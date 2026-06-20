import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNote, createSession, normaliseSession } from '../js/lib/model.js';
import { codeForSession } from '../js/lib/collab.js';
import { codeFromHash } from '../js/views/join.js';

test('createNote defaults to an unanalysed Room note', () => {
  const n = createNote({ text: 'BA crew rotated late' });
  assert.equal(n.text, 'BA crew rotated late');
  assert.equal(n.label, 'Room');
  assert.equal(n.source, 'note');
  assert.equal(n.analysed, false);
  assert.ok(n.id);
});

test('a new session has an empty notes stream', () => {
  assert.deepEqual(createSession().notes, []);
});

test('normaliseSession backfills notes and coerces fields', () => {
  // Old session with no notes array still loads.
  assert.deepEqual(normaliseSession({ segments: [], findings: [] }).notes, []);

  const s = normaliseSession({
    notes: [{ text: 'late rotation', label: 'Pat', analysed: true }, { text: '', label: '' }],
  });
  assert.equal(s.notes.length, 2);
  assert.equal(s.notes[0].label, 'Pat');
  assert.equal(s.notes[0].analysed, true);
  assert.equal(s.notes[1].label, 'Room'); // empty label defaults
  assert.ok(s.notes[1].id);
});

test('codeForSession is deterministic and well-formed', () => {
  const a = codeForSession('session-abc');
  const b = codeForSession('session-abc');
  const c = codeForSession('session-xyz');
  assert.equal(a, b, 'same id → same code');
  assert.notEqual(a, c, 'different id → different code (overwhelmingly likely)');
  assert.match(a, /^[A-Z]{4}-\d{2}$/);
  assert.equal(/[IO01]/.test(a.split('-')[0]), false, 'avoids ambiguous letters');
});

test('codeFromHash parses #/join/CODE and upcases', () => {
  assert.equal(codeFromHash('#/join/wamb-42'), 'WAMB-42');
  assert.equal(codeFromHash('#/join/ABCD-12?x=1'), 'ABCD-12');
  assert.equal(codeFromHash('#/capture'), '');
  assert.equal(codeFromHash('#/join/'), '');
});
