/**
 * Turn arbitrary (user-provided) text into a url-safe slug.
 *
 * Implemented with a single `split` on runs of non-alphanumerics rather than a
 * trim like `/^-+|-+$/`, which CodeQL flags as a polynomial / ReDoS-prone
 * regular expression on uncontrolled input. `split(/[^a-z0-9]+/)` is linear and
 * `filter(Boolean)` drops the empty segments that leading/trailing separators
 * would otherwise produce, so there are never leading/trailing dashes.
 */
export function slugify(value: string): string {
  return (value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');
}
