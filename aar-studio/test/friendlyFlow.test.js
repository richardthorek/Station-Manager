// Tests for the friendly, non-technical AAR flow: date/title helpers, the
// display-title fallback, and the non-destructive "fill metadata from the
// discussion" merge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDateInput, friendlyDate, friendlyDateTime } from '../js/lib/text.js';
import { createSession, displayTitle } from '../js/lib/model.js';
import { metadataSchema, mergeMetadata } from '../js/lib/extraction.js';

test('toDateInput renders a local YYYY-MM-DD for <input type=date>', () => {
  assert.equal(toDateInput(new Date(2026, 5, 20, 15, 42)), '2026-06-20');
  assert.equal(toDateInput(new Date(2026, 0, 3)), '2026-01-03');
});

test('friendlyDate accepts a Date or an input-date string', () => {
  assert.equal(friendlyDate(new Date(2026, 5, 20)), '20 Jun 2026');
  assert.equal(friendlyDate('2026-06-20'), '20 Jun 2026');
  assert.equal(friendlyDate(''), '');
});

test('friendlyDateTime renders 12-hour am/pm', () => {
  assert.equal(friendlyDateTime(new Date(2026, 5, 20, 15, 42)), '20 Jun 2026, 3:42pm');
  assert.equal(friendlyDateTime(new Date(2026, 5, 20, 0, 5)), '20 Jun 2026, 12:05am');
  assert.equal(friendlyDateTime(new Date(2026, 5, 20, 12, 0)), '20 Jun 2026, 12:00pm');
});

test('displayTitle uses the incident title, else a friendly fallback', () => {
  const titled = createSession({ incident: { title: 'Structure fire — 12 Smith St', date: '', location: '', type: '' } });
  assert.equal(displayTitle(titled), 'Structure fire — 12 Smith St');

  const blank = createSession({ createdAt: new Date(2026, 5, 20, 15, 42).toISOString() });
  assert.match(displayTitle(blank), /^Review — 20 Jun 2026, 3:42pm$/);
});

test('mergeMetadata only fills blanks — never overwrites the user', () => {
  const session = createSession({
    incident: { title: 'My own title', date: '', location: '', type: '' },
    units: [],
  });
  const meta = {
    title: 'AI suggested title',                 // ignored — user set a title
    location: 'Wamboin',                          // applied — was blank
    incidentType: 'Structure Fire',               // applied — valid + blank
    units: [{ unit: 'Wamboin', role: 'First in' }],
  };
  const patch = mergeMetadata(session, meta);
  assert.equal(patch.incident.title, undefined, 'does not overwrite the user title');
  assert.equal(patch.incident.location, 'Wamboin');
  assert.equal(patch.incident.type, 'Structure Fire');
  assert.deepEqual(patch.units, [{ unit: 'Wamboin', role: 'First in' }]);
});

test('mergeMetadata ignores empty/unknown values and pre-filled units', () => {
  const session = createSession({
    incident: { title: '', date: '', location: 'Set already', type: '' },
    units: [{ unit: 'Existing', role: '' }],
  });
  const patch = mergeMetadata(session, { title: '', location: 'New', incidentType: 'Nonsense', units: [{ unit: 'X', role: '' }] });
  assert.equal(patch.incident, undefined, 'nothing valid to fill (title empty, location taken, type invalid)');
  assert.equal(patch.units, undefined, 'units already present — left alone');
});

test('mergeMetadata replaces a quick-start GPS location but never a real one (AAR-3)', () => {
  // A quick-start review's location is raw device coordinates, flagged auto —
  // a real place name mentioned in the discussion should replace it.
  const auto = createSession({
    incident: { title: '', date: '', location: '-35.1234, 149.5678', type: '', locationIsAuto: true },
  });
  const patch = mergeMetadata(auto, { location: 'Wamboin' });
  assert.equal(patch.incident.location, 'Wamboin');
  assert.equal(patch.incident.locationIsAuto, false, 'clears the auto flag once a real name is applied');

  // A real, non-auto location (typed or already AI-derived) is never touched.
  const real = createSession({
    incident: { title: '', date: '', location: 'Bungendore Station', type: '', locationIsAuto: false },
  });
  const untouched = mergeMetadata(real, { location: 'Somewhere else' });
  assert.equal(untouched.incident, undefined, 'a real location is never overwritten');
});

test('metadataSchema constrains incidentType to known values plus empty', () => {
  const schema = metadataSchema();
  assert.ok(schema.properties.incidentType.enum.includes(''));
  assert.ok(schema.properties.incidentType.enum.includes('Structure Fire'));
  assert.deepEqual(schema.required, ['title', 'location', 'incidentType', 'units']);
});
