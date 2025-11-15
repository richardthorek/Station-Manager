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

import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import './LandingPage.css';

export function LandingPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="header-content">
          <div className="header-title-row">
            <div>
              <h1 className="app-title">RFS Station Manager</h1>
              <p className="app-subtitle">Digital management tools for Rural Fire Service stations</p>
            </div>
            <button 
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="welcome-section">
          <h2>Welcome to Station Manager</h2>
          <p className="welcome-text">
            A modern, real-time digital management system for RFS stations. 
            Track member presence, manage activities, and coordinate station operations 
            across multiple devices with instant synchronization.
          </p>
        </section>

        <section className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔥</div>
            <h3>Station Sign-In</h3>
            <p>Quick and easy member check-in/out with activity tracking. Real-time updates across all devices.</p>
            <Link to="/signin" className="feature-link">
              Go to Sign-In
              <span className="arrow">→</span>
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🚛</div>
            <h3>Truck Check</h3>
            <p>Vehicle maintenance tracking and inspection checklist system.</p>
            <Link to="/truckcheck" className="feature-link">
              Go to Truck Checks
              <span className="arrow">→</span>
            </Link>
          </div>

          <div className="feature-card feature-card-disabled">
            <div className="feature-icon">📊</div>
            <h3>Reports & Analytics</h3>
            <p>Historical reporting, analytics, and data export capabilities.</p>
            <div className="feature-link feature-link-disabled">
              Coming Soon
              <span className="badge">Future</span>
            </div>
          </div>

          <div className="feature-card feature-card-disabled">
            <div className="feature-icon">⚙️</div>
            <h3>Admin Dashboard</h3>
            <p>Station configuration, user management, and system settings.</p>
            <div className="feature-link feature-link-disabled">
              Coming Soon
              <span className="badge">Future</span>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="info-card">
            <h3>Multi-Device Support</h3>
            <p>Access from kiosks, mobile phones, tablets, or via QR codes</p>
          </div>
          <div className="info-card">
            <h3>Real-Time Sync</h3>
            <p>Changes appear instantly across all connected devices</p>
          </div>
          <div className="info-card">
            <h3>NSW RFS Branding</h3>
            <p>Designed to align with NSW RFS visual standards</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>Built with ❤️ for the RFS volunteer community</p>
        <p className="version">Version 1.0</p>
      </footer>
    </div>
  );
}
