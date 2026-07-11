import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyReport, renderSnapshotHtml, renderCombinedHtml, renderMarkdown, sessionFilename, renderTranscriptText } from '../js/lib/exports.js';
import { normaliseSession } from '../js/lib/model.js';

const sample = normaliseSession(JSON.parse(await readFile(new URL('../data/sample-session.json', import.meta.url), 'utf8')));

test('emptyReport mirrors the session phases and pre-fills the headline', () => {
  const r = emptyReport(sample);
  assert.equal(r.headline, sample.incident.title);
  assert.deepEqual(r.phases.map((p) => p.name), sample.phases);
  assert.equal(r.actions.length, 3);
  assert.match(r.caveat, /verify/i);
});

test('snapshot HTML renders the key sections and escapes content', () => {
  const html = renderSnapshotHtml(sample);
  assert.match(html, /Executive Snapshot/);
  assert.match(html, /Example: Rural Structure Fire — Long Driveway Access/);
  assert.match(html, /Top three actions/);
  assert.match(html, /What worked/);
  assert.match(html, /Lessons/);
  assert.match(html, /800/); // stat value
  assert.match(html, /Who attended/);
  // escaping: the contextBar contains no raw < from data, prove esc works:
  const hostile = normaliseSession({ ...sample, report: { ...sample.report, headline: '<script>alert(1)</script>' } });
  assert.ok(!renderSnapshotHtml(hostile).includes('<script>alert(1)'));
  assert.ok(renderSnapshotHtml(hostile).includes('&lt;script&gt;'));
});

test('snapshot HTML omits empty sections gracefully', () => {
  const bare = normaliseSession({ incident: { title: 'Bare' }, aar: {}, units: [] });
  const html = renderSnapshotHtml(bare);
  assert.match(html, /Bare/);
  assert.ok(!html.includes('Top three actions'));
  assert.ok(!html.includes('Who attended'));
});

test('markdown summary includes report sections and the findings register', () => {
  const md = renderMarkdown(sample);
  assert.match(md, /^# After Action Review — Example: Rural Structure Fire/m);
  assert.match(md, /## Incident snapshot/);
  assert.match(md, /## Suppression/);
  assert.match(md, /## Consolidated recommendations/);
  assert.match(md, /## Top three actions/);
  assert.match(md, /## Findings register/);
  assert.match(md, /\[Went well\]/);
});

test('every export carries the "Produced with AAR Studio" attribution (AAR-19)', () => {
  assert.match(renderSnapshotHtml(sample), /Produced with AAR Studio · Bushie Tools/);
  assert.match(renderCombinedHtml(sample), /Produced with AAR Studio · Bushie Tools/);
  assert.match(renderMarkdown(sample), /Produced with AAR Studio · Bushie Tools/);
});

test('transcript text applies the speaker rename map', () => {
  const text = renderTranscriptText(sample);
  assert.match(text, /BACO:/);          // Speaker 4 renamed
  assert.ok(!text.includes('Speaker 4'));
});

test('sessionFilename slugifies', () => {
  assert.equal(sessionFilename(sample, 'snapshot', 'html'), 'example-rural-structure-fire-long-driveway-access-snapshot.html');
});

test('sessionFilename falls back to a date slug for an untitled review (AAR-24)', () => {
  const untitled = normaliseSession({ incident: { title: '', date: '2026-07-04' }, aar: {}, createdAt: '2026-07-04T09:00:00.000Z' });
  assert.equal(sessionFilename(untitled, 'snapshot', 'html'), 'aar-2026-07-04-snapshot.html');
  // No date anywhere → the old bare fallback, but still valid.
  const noDate = normaliseSession({ incident: { title: '' }, aar: {} });
  assert.match(sessionFilename(noDate, 'summary', 'md'), /^aar(-\d{4}-\d\d-\d\d)?-summary\.md$/);
});

test('room notes appear in the combined report and markdown exports (AAR-21)', () => {
  const withNotes = normaliseSession({
    ...sample,
    notes: [
      { id: 'n1', text: 'Second pump was late to the staging area.', label: 'Jo', t: 320, source: 'note', analysed: false },
      { id: 'n2', text: 'Radio channel was congested during rescue.', label: 'Room', t: null, source: 'note', analysed: false },
    ],
  });
  const html = renderCombinedHtml(withNotes);
  assert.match(html, /Appendix — room notes/);
  assert.match(html, /Second pump was late to the staging area\./);
  assert.match(html, /Jo:/);
  const md = renderMarkdown(withNotes);
  assert.match(md, /## Room notes/);
  assert.match(md, /\*\*Jo:\*\* Second pump was late/);
  // A review with no notes gets no appendix.
  assert.ok(!renderCombinedHtml(sample).includes('Appendix — room notes'));
  assert.ok(!renderMarkdown(sample).includes('## Room notes'));
});
