// Per-unit finding attribution (P1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, createFinding, sessionUnitNames, normaliseSession } from '../js/lib/model.js';
import { renderCombinedHtml } from '../js/lib/exports.js';

test('createFinding defaults unit to empty and keeps an explicit unit', () => {
  assert.equal(createFinding({ category: 'well', text: 'x' }).unit, '');
  assert.equal(createFinding({ category: 'well', text: 'x', unit: 'Bungendore 1' }).unit, 'Bungendore 1');
  // non-string units are coerced
  assert.equal(createFinding({ category: 'well', text: 'x', unit: null }).unit, '');
});

test('sessionUnitNames returns distinct, trimmed, non-empty unit names', () => {
  const s = createSession({ units: [
    { unit: 'Bungendore 1', role: 'Pump' },
    { unit: '  Wamboin 7 ', role: 'Tanker' },
    { unit: '', role: 'spare row' },
    { unit: 'Bungendore 1', role: 'duplicate' },
  ] });
  assert.deepEqual(sessionUnitNames(s), ['Bungendore 1', 'Wamboin 7']);
});

test('normaliseSession coerces and backfills finding.unit', () => {
  const s = normaliseSession({
    incident: { title: 'T' }, aar: {}, units: [],
    findings: [
      { category: 'didnt', text: 'a', unit: 'Cat 1' },
      { category: 'well', text: 'b' }, // missing unit
    ],
    segments: [],
  });
  assert.equal(s.findings[0].unit, 'Cat 1');
  assert.equal(s.findings[1].unit, '');
});

test('findings register shows a Unit column only when a finding is attributed', () => {
  const withUnit = createSession({
    incident: { title: 'Job' }, units: [{ unit: 'Cat 1', role: 'Pump' }],
    findings: [createFinding({ category: 'didnt', text: 'Pump too close', unit: 'Cat 1' })],
    report: null,
  });
  const html = renderCombinedHtml(withUnit);
  assert.match(html, /<th>Unit<\/th>/);
  assert.match(html, /Cat 1/);

  const noUnit = createSession({
    incident: { title: 'Job' }, units: [],
    findings: [createFinding({ category: 'didnt', text: 'Pump too close' })],
    report: null,
  });
  assert.ok(!renderCombinedHtml(noUnit).includes('<th>Unit</th>'));
});
