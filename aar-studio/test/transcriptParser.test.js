import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript } from '../js/lib/transcriptParser.js';
import { parseClock, fmtClock } from '../js/lib/text.js';

test('parses the Teams DOCX copy format (Name + timestamp header, text lines)', () => {
  const raw = [
    'Dave Smith   0:15',
    'Page went out cleanly, we had two and six on the initial response.',
    '',
    'Jane Doe   1:02',
    'Coming up the driveway it narrows',
    'and the ground falls away on the Delta side.',
    '',
  ].join('\n');
  const { format, rows } = parseTranscript(raw);
  assert.equal(format, 'teams-docx');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { speaker: 'Dave Smith', t: 15, text: 'Page went out cleanly, we had two and six on the initial response.' });
  assert.equal(rows[1].t, 62);
  assert.match(rows[1].text, /narrows and the ground falls away/);
});

test('parses h:mm:ss Teams timestamps', () => {
  const { rows } = parseTranscript('Dave   1:02:03\nLong meeting.\n\nJane   1:05:00\nStill going.\n');
  assert.equal(rows[0].t, 3723);
  assert.equal(rows[1].t, 3900);
});

test('parses "Name: text" transcripts with continuation lines', () => {
  const raw = 'Dave: The monitor was the right call.\nJane: Agreed, single 38s did nothing\non a fire that size.';
  const { format, rows } = parseTranscript(raw);
  assert.equal(format, 'speaker-colon');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].speaker, 'Jane');
  assert.match(rows[1].text, /did nothing on a fire that size/);
});

test('does not treat prose containing a colon as a speaker header', () => {
  const raw = 'Dave: First point.\nThe lesson for everyone here is this: set up further back from the smoke.';
  const { rows } = parseTranscript(raw);
  assert.equal(rows.length, 1, 'long pre-colon text should be a continuation, not a speaker');
  assert.match(rows[0].text, /set up further back/);
});

test('parses WEBVTT with voice spans', () => {
  const raw = [
    'WEBVTT',
    '',
    '00:00:05.000 --> 00:00:09.000',
    '<v Dave Smith>The pump was too close to the smoke.</v>',
    '',
    '00:00:10.500 --> 00:00:12.000',
    'Unattributed cue text.',
    '',
  ].join('\n');
  const { format, rows } = parseTranscript(raw);
  assert.equal(format, 'vtt');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { speaker: 'Dave Smith', t: 5, text: 'The pump was too close to the smoke.' });
  assert.equal(rows[1].speaker, '');
  assert.equal(rows[1].t, 10);
});

test('falls back to plain paragraphs', () => {
  const { format, rows } = parseTranscript('First paragraph about the fire.\n\nSecond paragraph\nwrapped across lines.');
  assert.equal(format, 'plain');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].text, 'Second paragraph wrapped across lines.');
});

test('clock helpers round-trip', () => {
  assert.equal(parseClock('2:05'), 125);
  assert.equal(parseClock('00:01:05.250'), 65);
  assert.equal(parseClock('garbage'), null);
  assert.equal(fmtClock(125), '2:05');
  assert.equal(fmtClock(3723), '1:02:03');
  assert.equal(fmtClock(null), '');
});
