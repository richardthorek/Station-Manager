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
import { AuthProvider } from './AuthContext';
import type { Station } from '../types';
import { ReactNode } from 'react';

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getStations: vi.fn(),
    getStation: vi.fn(),
    getDemoStation: vi.fn(),
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
    <AuthProvider>
      <StationProvider>{children}</StationProvider>
    </AuthProvider>
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
    
    // After initialization, should be ready with no station selected
    expect(result.current.isLoading).toBe(false);
    expect(result.current.selectedStation).toBe(null);
    // Stations should NOT be loaded on initialization (only for kiosk mode)
    expect(result.current.stations).toEqual([]);
    // API should not be called on normal initialization
    expect(api.getStations).not.toHaveBeenCalled();
  });

  it('should not load stations from API on mount in normal mode', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // Stations not loaded in normal mode
    expect(api.getStations).not.toHaveBeenCalled();
    expect(result.current.stations).toEqual([]);
  });

  it('should default to null station when no selection', async () => {
    const { result } = await renderStationHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedStation).toBe(null);
    expect(setCurrentStationId).toHaveBeenCalledWith(null);
  });

  it('resolves to the demo station when demo mode is active (Q34, found 2026-07-17)', async () => {
    // Without this, currentStationId stayed null for an anonymous demo
    // visitor, so no X-Station-Id header was ever sent and requireSession's
    // demo bypass (which requires the request to explicitly target
    // DEMO_STATION_ID) never matched — every requireSession-gated read
    // 401'd for a signed-out demo visitor.
    sessionStorage.setItem('demoMode', 'true');
    const demoStation = mockStations.find((s) => s.id === DEMO_STATION_ID)!;
    vi.mocked(api.getDemoStation).mockResolvedValue(demoStation);

    const { result } = await renderStationHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(api.getDemoStation).toHaveBeenCalled();
    expect(result.current.selectedStation).toEqual(demoStation);
    expect(setCurrentStationId).toHaveBeenCalledWith(DEMO_STATION_ID);
  });

  it('falls back to no station if the demo-station lookup fails, without blocking load', async () => {
    sessionStorage.setItem('demoMode', 'true');
    vi.mocked(api.getDemoStation).mockRejectedValue(new Error('network error'));

    const { result } = await renderStationHook();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedStation).toBe(null);
  });

  describe('authenticated station auto-selection (Q41, found 2026-07-17)', () => {
    // Without this, selectedStation stayed null for any authenticated admin
    // who hadn't explicitly picked a station, so useSocket's join-station
    // effect (which requires a resolved stationId) never fired — an admin
    // viewing /signin directly got zero live updates from other devices,
    // even though the page itself loaded fine via the server's separate,
    // implicit JWT-to-station inference for REST calls.
    const stubAuthenticatedFetch = () => {
      localStorage.setItem('auth_token', 'fake-admin-token');
      const fetchMock = vi.fn((url: string) => {
        if (url.endsWith('/auth/config')) {
          return Promise.resolve({ ok: true, json: async () => ({ requireAuth: true }) });
        }
        if (url.endsWith('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 'u1',
              username: 'Richard BT',
              role: 'owner',
              organizationId: 'org-1',
              organization: { id: 'org-1', name: 'Org 1', slug: 'org-1', billingEmail: 'a@example.com', planCode: 'ai', status: 'active', entitlements: {} },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      vi.stubGlobal('fetch', fetchMock);
    };

    it('auto-selects the single station the org owns', async () => {
      stubAuthenticatedFetch();
      const ownStation: Station = { ...mockStations[2], organizationId: 'org-1' };
      vi.mocked(api.getStations).mockResolvedValue([mockStations[0], ownStation]); // default (orphan) + 1 own

      const { result } = await renderStationHook();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.getStations).toHaveBeenCalled();
      expect(result.current.selectedStation).toEqual(ownStation);
      expect(setCurrentStationId).toHaveBeenCalledWith(ownStation.id);

      vi.unstubAllGlobals();
    });

    it('falls back to the shared default station when the org owns none of its own', async () => {
      stubAuthenticatedFetch();
      // A fresh org: only the un-owned default station exists (matches what
      // a brand-new production org's own GET /api/stations actually returns
      // before it creates its first real station).
      vi.mocked(api.getStations).mockResolvedValue([mockStations[0]]);

      const { result } = await renderStationHook();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedStation).toEqual(mockStations[0]);
      expect(setCurrentStationId).toHaveBeenCalledWith(DEFAULT_STATION_ID);

      vi.unstubAllGlobals();
    });

    it('leaves no station auto-selected when the org owns two or more (genuinely ambiguous)', async () => {
      // A multi-station admin's intended station is genuinely ambiguous
      // without an explicit pick — auto-selecting the wrong one would be
      // worse than the current "no live updates until you pick one" gap, so
      // this case deliberately keeps today's behaviour.
      stubAuthenticatedFetch();
      const ownStationA: Station = { ...mockStations[1], id: 'own-a', organizationId: 'org-1' };
      const ownStationB: Station = { ...mockStations[2], id: 'own-b', organizationId: 'org-1' };
      vi.mocked(api.getStations).mockResolvedValue([mockStations[0], ownStationA, ownStationB]);

      const { result } = await renderStationHook();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedStation).toBe(null);
      expect(setCurrentStationId).toHaveBeenCalledWith(null);

      vi.unstubAllGlobals();
    });
  });

  it('should restore station selection from localStorage', async () => {
    localStorage.setItem('selectedStationId', DEMO_STATION_ID);
    
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // In normal mode, station selection is not persisted - always defaults to null
    // (Station selection is only through URL token or default)
    expect(result.current.selectedStation).toBe(null);
  });

  it('should refresh stations from API when explicitly requested', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // Initially, stations not loaded
    expect(api.getStations).not.toHaveBeenCalled();
    
    // Explicitly refresh (e.g., from admin page)
    await act(async () => {
      await result.current.refreshStations();
    });
    
    // After refresh, stations should be loaded
    expect(api.getStations).toHaveBeenCalledTimes(1);
    expect(result.current.stations).toEqual(mockStations);
  });

  it('should clear station selection and revert to default', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // In normal mode, always defaults to null
    expect(result.current.selectedStation).toBe(null);
    
    act(() => {
      result.current.clearStation();
    });
    
    expect(result.current.selectedStation).toBe(null);
    expect(localStorage.getItem('selectedStationId')).toBe(null);
  });

  it('should identify demo station correctly', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // In normal mode with no selection, not a demo station
    expect(result.current.isDemoStation()).toBe(false);
  });

  it('should identify default station correctly', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // With no selection, it's considered default
    expect(result.current.isDefaultStation()).toBe(true);
  });

  it('should handle API errors gracefully when refreshing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.getStations).mockRejectedValueOnce(new Error('API Error'));
    
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // Error should not be set yet (stations not loaded)
    expect(result.current.error).toBe(null);
    
    // Trigger refresh which will fail
    await act(async () => {
      await result.current.refreshStations();
    });
    
    // Now error should be set
    expect(result.current.error).toBe('API Error');
    expect(result.current.stations).toEqual([]);
    
    consoleError.mockRestore();
  });

  it('should not sync selection across tabs in normal mode', async () => {
    const { result } = await renderStationHook();
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    // Initially no station is selected
    expect(result.current.selectedStation).toBe(null);
    
    // Simulate storage event from another tab (should be ignored in normal mode)
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: 'selectedStationId',
        newValue: DEMO_STATION_ID,
        oldValue: null,
        storageArea: localStorage,
      });
      window.dispatchEvent(storageEvent);
    });
    
    // In normal mode, storage events don't change station (no selector)
    // Station would only be empty array since stations aren't loaded
    expect(result.current.selectedStation).toBe(null);
  });

  it('should throw error when used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useStation());
    }).toThrow('useStation must be used within a StationProvider');
    
    consoleError.mockRestore();
  });
});
