/**
 * WikiContent — shared renderer for the in-app wiki, used by both the
 * WikiPanel drawer and the public /wiki page. Fetches the manifest (table of
 * contents) and, when a page is selected, the page's markdown, then renders
 * it with react-markdown. Relative image paths and internal .md links are
 * rewritten to hit the wiki API / in-app navigation instead of 404ing.
 */

import { useEffect, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { api, type WikiManifest, type WikiPage, type WikiSection } from '../services/api';
import './WikiContent.css';

interface WikiContentProps {
  section: WikiSection;
  activeSlug: string | null;
  onNavigate: (slug: string | null) => void;
}

const INTERNAL_LINK_PATTERN = /^([a-z0-9-]+)\.md(#.*)?$/;
const IMAGE_FILENAME_PATTERN = /^images\/([^/]+)$/;

export function WikiContent({ section, activeSlug, onNavigate }: WikiContentProps) {
  const [manifest, setManifest] = useState<WikiManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [page, setPage] = useState<WikiPage | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getWikiManifest(section)
      .then((m) => {
        if (!cancelled) setManifest(m);
      })
      .catch(() => {
        if (!cancelled) setManifestError('Could not load the help contents.');
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  useEffect(() => {
    if (!activeSlug) {
      setPage(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPageError(null);
    api
      .getWikiPage(activeSlug, section)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch(() => {
        if (!cancelled) setPageError('Could not load this help page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, activeSlug]);

  function renderLink({ children, href = '', ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const internal = INTERNAL_LINK_PATTERN.exec(href);
    if (internal) {
      return (
        <a
          {...rest}
          href={href}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(internal[1]);
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
    return <img {...props} src={resolvedSrc} className="wiki-content__image" />;
  }

  if (activeSlug) {
    return (
      <div className="wiki-content">
        <button type="button" className="wiki-content__back" onClick={() => onNavigate(null)}>
          <ChevronLeft size={16} strokeWidth={2} aria-hidden /> All help topics
        </button>
        {loading && (
          <div className="wiki-content__loading">
            <Loader2 size={20} strokeWidth={2} className="wiki-content__spinner" aria-hidden /> Loading…
          </div>
        )}
        {pageError && <p className="wiki-content__error">{pageError}</p>}
        {!loading && page && (
          <article className="wiki-content__article">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ a: renderLink, img: renderImage }}
            >
              {page.markdown}
            </ReactMarkdown>
          </article>
        )}
      </div>
    );
  }

  return (
    <div className="wiki-content">
      {manifestError && <p className="wiki-content__error">{manifestError}</p>}
      {!manifest && !manifestError && (
        <div className="wiki-content__loading">
          <Loader2 size={20} strokeWidth={2} className="wiki-content__spinner" aria-hidden /> Loading…
        </div>
      )}
      {manifest?.sections.map((s) => (
        <section key={s.heading} className="wiki-content__toc-section">
          <h2 className="wiki-content__toc-heading">{s.heading}</h2>
          <ul className="wiki-content__toc-list">
            {s.pages.map((p) => (
              <li key={p.slug}>
                <button type="button" className="wiki-content__toc-item" onClick={() => onNavigate(p.slug)}>
                  <span className="wiki-content__toc-title">{p.title}</span>
                  <span className="wiki-content__toc-description">{p.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
