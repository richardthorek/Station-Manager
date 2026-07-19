/**
 * AccountMenu — the signed-in user's personal account entry point. Replaces
 * a bare "Logout" button wherever an authenticated admin user sees one
 * (LandingPage header, AdminNav): shows who's signed in and links to
 * `/account` for profile/passkey/organization-membership management, plus
 * sign-out. Deliberately does NOT duplicate Organization (billing, branding,
 * members) or Station Management (stations, crew access) here — those are
 * separate, org-scoped admin concerns with their own nav entries.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './AccountMenu.css';

export function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  if (!user) return null;

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className="account-menu__trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${user.username}`}
      >
        <span className="account-menu__avatar" aria-hidden="true">{initial}</span>
        <span className="account-menu__label">{user.username}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="account-menu__dropdown" role="menu">
          <div className="account-menu__header">
            <span className="account-menu__username">{user.username}</span>
            {user.email && <span className="account-menu__email">{user.email}</span>}
          </div>
          <Link to="/account" className="account-menu__item" role="menuitem" onClick={() => setIsOpen(false)}>
            <Settings size={16} strokeWidth={2} aria-hidden="true" />
            My Account
          </Link>
          <button
            type="button"
            className="account-menu__item account-menu__item--danger"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
