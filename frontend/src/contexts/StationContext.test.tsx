/**
 * Station Context Tests
 * 
 * Tests for station selection context including:
 * - Context provider initialization
 * - Station loading from API
 * - Station selection and persistence
 * - Cross-tab synchronization
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { StationProvider, useStation, DEMO_STATION_ID, DEFAULT_STATION_ID } from './StationContext';
import type { Station } from '../types';
import { ReactNode } from 'react';

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getStations: vi.fn(),
    getStation: vi.fn(),
  },
  setCurrentStationId: vi.fn(),
  getCurrentStationId: vi.fn(() => 'default-station'),
}));

import { api, setCurrentStationId } from '../services/api';

// Mock station data
const mockStations: Station[] = [
  {
    id: DEFAULT_STATION_ID,
    name: 'Default Station',
    brigadeId: 'default-brigade',
    brigadeName: 'Default Brigade',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Southern Highlands',
      district: 'Central',
      brigade: 'Default Brigade',
      station: 'Default Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: DEMO_STATION_ID,
    name: 'Demo Station',
    brigadeId: 'demo-brigade',
    brigadeName: 'Demo Brigade',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Demo Area',
      district: 'Demo District',
      brigade: 'Demo Brigade',
      station: 'Demo Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'test-station-1',
    name: 'Test Station 1',
    brigadeId: 'test-brigade',
    brigadeName: 'Test Brigade',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Test Area',
      district: 'Test District',
      brigade: 'Test Brigade',
      station: 'Test Station 1',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('StationContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementation
    vi.mocked(api.getStations).mockResolvedValue(mockStations);
  });

  afterEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <StationProvider>{children}</StationProvider>
  );

  const renderStationHook = async () => {
    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useStation>>> | undefined
    await act(async () => {
      hookResult = renderHook(() => useStation(), { wrapper })
    })
    return hookResult as ReturnType<typeof renderHook<ReturnType<typeof useStation>>>
  }

  it('should initialize with loading state', async () => {
    const { result } = await renderStationHook();
    
    // After act completes, initial load resolves; verify state is ready
    expect(result.current.isLoading).toBe(false);
    expect(result.current.selectedStation?.id).toBe(DEFAULT_STATION_ID);
    expect(result.current.stations).toEqual(mockStations);
  });

  it('should load stations from API on mount', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(api.getStations).toHaveBeenCalledTimes(1);
    expect(result.current.stations).toEqual(mockStations);
  });

  it('should select default station when no persisted selection', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.selectedStation?.id).toBe(DEFAULT_STATION_ID);
    expect(setCurrentStationId).toHaveBeenCalledWith(DEFAULT_STATION_ID);
  });

  it('should load persisted selection from localStorage', async () => {
    localStorage.setItem('selectedStationId', DEMO_STATION_ID);
    
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.selectedStation?.id).toBe(DEMO_STATION_ID);
    expect(setCurrentStationId).toHaveBeenCalledWith(DEMO_STATION_ID);
  });

  it('should select a station and persist to localStorage', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    act(() => {
      result.current.selectStation('test-station-1');
    });
    
    expect(result.current.selectedStation?.id).toBe('test-station-1');
    expect(localStorage.getItem('selectedStationId')).toBe('test-station-1');
    expect(setCurrentStationId).toHaveBeenCalledWith('test-station-1');
  });

  it('should clear station selection and revert to default', async () => {
    localStorage.setItem('selectedStationId', DEMO_STATION_ID);
    
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.selectedStation?.id).toBe(DEMO_STATION_ID);
    
    act(() => {
      result.current.clearStation();
    });
    
    expect(result.current.selectedStation?.id).toBe(DEFAULT_STATION_ID);
    expect(localStorage.getItem('selectedStationId')).toBe(null);
  });

  it('should identify demo station correctly', async () => {
    localStorage.setItem('selectedStationId', DEMO_STATION_ID);
    
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.isDemoStation()).toBe(true);
    
    act(() => {
      result.current.selectStation(DEFAULT_STATION_ID);
    });
    
    expect(result.current.isDemoStation()).toBe(false);
  });

  it('should identify default station correctly', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.isDefaultStation()).toBe(true);
    
    act(() => {
      result.current.selectStation(DEMO_STATION_ID);
    });
    
    expect(result.current.isDefaultStation()).toBe(false);
  });

  it('should refresh stations from API', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(api.getStations).toHaveBeenCalledTimes(1);
    
    await act(async () => {
      await result.current.refreshStations();
    });
    
    expect(api.getStations).toHaveBeenCalledTimes(2);
  });

  it('should handle API errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.getStations).mockRejectedValueOnce(new Error('API Error'));
    
    const { result } = renderHook(() => useStation(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.error).toBe('API Error');
    expect(result.current.stations).toEqual([]);
    
    consoleError.mockRestore();
  });

  it('should throw error when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useStation());
    }).toThrow('useStation must be used within a StationProvider');
    
    consoleError.mockRestore();
  });

  it('should sync selection across tabs via storage event', async () => {
    const { result } = renderHook(() => useStation(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.selectedStation?.id).toBe(DEFAULT_STATION_ID);
    
    // Simulate storage event from another tab
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: 'selectedStationId',
        newValue: DEMO_STATION_ID,
        oldValue: DEFAULT_STATION_ID,
        storageArea: localStorage,
      });
      window.dispatchEvent(storageEvent);
    });
    
    await waitFor(() => {
      expect(result.current.selectedStation?.id).toBe(DEMO_STATION_ID);
    });
  });
});
