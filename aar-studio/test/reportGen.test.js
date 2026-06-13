import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reportSchema, buildReportMessages, normaliseReport, generateReport } from '../js/lib/reportGen.js';
import { renderCombinedHtml } from '../js/lib/exports.js';
import { normaliseSession, createSession, GENERAL_PHASE, sessionPhases } from '../js/lib/model.js';

const sample = normaliseSession(JSON.parse(await readFile(new URL('../data/sample-session.json', import.meta.url), 'utf8')));

test('report schema constrains phases to the session phases', () => {
  const schema = reportSchema(['Arrival', GENERAL_PHASE]);
  assert.deepEqual(schema.properties.phases.items.properties.name.enum, ['Arrival', GENERAL_PHASE]);
  assert.equal(schema.additionalProperties, false);
});

test('report prompt carries findings, units and style rules', () => {
  const [system, user] = buildReportMessages(sample);
  assert.match(system.content, /Bold lead/);
  assert.match(system.content, /BACO/);
  assert.match(user.content, /Wamboin/);
  assert.match(user.content, /\[Arrival \| What didn't go well\]/);
  assert.match(user.content, /Fire & Rescue NSW/);
});

test('normaliseReport keeps session phase order, clamps themes/actions, pads actions to 3', () => {
  const session = createSession({ phases: ['Arrival', 'Suppression'] });
  const raw = {
    headline: ' H ',
    stats: [{ value: '8', label: 'Appliances' }, { value: '', label: '' }],
    phases: [
      { name: 'Suppression', happened: 'late entry first', well: ['a'], didnt: [] },
      { name: 'Arrival', happened: 'early', well: [], didnt: ['b'] },
      { name: GENERAL_PHASE, happened: '', well: ['cross-cutting'], didnt: [] },
      { name: 'Bogus', happened: 'dropped', well: [], didnt: [] },
    ],
    themes: [{ title: '1' , body: '' }, { title: '2', body: '' }, { title: '3', body: '' }, { title: '4', body: '' }],
    recommendations: ['r1', ''],
    actions: ['only one'],
    assessment: 'ok',
  };
  const r = normaliseReport(raw, session);
  assert.equal(r.headline, 'H');
  assert.deepEqual(r.phases.map((p) => p.name), ['Arrival', 'Suppression', GENERAL_PHASE]);
  assert.equal(r.phases[0].happened, 'early');
  assert.equal(r.stats.length, 1);
  assert.equal(r.themes.length, 3);
  assert.deepEqual(r.actions, ['only one', '', '']);
  assert.match(r.caveat, /verify/i); // default caveat filled in
});

test('generateReport maps a model reply onto the report shape', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({
        headline: 'Wamboin Shed Fire', contextBar: 'No mains water',
        stats: [{ value: '0', label: 'Injuries' }],
        snapshot: ['It burned.'],
        phases: sessionPhases(sample).map((name) => ({ name, happened: '', well: [], didnt: [] })),
        themes: [], recommendations: ['Do the thing'],
        actions: ['One', 'Two', 'Three'], assessment: 'Handled well.', caveat: 'Verify before distribution.',
      }) } }],
    }),
  });
  const settings = { llmEndpoint: 'https://x.openai.azure.com', llmKey: 'k', llmDeployment: 'mini', reportDeployment: 'big' };
  const report = await generateReport({ session: sample, settings, fetchImpl });
  assert.equal(report.headline, 'Wamboin Shed Fire');
  assert.deepEqual(report.actions, ['One', 'Two', 'Three']);
});

test('generateReport refuses to run without findings', async () => {
  await assert.rejects(
    generateReport({ session: createSession(), settings: {}, fetchImpl: async () => {} }),
    /No findings/,
  );
});

test('combined report contains snapshot, summary, register and optional transcript', () => {
  const withT = renderCombinedHtml(sample, { includeTranscript: true });
  assert.match(withT, /Executive Snapshot/);
  assert.match(withT, /Full summary/);
  assert.match(withT, /Findings register/);
  assert.match(withT, /Appendix — transcript/);
  assert.match(withT, /BACO:/); // speaker rename map applied in the appendix

  const without = renderCombinedHtml(sample);
  assert.ok(!without.includes('Appendix — transcript'));
  assert.match(without, /Findings register/);
});
