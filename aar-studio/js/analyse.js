// Shared AI analysis runner + the live auto-extraction counters.
// Used by the Capture view (manual/phase-change), the Board view, and the
// live listen controller (timer-driven).

import { toast } from './ui.js';
import * as store from './store.js';
import { getSettings } from './settings.js';
import { extractFromSegments, extractMetadata, mergeMetadata, shouldAutoExtract } from './lib/extraction.js';
import { dedupeFindings } from './lib/dedupe.js';
import { LlmError } from './lib/llm.js';
import { GENERAL_PHASE } from './lib/model.js';

let analysing = false;
let lastExtractAt = 0;
let pendingWords = 0;

export function isAnalysing() {
  return analysing;
}

/** Live capture reports newly transcribed words here. */
export function noteNewWords(n) {
  pendingWords += n;
}

/** Timer-driven check: run a pass when the 45 s / 70-word policy says so. */
export async function maybeAutoExtract() {
  if (analysing) return;
  if (!shouldAutoExtract({ msSinceLast: Date.now() - lastExtractAt, wordsPending: pendingWords })) return;
  await analyseNow(null, { quiet: true });
}

/**
 * Fill in blank incident details (title, location, type, units) from the
 * discussion. Non-destructive — never overwrites anything the user typed.
 * Quiet by default; toasts only when it actually fills something in.
 */
export async function fillMetadataFromDiscussion({ quiet = true } = {}) {
  const session = store.getSession();
  if (!session?.segments.some((seg) => seg.text.trim())) return;
  // Nothing left to fill? Skip the call.
  const blank = !session.incident.title?.trim() || !session.incident.location?.trim()
    || !session.incident.type || !(session.units ?? []).length;
  if (!blank) return;
  try {
    const meta = await extractMetadata({ session, segments: session.segments, settings: getSettings() });
    const patch = mergeMetadata(session, meta);
    if (!patch.incident && !patch.units) return;
    store.update((s) => {
      if (patch.incident) Object.assign(s.incident, patch.incident);
      if (patch.units) s.units = patch.units;
    }, { reason: 'session' });
    const filled = [
      patch.incident?.title && 'title',
      patch.incident?.location && 'location',
      patch.incident?.type && 'type',
      patch.units && 'units',
    ].filter(Boolean);
    if (filled.length) toast(`Filled in the ${filled.join(', ')} from the discussion`);
  } catch (err) {
    // Best-effort — a metadata miss shouldn't disrupt the review.
    if (!quiet) toast(`Couldn't read details from the discussion: ${err.message}`, 'error');
  }
}

/**
 * Run extraction over all un-analysed segments.
 * quiet=true (auto passes) only toasts when something was found or failed.
 */
export async function analyseNow(statusEl = null, { quiet = false } = {}) {
  if (analysing) return;
  const session = store.getSession();
  if (!session) return;
  const pendingSegs = session.segments.filter((seg) => !seg.analysed && seg.text.trim());
  const pendingNotes = (session.notes ?? []).filter((n) => !n.analysed && n.text.trim());
  // Room notes are fed to the AI as extra evidence, shaped like transcript
  // segments and clearly attributed so the model treats them as observations.
  const noteEvidence = pendingNotes.map((n) => ({
    id: n.id,
    t: n.t,
    speaker: `Room note${n.label && n.label !== 'Room' ? ` (${n.label})` : ''}`,
    text: n.text,
    phase: session.currentPhase ?? GENERAL_PHASE,
    source: 'note',
    analysed: false,
  }));
  const pending = [...pendingSegs, ...noteEvidence];
  if (!pending.length) {
    if (!quiet) toast('Nothing new to analyse — all segments are already processed');
    return;
  }
  analysing = true;
  lastExtractAt = Date.now();
  pendingWords = 0;
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
  try {
    setStatus(`Analysing ${pending.length} segment(s)…`);
    const found = await extractFromSegments({
      session,
      segments: pending,
      settings: getSettings(),
      onProgress: (done, total) => setStatus(`Analysing… chunk ${done}/${total}`),
    });
    const { added, skipped } = dedupeFindings(session.findings, found);
    store.update((s) => {
      s.findings.push(...added);
      const segIds = new Set(pendingSegs.map((seg) => seg.id));
      for (const seg of s.segments) if (segIds.has(seg.id)) seg.analysed = true;
      const noteIds = new Set(pendingNotes.map((n) => n.id));
      for (const n of (s.notes ?? [])) if (noteIds.has(n.id)) n.analysed = true;
    }, { reason: 'findings' });
    setStatus('');
    if (!quiet || added.length) {
      toast(`${added.length} new finding(s)${skipped.length ? `, ${skipped.length} duplicate(s) skipped` : ''}`);
    }
  } catch (err) {
    const hint = err instanceof LlmError && err.hint ? ` — ${err.hint}` : '';
    toast(`${err.message}${hint}`, 'error', 8000);
    setStatus('');
  } finally {
    analysing = false;
  }
}
