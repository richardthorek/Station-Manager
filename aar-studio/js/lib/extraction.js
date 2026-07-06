// Finding extraction: prompts, JSON schema, chunking and the live trigger
// policy. The only impure part is the chatJson call.

import { chatJson } from './llm.js';
import { CATEGORIES, CATEGORY_IDS, GENERAL_PHASE, INCIDENT_TYPES, sessionPhases, createFinding } from './model.js';
import { countWords, fmtClock } from './text.js';

/**
 * Live auto-extraction policy. We deliberately do NOT extract on a fixed timer:
 * firing mid-discussion chops one topic into many tiny per-utterance findings.
 * Instead we wait for the discussion to *settle* — a pause of `quietMs` after
 * the last words, with at least `minWords` banked — so the model reads a whole
 * back-and-forth exchange and can synthesise it into a few consolidated
 * findings. `ceilingWords` is a safety valve: a long unbroken monologue that
 * never pauses still gets processed once the backlog is large, so it can't grow
 * without bound (AAR insight-quality rework 2026-07-04).
 */
export const TRIGGER = { quietMs: 15_000, minWords: 45, ceilingWords: 600 };

export function shouldAutoExtract({ msSinceWords, wordsPending }) {
  if (wordsPending >= TRIGGER.ceilingWords) return true;
  return wordsPending >= TRIGGER.minWords && msSinceWords >= TRIGGER.quietMs;
}

/**
 * Group consecutive segments into chunks of ~maxWords for one LLM call each,
 * breaking on phase boundaries so phase context stays coherent. The budget is
 * wide on purpose: one call should see a whole discussion arc (many speakers,
 * back-and-forth) so it can consolidate, not a narrow slice that forces
 * per-utterance findings (AAR insight-quality rework 2026-07-04).
 */
export function chunkSegments(segments, maxWords = 1400) {
  const chunks = [];
  let current = [];
  let words = 0;
  for (const seg of segments) {
    const w = countWords(seg.text);
    const phaseBreak = current.length && current[current.length - 1].phase !== seg.phase;
    if (current.length && (words + w > maxWords || phaseBreak)) {
      chunks.push(current);
      current = [];
      words = 0;
    }
    current.push(seg);
    words += w;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export function findingsSchema(phases) {
  return {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: CATEGORY_IDS },
            phase: { type: 'string', enum: phases },
            text: { type: 'string', description: 'One discrete finding, a single clear sentence or two.' },
            quote: { type: 'string', description: 'Short verbatim quote from the transcript supporting this finding.' },
            segmentIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['category', 'phase', 'text', 'quote', 'segmentIds'],
          additionalProperties: false,
        },
      },
    },
    required: ['findings'],
    additionalProperties: false,
  };
}

export function buildMessages({ session, segments }) {
  const phases = sessionPhases(session);
  const units = (session.units ?? []).map((u) => `${u.unit}${u.role ? ` (${u.role})` : ''}`).join(', ') || 'not recorded';
  const categories = CATEGORIES.map((c) => `- "${c.id}" = ${c.label}`).join('\n');
  const system = `You are the expert facilitator of a fire brigade After Action Review (AAR). You listen to the crew's debrief and surface the handful of findings that actually matter — like a seasoned captain summing up, not a stenographer. Your job is INSIGHT, not transcription.

Incident: ${session.incident.title || 'untitled'} — ${session.incident.type || 'unknown type'}, ${session.incident.date || 'date unknown'}, ${session.incident.location || 'location unknown'}.
Attending units: ${units}.
Incident phases discussed: ${phases.join(', ')}. "${GENERAL_PHASE}" is the bucket for anything not tied to one phase.

Classify every finding into exactly one category:
${categories}

CONSOLIDATE BY TOPIC, NOT BY SEGMENT — this is the most important rule. The text below is one stretch of discussion where several people talk back and forth, often about more than one topic. Do NOT emit a finding per sentence or per speaker — for each distinct topic (e.g. communications, size-up, staging/location, PPE, safety, logistics, incident management are usually separate topics even inside one continuous exchange), read everything said about that topic and combine it into ONE well-rounded finding. But do NOT collapse separate topics into a single finding just because they came up in the same breath: comms, size-up and staging location are three findings, not one, even when the same back-and-forth covers all three in a row. As a rough guide, a short debrief segment usually yields somewhere around 3–8 findings: far more than that is under-consolidated (restating near-duplicates), one or two findings covering a segment that clearly touched several distinct topics is over-consolidated (topics blurred together).

Transcript reality: this is usually a single room microphone with many speakers, so words are garbled. Fix obvious mis-hearings from context (e.g. "be a operators" → "BA operators"). Mark names or figures you are not sure of with "(unclear)". Keep Australian fire-service terminology exactly as used: BA, BACO, Cat 1, Cat 6, 38 mm, 65 mm, OCC, FRNSW, SCC, appliance, fireground, talkgroup.

Rules:
- Each finding is a genuine insight or outcome a brigade member could read cold and act on — a clear sentence or two synthesising the discussion, not a paraphrase of one utterance.
- Ignore small talk, jokes, scheduling chatter and the facilitator's process talk ("let's move on to suppression"). Silence is fine: if nothing of substance was decided or learned, return an empty array.
- Each transcript segment is prefixed with its id like [s12]. Every finding must list ALL the segment ids that contributed to it in segmentIds (a consolidated finding will usually cite several), and one short verbatim quote in quote that best captures it.
- Use the segments' tagged phase as a hint, but assign the phase the content is actually about.

Respond with a JSON object: {"findings": [{"category", "phase", "text", "quote", "segmentIds"}]}.`;

  const lines = segments.map((seg) => {
    const time = seg.t != null ? ` ${fmtClock(seg.t)}` : '';
    const speaker = seg.speaker ? ` ${seg.speaker}:` : '';
    return `[${seg.id}]${time} (${seg.phase})${speaker} ${seg.text}`;
  });
  const user = `Here is a stretch of the debrief. Read the whole thing, then give me the consolidated findings — one per distinct topic, each combining everything said about that topic, with separate topics kept as separate findings:\n\n${lines.join('\n')}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Map a raw model finding into a session finding, clamping bad values. */
export function toFinding(raw, session, segmentPool) {
  const phases = sessionPhases(session);
  const validIds = new Set(segmentPool.map((s) => s.id));
  return createFinding({
    category: CATEGORY_IDS.includes(raw.category) ? raw.category : 'happened',
    phase: phases.includes(raw.phase) ? raw.phase : GENERAL_PHASE,
    text: String(raw.text ?? '').trim(),
    quote: String(raw.quote ?? '').trim(),
    segmentIds: (Array.isArray(raw.segmentIds) ? raw.segmentIds : []).filter((id) => validIds.has(id)),
    source: 'ai',
  });
}

// --- Incident metadata, pulled from the discussion ---------------------------
// The friendly flow lets people just start recording; the AI then fills in the
// title / location / type / units from what's said, so they rarely have to type.

export function metadataSchema() {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short incident title, e.g. "Structure fire — 412 Macs Reef Road". "" if not stated.' },
      location: { type: 'string', description: 'Where the incident was. "" if not stated.' },
      incidentType: { type: 'string', enum: ['', ...INCIDENT_TYPES], description: 'Closest matching type, or "" if unclear.' },
      units: {
        type: 'array',
        description: 'Brigades / agencies that attended, with their role if mentioned.',
        items: {
          type: 'object',
          properties: { unit: { type: 'string' }, role: { type: 'string' } },
          required: ['unit', 'role'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'location', 'incidentType', 'units'],
    additionalProperties: false,
  };
}

export function buildMetadataMessages({ session, segments }) {
  const system = `You read the transcript of a fire brigade After Action Review and pull out the basic incident details that were mentioned.

Only report what is actually stated or clearly implied — never invent a title, location, units or type. Use "" (or an empty array) when something is not mentioned. Keep Australian fire-service terminology and unit names as spoken (e.g. "Wamboin", "Bungendore", "FRNSW", "Cat 1"). Mark anything you are unsure of with "(unclear)".

Respond with a JSON object: {"title", "location", "incidentType", "units": [{"unit", "role"}]}.`;
  const lines = segments.map((seg) => `${seg.speaker ? seg.speaker + ': ' : ''}${seg.text}`);
  const user = `From this debrief transcript, extract the incident details:\n\n${lines.join('\n')}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Build a non-destructive patch: only fields the user (or a previous pass) hasn't
 * already filled get the discussion-derived value. Returns { incident?, units? }
 * with just the keys that should change, or {} if nothing to apply.
 *
 * `location` is the one exception to "never overwrite": a still-`locationIsAuto`
 * value (raw GPS coordinates from quick-start, see store.js's setIncidentLocation)
 * is replaced by a real place name the moment the discussion reveals one — a
 * typed or previously-derived location is never touched (AAR Studio hero review
 * 2026-07-03, AAR-3).
 */
export function mergeMetadata(session, meta = {}) {
  const patch = {};
  const incident = {};
  if (meta.title?.trim() && !session.incident.title?.trim()) incident.title = meta.title.trim();
  if (meta.location?.trim() && (!session.incident.location?.trim() || session.incident.locationIsAuto)) {
    incident.location = meta.location.trim();
    incident.locationIsAuto = false;
  }
  if (meta.incidentType && INCIDENT_TYPES.includes(meta.incidentType) && !session.incident.type) incident.type = meta.incidentType;
  if (Object.keys(incident).length) patch.incident = incident;
  const units = (Array.isArray(meta.units) ? meta.units : [])
    .map((u) => ({ unit: String(u.unit ?? '').trim(), role: String(u.role ?? '').trim() }))
    .filter((u) => u.unit);
  if (units.length && !(session.units ?? []).length) patch.units = units;
  return patch;
}

/** Ask the model for the incident metadata mentioned across the transcript. */
export async function extractMetadata({ session, segments, settings, fetchImpl = globalThis.fetch }) {
  const usable = (segments ?? []).filter((s) => s.text.trim());
  if (!usable.length) return {};
  // One call over a representative slice (metadata is usually said up front).
  let words = 0;
  const slice = [];
  for (const seg of usable) {
    slice.push(seg);
    words += countWords(seg.text);
    if (words > 1200) break;
  }
  const result = await chatJson({
    settings,
    deployment: settings.llmDeployment,
    messages: buildMetadataMessages({ session, segments: slice }),
    schema: metadataSchema(),
    schemaName: 'aar_metadata',
    fetchImpl,
  });
  return result ?? {};
}

/**
 * Run extraction over `segments` in chunks. Returns the new findings
 * (not yet deduped). onProgress(done, total) fires per chunk.
 */
export async function extractFromSegments({ session, segments, settings, onProgress = () => {}, fetchImpl = globalThis.fetch }) {
  const usable = segments.filter((s) => s.text.trim());
  if (!usable.length) return [];
  const phases = sessionPhases(session);
  const schema = findingsSchema(phases);
  const chunks = chunkSegments(usable);
  const findings = [];
  let done = 0;
  for (const chunk of chunks) {
    const result = await chatJson({
      settings,
      deployment: settings.llmDeployment,
      messages: buildMessages({ session, segments: chunk }),
      schema,
      schemaName: 'aar_findings',
      fetchImpl,
    });
    for (const raw of result?.findings ?? []) {
      const f = toFinding(raw, session, usable);
      if (f.text) findings.push(f);
    }
    onProgress(++done, chunks.length);
  }
  return findings;
}
