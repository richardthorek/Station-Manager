/**
 * Landing Page Component
 *
 * The logged-in hub — and the Bushie Tools suite app-launcher. Surfaces
 * Station Manager's own modules (sign-in, truck check, reports, AAR Studio,
 * admin) plus the sibling suite apps (Fire Santa Run, Fire Break Calculator),
 * each unlocked by the org's entitlements.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { OnboardingWizard } from '../../components/OnboardingWizard';
import { PageTransition } from '../../components/PageTransition';
import { staggerVariants, getVariants, getTransition, transitions } from '../../utils/animations';
import { SUITE_SIBLING_APPS } from '../../config/suiteApps';
import './LandingPage.css';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout, requireAuth, hasFeature, entitlements } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const containerVariants = getVariants(staggerVariants.container);
  const itemVariants = getVariants(staggerVariants.item);
  const itemTransition = getTransition(transitions.standard);

  const handleLogout = () => {
    logout();
    // Optionally show a toast notification
  };

  // A core module is "locked" only when we have entitlement context AND the org
  // lacks the feature. With no entitlements (single-tenant / kiosk back-compat)
  // everything stays unlocked, matching the AAR Studio + suite-app cards below.
  const signInLocked = Boolean(entitlements && !hasFeature('signInEnabled'));
  const truckCheckLocked = Boolean(entitlements && !hasFeature('truckCheckEnabled'));
  const reportsLocked = Boolean(entitlements && !hasFeature('reportsEnabled'));

  // Render a core-module card link: the live route when unlocked, or the
  // upgrade prompt (linking to the plan page) when the org isn't entitled — so
  // every gated card carries the same lock affordance instead of looking active.
  const moduleLink = (locked: boolean, to: string, label: string, moduleName: string) =>
    locked ? (
      <Link
        to="/admin/organization"
        className="feature-link feature-link--locked"
        aria-label={`${moduleName} is not included in your plan — click to view upgrade options`}
      >
        Not in your plan
        <span className="lock-icon" aria-hidden="true">🔒</span>
      </Link>
    ) : (
      <Link to={to} className="feature-link">
        {label}
        <span className="arrow" aria-hidden="true">→</span>
      </Link>
    );

  return (
    <PageTransition variant="fade">
      <div className="landing-page">
      <header className="landing-header">
        <div className="header-content">
          <div className="brand-row">
            <img
              src="/apple-touch-icon.png"
              alt="Bushie Tools logo"
              className="brand-mark"
              width={72}
              height={72}
              loading="eager"
              decoding="async"
            />
            <div className="brand-block">
              <p className="eyebrow">Bushie Tools</p>
              <h1 className="headline">Your crew toolkit</h1>
              <p className="subheadline">Sign-in book, vehicle checks, reports and AI-facilitated reviews — all in one place.</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="header-cta"
              onClick={() => setShowOnboarding(true)}
              aria-label="Start guided tour"
            >
              <span className="btn-icon">🎓</span>
              <span className="btn-text">Guided tour</span>
            </button>
            {requireAuth && !isAuthenticated && (
              <button
                className="header-cta admin-login-btn"
                onClick={() => navigate('/login')}
                aria-label="Admin login"
              >
                <span className="btn-icon">🔐</span>
                <span className="btn-text">Admin Login</span>
              </button>
            )}
            {isAuthenticated && user && (
              <button
                className="header-cta logout-btn"
                onClick={handleLogout}
                aria-label={`Logout ${user.username}`}
                title={`Logged in as ${user.username}`}
              >
                <span className="btn-icon">👤</span>
                <span className="btn-text">Logout</span>
              </button>
            )}
            <button 
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="landing-main" tabIndex={-1}>
        <div className="cards-area">
          <motion.section
            className="cards-grid"
            variants={containerVariants}
            initial="initial"
            animate="animate"
          >
            <motion.article
              className={`feature-card${signInLocked ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">🔥</div>
              <h3>Station Sign-In</h3>
              <p>Quick and easy member check-in/out with activity tracking. Real-time updates across all devices.</p>
              {moduleLink(signInLocked, '/signin', 'Go to Sign-In', 'Station Sign-In')}
            </motion.article>

            <motion.article
              className={`feature-card${truckCheckLocked ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">🚛</div>
              <h3>Vehicle Check</h3>
              <p>Vehicle and equipment maintenance tracking with inspection checklists.</p>
              {moduleLink(truckCheckLocked, '/truckcheck', 'Go to Vehicle Check', 'Vehicle Check')}
            </motion.article>

            <motion.article
              className={`feature-card${reportsLocked ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">📊</div>
              <h3>Reports & Analytics</h3>
              <p>Historical reporting, analytics, and data export capabilities.</p>
              {moduleLink(reportsLocked, '/reports', 'Go to Reports', 'Reports & Analytics')}
            </motion.article>

            <motion.article
              className={`feature-card${entitlements && !hasFeature('aarStudioEnabled') ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">🎙️</div>
              <h3>AAR Studio</h3>
              <p>AI-assisted After Action Reviews: capture the discussion live, build a findings board, and export the report.</p>
              {/* AAR Studio is a self-contained static sub-app served by the backend at /aar, so this is a plain link, not a router route. */}
              {entitlements && !hasFeature('aarStudioEnabled') ? (
                <Link to="/admin/organization" className="feature-link feature-link--locked" aria-label="AAR Studio requires AI Pro plan — click to view upgrade options">
                  Upgrade to AI Pro
                  <span className="lock-icon" aria-hidden="true">🔒</span>
                </Link>
              ) : (
                <a href="/aar/" className="feature-link">
                  Go to AAR Studio
                  <span className="arrow" aria-hidden="true">→</span>
                </a>
              )}
            </motion.article>

            <motion.article
              className="feature-card"
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">⚙️</div>
              <h3>Station Management</h3>
              <p>Admin portal for managing stations, viewing statistics, and configuring settings.</p>
              {(!requireAuth || isAuthenticated) ? (
                <div className="feature-links">
                  <Link to="/admin/stations" className="feature-link">
                    Stations
                    <span className="arrow" aria-hidden="true">→</span>
                  </Link>
                  <Link to="/admin/brigade-access" className="feature-link">
                    Crew Access
                    <span className="arrow" aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <p className="auth-required-msg" style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
                  Authentication required to access station management
                </p>
              )}
            </motion.article>

            {/* Bushie Tools sibling apps — separate deployments, unlocked by entitlements. */}
            {SUITE_SIBLING_APPS.map((suiteApp) => {
              const locked = Boolean(entitlements && suiteApp.feature && !hasFeature(suiteApp.feature));
              return (
                <motion.article
                  key={suiteApp.id}
                  className={`feature-card${locked ? ' feature-card--locked' : ''}`}
                  variants={itemVariants}
                  transition={itemTransition}
                >
                  {suiteApp.seasonal && <span className="suite-badge">Seasonal</span>}
                  <div className="feature-icon" aria-hidden="true">{suiteApp.icon}</div>
                  <h3>{suiteApp.name}</h3>
                  <p>{suiteApp.description}</p>
                  {locked ? (
                    <Link to="/admin/organization" className="feature-link feature-link--locked" aria-label={`${suiteApp.name} is not included in your plan — click to view upgrade options`}>
                      Not in your plan
                      <span className="lock-icon" aria-hidden="true">🔒</span>
                    </Link>
                  ) : (
                    <a href={suiteApp.href} className="feature-link" target="_blank" rel="noopener noreferrer">
                      Open {suiteApp.name}
                      <span className="arrow" aria-hidden="true">↗</span>
                    </a>
                  )}
                </motion.article>
              );
            })}
          </motion.section>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <span>Built with ❤️ for the volunteer community</span>
          <span className="footer-separator">•</span>
          <span className="version">
            Version 1.1 • Build: {__APP_VERSION__.commitShort}
            {__APP_VERSION__.buildTime && __APP_VERSION__.buildTime !== 'unknown' && (
              <>
                {' • '}
                <span title={`Full SHA: ${__APP_VERSION__.commitSha}\nBuild Time: ${__APP_VERSION__.buildTime}`}>
                  {new Date(__APP_VERSION__.buildTime).toLocaleString()}
                </span>
              </>
            )}
          </span>
          <span className="footer-separator">•</span>
          <a href="/?demo=true" className="discrete-link" title="View demo with test data">
            Demo Mode
          </a>
        </div>
      </footer>

        {showOnboarding && (
          <OnboardingWizard onClose={() => setShowOnboarding(false)} />
        )}
      </div>
    </PageTransition>
  );
}
