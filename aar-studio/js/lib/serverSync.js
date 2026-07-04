// Server-side persistence for AAR reviews (optional, additive).
//
// AAR Studio is local-first: localStorage is always the working source of truth
// and the app works fully signed-out. When the visitor is signed in to Station
// Manager (the SPA stores its JWT under `auth_token` on the same origin), this
// module mirrors reviews to `/api/aar-sessions` so they survive device loss and
// are visible to the whole brigade. Every call is best-effort — a network or
// auth failure never blocks the local workflow.
//
// Pure fetch + injectable token/fetch so it loads and tests under node.

const API_BASE = '/api/aar-sessions';

/** The SPA's JWT from same-origin localStorage, or null when signed out. */
export function getAuthToken(storage = globalThis.localStorage) {
  try {
    return storage?.getItem('auth_token') || null;
  } catch {
    return null;
  }
}

/** True when a Station Manager token is present (cloud sync is possible). */
export function isAuthed(storage = globalThis.localStorage) {
  return Boolean(getAuthToken(storage));
}

/**
 * Build the PUT body the backend expects from a full AAR session object. The
 * backend stores `payload` as an opaque blob and indexes the lifted fields.
 */
export function toServerBody(session) {
  const title = session?.incident?.title?.trim() || '';
  // Note: no `stationId` — the AAR session model never sets one, so sending it
  // was always undefined dead weight (AAR Studio hero review 2026-07-03,
  // AAR-16). The backend field stays optional for a future wiring.
  return {
    title: title || 'Untitled review',
    incidentDate: session?.incident?.date || undefined,
    schemaVersion: typeof session?.schemaVersion === 'number' ? session.schemaVersion : 1,
    // The device's last-edit time — the server uses it for stale-write detection.
    clientUpdatedAt: session?.updatedAt || undefined,
    payload: JSON.stringify(session),
  };
}

/**
 * True when a server review summary is newer than the local copy's last-edit
 * time — i.e. a teammate (or another device) has edited it since. Compares the
 * device edit time (`clientUpdatedAt`), falling back to the server write time.
 */
export function isRemoteNewer(remoteSummary, localUpdatedAt) {
  if (!localUpdatedAt) return false;
  const remote = remoteSummary?.clientUpdatedAt || remoteSummary?.updatedAt;
  if (!remote) return false;
  return new Date(remote).getTime() > new Date(localUpdatedAt).getTime();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Mirror one review to the server. Resolves {ok, status, skipped?} and never
 * rejects on HTTP/network errors, so callers can fire-and-forget.
 */
export async function pushSession(session, { fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  if (!token) return { ok: false, skipped: 'unauthenticated' };
  if (!session?.id) return { ok: false, skipped: 'no-id' };
  try {
    const res = await fetchImpl(`${API_BASE}/${encodeURIComponent(session.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(toServerBody(session)),
    });
    // 409 = the cloud copy was edited more recently elsewhere; don't clobber.
    return { ok: res.ok, status: res.status, conflict: res.status === 409 };
  } catch {
    return { ok: false, skipped: 'network' };
  }
}

/**
 * List the org's cloud reviews as home-card summaries. Returns [] when signed
 * out or on any error (cloud reviews are purely additive to the local list).
 */
export async function listServerSessions({ fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  if (!token) return [];
  try {
    const res = await fetchImpl(API_BASE, { headers: authHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.sessions ?? []).map((s) => ({
      id: s.id,
      title: s.title || '',
      incidentDate: s.incidentDate || '',
      createdAt: s.createdAt || s.updatedAt || '',
      updatedAt: s.updatedAt || '',
      clientUpdatedAt: s.clientUpdatedAt || '',
      createdByName: s.createdByName || '',
      remote: true,
    }));
  } catch {
    return [];
  }
}

/** Fetch one cloud review and return the parsed session object, or null. */
export async function fetchServerSession(id, { fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  if (!token || !id) return null;
  try {
    const res = await fetchImpl(`${API_BASE}/${encodeURIComponent(id)}`, { headers: authHeaders(token) });
    if (!res.ok) return null;
    const data = await res.json();
    const payload = data?.session?.payload;
    return typeof payload === 'string' ? JSON.parse(payload) : null;
  } catch {
    return null;
  }
}

/** Best-effort delete of a cloud review. Resolves {ok} and never rejects. */
export async function deleteServerSession(id, { fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  if (!token || !id) return { ok: false, skipped: 'unauthenticated-or-no-id' };
  try {
    const res = await fetchImpl(`${API_BASE}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, skipped: 'network' };
  }
}
