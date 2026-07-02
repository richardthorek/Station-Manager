/**
 * Unit tests for the voice-agent conversation loop (A3 inc 2) — the Azure
 * OpenAI function-calling loop with a mocked provider, verifying tool dispatch
 * and full AgentTurn transcript persistence.
 */

import { runAgentTurn } from '../services/agentLoop';
import { AgentToolExecutor, AGENT_TOOL_DEFINITIONS } from '../services/agentTools';
import { ensureAgentSessionDatabase } from '../services/agentSessionDbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import type { AgentSession } from '../types';

let applianceId: string;

function providerReply(message: Record<string, unknown>, status = 200) {
  return { status, json: async () => ({ choices: [{ message }] }) } as unknown as Response;
}

async function newSession(): Promise<{ session: AgentSession; executor: AgentToolExecutor }> {
  const session = await ensureAgentSessionDatabase().createSession({
    applianceId,
    initiatedBy: 'Loop Tester',
    modality: 'voice',
  });
  return { session, executor: new AgentToolExecutor(session) };
}

beforeAll(async () => {
  process.env.AZURE_OPENAI_ENDPOINT = 'https://unit-test.openai.azure.com';
  process.env.AZURE_OPENAI_KEY = 'unit-test-key';
  process.env.AZURE_OPENAI_DEPLOYMENT_CHAT = 'gpt-test';

  const db = await ensureTruckChecksDatabase();
  const appliance = await db.createAppliance('Loop Test Pumper', 'fixture');
  applianceId = appliance.id;
  await db.updateTemplate(applianceId, [
    { name: 'Lights working', description: 'All beacons and floods', order: 0 },
  ]);
});

afterAll(() => {
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT_CHAT;
});

describe('runAgentTurn', () => {
  it('returns a config message without calling the provider when Azure OpenAI is unset', async () => {
    const saved = process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    try {
      const { session, executor } = await newSession();
      const fetchMock = jest.fn();
      const out = await runAgentTurn(session, 'hello', executor, fetchMock as unknown as typeof fetch);
      expect(out.text).toMatch(/not configured/i);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      process.env.AZURE_OPENAI_ENDPOINT = saved;
    }
  });

  it('relays a plain reply and persists the user + agent turns', async () => {
    const { session, executor } = await newSession();
    const fetchMock = jest.fn().mockResolvedValue(providerReply({ content: 'Ready when you are.' }));

    const out = await runAgentTurn(session, "G'day, let's start", executor, fetchMock as unknown as typeof fetch);
    expect(out).toEqual({ text: 'Ready when you are.', toolCallsMade: 0, completed: false });

    // The provider was offered the tool definitions.
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(sentBody.tools).toHaveLength(AGENT_TOOL_DEFINITIONS.length);
    expect(sentBody.messages[0].role).toBe('system');

    const turns = await ensureAgentSessionDatabase().getTurnsForSession(session.id);
    expect(turns.map((t) => t.role)).toEqual(['user', 'agent']);
    expect(turns[0].text).toBe("G'day, let's start");
    expect(turns[1].text).toBe('Ready when you are.');
  });

  it('executes tool calls, persists tool turns, and feeds outputs back to the provider', async () => {
    const { session, executor } = await newSession();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(providerReply({
        content: null,
        tool_calls: [{ id: 'call-1', function: { name: 'record_result', arguments: JSON.stringify({ item: 'Lights working', status: 'done' }) } }],
      }))
      .mockResolvedValueOnce(providerReply({ content: 'Lights recorded as done. That is everything.' }));

    const out = await runAgentTurn(session, 'lights are all good', executor, fetchMock as unknown as typeof fetch);
    expect(out.toolCallsMade).toBe(1);
    expect(out.text).toMatch(/lights recorded/i);

    // Second provider call carries the assistant tool_calls echo + tool output.
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body);
    const roles = secondBody.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(secondBody.messages[3].tool_call_id).toBe('call-1');
    expect(secondBody.messages[3].content).toMatch(/"recorded"/);

    // The tool actually ran — the run exists with the result.
    const db = await ensureTruckChecksDatabase();
    const results = await db.getResultsByRunId(session.runId!);
    expect(results).toHaveLength(1);

    const turns = await ensureAgentSessionDatabase().getTurnsForSession(session.id);
    expect(turns.map((t) => t.role)).toEqual(['user', 'tool', 'agent']);
    expect(JSON.parse(turns[1].toolPayload!).name).toBe('record_result');
  });

  it('flags completion when complete_run succeeds mid-turn', async () => {
    const { session, executor } = await newSession();
    await executor.execute('record_result', JSON.stringify({ item: 'Lights working', status: 'done' }));

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(providerReply({
        content: null,
        tool_calls: [{ id: 'call-2', function: { name: 'complete_run', arguments: JSON.stringify({ summary: 'All good.' }) } }],
      }))
      .mockResolvedValueOnce(providerReply({ content: 'Check complete, no issues. Goodbye.' }));

    const out = await runAgentTurn(session, "that's everything, wrap it up", executor, fetchMock as unknown as typeof fetch);
    expect(out.completed).toBe(true);
    expect(session.status).toBe('completed');
  });

  it('replays prior text turns as history but never tool turns', async () => {
    const { session, executor } = await newSession();
    const db = ensureAgentSessionDatabase();
    await db.addTurn({ sessionId: session.id, role: 'user', text: 'first thing', sequence: 0 });
    await db.addTurn({ sessionId: session.id, role: 'tool', text: 'noise', toolPayload: '{}', sequence: 1 });
    await db.addTurn({ sessionId: session.id, role: 'agent', text: 'first reply', sequence: 2 });

    const fetchMock = jest.fn().mockResolvedValue(providerReply({ content: 'ok' }));
    await runAgentTurn(session, 'second thing', executor, fetchMock as unknown as typeof fetch);

    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(sentBody.messages.map((m: { role: string; content: string | null }) => [m.role, m.content])).toEqual([
      ['system', expect.any(String)],
      ['user', 'first thing'],
      ['assistant', 'first reply'],
      ['user', 'second thing'],
    ]);
  });

  it('degrades gracefully on a provider error, recording a system turn', async () => {
    const { session, executor } = await newSession();
    const fetchMock = jest.fn().mockResolvedValue(providerReply({ }, 500));

    const out = await runAgentTurn(session, 'hello?', executor, fetchMock as unknown as typeof fetch);
    expect(out.text).toMatch(/problem talking to the AI service/i);

    const turns = await ensureAgentSessionDatabase().getTurnsForSession(session.id);
    expect(turns.map((t) => t.role)).toEqual(['user', 'system']);
    expect(turns[1].text).toMatch(/provider error 500/);
  });

  it('stops after the iteration cap instead of looping forever', async () => {
    const { session, executor } = await newSession();
    const fetchMock = jest.fn().mockResolvedValue(providerReply({
      content: null,
      tool_calls: [{ id: 'call-x', function: { name: 'get_appliance_context', arguments: '{}' } }],
    }));

    const out = await runAgentTurn(session, 'loop forever', executor, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(out.toolCallsMade).toBe(8);
    expect(out.text).toMatch(/where were we/i);
  });
});
