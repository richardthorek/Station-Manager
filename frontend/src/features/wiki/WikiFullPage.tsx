/**
 * Public /wiki and /wiki/:slug — the full-page version of the user guide.
 * Unauthenticated, ungated (no AccessRoute/ProtectedRoute/FeatureRoute):
 * this is the "point people at stationkit.com.au/wiki" surface, meant to work
 * for prospects who haven't logged in as well as signed-in members who opened
 * "Open full guide in a new tab" from the WikiPanel drawer. Renders the same
 * WikiDocument the drawer uses, with page chrome instead of a drawer shell —
 * on a wide viewport WikiDocument's own container-query layout gives it a
 * real sidebar here.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { PageTransition } from '../../components/PageTransition';
import { PageHeader } from '../../components/PageHeader';
import { WikiDocument } from '../../components/WikiDocument';
import './WikiFullPage.css';

export function WikiFullPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  // Only used to seed WikiDocument's one-time initial scroll — the route
  // param isn't re-read after that, so later sidebar clicks don't fight with it.
  const [initialSlug] = useState(slug ?? null);

  useEffect(() => {
    document.title = slug ? `${slug.replace(/-/g, ' ')} — StationKit help` : 'StationKit help & user guide';
  }, [slug]);

  return (
    <PageTransition variant="fade">
      <div className="wiki-full-page">
        <PageHeader
          title="Help & user guide"
          backTo="/"
          backLabel="StationKit"
          actions={[{
            key: 'theme',
            label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
            icon: theme === 'light' ? <Moon size={20} strokeWidth={2} aria-hidden /> : <Sun size={20} strokeWidth={2} aria-hidden />,
            onClick: toggleTheme,
          }]}
        />
        <main className="wiki-full-page__main" id="main-content" tabIndex={-1}>
          <WikiDocument
            section="user-guide"
            initialSlug={initialSlug}
            onActivePageChange={(nextSlug) => navigate(`/wiki/${nextSlug}`, { replace: true })}
          />
        </main>
      </div>
    </PageTransition>
  );
}
