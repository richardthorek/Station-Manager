import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarity, isNearDuplicate, dedupeFindings, findMergeSuggestions, mergeFindings } from '../js/lib/dedupe.js';

const f = (category, text) => ({ category, text });
let _id = 0;
const fi = (category, text, extra = {}) => ({ id: `f${++_id}`, category, text, ...extra });

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

test('findMergeSuggestions surfaces soft-band pairs only (below auto-skip, above floor)', () => {
  const a = fi('well', 'The crew leader briefed every rotation and kept comms tight throughout the whole job.');
  const b = fi('well', 'The crew leader briefed each rotation and kept the comms clear all through the job.'); // soft-band dup of a (~0.64)
  const c = fi('didnt', 'Pump positioned somewhat near the smoke, about ten metres from the appliances.');
  const d = fi('next', 'Order more tankers earlier for going structure fires.'); // unrelated
  const suggestions = findMergeSuggestions([a, b, c, d]);
  assert.equal(suggestions.length, 1);
  const ids = [suggestions[0].a.id, suggestions[0].b.id].sort();
  assert.deepEqual(ids, [a.id, b.id].sort());
  assert.ok(suggestions[0].score >= 0.5 && suggestions[0].score < 0.72, `score ${suggestions[0].score} should be in the soft band`);
});

test('findMergeSuggestions ignores cross-category pairs and unrelated findings', () => {
  const findings = [
    fi('well', 'Pump set up too close to the smoke for comfort all night.'),
    fi('didnt', 'Pump set up too close to the smoke for comfort all night.'), // identical text, different category
    fi('well', 'Comms were crisp and the IC briefed every crew rotation.'),
  ];
  assert.equal(findMergeSuggestions(findings).length, 0);
});

test('findMergeSuggestions never reuses a finding across pairs (greedy, non-overlapping)', () => {
  // a-b ≈ 0.64 and b-c ≈ 0.70 are both soft-band and share b; a-c ≈ 0.90 is
  // auto-skip range (excluded). Greedy must return one non-overlapping pair.
  const a = fi('didnt', 'The crew leader briefed every rotation and kept comms tight throughout the whole job.');
  const b = fi('didnt', 'The crew leader briefed each rotation and kept the comms clear all through the job.');
  const c = fi('didnt', 'The crew leader briefed every rotation and kept comms tight for most of the job.');
  const suggestions = findMergeSuggestions([a, b, c]);
  const usedIds = suggestions.flatMap((p) => [p.a.id, p.b.id]);
  assert.equal(new Set(usedIds).size, usedIds.length, 'no finding id should appear in more than one suggested pair');
  assert.equal(suggestions.length, 1);
});

test('mergeFindings keeps the longer text, unions evidence, and is pure', () => {
  const keep = { id: 'a', category: 'didnt', phase: 'Attack', text: 'Pump too close.', quote: '', segmentIds: ['s1'], source: 'manual' };
  const drop = { id: 'b', category: 'didnt', phase: 'Attack', text: 'The pump was set up far too close to the smoke.', quote: 'about 10m', segmentIds: ['s2'], source: 'ai' };
  const merged = mergeFindings(keep, drop);
  assert.equal(merged.id, 'a');             // keeps identity
  assert.match(merged.text, /far too close/); // longer text wins
  assert.equal(merged.quote, 'about 10m');  // quote preserved from drop
  assert.deepEqual(merged.segmentIds.sort(), ['s1', 's2']);
  assert.equal(merged.source, 'merged');
  assert.equal(keep.text, 'Pump too close.'); // inputs untouched
  assert.equal(drop.segmentIds.length, 1);
});

test('mergeFindings preserves a unit attribution the kept finding lacks (AAR-17)', () => {
  const keep = { id: 'a', category: 'didnt', phase: 'Attack', text: 'Water ran out.', quote: '', unit: '', segmentIds: [], source: 'ai' };
  const drop = { id: 'b', category: 'didnt', phase: 'Attack', text: 'The tanker ran dry.', quote: '', unit: 'Wamboin', segmentIds: [], source: 'ai' };
  assert.equal(mergeFindings(keep, drop).unit, 'Wamboin', 'takes drop.unit when keep has none');
  // A unit on the kept finding is never overwritten by the dropped one.
  assert.equal(mergeFindings({ ...keep, unit: 'Bungendore' }, drop).unit, 'Bungendore');
});
