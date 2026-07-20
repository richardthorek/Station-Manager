/**
 * Wiki Provider
 *
 * Owns the open/closed state of the global in-app help drawer and renders
 * the drawer itself, mirroring ToastProvider's self-contained pattern. Only
 * ever backs the public user-guide section — the platform-admin section is
 * deliberately never wired into this global provider (see
 * features/admin/platform/PlatformAdminPage.tsx, which embeds WikiContent
 * directly instead).
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { WikiPanel } from '../components/WikiPanel';
import { WikiContext, type WikiContextValue } from './wikiContext';

interface WikiProviderProps {
  children: ReactNode;
}

export function WikiProvider({ children }: WikiProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const open = useCallback((slug?: string) => {
    setActiveSlug(slug ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const navigate = useCallback((slug: string) => {
    setActiveSlug(slug);
    setIsOpen(true);
  }, []);

  const value = useMemo<WikiContextValue>(
    () => ({ isOpen, activeSlug, open, close, navigate }),
    [isOpen, activeSlug, open, close, navigate]
  );

  return (
    <WikiContext.Provider value={value}>
      {children}
      <WikiPanel
        isOpen={isOpen}
        activeSlug={activeSlug}
        onNavigate={(slug) => setActiveSlug(slug)}
        onClose={close}
      />
    </WikiContext.Provider>
  );
}
