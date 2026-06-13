// Capture: live listen (mic / shared tab / file via Azure AI Speech),
// phase clicker, transcript paste ingest, segment list, AI analysis.

import { h, toast, confirmDanger, pickFile } from '../ui.js';
import * as store from '../store.js';
import { analyseNow } from '../analyse.js';
import * as live from '../audio/live.js';
import { sessionPhases, createSegment, speakerName, GENERAL_PHASE } from '../lib/model.js';
import { parseTranscript } from '../lib/transcriptParser.js';
import { fmtClock } from '../lib/text.js';

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

function audioPanel(status) {
  const ls = live.getState();
  const backupCheck = h('input', { type: 'checkbox', checked: true });

  const startBtn = (kind, onclick) => h('button', {
    class: 'btn btn--big',
    disabled: ls.status !== 'idle',
    onclick,
  }, `${live.SOURCES[kind].icon} ${live.SOURCES[kind].label}`);

  const idleControls = h('div', {},
    h('div', { class: 'btn-row' },
      startBtn('mic', () => live.start('mic', { backup: backupCheck.checked })),
      startBtn('display', () => live.start('display', { backup: backupCheck.checked })),
      startBtn('file', async () => {
        const file = await pickFile('audio/*');
        if (file) live.start('file', { file });
      }),
    ),
    h('label', { class: 'field field--check' }, backupCheck,
      h('span', {}, 'Keep a local backup recording (offered as a download when you stop)')),
    h('p', { class: 'muted' },
      'Room microphone is the primary mode — one mic, many speakers; diarization and language are set in ⚙ Settings. For a Teams meeting, share the meeting tab and tick “Share audio”.'),
  );

  // Live elements updated directly by the controller (no re-render per frame)
  const meterBar = h('div', { class: 'meter__bar' });
  const meter = h('div', { class: 'meter', title: 'Input level' }, meterBar);
  const elapsed = h('span', { class: 'live__elapsed' }, '0:00');
  const interimEl = h('div', { class: 'live__interim', 'aria-live': 'off' });
  const stateText = ls.status === 'starting' ? 'Connecting…'
    : ls.status === 'stopping' ? 'Stopping…'
    : `Listening — ${live.SOURCES[ls.source]?.label ?? ''}`;

  const liveControls = h('div', { class: 'live' },
    h('div', { class: 'live__row' },
      h('span', { class: 'live__dot', 'aria-hidden': 'true' }),
      h('span', { class: 'live__state' }, stateText),
      elapsed,
      meter,
      h('button', { class: 'btn btn--danger', disabled: ls.status !== 'listening', onclick: () => live.stop() }, '■ Stop listening'),
    ),
    interimEl,
    ls.recording ? h('p', { class: 'muted' }, '● Local backup recording in progress') : null,
  );

  const panel = h('section', { class: 'panel' },
    h('h2', {}, 'Live listen'),
    ls.status === 'idle' ? idleControls : liveControls,
    ls.recordingUrl && ls.status === 'idle'
      ? h('p', {}, h('a', { class: 'btn', href: ls.recordingUrl, download: ls.recordingName }, '⬇ Download backup recording'))
      : null,
    ls.error ? h('p', { class: 'live__error', role: 'alert' }, ls.error) : null,
  );

  // High-frequency updates touch the DOM directly; anything structural
  // (status flips, errors) re-renders the view, which rebuilds this panel
  // from live.getState() and re-registers this listener with fresh nodes.
  live.setUiListener((event, s) => {
    if (event === 'level') {
      meterBar.style.setProperty('--level', String(Math.min(1, s.level * 6)));
      if (s.startedAt) elapsed.textContent = fmtClock((Date.now() - s.startedAt) / 1000);
    } else if (event === 'interim') {
      interimEl.textContent = s.interim ? `${s.interimSpeaker ? s.interimSpeaker + ': ' : ''}${s.interim}…` : '';
    } else {
      store.update(() => {}, { reason: 'live' });
    }
  });

  return panel;
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
        analyseNow(status, { quiet: true });
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
    : h('p', { class: 'muted' }, 'No transcript yet. Start live listening above, or paste a transcript below.');

  container.append(
    h('h1', {}, 'Live capture'),
    h('section', { class: 'panel' },
      h('h2', {}, 'Current phase'),
      h('p', { class: 'muted' }, 'Click the phase as the room moves through it — new segments are tagged with it, and changing phase triggers an analysis pass.'),
      phaseButtons,
    ),
    audioPanel(status),
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

  // Auto-scroll the transcript to the latest segment while listening.
  if (live.getState().status === 'listening' && segments.length) {
    const list = container.querySelector('.segments');
    if (list) list.scrollTop = list.scrollHeight;
  }
}
