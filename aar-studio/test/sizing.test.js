import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotateColloquialSizes, normaliseSizeValue, formatArea, formatDistance } from '../js/lib/sizing.js';
import { toFinding } from '../js/lib/extraction.js';
import { normaliseReport } from '../js/lib/reportGen.js';
import { createSession, createSegment } from '../js/lib/model.js';

test('formatArea picks m² / ha / km² at sensible thresholds', () => {
  assert.equal(formatArea(261), '260 m²');
  assert.equal(formatArea(3 * 7000), '2.1 ha');
  assert.equal(formatArea(15_000_000), '15 km²');
});

test('formatDistance picks m / km', () => {
  assert.equal(formatDistance(45.7), '46 m');
  assert.equal(formatDistance(3 * 1609.34), '4.8 km');
});

test('annotates colloquial areas when the context is about size', () => {
  assert.equal(
    annotateColloquialSizes('The fire was about the size of a tennis court on arrival.'),
    'The fire was about the size of a tennis court (≈ 260 m²) on arrival.',
  );
  assert.equal(
    annotateColloquialSizes('It had spread across three footy fields by the time we got water on.'),
    'It had spread across three footy fields (≈ 2.1 ha) by the time we got water on.',
  );
});

test('leaves place mentions alone — a tennis court you staged at is not a size', () => {
  const text = 'Crews staged at the tennis court near the hall.';
  assert.equal(annotateColloquialSizes(text), text);
});

test('converts imperial distances with a quantity', () => {
  assert.equal(
    annotateColloquialSizes('The hydrant was 3 miles down the road.'),
    'The hydrant was 3 miles (≈ 4.8 km) down the road.',
  );
  assert.equal(
    annotateColloquialSizes('About half a mile of hose was laid.'),
    'About half a mile (≈ 800 m) of hose was laid.',
  );
  assert.equal(
    annotateColloquialSizes('Burnt roughly 5 acres of grass.'),
    'Burnt roughly 5 acres (≈ 2 ha) of grass.',
  );
});

test('is idempotent — an existing annotation is not stacked', () => {
  const once = annotateColloquialSizes('Fire the size of a tennis court.');
  assert.equal(annotateColloquialSizes(once), once);
  // The model may already have converted per the prompt rule.
  const modelDone = 'Fire the size of a tennis court (≈ 260 m²) on arrival.';
  assert.equal(annotateColloquialSizes(modelDone), modelDone);
});

test('square miles are claimed as area, not distance', () => {
  assert.equal(
    annotateColloquialSizes('The burn covered 2 square miles.'),
    'The burn covered 2 square miles (≈ 520 ha).',
  );
});

test('normaliseSizeValue converts a colloquial stat value and passes others through', () => {
  assert.equal(normaliseSizeValue('1 Tennis Court'), '≈ 260 m²');
  assert.equal(normaliseSizeValue('3 footy fields'), '≈ 2.1 ha');
  assert.equal(normaliseSizeValue('3 miles'), '≈ 4.8 km');
  assert.equal(normaliseSizeValue('~1000'), '~1000');
  assert.equal(normaliseSizeValue('800 L/min'), '800 L/min');
  assert.equal(normaliseSizeValue(''), '');
});

test('toFinding annotates colloquial sizes the model left unconverted', () => {
  const session = createSession();
  const seg = createSegment({ text: 'It was about the size of a tennis court.' });
  const f = toFinding({
    category: 'happened',
    phase: 'General',
    text: 'Initial size-up put the fire at about the size of a tennis court.',
    quote: 'about the size of a tennis court',
    segmentIds: [seg.id],
  }, session, [seg]);
  assert.match(f.text, /tennis court \(≈ 260 m²\)/);
  assert.equal(f.quote, 'about the size of a tennis court', 'quotes stay verbatim');
});

test('normaliseReport converts a colloquial size-box stat to metric', () => {
  const session = createSession();
  const report = normaliseReport({
    stats: [
      { value: '1 Tennis Court', label: 'FIRE AREA' },
      { value: '8', label: 'CREW ON SCENE' },
    ],
  }, session);
  assert.equal(report.stats[0].value, '≈ 260 m²');
  assert.equal(report.stats[1].value, '8');
});
