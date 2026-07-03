// Home: friendly landing — start a new review or reopen a past one.

import { h, toast, download, pickFile, confirmDanger, promptDialog } from '../ui.js';
import * as store from '../store.js';
import { requestAutoStart } from './capture.js';
import { displayTitle } from '../lib/model.js';
import { friendlyDate } from '../lib/text.js';
import { sessionFilename } from '../lib/exports.js';
import { isAuthed, listServerSessions, fetchServerSession, isRemoteNewer } from '../lib/serverSync.js';

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

/**
 * Load the bundled example review and land on the findings board. Reused by the
 * "See an example" button and the `?demo` deep link (main.js boot).
 */
export async function loadExampleSession() {
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
  const title = displayTitle({ incident: { title: s.title }, createdAt: s.createdAt });
  // Signed in ⇒ this review likely has a brigade-shared cloud copy, so "delete"
  // is no longer one unambiguous action — split it (A3 hero review 2026-07-03,
  // AAR-1). Previously the single 🗑 button deleted the cloud copy too, with a
  // confirm that never mentioned the team; a member "tidying up their iPad"
  // could silently wipe the whole brigade's only copy.
  const signedIn = isAuthed();

  const removeLocalBtn = h('button', {
    class: 'icon-btn', title: signedIn ? 'Remove from this device' : 'Delete',
    'aria-label': signedIn ? `Remove "${title}" from this device` : `Delete "${title}"`,
    onclick: async () => {
      const confirmed = signedIn
        ? await confirmDanger(`Remove "${title}" from this device? Your brigade's shared copy (if any) is kept — this only clears it here.`, { confirmLabel: 'Remove' })
        : await confirmDanger(`Delete "${title}"? This can't be undone.`);
      if (!confirmed) return;
      store.deleteSessionLocal(s.id);
      toast(signedIn ? 'Removed from this device' : 'Review deleted');
    },
  }, '🗑');

  const deleteEverywhereBtn = signedIn
    ? h('button', {
        class: 'btn btn--small btn--danger', title: 'Delete for everyone',
        'aria-label': `Delete "${title}" for your whole brigade`,
        onclick: async () => {
          const confirmed = await confirmDanger(`Delete "${title}" for your whole brigade? This removes the shared copy — other devices will lose it too. This can't be undone.`, { confirmLabel: 'Delete for everyone' });
          if (!confirmed) return;
          store.deleteSessionEverywhere(s.id);
          toast('Review deleted for everyone');
        },
      }, 'Delete for everyone')
    : null;

  return h('article', { class: 'review-card', 'data-session-id': s.id, onclick: () => { store.openSession(s.id); location.hash = '#/board'; } },
    h('div', { class: 'review-card__body' },
      h('h3', { class: 'review-card__title' }, title),
      h('p', { class: 'review-card__meta' }, subtitle || 'No details yet'),
      h('p', { class: 'review-card__stat' }, stat),
    ),
    h('div', { class: 'review-card__actions', onclick: (e) => e.stopPropagation() },
      h('button', { class: 'icon-btn', title: 'Rename', 'aria-label': 'Rename', onclick: async () => {
        const name = await promptDialog('Name this review:', s.title || '');
        if (name != null) store.renameSession(s.id, name);
      } }, '✎'),
      h('button', { class: 'icon-btn', title: 'Save a copy', 'aria-label': 'Save a copy', onclick: () => {
        const session = store.openSession(s.id);
        download(sessionFilename(session, 'review', 'json'), store.exportSessionJson(session), 'application/json');
      } }, '⬇'),
      removeLocalBtn,
      deleteEverywhereBtn,
    ),
  );
}

/** Pull the server copy of a review onto this device and open it. */
async function openRemote(id, triggerEl) {
  const card = triggerEl?.closest('.review-card') ?? null;
  if (card) card.classList.add('review-card--loading');
  try {
    const session = await fetchServerSession(id);
    if (!session) throw new Error('Could not download this review');
    store.adoptSession(session); // overwrites any local copy with the cloud one
    location.hash = '#/board';
  } catch (err) {
    if (card) card.classList.remove('review-card--loading');
    toast(err.message || 'Could not open that review', 'error');
  }
}

/** A cloud review not yet on this device: tap to pull it down and open it. */
function cloudCard(s) {
  const subtitle = [friendlyDate(s.incidentDate || s.createdAt), s.createdByName].filter(Boolean).join(' · ');
  return h('article', { class: 'review-card review-card--cloud', 'data-session-id': s.id, onclick: (e) => openRemote(s.id, e.currentTarget) },
    h('div', { class: 'review-card__body' },
      h('h3', { class: 'review-card__title' }, displayTitle({ incident: { title: s.title }, createdAt: s.createdAt })),
      h('p', { class: 'review-card__meta' }, subtitle || 'From your team'),
      h('p', { class: 'review-card__stat' }, '☁ Tap to open on this device'),
    ),
  );
}

/**
 * Flag a local review card whose cloud copy is newer (edited on another device),
 * and add a "Load latest" action that pulls the server version over the local one.
 */
function markCardUpdated(container, summary) {
  const card = container.querySelector(`.review-card[data-session-id="${summary.id}"]`);
  if (!card || card.querySelector('.review-card__cloud-flag')) return;
  card.querySelector('.review-card__body')?.append(
    h('p', { class: 'review-card__cloud-flag' }, '☁ Newer version from your team'),
  );
  card.querySelector('.review-card__actions')?.prepend(
    h('button', {
      class: 'icon-btn', title: 'Load latest from your team', 'aria-label': 'Load latest from your team',
      onclick: (e) => openRemote(summary.id, e.currentTarget),
    }, '⟳'),
  );
}

/**
 * After the page renders, pull the org's cloud reviews (when signed in). Reviews
 * not on this device get a "From your team" section; reviews that exist locally
 * but were edited more recently elsewhere get a "newer version" flag on their
 * card. Additive and best-effort — failures leave the local-only view untouched.
 */
async function appendCloudReviews(container, localById) {
  if (!isAuthed()) return;
  const remote = await listServerSessions();
  const missing = [];
  for (const s of remote) {
    if (!localById.has(s.id)) { missing.push(s); continue; }
    if (isRemoteNewer(s, localById.get(s.id))) markCardUpdated(container, s);
  }
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
  const localById = new Map(sessions.map((s) => [s.id, s.updatedAt]));

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
      h('button', { class: 'link-btn', onclick: () => loadExampleSession().catch((e) => toast(e.message, 'error')) }, 'See an example'),
      h('span', { class: 'home-footer__sep' }, '·'),
      h('button', { class: 'link-btn', onclick: openSavedFile }, 'Open a saved review file'),
    ),
  );

  // Pull in brigade-shared reviews from the server (best-effort, additive).
  appendCloudReviews(container, localById).catch(() => {});
}
