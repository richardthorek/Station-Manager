// Participant "add a note" page. Opened from a join link on a phone — no
// account, no install, no session needed. Big text box, one-tap send.

import { h, clear, toast } from '../ui.js';
import { joinSession, sendNote, onConnectionChange } from '../lib/collab.js';

const LABEL_KEY = 'aarstudio.noteLabel';
const CONNECTED_MSG = '● Connected — add as many notes as you like.';

// Drop any prior connection listener when the join page re-renders, so status
// updates don't stack up (AAR-13).
let unsubscribeConnection = null;

/** Parse the join code from a #/join/CODE hash. */
export function codeFromHash(hash = location.hash) {
  const m = String(hash).match(/^#\/join\/([A-Za-z0-9-]+)/);
  return m ? m[1].toUpperCase() : '';
}

export function render(container) {
  clear(container);
  const code = codeFromHash();

  if (!code) {
    container.append(h('section', { class: 'panel join' },
      h('h1', {}, 'Join a review'),
      h('p', { class: 'muted' }, 'This link is missing its session code. Ask the facilitator for the join link or code.'),
    ));
    return;
  }

  const status = h('p', { class: 'muted join__status' }, 'Connecting…');
  const nameInput = h('input', { type: 'text', placeholder: 'Your name (optional)', value: localStorage.getItem(LABEL_KEY) || '', autocomplete: 'name' });
  const textArea = h('textarea', { class: 'join__text', rows: 5, placeholder: 'Type what you noticed…', 'aria-label': 'Your note' });

  let sending = false;
  const send = async () => {
    const text = textArea.value.trim();
    if (!text || sending) return;
    sending = true;
    sendBtn.disabled = true;
    const label = nameInput.value.trim();
    if (label) localStorage.setItem(LABEL_KEY, label);
    try {
      await sendNote({ code, text, label });
      textArea.value = '';
      toast('Note sent to the review');
    } catch (err) {
      toast(`Couldn’t send: ${err.message}`, 'error');
    } finally {
      sending = false;
      sendBtn.disabled = false;
      textArea.focus();
    }
  };
  const sendBtn = h('button', { class: 'btn btn--primary btn--hero', onclick: send }, 'Send note');

  container.append(h('section', { class: 'panel join' },
    h('h1', {}, 'Add a note to the review'),
    h('p', { class: 'muted' }, `Session ${code}. Your notes appear on the facilitator’s board, timed to the discussion.`),
    h('label', { class: 'field' },
      h('span', { class: 'field__label' }, 'Your name (optional)'),
      nameInput,
    ),
    h('label', { class: 'field' },
      h('span', { class: 'field__label' }, 'Your note'),
      textArea,
    ),
    h('div', { class: 'btn-row' }, sendBtn),
    status,
  ));

  joinSession(code, nameInput.value.trim())
    .then(() => { status.textContent = CONNECTED_MSG; })
    .catch((err) => { status.textContent = `Couldn’t connect: ${err.message}`; });

  // Keep the status honest as the socket drops/reconnects (a slept phone used
  // to keep showing "Connected"). The AAR-7 re-join on 'connect' restores room
  // membership, so notes flow again once we're back (AAR-13).
  unsubscribeConnection?.();
  onConnectionChange((connected) => {
    status.textContent = connected
      ? CONNECTED_MSG
      : '○ Offline — reconnecting. Your notes will send once you’re back.';
  }).then((unsub) => { unsubscribeConnection = unsub; }).catch(() => {});
}
