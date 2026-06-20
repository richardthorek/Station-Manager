import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatJson, usesGateway, LlmError } from '../js/lib/llm.js';

const ok = (content) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });

test('usesGateway is true with no endpoint, false when an endpoint is set', () => {
  assert.equal(usesGateway({}), true);
  assert.equal(usesGateway({ llmEndpoint: '   ' }), true);
  assert.equal(usesGateway({ llmEndpoint: 'https://x.openai.azure.com' }), false);
});

test('gateway mode posts to /api/ai/chat with the responseFormat body key', async () => {
  let seenUrl = '';
  let seenBody = null;
  const fetchImpl = async (url, { body }) => { seenUrl = url; seenBody = JSON.parse(body); return ok('{"ok":true}'); };
  const result = await chatJson({ settings: {}, messages: [{ role: 'user', content: 'hi' }], schema: { type: 'object' }, fetchImpl });
  assert.equal(seenUrl, '/api/ai/chat');
  assert.ok('responseFormat' in seenBody, 'sends responseFormat (camelCase) to the gateway');
  assert.equal('response_format' in seenBody, false, 'does not send the Azure-style key to the gateway');
  assert.deepEqual(result, { ok: true });
});

test('gateway mode routes kind=report to /api/ai/report', async () => {
  let seenUrl = '';
  const fetchImpl = async (url) => { seenUrl = url; return ok('{}'); };
  await chatJson({ settings: {}, kind: 'report', messages: [], fetchImpl });
  assert.equal(seenUrl, '/api/ai/report');
});

test('gateway mode surfaces a 402 as an LlmError with an upgrade hint (no retry)', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 402, json: async () => ({ error: 'AI session limit reached for this month' }) }; };
  await assert.rejects(
    chatJson({ settings: {}, messages: [], schema: { type: 'object' }, fetchImpl }),
    (err) => err instanceof LlmError && err.status === 402 && /upgrade/i.test(err.hint),
  );
  assert.equal(calls, 1, '402 is terminal — it must not fall back through the response-format attempts');
});

test('direct mode is unchanged: posts to the Azure URL with an api-key', async () => {
  let seenUrl = '';
  let seenHeaders = null;
  let seenBody = null;
  const fetchImpl = async (url, { headers, body }) => { seenUrl = url; seenHeaders = headers; seenBody = JSON.parse(body); return ok('{"ok":true}'); };
  const settings = { llmEndpoint: 'https://x.openai.azure.com', llmKey: 'k', apiVersion: '2024-10-21' };
  await chatJson({ settings, deployment: 'gpt-test', messages: [], schema: { type: 'object' }, fetchImpl });
  assert.match(seenUrl, /x\.openai\.azure\.com\/openai\/deployments\/gpt-test/);
  assert.equal(seenHeaders['api-key'], 'k');
  assert.ok('response_format' in seenBody, 'direct mode keeps the Azure-style response_format key');
});
