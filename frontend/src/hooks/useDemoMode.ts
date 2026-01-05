/**
 * Demo Mode Hook
 * 
 * Custom React hook for managing demo mode state and detection.
 * 
 * Features:
 * - Detects ?demo=true in URL (single source of truth)
 * - Checks backend demo mode status
 * - Provides functions to toggle demo mode
 * 
 * Note: Does NOT persist in localStorage to avoid stale state issues.
 * The URL parameter is the only source of truth for demo mode state.
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface DemoModeStatus {
  isDemo: boolean;
  demoAvailable: boolean;
  perDeviceMode: boolean;
  instructions: string;
}

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoStatus, setDemoStatus] = useState<DemoModeStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  // Check for demo mode on mount and when URL changes
  useEffect(() => {
    checkDemoMode();
  }, []);

  async function checkDemoMode() {
    try {
      setLoading(true);

      // Check URL parameter - this is the ONLY source of truth
      const urlParams = new URLSearchParams(window.location.search);
      const demoParam = urlParams.get('demo');
      const urlHasDemo = demoParam === 'true' || demoParam === '1';

      // Check backend status
      const status = await api.getDemoStatus();

      setDemoStatus(status);

      // Demo mode is active if URL parameter is present
      // (backend will also check this parameter in middleware)
      setIsDemoMode(urlHasDemo);

      // Check if banner was dismissed (this is OK to persist per-session)
      const dismissed = sessionStorage.getItem('demoBannerDismissed') === 'true';
      setBannerDismissed(dismissed);
    } catch (error) {
      console.error('Failed to check demo mode:', error);
      // Fallback to URL parameter only
      const urlParams = new URLSearchParams(window.location.search);
      const demoParam = urlParams.get('demo');
      setIsDemoMode(demoParam === 'true' || demoParam === '1');
    } finally {
      setLoading(false);
    }
  }

  function enableDemoMode() {
    // Add ?demo=true to URL and reload
    const url = new URL(window.location.href);
    url.searchParams.set('demo', 'true');
    window.location.href = url.toString();
  }

  function disableDemoMode() {
    // Remove demo parameter and reload
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    sessionStorage.removeItem('demoBannerDismissed');
    window.location.href = url.toString();
  }

  function dismissBanner() {
    setBannerDismissed(true);
    sessionStorage.setItem('demoBannerDismissed', 'true');
  }

  function showBanner() {
    setBannerDismissed(false);
    sessionStorage.removeItem('demoBannerDismissed');
  }

  return {
    isDemoMode,
    demoStatus,
    loading,
    bannerDismissed,
    enableDemoMode,
    disableDemoMode,
    dismissBanner,
    showBanner,
  };
}
