/**
 * Landing Page Component
 *
 * The logged-in hub — and the StationKit suite app-launcher. The card grid
 * is apps/features only: Station Manager's own modules (sign-in, truck
 * check, reports, AAR Studio) plus the sibling suite apps (Fire Santa Run,
 * Fire Break Calculator), each unlocked by the org's entitlements. Station
 * Management (Stations/Crew Access admin) is deliberately NOT a card here —
 * it's a "Station Management" header link next to AccountMenu, since it's an
 * admin action, not an app a member opens day-to-day.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Truck, BarChart3, Mic, Settings2, GraduationCap, LockKeyhole, Moon, Sun, Lock, Heart, HelpCircle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { OnboardingWizard } from '../../components/OnboardingWizard';
import { PageTransition } from '../../components/PageTransition';
import { DeviceSetupGuide } from '../../components/DeviceSetupGuide';
import { AccountMenu } from '../../components/AccountMenu';
import { DeviceInfoBadge } from '../../components/DeviceInfoBadge';
import { staggerVariants, getVariants, getTransition, transitions } from '../../utils/animations';
import { SUITE_SIBLING_APPS } from '../../config/suiteApps';
import './LandingPage.css';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, requireAuth, hasFeature, entitlements } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const containerVariants = getVariants(staggerVariants.container);
  const itemVariants = getVariants(staggerVariants.item);
  const itemTransition = getTransition(transitions.standard);

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
        <span className="link-label">Not in your plan</span>
        <span className="lock-icon" aria-hidden="true"><Lock size={16} strokeWidth={2} /></span>
      </Link>
    ) : (
      <Link to={to} className="feature-link">
        <span className="link-label">{label}</span>
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
              alt="StationKit logo"
              className="brand-mark"
              width={72}
              height={72}
              loading="eager"
              decoding="async"
            />
            <div className="brand-block">
              <p className="eyebrow">StationKit</p>
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
              <span className="btn-icon"><GraduationCap size={20} strokeWidth={2} aria-hidden /></span>
              <span className="btn-text">Guided tour</span>
            </button>
            <button
              className="header-cta"
              onClick={() => setShowSetupGuide(true)}
              aria-label="Open device setup guide"
              title="How to set up a device"
            >
              <span className="btn-icon"><HelpCircle size={20} strokeWidth={2} aria-hidden /></span>
              <span className="btn-text">Setup Guide</span>
            </button>
            {requireAuth && !isAuthenticated && (
              <button
                className="header-cta admin-login-btn"
                onClick={() => navigate('/login')}
                aria-label="Admin login"
              >
                <span className="btn-icon"><LockKeyhole size={20} strokeWidth={2} aria-hidden /></span>
                <span className="btn-text">Admin Login</span>
              </button>
            )}
            {(!requireAuth || isAuthenticated) && (
              <Link to="/admin/stations" className="header-cta">
                <span className="btn-icon"><Settings2 size={20} strokeWidth={2} aria-hidden /></span>
                <span className="btn-text">Station Management</span>
              </Link>
            )}
            <DeviceInfoBadge />
            {isAuthenticated && user && <AccountMenu />}
            <button
              type="button"
              className="landing-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span aria-hidden="true">{theme === 'light' ? <Moon size={20} strokeWidth={2} /> : <Sun size={20} strokeWidth={2} />}</span>
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
              className={`feature-card feature-card--signin${signInLocked ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true"><LogIn size={32} strokeWidth={2} /></div>
              <div className="feature-body">
                <h3>Station Sign-In</h3>
                <p>Quick and easy member check-in/out with activity tracking. Real-time updates across all devices.</p>
                {moduleLink(signInLocked, '/signin', 'Go to Sign-In', 'Station Sign-In')}
              </div>
            </motion.article>

            <motion.article
              className={`feature-card feature-card--vehicle${truckCheckLocked ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true"><Truck size={32} strokeWidth={2} /></div>
              <div className="feature-body">
                <h3>Vehicle Check</h3>
                <p>Vehicle and equipment maintenance tracking with inspection checklists.</p>
                {moduleLink(truckCheckLocked, '/truckcheck', 'Go to Vehicle Check', 'Vehicle Check')}
              </div>
            </motion.article>

            <motion.article
              className={`feature-card feature-card--reports${reportsLocked ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true"><BarChart3 size={32} strokeWidth={2} /></div>
              <div className="feature-body">
                <h3>Reports & Analytics</h3>
                <p>Historical reporting, analytics, and data export capabilities.</p>
                {moduleLink(reportsLocked, '/reports', 'Go to Reports', 'Reports & Analytics')}
              </div>
            </motion.article>

            <motion.article
              className={`feature-card feature-card--aar${entitlements && !hasFeature('aarStudioEnabled') ? ' feature-card--locked' : ''}`}
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true"><Mic size={32} strokeWidth={2} /></div>
              <div className="feature-body">
                <h3>AAR Studio</h3>
                <p>AI-assisted After Action Reviews: capture the discussion live, build a findings board, and export the report.</p>
                {/* AAR Studio is a self-contained static sub-app served by the backend at /aar, so this is a plain link, not a router route. */}
                {entitlements && !hasFeature('aarStudioEnabled') ? (
                  <Link to="/admin/organization" className="feature-link feature-link--locked" aria-label="AAR Studio requires AI Pro plan — click to view upgrade options">
                    <span className="link-label">Upgrade to AI Pro</span>
                    <span className="lock-icon" aria-hidden="true"><Lock size={16} strokeWidth={2} /></span>
                  </Link>
                ) : (
                  <a href="/aar/" className="feature-link">
                    <span className="link-label">Go to AAR Studio</span>
                    <span className="arrow" aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </motion.article>

            {/* StationKit sibling apps — separate deployments, unlocked by entitlements. */}
            {SUITE_SIBLING_APPS.map((suiteApp) => {
              const locked = Boolean(entitlements && suiteApp.feature && !hasFeature(suiteApp.feature));
              return (
                <motion.article
                  key={suiteApp.id}
                  className={`feature-card feature-card--suite${locked ? ' feature-card--locked' : ''}`}
                  variants={itemVariants}
                  transition={itemTransition}
                >
                  {suiteApp.seasonal && <span className="suite-badge">Seasonal</span>}
                  <div className="feature-icon" aria-hidden="true">{suiteApp.icon}</div>
                  <div className="feature-body">
                    <h3>{suiteApp.name}</h3>
                    <p>{suiteApp.description}</p>
                    {locked ? (
                      <Link to="/admin/organization" className="feature-link feature-link--locked" aria-label={`${suiteApp.name} is not included in your plan — click to view upgrade options`}>
                        <span className="link-label">Not in your plan</span>
                        <span className="lock-icon" aria-hidden="true"><Lock size={16} strokeWidth={2} /></span>
                      </Link>
                    ) : (
                      <a href={suiteApp.href} className="feature-link" target="_blank" rel="noopener noreferrer">
                        <span className="link-label">Open {suiteApp.name}</span>
                        <span className="arrow" aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </motion.section>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <span>Built with <Heart size={14} strokeWidth={2} fill="currentColor" aria-hidden /> for the volunteer community</span>
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

        <DeviceSetupGuide
          isOpen={showSetupGuide}
          onClose={() => setShowSetupGuide(false)}
        />
      </div>
    </PageTransition>
  );
}
