/**
 * Public /wiki and /wiki/:slug — the full-page version of the user guide.
 * Unauthenticated, ungated (no AccessRoute/ProtectedRoute/FeatureRoute):
 * this is the "point people at stationkit.com.au/wiki" surface, meant to work
 * for prospects who haven't logged in as well as signed-in members who opened
 * "Open full guide in a new tab" from the WikiPanel drawer. Renders the same
 * WikiContent component the drawer uses, just with page chrome around it
 * instead of a sidebar.
 */

import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { PageTransition } from '../../components/PageTransition';
import { BrandMark } from '../../components/BrandMark';
import { WikiContent } from '../../components/WikiContent';
import './WikiFullPage.css';

export function WikiFullPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = slug ? `${slug.replace(/-/g, ' ')} — StationKit help` : 'StationKit help & user guide';
  }, [slug]);

  return (
    <PageTransition variant="fade">
      <div className="wiki-full-page">
        <header className="wiki-full-page__header">
          <Link to="/" className="wiki-full-page__home" aria-label="Back to StationKit home">
            <BrandMark size={22} /> StationKit
          </Link>
          <h1 className="wiki-full-page__title">Help &amp; user guide</h1>
        </header>
        <main className="wiki-full-page__main" id="main-content" tabIndex={-1}>
          <WikiContent
            section="user-guide"
            activeSlug={slug ?? null}
            onNavigate={(nextSlug) => navigate(nextSlug ? `/wiki/${nextSlug}` : '/wiki')}
          />
        </main>
      </div>
    </PageTransition>
  );
}
