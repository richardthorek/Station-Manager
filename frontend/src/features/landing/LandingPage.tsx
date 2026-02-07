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
import { useTheme } from '../../hooks/useTheme';
import { OnboardingWizard } from '../../components/OnboardingWizard';
import './LandingPage.css';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="header-content">
          <div className="header-title-row">
            <div>
              <h1 className="app-title">Station Manager</h1>
              <p className="app-subtitle">Digital management tools for fire stations</p>
            </div>
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
        <section className="welcome-section">
          <div className="welcome-content">
            <div>
              <h2>Welcome to Station Manager</h2>
              <p className="welcome-text">
                A modern, real-time digital management system for fire stations.
                Track member presence, manage activities, and coordinate station operations
                across multiple devices with instant synchronization.
              </p>
            </div>
            <button
              className="getting-started-btn"
              onClick={() => setShowOnboarding(true)}
              aria-label="Start guided tour"
            >
              <span className="btn-icon">🎓</span>
              <span className="btn-text">Getting Started</span>
            </button>
          </div>
        </section>

        <section className="cards-grid">
          <article className="feature-card">
            <div className="feature-icon" aria-hidden="true">🔥</div>
            <h3>Station Sign-In</h3>
            <p>Quick and easy member check-in/out with activity tracking. Real-time updates across all devices.</p>
            <Link to="/signin" className="feature-link">
              Go to Sign-In
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          </article>

          <article className="feature-card">
            <div className="feature-icon" aria-hidden="true">🚛</div>
            <h3>Truck Check</h3>
            <p>Vehicle maintenance tracking and inspection checklist system.</p>
            <Link to="/truckcheck" className="feature-link">
              Go to Truck Checks
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          </article>

          <article className="feature-card">
            <div className="feature-icon" aria-hidden="true">📊</div>
            <h3>Reports & Analytics</h3>
            <p>Historical reporting, analytics, and data export capabilities.</p>
            <Link to="/reports" className="feature-link">
              Go to Reports
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          </article>

          <article className="feature-card">
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
          </article>

          <article className="info-card">
            <h3>Multi-Device Support</h3>
            <p>Access from kiosks, mobile phones, tablets, or via QR codes</p>
          </article>
          <article className="info-card">
            <h3>Real-Time Sync</h3>
            <p>Changes appear instantly across all connected devices</p>
          </article>
          <article className="info-card">
            <h3>Professional Branding</h3>
            <p>Clean, modern design suitable for any fire service</p>
          </article>
        </section>
      </main>

      <footer className="landing-footer">
        <p>Built with ❤️ for the volunteer community</p>
        <p className="version">
          Version 1.0 • Build: {__APP_VERSION__.commitShort}
          {__APP_VERSION__.buildTime && __APP_VERSION__.buildTime !== 'unknown' && (
            <>
              {' • '}
              <span title={`Full SHA: ${__APP_VERSION__.commitSha}\nBuild Time: ${__APP_VERSION__.buildTime}`}>
                {new Date(__APP_VERSION__.buildTime).toLocaleString()}
              </span>
            </>
          )}
        </p>
        <p className="demo-mode-link">
          <a href="/?demo=true" className="discrete-link" title="View demo with test data">
            Demo Mode
          </a>
        </p>
      </footer>

      {showOnboarding && (
        <OnboardingWizard onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
