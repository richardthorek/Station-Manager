// Shared AI analysis runner + the live auto-extraction counters.
// Used by the Capture view (manual/phase-change), the Board view, and the
// live listen controller (timer-driven).

import { toast } from './ui.js';
import * as store from './store.js';
import { getSettings } from './settings.js';
import { extractFromSegments, shouldAutoExtract } from './lib/extraction.js';
import { dedupeFindings } from './lib/dedupe.js';
import { LlmError } from './lib/llm.js';

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
 * Run extraction over all un-analysed segments.
 * quiet=true (auto passes) only toasts when something was found or failed.
 */
export async function analyseNow(statusEl = null, { quiet = false } = {}) {
  if (analysing) return;
  const session = store.getSession();
  if (!session) return;
  const pending = session.segments.filter((seg) => !seg.analysed && seg.text.trim());
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
      const ids = new Set(pending.map((seg) => seg.id));
      for (const seg of s.segments) if (ids.has(seg.id)) seg.analysed = true;
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
