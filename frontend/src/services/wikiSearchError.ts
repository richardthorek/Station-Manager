/**
 * Split out of api.ts on purpose: tests need to import this real class for
 * `instanceof` checks (WikiDocument's AI-search error handling), but
 * importing anything real from api.ts — even one export — forces Vitest to
 * load and instrument the entire ~2200-line ApiService class for coverage,
 * which is otherwise always fully mocked in tests and tanks the aggregate
 * coverage numbers. Keeping this class in its own tiny file avoids that.
 */
export class WikiSearchUnavailableError extends Error {
  constructor() {
    super('AI search is not configured on this server');
    this.name = 'WikiSearchUnavailableError';
  }
}
