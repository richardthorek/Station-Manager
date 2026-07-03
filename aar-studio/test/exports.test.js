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
  assert.match(html, /Wamboin Structure Fire — 412 Macs Reef Road/);
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
  assert.match(md, /^# After Action Review — Wamboin/m);
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
  assert.equal(sessionFilename(sample, 'snapshot', 'html'), 'wamboin-structure-fire-412-macs-reef-road-snapshot.html');
});
