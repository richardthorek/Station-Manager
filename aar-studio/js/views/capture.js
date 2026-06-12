// Capture: phase clicker, transcript ingest (paste path now; live audio
// arrives in Stage 4), segment list, AI analysis.

import { h, toast, confirmDanger } from '../ui.js';
import * as store from '../store.js';
import { getSettings } from '../settings.js';
import { sessionPhases, createSegment, speakerName, GENERAL_PHASE } from '../lib/model.js';
import { parseTranscript } from '../lib/transcriptParser.js';
import { extractFromSegments } from '../lib/extraction.js';
import { dedupeFindings } from '../lib/dedupe.js';
import { LlmError } from '../lib/llm.js';
import { fmtClock } from '../lib/text.js';

let analysing = false;

/** Run extraction over un-analysed segments; shared with the Board view. */
export async function analyseNow(statusEl) {
  if (analysing) return;
  const session = store.getSession();
  const pending = session.segments.filter((seg) => !seg.analysed && seg.text.trim());
  if (!pending.length) {
    toast('Nothing new to analyse — all segments are already processed');
    return;
  }
  analysing = true;
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
    toast(`${added.length} new finding(s)${skipped.length ? `, ${skipped.length} duplicate(s) skipped` : ''}`);
  } catch (err) {
    const hint = err instanceof LlmError && err.hint ? ` — ${err.hint}` : '';
    toast(`${err.message}${hint}`, 'error', 8000);
    setStatus('');
  } finally {
    analysing = false;
  }
}

function ingestPaste(textarea) {
  const raw = textarea.value;
  if (!raw.trim()) {
    toast('Paste a transcript first', 'error');
    return;
  }
  const { format, rows } = parseTranscript(raw);
  if (!rows.length) {
    toast('Could not find any transcript lines in the pasted text', 'error');
    return;
  }
  store.update((s) => {
    for (const row of rows) {
      s.segments.push(createSegment({ t: row.t, speaker: row.speaker, text: row.text, phase: GENERAL_PHASE, source: 'paste' }));
    }
  }, { reason: 'segments' });
  textarea.value = '';
  toast(`Added ${rows.length} segment(s) (detected format: ${format})`);
}

export function render(container) {
  const session = store.getSession();
  const phases = sessionPhases(session);
  const status = h('span', { class: 'muted' });

  const phaseButtons = h('div', { class: 'phase-clicker', role: 'group', 'aria-label': 'Current phase' },
    phases.map((p) => h('button', {
      class: `phase-btn${session.currentPhase === p ? ' phase-btn--active' : ''}`,
      onclick: () => {
        store.update((s) => { s.currentPhase = p; }, { reason: 'phase' });
        // Phase change is an extraction trigger.
        analyseNow(status);
      },
    }, p)),
  );

  const pasteBox = h('textarea', {
    class: 'paste-box',
    rows: 8,
    placeholder: 'Paste a Teams transcript here…\nSupported: the DOCX copy format ("Name   m:ss" then text), "Name: text" lines, or WEBVTT.',
  });

  const segments = session.segments;
  const segmentList = segments.length
    ? h('ol', { class: 'segments' }, segments.slice(-200).map((seg) => h('li', { class: 'segment' },
        h('span', { class: 'segment__meta' },
          seg.t != null ? h('span', { class: 'segment__time' }, fmtClock(seg.t)) : null,
          seg.speaker ? h('span', { class: 'segment__speaker' }, speakerName(session, seg.speaker)) : null,
          h('span', { class: `chip chip--phase` }, seg.phase),
          seg.analysed ? h('span', { class: 'chip chip--done', title: 'Included in an AI analysis pass' }, '✓ analysed') : null,
        ),
        h('span', { class: 'segment__text' }, seg.text),
      )))
    : h('p', { class: 'muted' }, 'No transcript yet. Paste one below, or wait for live audio capture (Stage 4).');

  container.append(
    h('h1', {}, 'Live capture'),
    h('section', { class: 'panel' },
      h('h2', {}, 'Current phase'),
      h('p', { class: 'muted' }, 'Click the phase as the room moves through it — new segments are tagged with it, and changing phase triggers an analysis pass.'),
      phaseButtons,
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Audio'),
      h('p', { class: 'muted' },
        'Room microphone, shared Teams tab audio and uploaded recordings land in Stage 4 (Azure AI Speech with diarization). Until then, use the transcript paste below — the AI analysis pipeline is identical.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', disabled: true, title: 'Coming in Stage 4' }, '🎙 Room microphone'),
        h('button', { class: 'btn', disabled: true, title: 'Coming in Stage 4' }, '🖥 Share Teams tab audio'),
        h('button', { class: 'btn', disabled: true, title: 'Coming in Stage 4' }, '📂 Upload audio file'),
      ),
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Paste a transcript'),
      pasteBox,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--primary', onclick: () => ingestPaste(pasteBox) }, 'Parse & add segments'),
        h('button', { class: 'btn', onclick: () => analyseNow(status) }, '✨ Analyse with AI now'),
        status,
      ),
    ),
    h('section', { class: 'panel' },
      h('h2', {}, `Transcript (${segments.length} segments)`),
      segmentList,
      segments.length ? h('div', { class: 'btn-row' },
        h('a', { class: 'btn btn--primary', href: '#/board' }, 'Open the live board →'),
        h('button', { class: 'btn btn--danger', onclick: () => {
          if (confirmDanger('Clear ALL transcript segments? Findings are kept.')) {
            store.update((s) => { s.segments = []; }, { reason: 'segments' });
          }
        } }, 'Clear transcript'),
      ) : null,
    ),
  );
}
