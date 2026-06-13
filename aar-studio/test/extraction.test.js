import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoExtract, chunkSegments, findingsSchema, buildMessages, toFinding, extractFromSegments } from '../js/lib/extraction.js';
import { extractJsonObject, chatJson, LlmError } from '../js/lib/llm.js';
import { createSession, createSegment, GENERAL_PHASE } from '../js/lib/model.js';

test('auto-extract trigger needs both elapsed time and pending words', () => {
  assert.equal(shouldAutoExtract({ msSinceLast: 50_000, wordsPending: 100 }), true);
  assert.equal(shouldAutoExtract({ msSinceLast: 10_000, wordsPending: 500 }), false);
  assert.equal(shouldAutoExtract({ msSinceLast: 90_000, wordsPending: 20 }), false);
});

test('chunkSegments respects the word budget and phase boundaries', () => {
  const seg = (phase, words) => createSegment({ phase, text: Array(words).fill('word').join(' ') });
  const chunks = chunkSegments([seg('Arrival', 200), seg('Arrival', 200), seg('Arrival', 200), seg('Suppression', 10)], 450);
  assert.equal(chunks.length, 3, 'split on budget then on phase change');
  assert.equal(chunks[2][0].phase, 'Suppression');
});

test('extraction prompt carries ids, phases and terminology guidance', () => {
  const session = createSession();
  session.incident.title = 'Wamboin Shed Fire';
  const segs = [createSegment({ text: 'Monitor at 800 litres a minute.', phase: 'Suppression', speaker: 'Dave' })];
  const [system, user] = buildMessages({ session, segments: segs });
  assert.match(system.content, /BACO/);
  assert.match(system.content, /\(unclear\)/);
  assert.match(system.content, /Wamboin Shed Fire/);
  assert.ok(user.content.includes(`[${segs[0].id}]`));
  const schema = findingsSchema(['Arrival', GENERAL_PHASE]);
  assert.deepEqual(schema.properties.findings.items.properties.phase.enum, ['Arrival', GENERAL_PHASE]);
});

test('toFinding clamps invalid category/phase and filters unknown segment ids', () => {
  const session = createSession();
  const pool = [createSegment({ text: 'x' })];
  const f = toFinding({ category: 'nonsense', phase: 'Mopup', text: ' t ', quote: 'q', segmentIds: [pool[0].id, 'bogus'] }, session, pool);
  assert.equal(f.category, 'happened');
  assert.equal(f.phase, GENERAL_PHASE);
  assert.deepEqual(f.segmentIds, [pool[0].id]);
  assert.equal(f.source, 'ai');
});

test('extractJsonObject tolerates fences and surrounding prose', () => {
  assert.deepEqual(extractJsonObject('Sure!\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(extractJsonObject('prefix {"b": 2} suffix'), { b: 2 });
  assert.throws(() => extractJsonObject('no json here'), LlmError);
});

const SETTINGS = { llmEndpoint: 'https://example.openai.azure.com', llmKey: 'k', llmDeployment: 'gpt-test', apiVersion: '2024-10-21' };
const okResponse = (content) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });

test('chatJson falls back from json_schema to json_object on 400', async () => {
  const formats = [];
  const fetchImpl = async (url, { body }) => {
    const format = JSON.parse(body).response_format?.type ?? 'none';
    formats.push(format);
    if (format === 'json_schema') return { ok: false, status: 400, json: async () => ({ error: { message: 'response_format not supported' } }) };
    return okResponse('{"findings": []}');
  };
  const result = await chatJson({ settings: SETTINGS, deployment: 'gpt-test', messages: [], schema: { type: 'object' }, fetchImpl });
  assert.deepEqual(result, { findings: [] });
  assert.deepEqual(formats, ['json_schema', 'json_object']);
});

test('chatJson surfaces auth errors with a hint instead of retrying', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 401, json: async () => ({ error: { message: 'bad key' } }) }; };
  await assert.rejects(
    chatJson({ settings: SETTINGS, deployment: 'gpt-test', messages: [], schema: { type: 'object' }, fetchImpl }),
    (err) => err instanceof LlmError && err.status === 401 && /api-key/i.test(err.hint),
  );
  assert.equal(calls, 1);
});

test('extractFromSegments maps model output into session findings', async () => {
  const session = createSession();
  const segs = [createSegment({ text: 'The pump was ten metres from the smoke all night.', phase: 'Arrival' })];
  const fetchImpl = async () => okResponse(JSON.stringify({
    findings: [{ category: 'didnt', phase: 'Arrival', text: 'Pump positioned too close to the smoke.', quote: 'ten metres from the smoke', segmentIds: [segs[0].id] }],
  }));
  const found = await extractFromSegments({ session, segments: segs, settings: SETTINGS, fetchImpl });
  assert.equal(found.length, 1);
  assert.equal(found[0].category, 'didnt');
  assert.equal(found[0].source, 'ai');
});
