import { searchWiki } from '../services/wikiSearchService';

const OPENAI_ENV = {
  AZURE_OPENAI_ENDPOINT: 'https://example-openai.azure.com',
  AZURE_OPENAI_KEY: 'test-key',
  AZURE_OPENAI_DEPLOYMENT_CHAT: 'gpt-test',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function chatCompletionBody(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('searchWiki', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, OPENAI_ENV);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns 503 when AI is not configured', async () => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_KEY;
    const outcome = await searchWiki('user-guide', 'how do I check in?');
    expect(outcome.status).toBe(503);
    expect(outcome.result).toBeUndefined();
  });

  it('returns a grounded answer with only real, cited slugs', async () => {
    const fetchImpl = jest.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(
        chatCompletionBody(
          JSON.stringify({
            answer: 'Tap Sign In on the kiosk and select your name.',
            covered: true,
            sources: ['sign-in', 'this-slug-does-not-exist'],
          })
        )
      )
    );

    const outcome = await searchWiki('user-guide', 'how do I check in?', fetchImpl as unknown as typeof fetch);

    expect(outcome.status).toBe(200);
    expect(outcome.result?.covered).toBe(true);
    expect(outcome.result?.answer).toContain('Sign In');
    // The hallucinated slug must be dropped even though the model cited it.
    expect(outcome.result?.sources).toEqual(['sign-in']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0];
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.messages[0].role).toBe('system');
    expect(sentBody.messages[0].content).toContain('<page slug="getting-started">');
    expect(sentBody.messages[1]).toEqual({ role: 'user', content: 'how do I check in?' });
  });

  it('reports covered:false when the model says the docs do not answer it', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(
        chatCompletionBody(
          JSON.stringify({ answer: "The guide doesn't cover that.", covered: false, sources: [] })
        )
      )
    );

    const outcome = await searchWiki('user-guide', 'can I fly a drone from the app?', fetchImpl as unknown as typeof fetch);
    expect(outcome.status).toBe(200);
    expect(outcome.result?.covered).toBe(false);
    expect(outcome.result?.sources).toEqual([]);
  });

  it('falls back through response_format attempts when the deployment 400s on json_schema', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ error: { message: 'response_format not supported' } }, 400);
      return jsonResponse(chatCompletionBody(JSON.stringify({ answer: 'ok', covered: true, sources: [] })));
    });

    const outcome = await searchWiki('user-guide', 'test', fetchImpl as unknown as typeof fetch);
    expect(outcome.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('extracts JSON from a free-form completion when structured output is unavailable', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call += 1;
      if (call < 3) return jsonResponse({ error: { message: 'unsupported' } }, 400);
      return jsonResponse(
        chatCompletionBody('Sure! Here you go: {"answer":"Use the sign-in board.","covered":true,"sources":["sign-in"]}')
      );
    });

    const outcome = await searchWiki('user-guide', 'test', fetchImpl as unknown as typeof fetch);
    expect(outcome.status).toBe(200);
    expect(outcome.result?.answer).toBe('Use the sign-in board.');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('returns 502 when every attempt fails to produce a parseable answer', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(chatCompletionBody('not json at all')));
    const outcome = await searchWiki('user-guide', 'test', fetchImpl as unknown as typeof fetch);
    expect(outcome.status).toBe(502);
    expect(outcome.result).toBeUndefined();
  });

  it('forwards a non-format provider error', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ error: 'rate limited upstream' }, 429));
    const outcome = await searchWiki('user-guide', 'test', fetchImpl as unknown as typeof fetch);
    expect(outcome.status).toBe(429);
    expect(outcome.error).toBe('rate limited upstream');
  });
});
