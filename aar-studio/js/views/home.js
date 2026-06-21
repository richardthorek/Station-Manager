// Home: friendly landing — start a new review or reopen a past one.

import { h, toast, download, pickFile, confirmDanger } from '../ui.js';
import * as store from '../store.js';
import { requestAutoStart } from './capture.js';
import { displayTitle } from '../lib/model.js';
import { friendlyDate } from '../lib/text.js';
import { sessionFilename } from '../lib/exports.js';
import { isAuthed, listServerSessions, fetchServerSession } from '../lib/serverSync.js';

// Quick kick-off: blank review with today's date, jump to capture, start the mic.
function startRecordingNow() {
  store.quickStart();
  // Best-effort device location; the AI fills a named location from the talk later.
  navigator.geolocation?.getCurrentPosition(
    (pos) => store.setIncidentLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
    () => {},
    { timeout: 5000, maximumAge: 600000 },
  );
  requestAutoStart('mic');
  location.hash = '#/capture';
}

function setUpFirst() {
  store.newSession();
  location.hash = '#/setup';
}

async function loadExample() {
  const res = await fetch('./data/sample-session.json');
  if (!res.ok) throw new Error(`Example not available (${res.status})`);
  store.importSessionJson(await res.text());
  location.hash = '#/board';
  toast('Loaded an example review — have a look around');
}

async function openSavedFile() {
  const file = await pickFile('application/json,.json');
  if (!file) return;
  try {
    store.importSessionJson(await file.text());
    location.hash = '#/board';
    toast('Review opened');
  } catch (err) {
    toast(`Couldn't open that file: ${err.message}`, 'error');
  }
}

function reviewCard(s) {
  const subtitle = [friendlyDate(s.incidentDate || s.createdAt), s.location].filter(Boolean).join(' · ');
  const stat = s.findings
    ? `${s.findings} finding${s.findings === 1 ? '' : 's'}`
    : (s.segments ? 'recorded, not yet summarised' : 'empty');
  return h('article', { class: 'review-card', onclick: () => { store.openSession(s.id); location.hash = '#/board'; } },
    h('div', { class: 'review-card__body' },
      h('h3', { class: 'review-card__title' }, displayTitle({ incident: { title: s.title }, createdAt: s.createdAt })),
      h('p', { class: 'review-card__meta' }, subtitle || 'No details yet'),
      h('p', { class: 'review-card__stat' }, stat),
    ),
    h('div', { class: 'review-card__actions', onclick: (e) => e.stopPropagation() },
      h('button', { class: 'icon-btn', title: 'Rename', 'aria-label': 'Rename', onclick: () => {
        const name = prompt('Name this review:', s.title || '');
        if (name != null) store.renameSession(s.id, name.trim());
      } }, '✎'),
      h('button', { class: 'icon-btn', title: 'Save a copy', 'aria-label': 'Save a copy', onclick: () => {
        const session = store.openSession(s.id);
        download(sessionFilename(session, 'review', 'json'), store.exportSessionJson(session), 'application/json');
      } }, '⬇'),
      h('button', { class: 'icon-btn icon-btn--danger', title: 'Delete', 'aria-label': 'Delete', onclick: () => {
        if (confirmDanger(`Delete "${displayTitle({ incident: { title: s.title }, createdAt: s.createdAt })}"? This can't be undone.`)) {
          store.deleteSession(s.id);
          toast('Review deleted');
        }
      } }, '🗑'),
    ),
  );
}

/** A cloud review not yet on this device: tap to pull it down and open it. */
function cloudCard(s) {
  const subtitle = [friendlyDate(s.incidentDate || s.createdAt), s.createdByName].filter(Boolean).join(' · ');
  const open = async () => {
    try {
      const session = await fetchServerSession(s.id);
      if (!session) throw new Error('Could not download this review');
      store.adoptSession(session);
      location.hash = '#/board';
    } catch (err) {
      toast(err.message || 'Could not open that review', 'error');
    }
  };
  return h('article', { class: 'review-card review-card--cloud', onclick: open },
    h('div', { class: 'review-card__body' },
      h('h3', { class: 'review-card__title' }, displayTitle({ incident: { title: s.title }, createdAt: s.createdAt })),
      h('p', { class: 'review-card__meta' }, subtitle || 'From your team'),
      h('p', { class: 'review-card__stat' }, '☁ Tap to open on this device'),
    ),
  );
}

/**
 * After the page renders, pull the org's cloud reviews (when signed in) and show
 * any that aren't already on this device in a "From your team" section. Additive
 * and best-effort — failures leave the local-only view untouched.
 */
async function appendCloudReviews(container, localIds) {
  if (!isAuthed()) return;
  const remote = await listServerSessions();
  const missing = remote.filter((s) => !localIds.has(s.id));
  if (!missing.length) return;
  container.append(
    h('section', { class: 'reviews reviews--cloud' },
      h('h2', {}, 'From your team'),
      h('p', { class: 'muted' }, 'Reviews saved to your brigade’s account on another device.'),
      h('div', { class: 'review-grid' }, missing.map(cloudCard)),
    ),
  );
}

export function render(container) {
  const sessions = store.listSessions();
  const localIds = new Set(sessions.map((s) => s.id));

  container.append(
    h('section', { class: 'hero hero--home' },
      h('h1', {}, 'After Action Reviews, made easy'),
      h('p', {}, 'Record your crew’s debrief and get a clear write-up — who attended, what happened, what went well, and what to do next time. Just talk; the app does the rest.'),
      h('div', { class: 'hero__actions' },
        h('button', { class: 'btn btn--primary btn--hero', onclick: startRecordingNow }, '🎙 Start recording now'),
        h('button', { class: 'btn btn--big', onclick: setUpFirst }, 'Set up a review first'),
      ),
      h('p', { class: 'hero__hint' }, 'No setup needed — start talking and the title, location and crews are picked up from the conversation. You can edit anything afterwards.'),
    ),
    h('section', { class: 'reviews' },
      h('h2', {}, 'Your reviews'),
      sessions.length
        ? h('div', { class: 'review-grid' }, sessions.map(reviewCard))
        : h('p', { class: 'muted' }, 'No reviews yet. Hit “Start recording now” at the end of your next job.'),
    ),
    h('section', { class: 'home-footer' },
      h('button', { class: 'link-btn', onclick: () => loadExample().catch((e) => toast(e.message, 'error')) }, 'See an example'),
      h('span', { class: 'home-footer__sep' }, '·'),
      h('button', { class: 'link-btn', onclick: openSavedFile }, 'Open a saved review file'),
    ),
  );

  // Pull in brigade-shared reviews from the server (best-effort, additive).
  appendCloudReviews(container, localIds).catch(() => {});
}
