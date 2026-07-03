/**
 * Voice-agent conversation loop (A3 inc 2).
 *
 * One user turn in, one agent reply out — with Azure OpenAI function-calling
 * in between. Tool calls are dispatched through AgentToolExecutor and every
 * step (user text, each tool call, the final reply) is persisted as an
 * AgentTurn so the session transcript is complete.
 *
 * Prompt-state design: only user/agent *text* turns are replayed as history.
 * Recorded check state lives in the database, and the system prompt tells the
 * model to re-ground itself via get_appliance_context — so a reconnect or a
 * long session never desyncs the model from reality.
 */

import { chatCompletion, ChatMessage, isOpenAiConfigured } from './aiGateway';
import { AGENT_TOOL_DEFINITIONS, AgentToolExecutor } from './agentTools';
import { ensureAgentSessionDatabase } from './agentSessionDbFactory';
import { logger } from './logger';
import type { AgentSession } from '../types';

/** Hard cap on tool-call iterations within one user turn. */
const MAX_TOOL_ITERATIONS = 8;

const SYSTEM_PROMPT = `You are a NSW RFS truck-check assistant guiding a brigade member through a vehicle inspection by voice. Be brief and practical — one checklist item at a time, plain spoken language suited to text-to-speech (no markdown, no lists).

Rules:
- Start by calling get_appliance_context to learn the truck, its zones, its quirks, and the checklist.
- Walk the check in zone order. Use next_unchecked_in_zone to pick the next item; mention which zone you are in when it changes.
- When the member reports an outcome, record it with record_result (or flag_issue) before moving on. Read back any issue in one short sentence so they can correct you.
- If an answer is ambiguous, ask one short clarifying question rather than guessing.
- Never invent checklist items, zones, or equipment — only what the tools return.
- When every item is recorded and the member confirms they are finished, call complete_run with a short summary, then say goodbye.`;

/** Shape of an Azure OpenAI assistant message with optional tool calls. */
interface ProviderToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ProviderChoiceMessage {
  content?: string | null;
  tool_calls?: ProviderToolCall[];
}

export interface AgentTurnOutcome {
  /** The agent's spoken reply for this turn. */
  text: string;
  /** Number of tool calls executed while producing the reply. */
  toolCallsMade: number;
  /** True when complete_run was executed this turn (session is finished). */
  completed: boolean;
}

function extractMessage(body: unknown): ProviderChoiceMessage | null {
  const choices = (body as { choices?: Array<{ message?: ProviderChoiceMessage }> })?.choices;
  return choices?.[0]?.message ?? null;
}

/**
 * Was a complete_run tool result actually a success? AgentToolExecutor.execute
 * always resolves to a JSON string (the OpenAI tool-message wire shape), so we
 * parse it and read the typed `completed` field rather than substring-matching
 * the raw text — a summary or issue comment that happened to contain the
 * literal text `"completed":true` could otherwise end the session early
 * (A3 code review, reuse/simplification section).
 */
function isCompletedToolResult(output: string): boolean {
  try {
    const parsed = JSON.parse(output) as { completed?: unknown };
    return parsed.completed === true;
  } catch {
    return false;
  }
}

/**
 * Run one user turn through the tool loop. Throws only on unexpected internal
 * errors; provider failures come back as a spoken-style error message so the
 * WS layer can always relay something to the member.
 */
export async function runAgentTurn(
  session: AgentSession,
  userText: string,
  executor: AgentToolExecutor,
  fetchImpl?: typeof fetch,
): Promise<AgentTurnOutcome> {
  const db = ensureAgentSessionDatabase();

  if (!isOpenAiConfigured()) {
    return { text: 'The AI service is not configured on this server yet.', toolCallsMade: 0, completed: false };
  }

  const priorTurns = await db.getTurnsForSession(session.id);
  let sequence = priorTurns.length;

  await db.addTurn({ sessionId: session.id, role: 'user', text: userText, sequence: sequence++ });

  // History = text turns only; live check state is re-fetched via tools.
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...priorTurns
      .filter((t) => (t.role === 'user' || t.role === 'agent') && t.text)
      .map((t): ChatMessage => ({ role: t.role === 'agent' ? 'assistant' : 'user', content: t.text ?? '' })),
    { role: 'user', content: userText },
  ];

  let toolCallsMade = 0;
  let completed = false;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const result = await chatCompletion({ kind: 'chat', messages, tools: AGENT_TOOL_DEFINITIONS, fetchImpl });
    if (result.status !== 200) {
      logger.error('Agent loop: provider error', { sessionId: session.id, status: result.status, body: result.body });
      const text = 'Sorry, I hit a problem talking to the AI service. Say that again in a moment, or finish the check on the screen.';
      await db.addTurn({ sessionId: session.id, role: 'system', text: `provider error ${result.status}`, sequence: sequence++ });
      return { text, toolCallsMade, completed };
    }

    const message = extractMessage(result.body);
    const toolCalls = message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const text = message?.content?.trim() || 'Sorry, I did not catch that — could you say it again?';
      await db.addTurn({ sessionId: session.id, role: 'agent', text, sequence: sequence++ });
      return { text, toolCallsMade, completed };
    }

    // Echo the assistant's tool-call message, then answer each call.
    messages.push({ role: 'assistant', content: message?.content ?? null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const output = await executor.execute(call.function.name, call.function.arguments);
      toolCallsMade++;
      if (call.function.name === 'complete_run' && isCompletedToolResult(output)) {
        completed = true;
      }
      await db.addTurn({
        sessionId: session.id,
        role: 'tool',
        text: `${call.function.name} → ${output.length > 500 ? output.slice(0, 500) + '…' : output}`,
        toolPayload: JSON.stringify({ name: call.function.name, arguments: call.function.arguments, output }),
        sequence: sequence++,
      });
      messages.push({ role: 'tool', content: output, tool_call_id: call.id });
    }
  }

  const text = 'I have done as much as I can in one go — where were we up to?';
  await db.addTurn({ sessionId: session.id, role: 'agent', text, sequence: sequence++ });
  return { text, toolCallsMade, completed };
}
