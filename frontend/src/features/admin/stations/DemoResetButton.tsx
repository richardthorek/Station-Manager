/**
 * Demo Reset Button Component
 * 
 * Button for resetting demo station data to fresh state.
 * Shows confirmation dialog before resetting.
 * Displays last reset time if available.
 * Only visible when viewing demo station.
 */

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { api } from '../../../services/api';
import './DemoResetButton.css';

interface DemoResetButtonProps {
  onResetComplete?: () => void;
}

export function DemoResetButton({ onResetComplete }: DemoResetButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastResetTime, setLastResetTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await api.resetDemoStation();
      setLastResetTime(new Date(result.resetAt));
      setSuccess(true);
      setIsConfirmOpen(false);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);

      // Notify parent component
      if (onResetComplete) {
        onResetComplete();
      }

      // Reload page after short delay to show fresh data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset demo station');
      console.error('Error resetting demo station:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="demo-reset-container">
      <button 
        className="demo-reset-btn"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isResetting}
      >
        🔄 Reset Demo Data
      </button>

      {lastResetTime && (
        <div className="last-reset-info">
          Last reset: {lastResetTime.toLocaleString()}
        </div>
      )}

      {success && (
        <div className="reset-success-message">
          ✅ Demo station reset successfully! Refreshing...
        </div>
      )}

      {error && (
        <div className="reset-error-message">
          ❌ {error}
        </div>
      )}

      {isConfirmOpen && (
        <div
          className="reset-confirm-overlay"
          onClick={(event: MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget && !isResetting) {
              setIsConfirmOpen(false);
            }
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget) return;
            if ((event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') && !isResetting) {
              event.preventDefault();
              setIsConfirmOpen(false);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close reset confirmation"
        >
          <div className="reset-confirm-dialog">
            <div className="reset-confirm-header">
              <div className="reset-confirm-icon">🔄</div>
              <h2>Reset Demo Station?</h2>
            </div>

            <div className="reset-confirm-content">
              <p className="reset-confirm-warning">
                ⚠️ This will delete all demo station data and recreate it with fresh sample data.
              </p>

              <div className="reset-confirm-details">
                <p><strong>What will be reset:</strong></p>
                <ul>
                  <li>All members</li>
                  <li>All check-ins and events</li>
                  <li>All appliances and truck checks</li>
                  <li>All activities</li>
                </ul>
                <p><strong>What will be created:</strong></p>
                <ul>
                  <li>20 diverse sample members</li>
                  <li>5 standard activities</li>
                  <li>Recent check-ins and events</li>
                  <li>2 appliances with sample check runs</li>
                </ul>
              </div>

              <p className="reset-confirm-note">
                💡 This action only affects the demo station. Real brigade data is not impacted.
              </p>
            </div>

            <div className="reset-confirm-actions">
              <button 
                className="reset-confirm-btn reset-confirm-cancel"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button 
                className="reset-confirm-btn reset-confirm-proceed"
                onClick={handleReset}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Reset Demo Station'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
