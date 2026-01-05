/**
 * Demo Mode Hook
 * 
 * Custom React hook for managing demo mode state and detection.
 * 
 * Features:
 * - Detects ?demo=true in URL
 * - Checks backend demo mode status
 * - Persists preference in localStorage
 * - Provides functions to toggle demo mode
 */

import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface DemoModeStatus {
  isDemo: boolean;
  tableSuffix: string;
  environment: string;
  demoAvailable: boolean;
  instructions: string;
}

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [demoStatus, setDemoStatus] = useState<DemoModeStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  // Check for demo mode on mount
  useEffect(() => {
    checkDemoMode();
  }, []);

  async function checkDemoMode() {
    try {
      setLoading(true);

      // Check URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const demoParam = urlParams.get('demo');
      const urlHasDemo = demoParam === 'true' || demoParam === '1';

      // Check backend status
      const response = await api.get<DemoModeStatus>('/api/demo/status');
      const status = response.data;

      setDemoStatus(status);

      // Demo mode is active if backend reports it OR URL parameter is present
      const isDemo = status.isDemo || urlHasDemo;
      setIsDemoMode(isDemo);

      // Persist in localStorage
      if (isDemo) {
        localStorage.setItem('demoMode', 'true');
      }

      // Check if banner was dismissed
      const dismissed = localStorage.getItem('demoBannerDismissed') === 'true';
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
    localStorage.removeItem('demoMode');
    localStorage.removeItem('demoBannerDismissed');
    window.location.href = url.toString();
  }

  function dismissBanner() {
    setBannerDismissed(true);
    localStorage.setItem('demoBannerDismissed', 'true');
  }

  function showBanner() {
    setBannerDismissed(false);
    localStorage.removeItem('demoBannerDismissed');
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
