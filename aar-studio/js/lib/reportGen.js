// AI report generation: turn the curated findings (plus session context)
// into the full report structure. Uses the optional report deployment when
// configured, falling back to the live-extraction deployment.

import { chatJson } from './llm.js';
import { CATEGORIES, sessionPhases, GENERAL_PHASE } from './model.js';
import { emptyReport } from './exports.js';

export function reportSchema(phases) {
  const str = { type: 'string' };
  const strArr = { type: 'array', items: str };
  return {
    type: 'object',
    properties: {
      headline: { ...str, description: 'Incident title for the report header' },
      contextBar: { ...str, description: 'One line on the property/context, shown on the red bar' },
      stats: {
        type: 'array',
        description: '4-6 key figures',
        items: {
          type: 'object',
          properties: { value: str, label: str },
          required: ['value', 'label'],
          additionalProperties: false,
        },
      },
      snapshot: { ...strArr, description: '1-2 short narrative paragraphs describing the incident' },
      phases: {
        type: 'array',
        description: 'One entry per incident phase, in order',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: phases },
            happened: { ...str, description: 'Short narrative of what happened in this phase' },
            well: { ...strArr, description: 'What went well — bullet sentences' },
            didnt: { ...strArr, description: "What didn't go well / lessons — bullet sentences" },
          },
          required: ['name', 'happened', 'well', 'didnt'],
          additionalProperties: false,
        },
      },
      themes: {
        type: 'array',
        description: '0-3 cross-cutting theme sections',
        items: {
          type: 'object',
          properties: { title: str, body: str },
          required: ['title', 'body'],
          additionalProperties: false,
        },
      },
      recommendations: { ...strArr, description: 'Consolidated recommendations, most important first' },
      actions: { ...strArr, description: 'Exactly the top 3 actions' },
      assessment: { ...str, description: 'Overall assessment paragraph' },
      caveat: { ...str, description: 'Verification caveat for the footer' },
    },
    required: ['headline', 'contextBar', 'stats', 'snapshot', 'phases', 'themes', 'recommendations', 'actions', 'assessment', 'caveat'],
    additionalProperties: false,
  };
}

export function buildReportMessages(session) {
  const phases = sessionPhases(session);
  const units = (session.units ?? []).map((u) => `- ${u.unit}: ${u.role}`).join('\n') || '- not recorded';
  const findingLines = (session.findings ?? []).map((f) => {
    const cat = CATEGORIES.find((c) => c.id === f.category)?.label ?? f.category;
    const quote = f.quote ? ` (quote: "${f.quote}")` : '';
    return `- [${f.phase} | ${cat}] ${f.text}${quote}`;
  }).join('\n');

  const system = `You write the After Action Review report for a fire brigade incident, working from the curated findings of the AAR meeting.

Audience: brigade members and district staff. Tone: plain, direct, operational — no corporate filler. Keep Australian fire-service terminology exactly as used (BA, BACO, Cat 1, Cat 6, 38 mm, 65 mm, OCC, FRNSW, SCC, appliance, fireground). Keep "(unclear)" markers from findings — do not invent specifics to replace them.

Produce a JSON report with this structure and style:
- headline: the incident title, tightened if needed.
- contextBar: one line describing the property/context and key constraints.
- stats: 4-6 punchy figures drawn ONLY from the findings (value like "8" or "~1000", short uppercase-friendly label). Include "0 injuries"-style stats only if supported by the findings.
- snapshot: 1-2 paragraphs telling the incident story.
- phases: one entry per phase, in this order: ${phases.join(', ')}. Each has a short "happened" narrative plus "well" and "didnt" bullet lists. Write bullets as "Bold lead. Supporting detail." — a 3-8 word lead sentence, then the detail. Use the ${GENERAL_PHASE} entry for material not tied to one phase; leave fields empty if a phase genuinely has nothing.
- themes: 0-3 cross-cutting sections (e.g. logistics aftermath) for material that spans phases; empty array if none warranted.
- recommendations: consolidated, deduplicated, most important first, each actionable.
- actions: exactly the top 3 actions, each one sentence, imperative.
- assessment: an honest overall paragraph — what the job says about the brigades, and the single most important lesson.
- caveat: a verification footer noting the source (AAR meeting transcript) and that names/callsigns/figures should be verified before wider distribution.

Base everything on the findings. Do not introduce facts that are not in them.`;

  const user = `Incident: ${session.incident.title || 'untitled'}
Type: ${session.incident.type || 'unknown'} | Date: ${session.incident.date || 'unknown'} | Location: ${session.incident.location || 'unknown'}
AAR: ${session.aar.date || 'date unknown'}${session.aar.location ? `, ${session.aar.location}` : ''}${session.aar.facilitator ? ` (facilitator: ${session.aar.facilitator})` : ''}

Attending units:
${units}

Findings (${session.findings?.length ?? 0}):
${findingLines || '- none recorded'}

Write the report JSON now.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Clamp/align a raw model report onto the session's report shape. */
export function normaliseReport(raw, session) {
  const base = emptyReport(session);
  const r = raw && typeof raw === 'object' ? raw : {};
  const str = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
  const strArr = (v) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);

  const byName = new Map((Array.isArray(r.phases) ? r.phases : []).map((p) => [p?.name, p]));
  // Keep the session's phase order; include a General entry only if the model
  // put something in it.
  const phases = base.phases.map((p) => {
    const m = byName.get(p.name) ?? {};
    return { name: p.name, happened: str(m.happened), well: strArr(m.well), didnt: strArr(m.didnt) };
  });
  const general = byName.get(GENERAL_PHASE);
  if (general && (str(general.happened) || strArr(general.well).length || strArr(general.didnt).length)) {
    phases.push({ name: GENERAL_PHASE, happened: str(general.happened), well: strArr(general.well), didnt: strArr(general.didnt) });
  }

  const actions = strArr(r.actions).slice(0, 3);
  while (actions.length < 3) actions.push('');

  return {
    headline: str(r.headline, base.headline),
    contextBar: str(r.contextBar),
    stats: (Array.isArray(r.stats) ? r.stats : [])
      .map((s) => ({ value: str(s?.value), label: str(s?.label) }))
      .filter((s) => s.value || s.label)
      .slice(0, 6),
    snapshot: strArr(r.snapshot),
    phases,
    themes: (Array.isArray(r.themes) ? r.themes : [])
      .map((t) => ({ title: str(t?.title), body: str(t?.body) }))
      .filter((t) => t.title || t.body)
      .slice(0, 3),
    recommendations: strArr(r.recommendations),
    actions,
    assessment: str(r.assessment),
    caveat: str(r.caveat, base.caveat),
  };
}

/** Generate the report from the session's findings. Returns a report object. */
export async function generateReport({ session, settings, fetchImpl = globalThis.fetch }) {
  if (!session.findings?.length) {
    throw new Error('No findings to build a report from — run the AI analysis (or add findings) first');
  }
  const raw = await chatJson({
    settings,
    deployment: settings.reportDeployment || settings.llmDeployment,
    kind: 'report',
    messages: buildReportMessages(session),
    schema: reportSchema(sessionPhases(session)),
    schemaName: 'aar_report',
    fetchImpl,
  });
  return normaliseReport(raw, session);
}
