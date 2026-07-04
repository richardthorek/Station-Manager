// Near-duplicate finding detection. Pure.
//
// Live extraction re-reads overlapping context, so the model often restates a
// finding it already produced. We treat two findings as duplicates when their
// normalised token sets are highly similar (Jaccard) or one is contained in
// the other (short restatement of a longer finding).

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'was', 'were', 'is', 'are', 'be', 'been', 'it', 'that', 'this', 'we', 'they',
  'had', 'have', 'has', 'not', 'no', 'but', 'as', 'by', 'from', 'up', 'so',
]);

export function tokens(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

export function similarity(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  // Containment catches "A restated more briefly"; require a few shared
  // tokens so two 2-word findings don't collapse together.
  return Math.max(jaccard, inter >= 4 ? containment : 0);
}

export function isNearDuplicate(a, b, threshold = 0.72) {
  if (a.category !== b.category) return false;
  return similarity(a.text, b.text) >= threshold;
}

/**
 * Filter incoming findings against existing ones (and each other).
 * Returns { added, skipped } — `added` are safe to append.
 */
export function dedupeFindings(existing, incoming, threshold = 0.72) {
  const kept = [...existing];
  const added = [];
  const skipped = [];
  for (const f of incoming) {
    if (kept.some((e) => isNearDuplicate(e, f, threshold))) skipped.push(f);
    else {
      kept.push(f);
      added.push(f);
    }
  }
  return { added, skipped };
}

/**
 * Find pairs of findings already on the board that look like possible
 * duplicates but fell *below* the auto-skip line — so they coexist and a human
 * should decide. This is the "soft band": similarity in
 * [suggestThreshold, autoThreshold). Pairs at/above autoThreshold were already
 * dropped at extraction time; pairs below suggestThreshold are left alone.
 *
 * Greedy and non-overlapping: each finding appears in at most one suggested
 * pair (highest-scoring wins), so the UI never shows confusing chains.
 *
 * @returns {Array<{ a: object, b: object, score: number }>} sorted by score desc
 */
export function findMergeSuggestions(findings, { suggestThreshold = 0.5, autoThreshold = 0.72 } = {}) {
  const list = Array.isArray(findings) ? findings : [];
  const pairs = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.category !== b.category) continue;
      const score = similarity(a.text, b.text);
      if (score >= suggestThreshold && score < autoThreshold) pairs.push({ a, b, score });
    }
  }
  pairs.sort((p, q) => q.score - p.score);
  const used = new Set();
  const out = [];
  for (const p of pairs) {
    if (used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id);
    used.add(p.b.id);
    out.push(p);
  }
  return out;
}

/**
 * Merge two findings into one. Pure — returns a new object, mutates nothing.
 * Keeps `keep`'s identity (id/category/phase/createdAt); the longer text wins
 * (it usually carries more detail); a quote and segmentIds are unioned so no
 * evidence is lost. Source becomes 'merged'.
 */
export function mergeFindings(keep, drop) {
  const text = (drop.text ?? '').length > (keep.text ?? '').length ? drop.text : keep.text;
  const segmentIds = Array.from(new Set([...(keep.segmentIds ?? []), ...(drop.segmentIds ?? [])]));
  return {
    ...keep,
    text,
    quote: keep.quote || drop.quote || '',
    // Don't lose a unit attribution when the kept finding has none — mirror the
    // quote handling above (AAR Studio hero review 2026-07-03, AAR-17).
    unit: keep.unit || drop.unit || '',
    segmentIds,
    source: 'merged',
  };
}
