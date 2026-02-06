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

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setCurrentStationId } from '../services/api';
import type { Station } from '../types';
import { 
  isKioskMode, 
  getKioskStationId, 
  initializeKioskMode, 
  validateKioskToken,
  canSwitchStation 
} from '../utils/kioskMode';

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
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kioskMode, setKioskMode] = useState(false);

  /**
   * Load stations from API
   */
  const loadStations = useCallback(async () => {
    try {
      setError(null);
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
   * Load persisted selection from localStorage or kiosk mode
   */
  const loadPersistedSelection = useCallback(async (availableStations: Station[]) => {
    try {
      // Check if in kiosk mode first
      const inKioskMode = isKioskMode();
      setKioskMode(inKioskMode);
      
      if (inKioskMode) {
        // Validate kiosk token
        const validation = await validateKioskToken();
        
        if (!validation.valid) {
          setError('Invalid or expired kiosk access token. Please contact your administrator.');
          setIsLoading(false);
          return;
        }
        
        // Lock to kiosk station
        const kioskStationId = validation.stationId || getKioskStationId();
        if (kioskStationId) {
          const kioskStation = availableStations.find(s => s.id === kioskStationId);
          if (kioskStation) {
            // Initialize kiosk mode with validated station info
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
      
      // Normal mode: Load from localStorage
      const persistedId = localStorage.getItem(STORAGE_KEY);
      
      if (persistedId && availableStations.length > 0) {
        // Find the persisted station
        const station = availableStations.find(s => s.id === persistedId);
        if (station) {
          setSelectedStation(station);
          setCurrentStationId(station.id);
          return;
        }
      }
      
      // If no persisted selection or station not found, use default
      const defaultStation = availableStations.find(s => s.id === DEFAULT_STATION_ID);
      if (defaultStation) {
        setSelectedStation(defaultStation);
        setCurrentStationId(defaultStation.id);
      } else if (availableStations.length > 0) {
        // Fallback to first station if default not found
        setSelectedStation(availableStations[0]);
        setCurrentStationId(availableStations[0].id);
      }
    } catch (err) {
      console.error('Error loading persisted selection:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initialize: Load stations and persisted selection
   */
  useEffect(() => {
    const initialize = async () => {
      const loadedStations = await loadStations();
      await loadPersistedSelection(loadedStations);
    };
    
    initialize();
  }, [loadStations, loadPersistedSelection]);

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
    
    const station = stations.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      setCurrentStationId(station.id);
      localStorage.setItem(STORAGE_KEY, station.id);
    }
  }, [stations, kioskMode]);

  /**
   * Clear station selection (revert to default)
   */
  const clearStation = useCallback(() => {
    // Prevent station clearing in kiosk mode
    if (kioskMode) {
      console.warn('Station clearing is disabled in kiosk mode');
      return;
    }
    
    localStorage.removeItem(STORAGE_KEY);
    const defaultStation = stations.find(s => s.id === DEFAULT_STATION_ID);
    if (defaultStation) {
      setSelectedStation(defaultStation);
      setCurrentStationId(defaultStation.id);
    } else if (stations.length > 0) {
      setSelectedStation(stations[0]);
      setCurrentStationId(stations[0].id);
    }
  }, [stations, kioskMode]);

  /**
   * Refresh stations from API
   */
  const refreshStations = useCallback(async () => {
    setIsLoading(true);
    const loadedStations = await loadStations();
    
    // Re-select current station if it still exists
    if (selectedStation) {
      const updatedStation = loadedStations.find(s => s.id === selectedStation.id);
      if (updatedStation) {
        setSelectedStation(updatedStation);
      } else {
        // Station was removed, select default
        await loadPersistedSelection(loadedStations);
      }
    }
    
    setIsLoading(false);
  }, [loadStations, loadPersistedSelection, selectedStation]);

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
