// Capture: just listen. Live transcription + automatic finding extraction —
// no phase clicking, no manual "analyse". The room talks; findings appear.

import { h, toast, confirmDanger, pickFile, mount } from '../ui.js';
import * as store from '../store.js';
import { analyseNow, getPersistentError, dismissPersistentError } from '../analyse.js';
import * as live from '../audio/live.js';
import { createSegment, createNote, speakerName, displayTitle, GENERAL_PHASE } from '../lib/model.js';
import { parseTranscript } from '../lib/transcriptParser.js';
import { fmtClock } from '../lib/text.js';
import { codeForSession, joinUrl, hostSession } from '../lib/collab.js';

// Host the room-notes relay once per session id (survives capture re-renders).
let hostedCode = null;
function ensureHosting(session) {
  const code = codeForSession(session.id);
  if (hostedCode === code) return code;
  hostedCode = code;
  hostSession(code, {
    onNote: (note) => {
      const ls = live.getState();
      const t = ls.status === 'listening' && ls.startedAt
        ? Math.round((Date.now() - ls.startedAt) / 1000)
        : (typeof note.offsetSec === 'number' ? note.offsetSec : null);
      store.update((s) => {
        (s.notes ??= []).push(createNote({ text: note.text, label: note.label, t }));
      }, { reason: 'session' });
      toast(`Room note from ${note.label}`);
    },
  }).catch(() => { hostedCode = null; });
  return code;
}

function roomNotesPanel() {
  const session = store.getSession();
  const code = ensureHosting(session);
  const url = joinUrl(code);
  const notes = session.notes ?? [];

  const copyBtn = h('button', {
    class: 'btn btn--small',
    onclick: async () => {
      try { await navigator.clipboard?.writeText(url); toast('Join link copied'); }
      catch { toast('Copy failed — share the code instead', 'error'); }
    },
  }, 'Copy join link');

  return h('details', { class: 'panel room-notes', open: notes.length > 0 },
    h('summary', {}, `Room notes${notes.length ? ` (${notes.length})` : ''}`),
    h('p', { class: 'muted' }, 'Let the whole room chip in. Anyone can add notes from their phone — they’re timed to the discussion and feed the findings.'),
    h('div', { class: 'room-notes__share' },
      h('span', { class: 'room-notes__code', title: 'Session join code' }, code),
      copyBtn,
    ),
    h('p', { class: 'muted room-notes__url' }, url),
    notes.length
      ? h('ul', { class: 'room-notes__list' }, notes.slice().reverse().map((n) => h('li', { class: 'room-note' },
          h('span', { class: 'room-note__meta' },
            h('span', { class: 'room-note__label' }, n.label || 'Room'),
            n.t != null ? h('span', { class: 'room-note__time' }, fmtClock(n.t)) : null,
          ),
          h('span', { class: 'room-note__text' }, n.text),
        )))
      : h('p', { class: 'muted' }, 'No room notes yet — share the link above to invite the room.'),
  );
}

/**
 * A latched 401/402/403 from auto-extraction (AAR-10): a single dismissible
 * banner instead of an identical toast every 45s for the rest of the meeting.
 * Dismissing lets the next auto-extract pass try again.
 */
function aiErrorBanner() {
  const err = getPersistentError();
  if (!err) return null;
  return h('div', { class: 'ai-error-banner', role: 'alert' },
    h('span', {}, `${err.message}${err.hint ? ` — ${err.hint}` : ''}`),
    h('button', { class: 'btn btn--small', onclick: () => { dismissPersistentError(); store.update(() => {}, { reason: 'live' }); } }, 'Dismiss'),
  );
}

// Quick kick-off asks Capture to start a source as soon as it mounts.
let pendingAutoStart = null;
export function requestAutoStart(kind = 'mic') { pendingAutoStart = kind; }

function ingestPaste(textarea) {
  const session = store.getSession();
  if (session.isDemo) {
    toast('This is a sample demo — you can’t add new content. Try opening a new review.', 'error');
    return;
  }
  const raw = textarea.value;
  if (!raw.trim()) {
    toast('Paste a transcript first', 'error');
    return;
  }
  const { format, rows } = parseTranscript(raw);
  if (!rows.length) {
    toast('Couldn’t find any conversation in that text', 'error');
    return;
  }
  store.update((s) => {
    for (const row of rows) {
      s.segments.push(createSegment({ t: row.t, speaker: row.speaker, text: row.text, phase: GENERAL_PHASE, source: 'paste' }));
    }
  }, { reason: 'segments' });
  textarea.value = '';
  toast(`Added ${rows.length} line(s) (${format})`);
  analyseNow(null, { quiet: true });
}

function audioPanel() {
  const session = store.getSession();
  const ls = live.getState();
  const findingCount = session.findings.length;

  const startBtn = (kind, primary = false) => h('button', {
    class: `btn ${primary ? 'btn--primary btn--hero' : 'btn--big'}`,
    disabled: ls.status !== 'idle' || session.isDemo,
    title: session.isDemo ? 'Recording is disabled in the sample demo' : '',
    onclick: kind === 'file'
      ? async () => { const file = await pickFile('audio/*'); if (file) live.start('file', { file }); }
      : () => live.start(kind, { backup: true }),
  }, `${live.SOURCES[kind].icon} ${kind === 'mic' ? 'Start recording the room' : live.SOURCES[kind].label}`);

  // "Shared tab / system audio" needs getDisplayMedia, which iPad Safari
  // doesn't expose — showing the button there just fails after the tap, so
  // hide it on unsupported platforms (AAR Studio hero review 2026-07-03, AAR-14).
  const canShareTab = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
  const idleControls = h('div', {},
    h('div', { class: 'capture-start' }, startBtn('mic', true)),
    h('details', { class: 'more-ways' },
      h('summary', {}, 'Other ways to capture'),
      h('div', { class: 'btn-row' }, canShareTab ? startBtn('display') : null, startBtn('file')),
      h('p', { class: 'muted' }, canShareTab
        ? 'Share a Teams meeting tab (tick “Share audio”), or upload a recording you already have. Diarisation and language live in ⚙ Settings.'
        : 'Upload a recording you already have. (Sharing a meeting tab’s audio isn’t supported on this device.) Diarisation and language live in ⚙ Settings.'),
    ),
  );

  // Live elements updated directly by the controller (no re-render per frame).
  // The waveform is a rolling history of real input levels — the room can see
  // the app hearing them, not just a single meter bar.
  const WAVE_BARS = 24;
  const waveBars = Array.from({ length: WAVE_BARS }, () => h('span', { class: 'wave__bar' }));
  const wave = h('div', { class: 'wave', title: 'Input level', 'aria-hidden': 'true' }, ...waveBars);
  const waveLevels = new Array(WAVE_BARS).fill(0);
  const elapsed = h('span', { class: 'live__elapsed' }, '0:00');
  const interimEl = h('div', { class: 'live__interim', 'aria-live': 'off' });
  const stateText = ls.status === 'starting' ? 'Connecting…'
    : ls.status === 'stopping' ? 'Wrapping up…'
    : ls.status === 'reconnecting' ? 'Connection interrupted — reconnecting…'
    : 'Listening — talk naturally';

  const liveControls = h('div', { class: 'live' },
    h('div', { class: 'live__row' },
      h('span', { class: `live__dot${ls.status === 'reconnecting' ? ' live__dot--reconnecting' : ''}`, 'aria-hidden': 'true' }),
      h('span', { class: 'live__state' }, stateText),
      elapsed,
      wave,
      h('button', { class: 'btn btn--primary', disabled: ls.status !== 'listening' && ls.status !== 'reconnecting', onclick: () => live.stop() }, '■ Stop & see findings'),
    ),
    h('p', { class: 'live__progress muted' }, findingCount
      ? `${findingCount} finding${findingCount === 1 ? '' : 's'} so far — they keep appearing as you talk.`
      : 'Findings appear automatically once there’s enough to go on.'),
    interimEl,
    ls.recording ? h('p', { class: 'muted' }, '● Keeping a local backup recording') : null,
  );

  const panel = h('section', { class: 'panel panel--capture' },
    ls.status === 'idle' ? idleControls : liveControls,
    ls.recordingUrl && ls.status === 'idle'
      ? h('p', {}, h('a', { class: 'btn', href: ls.recordingUrl, download: ls.recordingName }, '⬇ Download backup recording'))
      : null,
    // Suppress the raw error line while a reconnect is in flight — the amber
    // "reconnecting…" status above already says enough without an alarming
    // red alert for what's usually a transient, self-healing blip.
    ls.error && ls.status !== 'reconnecting' ? h('p', { class: 'live__error', role: 'alert' }, ls.error) : null,
  );

  live.setUiListener((event, s) => {
    if (event === 'level') {
      // Shift the rolling level history left and paint the newest level on
      // the right — direct style writes, no re-render per audio frame.
      waveLevels.shift();
      waveLevels.push(Math.min(1, s.level * 6));
      for (let i = 0; i < WAVE_BARS; i++) {
        waveBars[i].style.setProperty('--l', waveLevels[i].toFixed(3));
      }
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
  const ls = live.getState();

  // Quick kick-off (or a fresh return) asked us to start a source automatically.
  if (pendingAutoStart && ls.status === 'idle') {
    const kind = pendingAutoStart;
    pendingAutoStart = null;
    live.start(kind, { backup: true });
  }

  const segments = session.segments;
  const transcript = segments.length
    ? h('ol', { class: 'segments' }, segments.slice(-200).map((seg) => h('li', { class: 'segment' },
        h('span', { class: 'segment__meta' },
          seg.t != null ? h('span', { class: 'segment__time' }, fmtClock(seg.t)) : null,
          seg.speaker ? h('span', { class: 'segment__speaker' }, speakerName(session, seg.speaker)) : null,
        ),
        h('span', { class: 'segment__text' }, seg.text),
      )))
    : h('p', { class: 'muted' }, 'Nothing captured yet. Start recording above — what’s said appears here.');

  mount(container,
    h('div', { class: 'capture-head' },
      h('h1', {}, displayTitle(session)),
      h('a', { class: 'btn', href: '#/board' }, session.findings.length ? `See findings (${session.findings.length}) →` : 'Findings →'),
    ),
    aiErrorBanner(),
    audioPanel(),
    roomNotesPanel(),
    h('section', { class: 'panel' },
      h('h2', {}, `What was said${segments.length ? ` (${segments.length})` : ''}`),
      transcript,
      segments.length ? h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn--small', title: 'Re-check for findings now', onclick: () => analyseNow(null) }, '↻ Update findings now'),
        h('button', { class: 'btn btn--small btn--danger', onclick: async () => {
          if (await confirmDanger('Clear everything that was captured? Findings are kept.', { confirmLabel: 'Clear' })) {
            store.update((s) => { s.segments = []; }, { reason: 'segments' });
          }
        } }, 'Clear transcript'),
      ) : null,
    ),
    h('details', { class: 'paste-section' },
      h('summary', {}, 'Add a typed or pasted transcript instead'),
      h('p', { class: 'muted' }, 'Already have a Teams transcript? Paste it here (the copied chat, “Name: text” lines, or a WEBVTT file).'),
      (() => {
        const pasteBox = h('textarea', { class: 'paste-box', rows: 6, placeholder: 'Paste a transcript here…' });
        return h('div', {},
          pasteBox,
          h('button', { class: 'btn btn--primary', onclick: () => ingestPaste(pasteBox) }, 'Add this transcript'),
        );
      })(),
    ),
  );

  // Auto-scroll the transcript to the latest line while listening.
  if (ls.status === 'listening' && segments.length) {
    const list = container.querySelector('.segments');
    if (list) list.scrollTop = list.scrollHeight;
  }
}
