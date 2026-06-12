import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarity, isNearDuplicate, dedupeFindings } from '../js/lib/dedupe.js';

const f = (category, text) => ({ category, text });

test('similarity is high for restatements, low for unrelated findings', () => {
  const a = 'The pump was set up too close, roughly 10 m from thick smoke.';
  const b = 'Pump set up too close — about 10 m from the thick smoke.';
  const c = 'The BACO performance was outstanding with constant comms.';
  assert.ok(similarity(a, b) > 0.7, `expected high, got ${similarity(a, b)}`);
  assert.ok(similarity(a, c) < 0.2, `expected low, got ${similarity(a, c)}`);
});

test('containment catches a short restatement of a longer finding', () => {
  const long = 'Call for more tankers up front for a going structure fire off reticulated water, and run 65 mm to staging with trucks rotating through.';
  const short = 'Call more tankers up front for structure fires off reticulated water.';
  assert.ok(similarity(long, short) >= 0.72);
});

test('different categories are never duplicates', () => {
  assert.equal(isNearDuplicate(f('well', 'Monitor knocked the fire down'), f('didnt', 'Monitor knocked the fire down')), false);
});

test('dedupeFindings drops repeats across and within the incoming batch', () => {
  const existing = [f('didnt', 'Pump positioned too close to the smoke, operator masked all night.')];
  const incoming = [
    f('didnt', 'The pump was positioned too close to the smoke and the operator was masked all night.'), // dup of existing
    f('well', 'BA control went straight to a Stage 2 board with a two-cylinder limit.'),                  // new
    f('well', 'BA control: straight to Stage 2 board, two-cylinder limit per operator.'),                 // dup within batch
  ];
  const { added, skipped } = dedupeFindings(existing, incoming);
  assert.equal(added.length, 1);
  assert.equal(skipped.length, 2);
  assert.match(added[0].text, /Stage 2/);
});
