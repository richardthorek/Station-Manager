/**
 * Member Session Utility (AC-1)
 *
 * A member who checks in via their personal link (`/sign-in?user=...`) gets a
 * short-lived, station-scoped read session minted by the backend
 * (`POST /api/checkins/url-checkin` returns `sessionToken`). Storing it here
 * lets the AccessRoute gate and api.ts's request headers recognise the same
 * visitor as legitimately allowed into the sign-in book for the rest of the
 * browser session — without a full account or a kiosk device.
 *
 * Deliberately separate from kiosk mode (a real device credential) and from
 * demo mode (the one anonymous path with no credential at all): this token
 * is tied to one member and expires server-side on its own (see
 * backend/src/routes/checkins.ts's mintMemberSessionToken).
 */

const MEMBER_SESSION_KEY = 'memberSessionToken';

/** Persist the session token returned by a personal-link check-in. */
export function setMemberSessionToken(token: string): void {
  try {
    sessionStorage.setItem(MEMBER_SESSION_KEY, token);
  } catch {
    // sessionStorage unavailable (private mode) — the check-in itself still succeeded.
  }
}

/** Read the current member-session token, if any. */
export function getMemberSessionToken(): string | null {
  try {
    return sessionStorage.getItem(MEMBER_SESSION_KEY);
  } catch {
    return null;
  }
}

/** True when a member-session token is stored for this browser session. */
export function hasMemberSession(): boolean {
  return Boolean(getMemberSessionToken());
}

/** Clear the stored member-session token. */
export function clearMemberSession(): void {
  try {
    sessionStorage.removeItem(MEMBER_SESSION_KEY);
  } catch {
    // ignore
  }
}
