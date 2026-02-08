/**
 * Landing Page Component
 *
 * Central hub displaying all available features:
 * - Sign-In system
 * - Truck Checks (vehicle inspections)
 * - Future features
 *
 * Provides easy navigation to different modules of the application.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';
import { OnboardingWizard } from '../../components/OnboardingWizard';
import { PageTransition } from '../../components/PageTransition';
import { staggerVariants, getVariants, getTransition, transitions } from '../../utils/animations';
import './LandingPage.css';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const containerVariants = getVariants(staggerVariants.container);
  const itemVariants = getVariants(staggerVariants.item);
  const itemTransition = getTransition(transitions.standard);

  return (
    <PageTransition variant="fade">
      <div className="landing-page">
      <header className="landing-header">
        <div className="header-content">
          <div className="brand-row">
            <img
              src="/apple-touch-icon.png"
              alt="Station Manager logo"
              className="brand-mark"
              width={72}
              height={72}
              loading="eager"
              decoding="async"
            />
            <div className="brand-block">
              <p className="eyebrow">Station Manager</p>
              <h1 className="headline">Digital tools for fire stations</h1>
              <p className="subheadline">Real-time sign-ins, truck checks, and reporting across every device.</p>
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
              className="feature-card"
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">🔥</div>
              <h3>Station Sign-In</h3>
              <p>Quick and easy member check-in/out with activity tracking. Real-time updates across all devices.</p>
              <Link to="/signin" className="feature-link">
                Go to Sign-In
                <span className="arrow" aria-hidden="true">→</span>
              </Link>
            </motion.article>

            <motion.article
              className="feature-card"
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">🚛</div>
              <h3>Truck Check</h3>
              <p>Vehicle maintenance tracking and inspection checklist system.</p>
              <Link to="/truckcheck" className="feature-link">
                Go to Truck Checks
                <span className="arrow" aria-hidden="true">→</span>
              </Link>
            </motion.article>

            <motion.article
              className="feature-card"
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">📊</div>
              <h3>Reports & Analytics</h3>
              <p>Historical reporting, analytics, and data export capabilities.</p>
              <Link to="/reports" className="feature-link">
                Go to Reports
                <span className="arrow" aria-hidden="true">→</span>
              </Link>
            </motion.article>

            <motion.article
              className="feature-card"
              variants={itemVariants}
              transition={itemTransition}
            >
              <div className="feature-icon" aria-hidden="true">⚙️</div>
              <h3>Station Management</h3>
              <p>Admin portal for managing stations, viewing statistics, and configuring settings.</p>
              <div className="feature-links">
                <Link to="/admin/stations" className="feature-link">
                  Stations
                  <span className="arrow" aria-hidden="true">→</span>
                </Link>
                <Link to="/admin/brigade-access" className="feature-link">
                  Brigade Access
                  <span className="arrow" aria-hidden="true">→</span>
                </Link>
              </div>
            </motion.article>
          </motion.section>
        </div>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <span>Built with ❤️ for the volunteer community</span>
          <span className="footer-separator">•</span>
          <span className="version">
            Version 1.0 • Build: {__APP_VERSION__.commitShort}
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
