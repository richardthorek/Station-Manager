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

export function chatUrl(settings, deployment) {
  const endpoint = String(settings.llmEndpoint ?? '').trim().replace(/\/+$/, '');
  if (!endpoint) throw new LlmError('No Azure OpenAI endpoint configured', { hint: 'Open Settings and set your Foundry/Azure OpenAI endpoint, e.g. https://myresource.openai.azure.com' });
  if (!deployment) throw new LlmError('No deployment configured', { hint: 'Open Settings and set the chat deployment name (e.g. gpt-4o or gpt-4.1-mini).' });
  const apiVersion = settings.apiVersion || '2024-10-21';
  return `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
}

async function post(url, key, body, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new LlmError('Could not reach the Azure OpenAI endpoint', {
      hint: 'Network or CORS failure. Check the endpoint URL is correct (https://<resource>.openai.azure.com), that you are online, and that nothing (VPN/firewall) blocks *.openai.azure.com. Azure OpenAI allows browser calls by default — a CORS error usually means the URL or api-version is wrong.',
      cause: err,
    });
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message ?? ''; } catch { /* not json */ }
    const hints = {
      401: 'The api-key was rejected. Re-copy Key 1/Key 2 from the Azure portal for this resource.',
      403: 'Access denied — the key may be for a different resource, or the resource has network restrictions blocking the browser.',
      404: 'Deployment not found. Check the deployment name (not the model name) and the api-version.',
      429: 'Rate limited — the deployment is out of quota. Wait a moment or raise the deployment TPM.',
    };
    const err = new LlmError(`Azure OpenAI returned ${res.status}${detail ? `: ${detail}` : ''}`, { hint: hints[res.status] ?? '', status: res.status });
    throw err;
  }
  return res.json();
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
export async function chatJson({ settings, deployment, messages, schema, schemaName = 'result', fetchImpl = globalThis.fetch }) {
  const key = String(settings.llmKey ?? '').trim();
  if (!key) throw new LlmError('No Azure OpenAI key configured', { hint: 'Open Settings and paste an api-key for the resource. Keys are stored in this browser only.' });
  const url = chatUrl(settings, deployment);

  const attempts = [];
  if (schema) attempts.push({ type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } });
  attempts.push({ type: 'json_object' });
  attempts.push(null); // free-form, parse manually

  let lastErr = null;
  for (const responseFormat of attempts) {
    const body = { messages };
    if (responseFormat) body.response_format = responseFormat;
    try {
      const data = await post(url, key, body, fetchImpl);
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
