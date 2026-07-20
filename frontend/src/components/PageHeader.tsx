/**
 * PageHeader — shared sub-page header: back arrow + title + a row of
 * actions that collapses into an overflow menu once there's more than a
 * couple, so the bar never wraps onto a second line on a phone.
 *
 * Every StationKit sub-page (truck checks, reports, admin dashboards, voice
 * check) used to hand-roll its own "<Link className='back-link'>" header —
 * nine near-identical copies, each one easy to forget on a new screen. This
 * is the one place that pattern lives now; page-specific content (tabs,
 * filters, export menus) still renders as `children` below the bar.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import './PageHeader.css';

export interface PageHeaderAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Route the back arrow returns to. Defaults to the app picker. */
  backTo?: string;
  backLabel?: string;
  /** Icon actions (theme toggle, export, etc). First two show inline; the rest collapse into a "more" menu. */
  actions?: PageHeaderAction[];
  /** Page-specific content (tabs, filters) rendered as a second row below the back/title bar. */
  children?: ReactNode;
}

const MAX_INLINE_ACTIONS = 2;

export function PageHeader({ title, subtitle, backTo = '/', backLabel = 'Back', actions = [], children }: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  const inlineActions = actions.slice(0, MAX_INLINE_ACTIONS);
  const overflowActions = actions.slice(MAX_INLINE_ACTIONS);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <header className="page-header">
      <div className="page-header__row">
        <Link to={backTo} className="page-header__back" aria-label={backLabel} title={backLabel}>
          <ArrowLeft size={20} strokeWidth={2.5} aria-hidden />
          <span className="page-header__back-label">{backLabel}</span>
        </Link>
        <h1 className="page-header__title">{title}</h1>
        {(inlineActions.length > 0 || overflowActions.length > 0) && (
          <div className="page-header__actions">
            {inlineActions.map((action) => (
              <button
                key={action.key}
                className="page-header__action"
                onClick={action.onClick}
                aria-label={action.label}
                title={action.label}
              >
                {action.icon}
              </button>
            ))}
            {overflowActions.length > 0 && (
              <div className="page-header__overflow" ref={overflowRef}>
                <button
                  className="page-header__action"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="More actions"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                >
                  <MoreVertical size={20} strokeWidth={2.5} aria-hidden />
                </button>
                {menuOpen && (
                  <div className="page-header__menu" role="menu">
                    {overflowActions.map((action) => (
                      <button
                        key={action.key}
                        className="page-header__menu-item"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          action.onClick();
                        }}
                      >
                        <span className="page-header__menu-icon">{action.icon}</span>
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {(subtitle || children) && (
        <div className="page-header__extra">
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
          {children}
        </div>
      )}
    </header>
  );
}
