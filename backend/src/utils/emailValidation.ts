/**
 * Lightweight, non-backtracking email sanity check.
 *
 * Deliberately avoids the common `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` pattern: since
 * `.` is not excluded from the character classes, the two `+` groups and the
 * literal dot overlap, giving the regex engine exponentially many ways to
 * split a long attacker-controlled string with many dots — a ReDoS on public,
 * pre-auth endpoints (signup, org-invite acceptance). Each check below is a
 * single unambiguous quantified group or a linear-time string method, so
 * there is nothing to backtrack.
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string' || email.length === 0 || email.length > 254) {
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    return false;
  }
  const domain = email.slice(email.lastIndexOf('@') + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}
