/**
 * Demo Mode Warning Component
 * 
 * Warning dialog shown before destructive actions in demo mode.
 * Explains that data in demo mode can be reset and reminds users
 * they're working with test data.
 */

import type { KeyboardEvent, MouseEvent } from 'react';
import './DemoModeWarning.css';

interface DemoModeWarningProps {
  action: string; // e.g., "delete this member", "reset the station"
  onConfirm: () => void;
  onCancel: () => void;
}

export function DemoModeWarning({ action, onConfirm, onCancel }: DemoModeWarningProps) {
  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCancel();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="demo-warning-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close demo warning"
    >
      <div className="demo-warning-dialog">
        <div className="demo-warning-header">
          <div className="demo-warning-icon">🎭</div>
          <h2>Demo Mode Warning</h2>
        </div>
        
        <div className="demo-warning-content">
          <p className="demo-warning-message">
            You are about to <strong>{action}</strong> in demo mode.
          </p>
          
          <div className="demo-warning-info">
            <p>
              ⚠️ Remember: This is a demo station with test data.
            </p>
            <p>
              • All demo data can be reset at any time
            </p>
            <p>
              • No real brigade data is affected
            </p>
            <p>
              • Changes are for demonstration purposes only
            </p>
          </div>
        </div>
        
        <div className="demo-warning-actions">
          <button 
            className="demo-warning-btn demo-warning-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="demo-warning-btn demo-warning-confirm"
            onClick={onConfirm}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
