/**
 * Lightweight, non-backtracking email sanity check.
 *
 * Deliberately avoids `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — since `.` isn't
 * excluded from the character classes, the two `+` groups and the literal
 * dot overlap, which lets a long crafted string cause exponential
 * backtracking (ReDoS). Each check below is a single unambiguous quantified
 * group or a linear-time string method.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  const domain = email.slice(email.lastIndexOf('@') + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}
