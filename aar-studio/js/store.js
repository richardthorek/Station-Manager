// Current-session store: one localStorage key per session, autosave on every
// mutation, tiny pub/sub so views can re-render on structural changes.

import { createSession, normaliseSession } from './lib/model.js';
import { toDateInput } from './lib/text.js';
import { isAuthed, pushSession, deleteServerSession } from './lib/serverSync.js';

const SESSION_PREFIX = 'aarstudio.session.';
const LAST_KEY = 'aarstudio.lastSession';
const CLOUD_BACKUP_DELAY_MS = 4000;

let current = null;
const listeners = new Set();
let cloudBackupTimer = null;

/**
 * Mirror the current session to the server, debounced, when signed in. Saves
 * happen on every edit (incl. per-keystroke), so we coalesce them into one PUT a
 * few seconds after activity settles. Best-effort: failures never surface.
 */
function scheduleCloudBackup() {
  if (!current || !isAuthed()) return;
  const session = current;
  clearTimeout(cloudBackupTimer);
  cloudBackupTimer = setTimeout(() => { pushSession(session).catch(() => {}); }, CLOUD_BACKUP_DELAY_MS);
}

export function getSession() {
  return current;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(reason) {
  for (const fn of listeners) fn(reason);
}

function persist() {
  if (!current) return;
  current.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(SESSION_PREFIX + current.id, JSON.stringify(current));
    localStorage.setItem(LAST_KEY, current.id);
    scheduleCloudBackup();
  } catch (err) {
    console.error('autosave failed', err);
    notify('save-error');
  }
}

/**
 * Mutate the current session and autosave.
 * silent=true skips re-render notification (use for per-keystroke field
 * edits where the input is already the source of truth on screen).
 */
export function update(mutator, { silent = false, reason = 'session' } = {}) {
  if (!current) return;
  mutator(current);
  persist();
  if (!silent) notify(reason);
}

export function newSession() {
  current = createSession();
  persist();
  notify('session-loaded');
  return current;
}

/**
 * Start a review with the least possible friction: today's date pre-set, the
 * title/location/units left blank so the AI can fill them from the discussion.
 * The caller jumps straight to capture and starts the mic.
 */
export function quickStart() {
  const today = toDateInput(new Date());
  current = createSession({
    incident: { title: '', date: today, location: '', type: '' },
    aar: { date: today, location: '', facilitator: '' },
  });
  persist();
  notify('session-loaded');
  return current;
}

/**
 * Best-effort device location (e.g. from geolocation) — never overwrites a
 * real location (typed or discussion-derived), only a still-auto one. Marks
 * the value `locationIsAuto` so a later AI metadata pass can still replace
 * these raw coordinates with the actual place name once it's mentioned
 * (AAR Studio hero review 2026-07-03, AAR-3).
 */
export function setIncidentLocation(location) {
  if (!current || !location) return;
  if (current.incident.location?.trim() && !current.incident.locationIsAuto) return;
  update((s) => { s.incident.location = location; s.incident.locationIsAuto = true; }, { reason: 'session' });
}

/** Rename the current or a given session's incident title. */
export function renameSession(id, title) {
  if (current?.id === id) {
    update((s) => { s.incident.title = title; }, { reason: 'session' });
    return;
  }
  const raw = localStorage.getItem(SESSION_PREFIX + id);
  if (!raw) return;
  const s = normaliseSession(JSON.parse(raw));
  s.incident.title = title;
  s.updatedAt = new Date().toISOString();
  localStorage.setItem(SESSION_PREFIX + id, JSON.stringify(s));
  notify('session-loaded');
}

export function openSession(id) {
  const raw = localStorage.getItem(SESSION_PREFIX + id);
  if (!raw) throw new Error('Session not found');
  current = normaliseSession(JSON.parse(raw));
  localStorage.setItem(LAST_KEY, current.id);
  notify('session-loaded');
  return current;
}

export function closeSession() {
  current = null;
  localStorage.removeItem(LAST_KEY);
  notify('session-loaded');
}

export function resumeLastSession() {
  const id = localStorage.getItem(LAST_KEY);
  if (!id) return null;
  try {
    return openSession(id);
  } catch {
    return null;
  }
}

export function listSessions() {
  const sessions = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(SESSION_PREFIX)) continue;
    try {
      const s = JSON.parse(localStorage.getItem(key));
      sessions.push({
        id: s.id,
        title: s.incident?.title || '',
        location: s.incident?.location || '',
        incidentDate: s.incident?.date || '',
        createdAt: s.createdAt || s.updatedAt || '',
        updatedAt: s.updatedAt || '',
        findings: s.findings?.length ?? 0,
        segments: s.segments?.length ?? 0,
      });
    } catch {
      // skip corrupt entries
    }
  }
  return sessions.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * Remove a review from this device only — a brigade-shared cloud copy (if
 * any) is left untouched. The safe default when a member is just tidying up
 * one device (AAR Studio hero review 2026-07-03, AAR-1).
 */
export function deleteSessionLocal(id) {
  localStorage.removeItem(SESSION_PREFIX + id);
  if (current?.id === id) {
    current = null;
    localStorage.removeItem(LAST_KEY);
  }
  notify('session-loaded');
}

/**
 * Remove a review everywhere: this device and (best-effort) the brigade's
 * shared cloud copy, so it's also gone from every other device. Only
 * meaningful when signed in — the server call is a silent no-op otherwise.
 */
export function deleteSessionEverywhere(id) {
  deleteSessionLocal(id);
  if (isAuthed()) deleteServerSession(id).catch(() => {});
}

/**
 * Adopt a session object fetched from the server: normalise, store locally, and
 * open it as current. Used to pull a brigade-mate's cloud review onto this
 * device. Persisting locally also re-mirrors it (idempotent).
 */
export function adoptSession(obj) {
  current = normaliseSession(obj);
  persist();
  notify('session-loaded');
  return current;
}

/** Import a session from exported JSON text; opens it as current. */
export function importSessionJson(text) {
  const session = normaliseSession(JSON.parse(text));
  // Avoid clobbering an existing different session that shares the id.
  const existing = localStorage.getItem(SESSION_PREFIX + session.id);
  if (existing && JSON.parse(existing).updatedAt !== session.updatedAt) {
    session.id = createSession().id;
  }
  current = session;
  persist();
  notify('session-loaded');
  return current;
}

export function exportSessionJson(session = current) {
  return JSON.stringify(session, null, 2);
}
