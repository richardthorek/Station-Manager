/**
 * Demo Mode Utility
 *
 * The public demo lets a prospective user explore the app with seeded test
 * data without a real brigade code or account. It is entered via `?demo=true`
 * (on the landing/marketing front door) and then persists for the browser
 * session so the access gate on `/signin` keeps letting the demo through as the
 * user navigates between modules (the query param is dropped on navigation).
 *
 * This is deliberately separate from kiosk mode (a real brigade device code)
 * and from auth — it is the one anonymous path that is allowed *without* a
 * brigade code, and only ever exposes the demo station's data.
 */

const DEMO_MODE_KEY = 'demoMode';

/** Read `?demo=true` from the current URL. */
function demoInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'true';
}

/**
 * True when the demo is active — either `?demo=true` is in the URL right now,
 * or it was activated earlier this browser session.
 */
export function isDemoActive(): boolean {
  if (demoInUrl()) return true;
  try {
    return sessionStorage.getItem(DEMO_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persist demo mode for the rest of this browser session. */
export function activateDemo(): void {
  try {
    sessionStorage.setItem(DEMO_MODE_KEY, 'true');
  } catch {
    // sessionStorage unavailable (private mode / SSR) — the URL param still
    // covers the current navigation.
  }
}

/** Clear demo mode (e.g. on explicit exit). */
export function exitDemo(): void {
  try {
    sessionStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    // ignore
  }
}
