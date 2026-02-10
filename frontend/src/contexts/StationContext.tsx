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
  const { isAuthenticated, requireAuth, isLoading: authLoading } = useAuth();
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
      
      // Normal mode: Just use demo/default station - NO API CALL
      // Station is determined automatically based on authentication/requirements
      // No persisted selection needed - always use demo/default
      setSelectedStation(null);
      setCurrentStationId(null);
      setIsLoading(false);
    };

    initialize();
  }, [authLoading, loadStations, isAuthenticated, requireAuth]);

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
