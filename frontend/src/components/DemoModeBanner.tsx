/**
 * Demo Mode Banner Component
 * 
 * Displays a prominent banner when the application is running in demo mode.
 * Shows information about test data and provides instructions.
 */

import './DemoModeBanner.css';

interface DemoModeBannerProps {
  onDismiss?: () => void;
}

export function DemoModeBanner({ onDismiss }: DemoModeBannerProps) {
  return (
    <div className="demo-mode-banner">
      <div className="demo-banner-content">
        <div className="demo-banner-icon">🎭</div>
        <div className="demo-banner-text">
          <strong>DEMO MODE ACTIVE</strong>
          <span className="demo-banner-subtitle">
            You're viewing test data. Changes won't affect production records.
          </span>
        </div>
        {onDismiss && (
          <button 
            className="demo-banner-dismiss" 
            onClick={onDismiss}
            aria-label="Dismiss demo mode banner"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
