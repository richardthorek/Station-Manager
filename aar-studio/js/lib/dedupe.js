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
