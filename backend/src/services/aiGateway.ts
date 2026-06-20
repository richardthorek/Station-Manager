/**
 * Server-side AI gateway — provider adapters.
 *
 * Centralises the AI provider credentials (held server-side, never in the
 * browser) and routes a logical capability to the right provider/deployment.
 * AAR Studio and the SPA call `/api/ai/*`; those routes call into here.
 *
 * Providers:
 *  - Azure OpenAI  → chat + report (chat-completions)
 *  - Azure Speech  → short-lived STT/TTS token vend
 *  - Anthropic     → stubbed adapter (capability routing seam for later)
 *
 * Configuration is entirely env-driven so the catalog stays deployment-
 * agnostic and no secrets live in code:
 *   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY,
 *   AZURE_OPENAI_DEPLOYMENT_CHAT, AZURE_OPENAI_DEPLOYMENT_REPORT,
 *   AZURE_OPENAI_API_VERSION (optional),
 *   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
 */

import { logger } from './logger';

export type AiKind = 'chat' | 'report';

export interface ChatResult {
  /** HTTP status to forward to the caller (200, or the provider's error status). */
  status: number;
  /** Raw provider JSON body (Azure OpenAI chat-completion shape) or an error body. */
  body: unknown;
  /** Token usage when the provider reports it, for metering/observability. */
  usage?: { promptTokens?: number; completionTokens?: number };
}

const DEFAULT_OPENAI_API_VERSION = '2024-10-21';

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY);
}

export function isSpeechConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

/** True when at least one AI capability is available. */
export function isAiConfigured(): boolean {
  return isOpenAiConfigured() || isSpeechConfigured();
}

function deploymentFor(kind: AiKind): string | undefined {
  if (kind === 'report') {
    return process.env.AZURE_OPENAI_DEPLOYMENT_REPORT || process.env.AZURE_OPENAI_DEPLOYMENT_CHAT;
  }
  return process.env.AZURE_OPENAI_DEPLOYMENT_CHAT;
}

export interface ChatRequest {
  kind: AiKind;
  messages: Array<{ role: string; content: string }>;
  responseFormat?: unknown;
  fetchImpl?: typeof fetch;
}

/**
 * Proxy a chat-completion to Azure OpenAI. Returns the provider's status and
 * body verbatim so the client's structured-output fallback (json_schema →
 * json_object → free-form) keeps working unchanged through the gateway.
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const fetchImpl = req.fetchImpl ?? fetch;
  const endpoint = String(process.env.AZURE_OPENAI_ENDPOINT ?? '').trim().replace(/\/+$/, '');
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = deploymentFor(req.kind);
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULT_OPENAI_API_VERSION;

  if (!endpoint || !key) {
    return { status: 503, body: { error: 'AI chat is not configured on this server' } };
  }
  if (!deployment) {
    return { status: 503, body: { error: 'No Azure OpenAI deployment configured for this capability' } };
  }

  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const body: Record<string, unknown> = { messages: req.messages };
  if (req.responseFormat) body.response_format = req.responseFormat;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error('AI gateway: could not reach Azure OpenAI', { error: err });
    return { status: 502, body: { error: 'Could not reach the AI provider' } };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = { error: 'Provider returned a non-JSON response' };
  }

  const usageRaw = (json as { usage?: { prompt_tokens?: number; completion_tokens?: number } })?.usage;
  return {
    status: res.status,
    body: json,
    usage: usageRaw
      ? { promptTokens: usageRaw.prompt_tokens, completionTokens: usageRaw.completion_tokens }
      : undefined,
  };
}

export interface SpeechToken {
  token: string;
  region: string;
}

/**
 * Vend a short-lived (≈10 min) Azure Speech authorization token so the browser
 * can open the realtime STT websocket without ever holding the subscription
 * key. The token is region-scoped; the SDK uses `fromAuthorizationToken`.
 */
export async function issueSpeechToken(fetchImpl: typeof fetch = fetch): Promise<SpeechToken> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new GatewayError(503, 'Speech is not configured on this server');
  }

  const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    });
  } catch (err) {
    logger.error('AI gateway: could not reach Azure Speech token service', { error: err });
    throw new GatewayError(502, 'Could not reach the speech provider');
  }
  if (!res.ok) {
    logger.warn('AI gateway: speech token request failed', { status: res.status });
    throw new GatewayError(502, `Speech token request failed (${res.status})`);
  }
  const token = await res.text();
  return { token, region };
}

/** Error carrying an HTTP status for the route layer to forward. */
export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
  }
}

/**
 * Anthropic adapter — stubbed. Present so the capability-routing seam exists;
 * wiring a real Anthropic provider only needs this function implemented and a
 * routing rule in chatCompletion.
 */
export async function chatCompletionAnthropic(_req: ChatRequest): Promise<ChatResult> {
  return { status: 501, body: { error: 'Anthropic provider is not yet implemented' } };
}
