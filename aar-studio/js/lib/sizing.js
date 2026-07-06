// Colloquial → metric sizing. Debriefs describe fires in tennis courts,
// footy fields and miles; reports need consistent metric (m, km, m², ha).
// Pure functions: a deterministic secondary pass over AI finding text
// (annotateColloquialSizes) and a normaliser for report stat values
// (normaliseSizeValue). The extraction/report prompts ask the model to do
// this too — this pass catches what the model misses, and never double-
// annotates what it already converted.

// Comparator areas use common Australian reference sizes. "Footy field"
// covers the rectangular codes (league/union/soccer, ~0.7 ha); AFL and
// cricket ovals are the larger ~1.8 ha shape.
const AREA_UNITS = [
  { src: 'tennis courts?', m2: 261 },
  { src: 'basketball courts?', m2: 420 },
  { src: 'netball courts?', m2: 465 },
  { src: 'olympic(?:[ -]sized?)?(?: swimming)? pools?', m2: 1250 },
  { src: '(?:footy|football|soccer|rugby|league) (?:fields?|pitch(?:es)?|paddocks?)', m2: 7000 },
  { src: '(?:footy|afl|cricket) ovals?', m2: 18000 },
  { src: 'square miles?', m2: 2589988, needsQty: true },
  { src: 'square yards?', m2: 0.836, needsQty: true },
  { src: 'square (?:feet|foot)|sq ?ft', m2: 0.0929, needsQty: true },
  { src: 'acres?', m2: 4047, needsQty: true },
];

const DIST_UNITS = [
  { src: 'miles?', m: 1609.34, needsQty: true },
  { src: 'yards?', m: 0.9144, needsQty: true },
  { src: '(?:feet|foot)', m: 0.3048, needsQty: true },
];

const NUM_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  'half a': 0.5, 'half an': 0.5, 'a couple of': 2, 'couple of': 2, 'a dozen': 12,
};

// Longest alternatives first so "a couple of" wins over "a".
const QTY_SRC = '\\d+(?:\\.\\d+)?|half an?|a couple of|couple of|a dozen|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an|a';

function parseQty(raw) {
  if (!raw) return 1;
  const s = String(raw).toLowerCase().trim();
  if (/^\d/.test(s)) return parseFloat(s);
  return NUM_WORDS[s] ?? 1;
}

/** A quantity that clearly marks a measurement ("3", "three") rather than an article. */
function isExplicitQty(raw) {
  if (!raw) return false;
  const s = String(raw).toLowerCase().trim();
  return !['a', 'an'].includes(s);
}

// Two significant figures reads naturally for rough comparisons (≈ 260 m²,
// ≈ 4.8 km) without implying survey precision.
const sig = (n) => String(Number(n.toPrecision(2)));

export function formatArea(m2) {
  if (m2 < 10000) return `${sig(m2)} m²`;
  if (m2 < 10_000_000) return `${sig(m2 / 10000)} ha`;
  return `${sig(m2 / 1_000_000)} km²`;
}

export function formatDistance(m) {
  return m < 1000 ? `${sig(m)} m` : `${sig(m / 1000)} km`;
}

// A comparator with no real quantity ("the tennis court") is only a size when
// the surrounding words are about size — otherwise it's just a place.
const CONTEXT_RE = /\b(size|sized|big|area|cover\w*|burn\w*|spread|across|wide|long|front)\b/i;

function hasSizeContext(text, offset, matchLength) {
  const before = text.slice(Math.max(0, offset - 40), offset);
  const after = text.slice(offset + matchLength, offset + matchLength + 12);
  return CONTEXT_RE.test(before) || /^[\s-]*sized?\b/i.test(after);
}

/** Already annotated (by us or by the model) — don't stack a second one. */
function alreadyAnnotated(text, end) {
  return /^\s*\((?:≈|~|about|approx|roughly)/i.test(text.slice(end));
}

function annotateWith(text, units, format, key) {
  let out = text;
  for (const unit of units) {
    const re = unit.needsQty
      ? new RegExp(`(?:\\b(${QTY_SRC})\\s+)(${unit.src})\\b`, 'gi')
      : new RegExp(`(?:\\b(${QTY_SRC})\\s+)?(${unit.src})\\b`, 'gi');
    out = out.replace(re, (...args) => {
      const [match, qty] = args;
      const offset = args[args.length - 2];
      const full = args[args.length - 1];
      if (alreadyAnnotated(full, offset + match.length)) return match;
      if (!unit.needsQty && !isExplicitQty(qty) && !hasSizeContext(full, offset, match.length)) return match;
      return `${match} (≈ ${format(parseQty(qty) * unit[key])})`;
    });
  }
  return out;
}

/**
 * Append the metric equivalent after colloquial/imperial sizes and distances:
 * "the size of a tennis court" → "the size of a tennis court (≈ 260 m²)",
 * "3 miles down the road" → "3 miles down the road (≈ 4.8 km)". Idempotent,
 * and leaves place mentions ("staged at the tennis court") alone.
 */
export function annotateColloquialSizes(text) {
  if (!text) return text;
  // Areas first so "square miles" is claimed before the bare "miles" pattern.
  let out = annotateWith(text, AREA_UNITS, formatArea, 'm2');
  out = annotateWith(out, DIST_UNITS, formatDistance, 'm');
  return out;
}

/**
 * Normalise a report stat value that IS a colloquial size ("1 Tennis Court")
 * to its metric equivalent ("≈ 260 m²"). Anything else passes through.
 */
export function normaliseSizeValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return v;
  for (const unit of AREA_UNITS) {
    const m = v.match(new RegExp(`^[~≈]?\\s*(?:(${QTY_SRC})\\s+)?(?:${unit.src})\\s*$`, 'i'));
    if (m) return `≈ ${formatArea(parseQty(m[1]) * unit.m2)}`;
  }
  for (const unit of DIST_UNITS) {
    const m = v.match(new RegExp(`^[~≈]?\\s*(?:(${QTY_SRC})\\s+)?(?:${unit.src})\\s*$`, 'i'));
    if (m) return `≈ ${formatDistance(parseQty(m[1]) * unit.m)}`;
  }
  return v;
}
