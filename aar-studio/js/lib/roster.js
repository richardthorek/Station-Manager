// Roster lookups against the Station Manager API, used to turn AAR Studio's
// free-text setup fields (meeting location, facilitator) into roster-backed
// typeaheads. Like serverSync this is best-effort and signed-in-only: when no
// SM token is present, or any call fails, callers fall back to plain free text
// and the local-first flow is unchanged.
//
// Pure fetch + injectable token/fetch so it loads and tests under node.

import { getAuthToken } from './serverSync.js';

// Cap the per-station member fan-out so a large multi-station org can't trigger
// a runaway number of requests from the setup screen.
const MAX_STATIONS_FOR_MEMBERS = 8;

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The org's stations as `{ id, name }`, or [] when signed out / on error. */
export async function fetchStations({ fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  if (!token) return [];
  try {
    const res = await fetchImpl('/api/stations', { headers: authHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.stations ?? [])
      .filter((s) => s && s.id && s.name)
      .map((s) => ({ id: s.id, name: s.name }));
  } catch {
    return [];
  }
}

/** Member names for one station, or [] when signed out / on error. */
export async function fetchMembers({ fetchImpl = globalThis.fetch, token = getAuthToken(), stationId } = {}) {
  if (!token) return [];
  try {
    const qs = stationId ? `?stationId=${encodeURIComponent(stationId)}` : '';
    const res = await fetchImpl(`/api/members${qs}`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : [])
      .filter((m) => m && (m.isActive ?? true) && !m.isDeleted && m.name)
      .map((m) => m.name);
  } catch {
    return [];
  }
}

/**
 * Build the setup-screen roster: station names and the de-duplicated set of
 * member names across those stations (capped). Returns { stations, members }
 * with `stations` as `{ id, name }[]` and `members` as a sorted name list.
 * Never throws — returns empty lists when signed out or on any failure.
 */
export async function loadRoster({ fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  const stations = await fetchStations({ fetchImpl, token });
  if (!stations.length) return { stations, members: [] };

  const names = new Set();
  const targets = stations.slice(0, MAX_STATIONS_FOR_MEMBERS);
  const lists = await Promise.all(
    targets.map((s) => fetchMembers({ fetchImpl, token, stationId: s.id })),
  );
  for (const list of lists) for (const name of list) names.add(name);

  return {
    stations,
    members: Array.from(names).sort((a, b) => a.localeCompare(b)),
  };
}
