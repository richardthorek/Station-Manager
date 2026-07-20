/**
 * WikiDocument — the in-app wiki reader. Used both inside the WikiPanel
 * drawer and on the public /wiki page.
 *
 * Design: one continuous, scrollable document (every page in the section,
 * concatenated in manifest order) with a sidebar table of contents. Clicking
 * a sidebar entry scrolls to that section (`scrollIntoView`) — it never
 * triggers a new page load, so the reading position/scroll never resets and
 * back/forward never feels like leaving the guide. A search box filters the
 * sidebar instantly (everything's already loaded client-side) and can also
 * ask a grounded AI question over the same content (POST .../search) for
 * "I don't know what page this would even be on" queries.
 *
 * Layout adapts via a CSS container query on the wrapper, not a window media
 * query — so the same component lays out as a real two-column sidebar+content
 * page on the wide /wiki page, and collapses to a single column with a
 * disclosure-based nav inside the narrower WikiPanel drawer, without needing
 * two code paths.
 */

import { useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, Sparkles, Loader2, X, CircleAlert } from 'lucide-react';
import { api, type WikiManifest, type WikiPage, type WikiSection, type WikiSearchResult } from '../services/api';
import { WikiSearchUnavailableError } from '../services/wikiSearchError';
import './WikiDocument.css';

interface WikiDocumentProps {
  section: WikiSection;
  /** Scrolled to once, after content loads (e.g. a contextual open from HelpButton, or /wiki/:slug). */
  initialSlug?: string | null;
  /** Called whenever the reader settles on a page (initial scroll, sidebar click, or internal link) — lets the host update a URL without causing a navigation. */
  onActivePageChange?: (slug: string) => void;
}

const INTERNAL_LINK_PATTERN = /^([a-z0-9-]+)\.md(#.*)?$/;
const IMAGE_FILENAME_PATTERN = /^images\/([^/]+)$/;

// Only ever called with a non-empty, already-trimmed query — filteredSections
// short-circuits to the unfiltered list before this runs at all otherwise.
function matchesQuery(page: WikiPage, description: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    page.title.toLowerCase().includes(q) ||
    description.toLowerCase().includes(q) ||
    page.markdown.toLowerCase().includes(q)
  );
}

export function WikiDocument({ section, initialSlug, onActivePageChange }: WikiDocumentProps) {
  const [manifest, setManifest] = useState<WikiManifest | null>(null);
  const [pages, setPages] = useState<Map<string, WikiPage>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [aiState, setAiState] = useState<
    { status: 'idle' } | { status: 'loading'; query: string } | { status: 'done'; query: string; result: WikiSearchResult } | { status: 'unavailable'; query: string } | { status: 'error'; query: string; message: string }
  >({ status: 'idle' });

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lastScrolledSlug = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setManifest(null);
    setPages(new Map());
    setLoadError(null);
    lastScrolledSlug.current = null;

    api
      .getWikiManifest(section)
      .then(async (m) => {
        if (cancelled) return;
        setManifest(m);
        const slugs = m.sections.flatMap((s) => s.pages.map((p) => p.slug));
        const fetched = await Promise.all(
          slugs.map((slug) =>
            api
              .getWikiPage(slug, section)
              .then((page): [string, WikiPage] => [slug, page])
              .catch((): [string, WikiPage] | null => null)
          )
        );
        if (cancelled) return;
        const map = new Map<string, WikiPage>();
        for (const entry of fetched) {
          if (entry) map.set(entry[0], entry[1]);
        }
        setPages(map);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the help contents.');
      });

    return () => {
      cancelled = true;
    };
  }, [section]);

  // Scroll to the contextual/deep-linked page once its content has rendered —
  // and again whenever initialSlug itself changes (e.g. a later useWiki().navigate()
  // call while the panel is already open), but never twice for the same slug.
  useEffect(() => {
    if (!initialSlug || pages.size === 0 || lastScrolledSlug.current === initialSlug) return;
    const el = sectionRefs.current.get(initialSlug);
    if (el) {
      lastScrolledSlug.current = initialSlug;
      el.scrollIntoView({ block: 'start' });
      onActivePageChange?.(initialSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlug, pages]);

  function scrollToSlug(slug: string) {
    const el = sectionRefs.current.get(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onActivePageChange?.(slug);
  }

  async function runAiSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setAiState({ status: 'loading', query: trimmed });
    try {
      const result = await api.searchWiki(trimmed, section);
      setAiState({ status: 'done', query: trimmed, result });
    } catch (err) {
      if (err instanceof WikiSearchUnavailableError) {
        setAiState({ status: 'unavailable', query: trimmed });
      } else {
        setAiState({ status: 'error', query: trimmed, message: err instanceof Error ? err.message : 'AI search failed' });
      }
    }
  }

  function renderLink({ children, href = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const internal = INTERNAL_LINK_PATTERN.exec(href);
    if (internal) {
      return (
        <a
          {...rest}
          href={`#${internal[1]}`}
          onClick={(e) => {
            e.preventDefault();
            scrollToSlug(internal[1]);
          }}
        >
          {children}
        </a>
      );
    }
    if (/^https?:\/\//.test(href)) {
      return (
        <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return (
      <a {...rest} href={href}>
        {children}
      </a>
    );
  }

  function renderImage(props: ImgHTMLAttributes<HTMLImageElement>) {
    const src = props.src || '';
    const match = IMAGE_FILENAME_PATTERN.exec(src);
    const resolvedSrc = match ? api.getWikiImageUrl(match[1], section) : src;
    // eslint-disable-next-line jsx-a11y/alt-text -- alt comes through from markdown via props
    return <img {...props} src={resolvedSrc} className="wiki-document__image" />;
  }

  const filteredSections = useMemo(() => {
    if (!manifest) return [];
    if (!query.trim()) return manifest.sections;
    return manifest.sections
      .map((s) => ({
        ...s,
        pages: s.pages.filter((p) => {
          const page = pages.get(p.slug);
          return page ? matchesQuery(page, p.description, query) : p.title.toLowerCase().includes(query.trim().toLowerCase());
        }),
      }))
      .filter((s) => s.pages.length > 0);
  }, [manifest, pages, query]);

  const loading = !manifest || pages.size === 0;

  return (
    <div className="wiki-document">
      <div className="wiki-document__search">
        <Search size={18} strokeWidth={2} className="wiki-document__search-icon" aria-hidden />
        <input
          type="search"
          className="wiki-document__search-input"
          placeholder="Search the guide, or ask a question…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runAiSearch(query);
          }}
          aria-label="Search the guide, or ask a question"
        />
        {query && (
          <button type="button" className="wiki-document__search-clear" onClick={() => { setQuery(''); setAiState({ status: 'idle' }); }} aria-label="Clear search">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className="wiki-document__ask-ai"
          onClick={() => runAiSearch(query)}
          disabled={!query.trim() || aiState.status === 'loading'}
        >
          <Sparkles size={15} strokeWidth={2} aria-hidden /> Ask AI
        </button>
      </div>

      {aiState.status !== 'idle' && (
        <div className="wiki-document__ai-answer" role="status">
          {aiState.status === 'loading' && (
            <div className="wiki-document__ai-loading">
              <Loader2 size={16} strokeWidth={2} className="wiki-document__spinner" aria-hidden /> Reading the guide…
            </div>
          )}
          {aiState.status === 'unavailable' && (
            <p className="wiki-document__ai-hint">
              AI search isn't switched on for this deployment — try the contents below, or a different search term.
            </p>
          )}
          {aiState.status === 'error' && <p className="wiki-document__ai-hint">{aiState.message}</p>}
          {aiState.status === 'done' && (
            <>
              {!aiState.result.covered && (
                <div className="wiki-document__ai-uncovered">
                  <CircleAlert size={16} strokeWidth={2} aria-hidden /> Not directly covered by the guide
                </div>
              )}
              <p className="wiki-document__ai-text">{aiState.result.answer}</p>
              {aiState.result.sources.length > 0 && (
                <div className="wiki-document__ai-sources">
                  {aiState.result.sources.map((slug) => {
                    const page = pages.get(slug);
                    if (!page) return null;
                    return (
                      <button key={slug} type="button" className="wiki-document__ai-source" onClick={() => scrollToSlug(slug)}>
                        {page.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {loadError && <p className="wiki-document__error">{loadError}</p>}

      {loading && !loadError && (
        <div className="wiki-document__loading">
          <Loader2 size={20} strokeWidth={2} className="wiki-document__spinner" aria-hidden /> Loading…
        </div>
      )}

      {!loading && (
        <div className="wiki-document__layout">
          <nav className="wiki-document__sidebar" aria-label="Guide contents">
            {filteredSections.map((s) => (
              <div key={s.heading} className="wiki-document__toc-section">
                <h2 className="wiki-document__toc-heading">{s.heading}</h2>
                <ul className="wiki-document__toc-list">
                  {s.pages.map((p) => (
                    <li key={p.slug}>
                      <a
                        href={`#${p.slug}`}
                        className="wiki-document__toc-link"
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToSlug(p.slug);
                        }}
                      >
                        {p.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {filteredSections.length === 0 && <p className="wiki-document__toc-empty">No pages match "{query}".</p>}
          </nav>

          <div className="wiki-document__content">
            {manifest?.sections.flatMap((s) => s.pages).map((p) => {
              const page = pages.get(p.slug);
              if (!page) return null;
              return (
                <section
                  key={p.slug}
                  id={p.slug}
                  className="wiki-document__article"
                  ref={(el) => {
                    if (el) sectionRefs.current.set(p.slug, el);
                    else sectionRefs.current.delete(p.slug);
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: renderLink, img: renderImage }}>
                    {page.markdown}
                  </ReactMarkdown>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
