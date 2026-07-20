/**
 * WikiPanel — the global help drawer. A right-hand sidebar on desktop, a
 * full-screen sheet on mobile (see WikiPanel.css breakpoint), rendered once
 * by WikiProvider. Always the user-guide section — see WikiProvider's header
 * comment for why platform-admin content never goes through this component.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { WikiDocument } from './WikiDocument';
import './WikiPanel.css';

interface WikiPanelProps {
  isOpen: boolean;
  activeSlug: string | null;
  onClose: () => void;
}

export function WikiPanel({ isOpen, activeSlug, onClose }: WikiPanelProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="wiki-panel__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="wiki-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Help"
      >
        <div className="wiki-panel__header">
          <h1 className="wiki-panel__title">Help &amp; guide</h1>
          <button type="button" className="wiki-panel__close" onClick={onClose} aria-label="Close help">
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="wiki-panel__body">
          {/* activeSlug is a best-guess default for the current route, not something
              the visitor asked for — land on search + suggested questions instead of
              jumping straight past them into a scrolled-down page. */}
          <WikiDocument section="user-guide" initialSlug={activeSlug} autoScrollToInitialSlug={false} />
        </div>
        <div className="wiki-panel__footer">
          <a href="/wiki" target="_blank" rel="noopener noreferrer" className="wiki-panel__full-link">
            Open full guide in a new tab
          </a>
        </div>
      </div>
    </>
  );
}
