/**
 * AdminNav — shared top bar for the three admin console pages (Stations,
 * Brigade Access, Organization).
 *
 * Before this existed, each admin page only had a small "← Home" text link
 * and no way to move between admin areas or sign out — landing here after
 * login felt like a dead end (LL-2, sign-in/landing review 2026-07-03).
 */

import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { OrgSwitcher } from './OrgSwitcher';
import { BrandMark } from './BrandMark';
import './AdminNav.css';

const ADMIN_LINKS = [
  { to: '/admin/stations', label: 'Stations' },
  { to: '/admin/brigade-access', label: 'Crew Access' },
  { to: '/admin/organization', label: 'Organization' },
];

const PLATFORM_ADMIN_LINK = { to: '/admin/platform', label: 'Platform' };

export function AdminNav() {
  const { user, logout, isPlatformAdmin } = useAuth();
  const links = isPlatformAdmin ? [...ADMIN_LINKS, PLATFORM_ADMIN_LINK] : ADMIN_LINKS;

  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link to="/" className="admin-nav__home" aria-label="Back to StationKit home">
        <BrandMark size={20} /> StationKit
      </Link>
      <div className="admin-nav__links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `admin-nav__link${isActive ? ' admin-nav__link--active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <OrgSwitcher />
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
