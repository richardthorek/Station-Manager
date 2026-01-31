/**
 * Header Component
 * 
 * Main application header displaying:
 * - Application title and logo
 * - Station selector dropdown
 * - Demo mode indicator (when applicable)
 * - Theme toggle (light/dark mode)
 * - Connection status indicator
 * - Database status warning (in-memory vs persistent)
 */

import { useTheme } from '../hooks/useTheme';
import { StationSelector } from './StationSelector';
import { useStation } from '../contexts/StationContext';
import './Header.css';

interface HeaderProps {
  isConnected: boolean;
  databaseStatus?: {
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    usingInMemory: boolean;
  } | null;
}

export function Header({ isConnected, databaseStatus }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { isDemoStation } = useStation();
  const showDatabaseWarning = databaseStatus?.usingInMemory;
  const isDemo = isDemoStation();

  return (
    <header className={`header ${isDemo ? 'demo-mode' : ''}`}>
      <div className="header-content">
        <div className="header-logo">
          <div className="logo-icon">🚒</div>
          <h1>Station Manager</h1>
          {isDemo && (
            <div className="demo-badge" title="Demo Mode - Data can be reset at any time">
              🎭 DEMO MODE
            </div>
          )}
        </div>
        <div className="header-center">
          <StationSelector />
        </div>
        <div className="header-status">
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {showDatabaseWarning && (
            <div className="status-indicator warning" title="Using in-memory database - data will be lost on restart">
              <span className="status-dot"></span>
              <span className="status-text">
                Memory Only
              </span>
            </div>
          )}
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
