/**
 * HelpButton — the single, consistent (?) affordance for the in-app wiki.
 * Mounted once, globally, in App.tsx, so it's present at the same spot on
 * every page rather than being wired into each page's own header. Opens the
 * WikiPanel drawer at a contextual default page for the current route, but
 * always with the full table of contents one tap away.
 */

import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useWiki } from '../hooks/useWiki';
import './HelpButton.css';

const ROUTE_SLUGS: [pattern: RegExp, slug: string][] = [
  [/^\/truckcheck\/voice/, 'voice-check'],
  [/^\/truckcheck/, 'truck-checks'],
  [/^\/reports/, 'reports'],
  [/^\/signin$|^\/sign-in$/, 'sign-in'],
  [/^\/profile/, 'profiles-and-achievements'],
  [/^\/admin\/organization/, 'admin-guide'],
  [/^\/admin\/stations/, 'admin-guide'],
  [/^\/admin\/brigade-access/, 'admin-guide'],
  [/^\/login$|^\/signup$|^\/$|^\/apps$/, 'getting-started'],
];

function contextualSlug(pathname: string): string | undefined {
  return ROUTE_SLUGS.find(([pattern]) => pattern.test(pathname))?.[1];
}

export function HelpButton() {
  const location = useLocation();
  const { open, isOpen } = useWiki();

  // The platform console has its own embedded help section — don't stack a
  // second, differently-scoped help entry point on top of it.
  if (location.pathname.startsWith('/admin/platform')) return null;
  if (isOpen) return null;

  return (
    <button
      type="button"
      className="help-fab"
      onClick={() => open(contextualSlug(location.pathname))}
      aria-label="Help and user guide"
      title="Help"
    >
      <HelpCircle size={26} strokeWidth={2} aria-hidden />
    </button>
  );
}
