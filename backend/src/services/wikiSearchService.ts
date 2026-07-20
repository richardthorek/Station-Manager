/**
 * AI-grounded wiki search — "ask a question, get an answer sourced from the
 * actual user guide" rather than a keyword list. Deliberately full-context
 * (the whole section's markdown goes in the prompt) rather than a vector-RAG
 * pipeline: the corpus is a handful of short pages, so stuffing the full text
 * is simpler, cheaper to build/maintain, and strictly more accurate than
 * retrieval that could miss the right chunk.
 *
 * Grounding contract (this is the whole point — see CLAUDE.md's "never present
 * fabricated data as real analysis" ethos, same principle applied to docs):
 * the model is instructed to answer ONLY from the supplied pages, to say so
 * when the docs don't cover the question, and every "source" slug it cites is
 * re-validated against the real manifest server-side before being returned —
 * a hallucinated slug is dropped, never trusted onto the client.
 */

import { chatCompletion, isOpenAiConfigured, type ChatMessage } from './aiGateway';
import { getAllWikiPages, type WikiPage, type WikiSection } from './wikiContentService';

export interface WikiSearchResult {
  answer: string;
  covered: boolean;
  sources: string[];
}

export interface WikiSearchOutcome {
  status: number;
  result?: WikiSearchResult;
  error?: string;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    covered: { type: 'boolean' },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'covered', 'sources'],
  additionalProperties: false,
};

function buildCorpus(pages: WikiPage[]): string {
  return pages.map((p) => `<page slug="${p.slug}">\n${p.markdown}\n</page>`).join('\n\n');
}

function buildMessages(section: WikiSection, query: string, pages: WikiPage[]): ChatMessage[] {
  const audience = section === 'platform-admin' ? 'a platform operator' : 'a brigade member or brigade administrator';
  const system = [
    `You are a search assistant for the Station Manager ${section === 'platform-admin' ? 'platform-admin' : 'user'} guide, answering questions for ${audience}.`,
    'Answer ONLY using the documentation between <page> tags below — never use general knowledge, never guess, never invent features, steps, or menu names that are not in the text.',
    'If the documentation does not answer the question, set "covered" to false and say so plainly in "answer" rather than guessing.',
    'Keep "answer" short and practical: 2-4 sentences, plain language, no jargon.',
    'List the slug of every <page> the answer actually draws from in "sources" — only slugs that appear below, only ones actually used.',
    '',
    buildCorpus(pages),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: query },
  ];
}

function extractJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // fall through to brace-extraction below
  }
  const match = /\{[\s\S]*\}/.exec(content);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function isWikiSearchResult(value: unknown): value is WikiSearchResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.answer === 'string' && typeof v.covered === 'boolean' && Array.isArray(v.sources);
}

/**
 * Structured-output strategy mirrors aar-studio/js/lib/llm.js: try strict
 * json_schema first, fall back to json_object, then free-form + manual
 * extraction — some Azure OpenAI deployments/api-versions 400 on
 * response_format shapes the deployed model doesn't support.
 */
export async function searchWiki(
  section: WikiSection,
  query: string,
  fetchImpl?: typeof fetch
): Promise<WikiSearchOutcome> {
  if (!isOpenAiConfigured()) {
    return { status: 503, error: 'AI search is not configured on this server' };
  }

  const pages = getAllWikiPages(section);
  if (pages.length === 0) {
    return { status: 200, result: { answer: 'No documentation is available to search.', covered: false, sources: [] } };
  }

  const knownSlugs = new Set(pages.map((p) => p.slug));
  const messages = buildMessages(section, query, pages);

  const attempts: Array<{ type: string; json_schema?: unknown } | undefined> = [
    { type: 'json_schema', json_schema: { name: 'wiki_search_result', strict: true, schema: RESPONSE_SCHEMA } },
    { type: 'json_object' },
    undefined,
  ];

  let lastError: string | undefined;
  for (const responseFormat of attempts) {
    const result = await chatCompletion({ kind: 'chat', messages, responseFormat, fetchImpl });

    if (responseFormat && result.status === 400) {
      // Unsupported response_format for this deployment/api-version — try the next fallback.
      lastError = 'Deployment rejected structured output request';
      continue;
    }
    if (result.status < 200 || result.status >= 300) {
      const body = result.body as { error?: string } | undefined;
      return { status: result.status, error: body?.error || 'AI search failed' };
    }

    const body = result.body as { choices?: Array<{ message?: { content?: string } }> } | undefined;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      lastError = 'Empty completion from the model';
      continue;
    }

    const parsed = extractJson(content);
    if (!isWikiSearchResult(parsed)) {
      lastError = 'Could not parse a structured answer from the model';
      continue;
    }

    // Never trust the model's citations blindly — drop anything that isn't a real page.
    const sources = parsed.sources.filter((slug) => knownSlugs.has(slug));
    return { status: 200, result: { answer: parsed.answer, covered: parsed.covered, sources } };
  }

  return { status: 502, error: lastError || 'AI search failed' };
}
