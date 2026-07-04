// Azure OpenAI chat-completions client (Azure AI Foundry deployments).
// Browser → Azure directly; the api-key comes from settings (localStorage).
// Pure fetch — loadable under node for tests.
//
// Structured output strategy: try response_format json_schema (strict);
// a 400 means the api-version/model doesn't support it, so fall back to
// json_object, then to free-form + JSON extraction. temperature/max_tokens
// are never sent so reasoning models work unchanged.

export class LlmError extends Error {
  constructor(message, { hint = '', status = null, cause = null } = {}) {
    super(message);
    this.name = 'LlmError';
    this.hint = hint;
    this.status = status;
    this.cause = cause;
  }
}

// Statuses where waiting and retrying can never help — the facilitator has to
// act (sign in, top up, upgrade) before the AI comes back. Auto-extraction
// treats these as "persistent" so it can stop hammering an identical toast
// every 45s for the rest of the meeting (AAR Studio hero review 2026-07-03,
// AAR-10); 429/503/network errors are left as transient/retryable.
const PERSISTENT_AI_STATUSES = new Set([401, 402, 403]);

export function isPersistentAiError(err) {
  return err instanceof LlmError && PERSISTENT_AI_STATUSES.has(err.status);
}

export function chatUrl(settings, deployment) {
  const endpoint = String(settings.llmEndpoint ?? '').trim().replace(/\/+$/, '');
  if (!endpoint) throw new LlmError('No Azure OpenAI endpoint configured', { hint: 'Open Settings and set your Foundry/Azure OpenAI endpoint, e.g. https://myresource.openai.azure.com' });
  if (!deployment) throw new LlmError('No deployment configured', { hint: 'Open Settings and set the chat deployment name (e.g. gpt-4o or gpt-4.1-mini).' });
  const apiVersion = settings.apiVersion || '2024-10-21';
  return `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
}

// Direct-mode (browser → Azure) error hints.
const DIRECT_HINTS = {
  401: 'The api-key was rejected. Re-copy Key 1/Key 2 from the Azure portal for this resource.',
  403: 'Access denied — the key may be for a different resource, or the resource has network restrictions blocking the browser.',
  404: 'Deployment not found. Check the deployment name (not the model name) and the api-version.',
  429: 'Rate limited — the deployment is out of quota. Wait a moment or raise the deployment TPM.',
};

// Gateway-mode (browser → /api/ai → Azure) error hints, in plain language.
const GATEWAY_HINTS = {
  401: 'Please sign in to your team account to use the AI features.',
  402: 'You’ve used all your AI sessions for this month. Upgrade your plan or top up to keep going.',
  403: 'AI features aren’t included in your current plan. Upgrade to AI Pro to turn them on.',
  503: 'The AI service isn’t set up on the server yet. Ask your administrator to configure it.',
};

async function post(url, headers, body, fetchImpl, gateway = false) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new LlmError(
      gateway ? 'Could not reach the AI service' : 'Could not reach the Azure OpenAI endpoint',
      {
        hint: gateway
          ? 'Network failure talking to this site’s AI service. Check you are online and try again.'
          : 'Network or CORS failure. Check the endpoint URL is correct (https://<resource>.openai.azure.com), that you are online, and that nothing (VPN/firewall) blocks *.openai.azure.com. Azure OpenAI allows browser calls by default — a CORS error usually means the URL or api-version is wrong.',
        cause: err,
      },
    );
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message ?? ''; } catch { /* not json */ }
    const hints = gateway ? GATEWAY_HINTS : DIRECT_HINTS;
    const label = gateway ? 'The AI service' : 'Azure OpenAI';
    const err = new LlmError(`${label} returned ${res.status}${detail ? `: ${detail}` : ''}`, { hint: hints[res.status] ?? '', status: res.status });
    throw err;
  }
  return res.json();
}

/** AAR Studio runs in gateway mode unless the user has set their own Azure endpoint. */
export function usesGateway(settings) {
  return !String(settings?.llmEndpoint ?? '').trim();
}

/** Bearer header from the SPA's stored token (same origin), when present. */
function gatewayAuthHeader() {
  try {
    const token = globalThis.localStorage?.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Strip ``` fences / prose and return the first JSON object in `text`. */
export function extractJsonObject(text) {
  const s = String(text ?? '');
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], s, s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try { return JSON.parse(c.trim()); } catch { /* try next */ }
  }
  throw new LlmError('The model reply was not valid JSON', { hint: 'Try again, or use a deployment that supports structured outputs.' });
}

/**
 * Run a chat completion that must return a JSON object.
 * @returns {Promise<object>} parsed JSON content
 */
export async function chatJson({ settings, deployment, messages, schema, schemaName = 'result', fetchImpl = globalThis.fetch, kind = 'chat' }) {
  const gateway = usesGateway(settings);

  // Pick the transport. Gateway mode sends the capability (kind) — the server
  // holds the credentials and chooses the deployment — and uses `responseFormat`
  // (camelCase) as the request body key. Direct mode is unchanged: browser →
  // Azure with the user's api-key and `response_format`.
  let url, headers, formatKey;
  if (gateway) {
    url = kind === 'report' ? '/api/ai/report' : '/api/ai/chat';
    headers = gatewayAuthHeader();
    formatKey = 'responseFormat';
  } else {
    const key = String(settings.llmKey ?? '').trim();
    if (!key) throw new LlmError('No Azure OpenAI key configured', { hint: 'Open Settings and paste an api-key for the resource, or clear the endpoint to use this site’s built-in AI.' });
    url = chatUrl(settings, deployment);
    headers = { 'api-key': key };
    formatKey = 'response_format';
  }

  const attempts = [];
  if (schema) attempts.push({ type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } });
  attempts.push({ type: 'json_object' });
  attempts.push(null); // free-form, parse manually

  let lastErr = null;
  for (const responseFormat of attempts) {
    const body = { messages };
    if (responseFormat) body[formatKey] = responseFormat;
    try {
      const data = await post(url, headers, body, fetchImpl, gateway);
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new LlmError('Empty completion from the model');
      return responseFormat ? JSON.parse(content) : extractJsonObject(content);
    } catch (err) {
      lastErr = err;
      // Only a 400 (unsupported response_format / schema) warrants falling
      // back; auth, network and rate-limit errors won't improve by retrying.
      if (!(err instanceof LlmError) || err.status !== 400) throw err;
    }
  }
  throw lastErr;
}

/** Cheap round-trip used by the Settings "Test connection" button. */
export async function testConnection(settings, fetchImpl = globalThis.fetch) {
  const result = await chatJson({
    settings,
    deployment: settings.llmDeployment,
    messages: [
      { role: 'system', content: 'Reply with a JSON object exactly like {"ok": true}.' },
      { role: 'user', content: 'ping' },
    ],
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    schemaName: 'ping',
    fetchImpl,
  });
  if (result?.ok !== true) throw new LlmError('Unexpected reply from the model');
  return true;
}
