// Pure text helpers shared by lib modules, views and tests. No DOM.

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function countWords(text) {
  const m = String(text ?? '').trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'session';
}

/** Seconds → "m:ss" or "h:mm:ss". Null-safe. */
export function fmtClock(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "m:ss", "mm:ss", "h:mm:ss", "00:01:05.250" → seconds (or null). */
export function parseClock(s) {
  const m = String(s ?? '').trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const [, h, min, sec] = m;
  return (h ? Number(h) * 3600 : 0) + Number(min) * 60 + Number(sec);
}

/**
 * Session/segment/finding ids — used to scope API access (e.g. cloud-sync
 * session ids double as the collab join-code seed), so they need to be
 * unguessable. `Math.random()` is not cryptographically secure; both
 * branches here use the Web Crypto API instead (CodeQL insecure-randomness
 * finding on PR #609, flagged from the AAR-15 sync-conflict fix).
 */
export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return 'id-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A Date → the value an <input type="date"> expects (local date, "YYYY-MM-DD"). */
export function toDateInput(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Friendly date for display, e.g. "20 Jun 2026". Accepts a Date or "YYYY-MM-DD". */
export function friendlyDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Friendly date + time, e.g. "20 Jun 2026, 3:42pm". */
export function friendlyDateTime(date = new Date()) {
  let h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return `${friendlyDate(date)}, ${h}:${min}${ampm}`;
}
