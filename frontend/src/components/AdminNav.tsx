/**
 * AdminNav — shared top bar for the three admin console pages (Stations,
 * Brigade Access, Organization).
 *
 * Before this existed, each admin page only had a small "← Home" text link
 * and no way to move between admin areas or sign out — landing here after
 * login felt like a dead end (LL-2, sign-in/landing review 2026-07-03).
 */

import { Link, NavLink } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './AdminNav.css';

const ADMIN_LINKS = [
  { to: '/admin/stations', label: 'Stations' },
  { to: '/admin/brigade-access', label: 'Brigade Access' },
  { to: '/admin/organization', label: 'Organization' },
];

export function AdminNav() {
  const { user, logout } = useAuth();

  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link to="/" className="admin-nav__home" aria-label="Back to Bushie Tools home">
        <span aria-hidden="true"><Flame size={18} strokeWidth={2} /></span> Bushie Tools
      </Link>
      <div className="admin-nav__links">
        {ADMIN_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `admin-nav__link${isActive ? ' admin-nav__link--active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      {user && (
        <div className="admin-nav__user">
          <span className="admin-nav__username" title={`Signed in as ${user.username}`}>{user.username}</span>
          <button type="button" className="admin-nav__logout" onClick={logout}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
