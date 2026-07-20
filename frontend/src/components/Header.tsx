/**
 * Header Component
 * 
 * Main application header displaying:
 * - Application title and logo
 * - Station selector dropdown
 * - Demo mode indicator (when applicable)
 * - Admin menu (optional)
 * - Theme toggle (light/dark mode)
 * - Connection status indicator
 * - Database status warning (in-memory vs persistent)
 */

import { useState, useRef, useEffect } from 'react';
import { Settings2, Users, Plus, BarChart3, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useClampMenuToViewport } from '../hooks/useClampMenuToViewport';
import { useStation } from '../contexts/StationContext';
import { BrandMark } from './BrandMark';
import './Header.css';

interface HeaderProps {
  isConnected: boolean;
  databaseStatus?: {
    databaseType: 'mongodb' | 'in-memory' | 'table-storage';
    usingInMemory: boolean;
  } | null;
  onManageUsers?: () => void;
  onExportData?: () => void;
  onAddActivityType?: () => void;
}

export function Header({ 
  isConnected, 
  databaseStatus,
  onManageUsers,
  onExportData,
  onAddActivityType
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { isDemoStation } = useStation();
  const showDatabaseWarning = databaseStatus?.usingInMemory;
  const isDemo = isDemoStation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClampMenuToViewport(dropdownRef, isMenuOpen);

  // Show admin menu if any callback is provided
  const showAdminMenu = !!(onManageUsers || onExportData || onAddActivityType);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isMenuOpen]);

  const handleMenuItemClick = (callback?: () => void) => {
    setIsMenuOpen(false);
    callback?.();
  };

  return (
    <header className={`header ${isDemo ? 'demo-mode' : ''}`}>
      <div className="header-content">
        <div className="header-logo">
          <div className="logo-icon"><BrandMark size={28} /></div>
          <h1>Station Manager</h1>
          {isDemo && (
            <div className="demo-badge" title="Demo Mode - Data can be reset at any time">
              🎭 DEMO MODE
            </div>
          )}
        </div>
        <div className="header-status">
          {showAdminMenu && (
            <div className="admin-menu-container" ref={menuRef}>
              <button 
                className="admin-menu-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Admin menu"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                title="Admin options"
              >
                <Settings2 size={20} strokeWidth={2} aria-hidden />
              </button>
              {isMenuOpen && (
                <div className="admin-menu-dropdown" role="menu" ref={dropdownRef}>
                  {onManageUsers && (
                    <button 
                      className="admin-menu-item"
                      onClick={() => handleMenuItemClick(onManageUsers)}
                      role="menuitem"
                    >
                      <span className="menu-item-icon"><Users size={18} strokeWidth={2} aria-hidden /></span>
                      <span className="menu-item-text">Manage Users</span>
                    </button>
                  )}
                  {onAddActivityType && (
                    <button 
                      className="admin-menu-item"
                      onClick={() => handleMenuItemClick(onAddActivityType)}
                      role="menuitem"
                    >
                      <span className="menu-item-icon"><Plus size={18} strokeWidth={2} aria-hidden /></span>
                      <span className="menu-item-text">Add Activity Type</span>
                    </button>
                  )}
                  {onExportData && (
                    <button 
                      className="admin-menu-item"
                      onClick={() => handleMenuItemClick(onExportData)}
                      role="menuitem"
                    >
                      <span className="menu-item-icon"><BarChart3 size={18} strokeWidth={2} aria-hidden /></span>
                      <span className="menu-item-text">Export Data</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={20} strokeWidth={2} aria-hidden /> : <Sun size={20} strokeWidth={2} aria-hidden />}
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
