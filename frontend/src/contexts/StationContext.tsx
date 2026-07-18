/**
 * Station Context
 * 
 * Provides station selection state and management across the application.
 * Handles:
 * - Loading stations from API
 * - Persisting selection to localStorage
 * - Syncing selection across browser tabs
 * - Providing station data to all components
 * - Kiosk mode: Brigade-locked station selection for kiosk devices
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { api, setCurrentStationId } from '../services/api';
import type { Station } from '../types';
import {
  isKioskMode,
  getKioskStationId,
  initializeKioskMode,
  validateKioskToken,
  canSwitchStation
} from '../utils/kioskMode';
import { isDemoActive } from '../utils/demoMode';
import { useAuth } from './AuthContext';

// LocalStorage key for persisting station selection
const STORAGE_KEY = 'selectedStationId';

// Demo station ID for special styling
export const DEMO_STATION_ID = 'demo-station';

// Default station ID for fallback
export const DEFAULT_STATION_ID = 'default-station';

interface StationContextType {
  // Current state
  selectedStation: Station | null;
  stations: Station[];
  isLoading: boolean;
  error: string | null;
  isKioskMode: boolean;
  
  // Actions
  selectStation: (stationId: string) => void;
  clearStation: () => void;
  refreshStations: () => Promise<void>;
  
  // Helper methods
  isDemoStation: () => boolean;
  isDefaultStation: () => boolean;
  canSwitchStations: () => boolean;
}

const StationContext = createContext<StationContextType | undefined>(undefined);

interface StationProviderProps {
  children: ReactNode;
}

export function StationProvider({ children }: StationProviderProps) {
  const { isAuthenticated, requireAuth, isLoading: authLoading, organization } = useAuth();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kioskMode, setKioskMode] = useState(false);
  const hasInitialized = useRef(false);

  /**
   * Load stations from API
   * @param hasAccess - Whether the user has access to load stations (auth not required OR user is authenticated)
   */
  const loadStations = useCallback(async (hasAccess: boolean) => {
    try {
      setError(null);
      
      // Only load stations if user has access
      if (!hasAccess) {
        setStations([]);
        return [];
      }
      
      // Load all stations from API
      const loadedStations = await api.getStations();
      setStations(loadedStations);
      return loadedStations;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load stations';
      setError(errorMessage);
      console.error('Error loading stations:', err);
      return [];
    }
  }, []);

  /**
   * Initialize: Set up station based on mode (kiosk or normal)
   * - Kiosk mode: Load stations and lock to specified station
   * - Normal mode: Default to demo/default station without API call
   * Wait for authentication to complete before initializing
   */
  useEffect(() => {
    // Don't initialize until auth has finished loading
    if (authLoading) {
      return;
    }
    
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialize = async () => {
      // Check if in kiosk mode first
      const inKioskMode = isKioskMode();
      setKioskMode(inKioskMode);
      
      if (inKioskMode) {
        // Kiosk mode requires station validation and loading
        const validation = await validateKioskToken();
        
        if (!validation.valid) {
          setError('Invalid or expired kiosk access token. Please contact your administrator.');
          setIsLoading(false);
          return;
        }
        
        // For kiosk mode, load stations to find the locked station
        const hasAccess = !requireAuth || isAuthenticated;
        const loadedStations = await loadStations(hasAccess);
        const kioskStationId = validation.stationId || getKioskStationId();
        if (kioskStationId) {
          const kioskStation = loadedStations.find(s => s.id === kioskStationId);
          if (kioskStation) {
            if (validation.stationId && validation.brigadeId) {
              initializeKioskMode(validation.stationId, validation.brigadeId);
            }
            setSelectedStation(kioskStation);
            setCurrentStationId(kioskStation.id);
            setIsLoading(false);
            return;
          }
        }
        
        setError('Kiosk station not found. Please contact your administrator.');
        setIsLoading(false);
        return;
      }
      
      // Normal mode, anonymous demo visitor (Q34, found 2026-07-17): explicitly
      // resolve to the demo station so requests carry X-Station-Id: demo-station.
      // Without this, currentStationId stayed null for every anonymous demo
      // request, so requireSession's demo bypass (which requires the request to
      // explicitly target DEMO_STATION_ID) never matched — every
      // requireSession-gated read (members, checkins, events, truck-checks,
      // reports) 401'd for a signed-out demo visitor.
      if (isDemoActive() && !isAuthenticated) {
        try {
          const demoStation = await api.getDemoStation();
          setSelectedStation(demoStation);
          setCurrentStationId(demoStation.id);
        } catch {
          // Best-effort — fall through to the no-station default below rather
          // than blocking the app on a failed demo-station lookup.
          setSelectedStation(null);
          setCurrentStationId(null);
        }
        setIsLoading(false);
        return;
      }

      // Normal mode, authenticated admin with an unambiguous station (Q41,
      // found 2026-07-17): resolve selectedStation so useSocket's
      // join-station effect has a stationId to join. REST calls already
      // work with currentStationId left null here (the server infers the
      // org's station from the JWT when no X-Station-Id header is sent),
      // but the real-time socket layer has no equivalent server-side
      // inference — join-station requires an explicit stationId, so an
      // admin viewing /signin directly never joined any room and got zero
      // live updates from other devices, even though the page itself
      // loaded correctly.
      //
      // A fresh org typically owns zero stations of its own and relies
      // entirely on the shared DEFAULT_STATION_ID fallback (confirmed live:
      // a brand-new org's own GET /api/stations returned only
      // default-station, un-owned, until it created its first real one) —
      // so "own stations" here means organizationId-tagged rows only, not
      // that shared fallback or other still-unbackfilled orphans (Q35).
      // Only auto-select when that count is unambiguous (zero -> the
      // shared default; exactly one -> that station); two or more is a
      // genuine multi-station admin whose intended station can't be
      // guessed without an explicit pick, so that case keeps today's
      // behaviour (no station, REST-only, no live updates).
      if (isAuthenticated && organization) {
        const loadedStations = await loadStations(true);
        const ownStations = loadedStations.filter(s => s.organizationId === organization.id);
        if (ownStations.length === 1) {
          setSelectedStation(ownStations[0]);
          setCurrentStationId(ownStations[0].id);
          setIsLoading(false);
          return;
        }
        if (ownStations.length === 0) {
          const fallback = loadedStations.find(s => s.id === DEFAULT_STATION_ID);
          if (fallback) {
            setSelectedStation(fallback);
            setCurrentStationId(fallback.id);
            setIsLoading(false);
            return;
          }
        }
      }

      // Normal mode: Just use demo/default station - NO API CALL
      // Station is determined automatically based on authentication/requirements
      // No persisted selection needed - always use demo/default
      setSelectedStation(null);
      setCurrentStationId(null);
      setIsLoading(false);
    };

    initialize();
  }, [authLoading, loadStations, isAuthenticated, requireAuth, organization]);

  /**
   * Listen for storage changes from other tabs
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newStationId = e.newValue;
        const station = stations.find(s => s.id === newStationId);
        if (station) {
          setSelectedStation(station);
          setCurrentStationId(station.id);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [stations]);

  /**
   * Select a station by ID
   */
  const selectStation = useCallback((stationId: string) => {
    // Prevent station switching in kiosk mode
    if (kioskMode) {
      console.warn('Station switching is disabled in kiosk mode');
      return;
    }
    
    // Prevent station switching for unauthenticated users when auth is required
    if (requireAuth && !isAuthenticated) {
      console.warn('Station switching requires authentication');
      return;
    }
    
    const station = stations.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      setCurrentStationId(station.id);
      localStorage.setItem(STORAGE_KEY, station.id);
    }
  }, [stations, kioskMode, requireAuth, isAuthenticated]);

  /**
   * Clear station selection (revert to default)
   */
  const clearStation = useCallback(() => {
    // Prevent station clearing in kiosk mode
    if (kioskMode) {
      console.warn('Station clearing is disabled in kiosk mode');
      return;
    }
    
    // Prevent station clearing for unauthenticated users when auth is required
    if (requireAuth && !isAuthenticated) {
      console.warn('Station clearing requires authentication');
      return;
    }
    
    localStorage.removeItem(STORAGE_KEY);
    setSelectedStation(null);
    setCurrentStationId(null);
  }, [kioskMode, requireAuth, isAuthenticated]);

  /**
   * Refresh stations from API
   */
  /**
   * Refresh stations from API (used by admin pages)
   */
  const refreshStations = useCallback(async () => {
    setIsLoading(true);
    const hasAccess = !requireAuth || isAuthenticated;
    const loadedStations = await loadStations(hasAccess);
    
    // Re-select current station if it still exists
    if (selectedStation) {
      const updatedStation = loadedStations.find(s => s.id === selectedStation.id);
      if (updatedStation) {
        setSelectedStation(updatedStation);
      } else {
        // Station was removed, clear selection
        setSelectedStation(null);
        setCurrentStationId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    
    setIsLoading(false);
  }, [loadStations, selectedStation, requireAuth, isAuthenticated]);

  /**
   * Check if current station is demo station
   */
  const isDemoStation = useCallback(() => {
    return selectedStation?.id === DEMO_STATION_ID;
  }, [selectedStation]);

  /**
   * Check if current station is default station
   */
  const isDefaultStation = useCallback(() => {
    return !selectedStation || selectedStation.id === DEFAULT_STATION_ID;
  }, [selectedStation]);

  /**
   * Check if station switching is allowed
   */
  const canSwitchStations = useCallback(() => {
    return canSwitchStation();
  }, []);

  const value: StationContextType = {
    selectedStation,
    stations,
    isLoading,
    error,
    isKioskMode: kioskMode,
    selectStation,
    clearStation,
    refreshStations,
    isDemoStation,
    isDefaultStation,
    canSwitchStations,
  };

  return (
    <StationContext.Provider value={value}>
      {children}
    </StationContext.Provider>
  );
}

/**
 * Hook to use station context
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStation() {
  const context = useContext(StationContext);
  if (context === undefined) {
    throw new Error('useStation must be used within a StationProvider');
  }
  return context;
}
