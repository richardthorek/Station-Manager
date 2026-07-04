/**
 * TruckCheckComparativePage Component Tests
 */

import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TruckCheckComparativePage } from './TruckCheckComparativePage';
import { StationProvider, useStation } from '../../contexts/StationContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { api } from '../../services/api';

/**
 * StationContext only loads stations from the API when explicitly told to
 * (e.g. StationManagementPage calling refreshStations()) — normal-mode
 * initialization deliberately skips the API call. Mirror that real trigger
 * here so the multi-station selector has data to show.
 */
function StationsLoader({ children }: { children: React.ReactNode }) {
  const { refreshStations } = useStation();
  const triggered = useRef(false);
  useEffect(() => {
    if (!triggered.current) {
      triggered.current = true;
      void refreshStations();
    }
  }, [refreshStations]);
  return <>{children}</>;
}

vi.mock('../../services/api', () => ({
  api: {
    getStations: vi.fn(),
    getDemoStation: vi.fn(),
    getTruckCheckComparative: vi.fn(),
  },
  setCurrentStationId: vi.fn(),
  getCurrentStationId: vi.fn(),
}));

const mockStations = [
  {
    id: 'station-1',
    name: 'Blacktown Fire Station',
    brigadeId: 'brigade-1',
    brigadeName: 'Blacktown Brigade',
    hierarchy: {
      jurisdiction: 'NSW', area: 'Greater Sydney', district: 'Western Sydney',
      brigade: 'Blacktown Brigade', station: 'Blacktown Fire Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'station-2',
    name: 'Penrith Fire Station',
    brigadeId: 'brigade-1',
    brigadeName: 'Blacktown Brigade',
    hierarchy: {
      jurisdiction: 'NSW', area: 'Greater Sydney', district: 'Western Sydney',
      brigade: 'Blacktown Brigade', station: 'Penrith Fire Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const mockComparative = {
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-03-31T00:00:00.000Z',
  stationIds: ['station-1', 'station-2'],
  vehicleTypes: [
    {
      vehicleTypeCode: 'cat1-tanker',
      vehicleTypeName: 'Cat 1 Tanker',
      items: [
        {
          itemCode: 'tyre-condition',
          itemName: 'Tyre Condition',
          stations: [
            { stationId: 'station-1', stationName: 'Blacktown Fire Station', totalChecks: 10, doneCount: 9, issueCount: 1, skippedCount: 0, passRate: 90 },
            { stationId: 'station-2', stationName: 'Penrith Fire Station', totalChecks: 8, doneCount: 4, issueCount: 4, skippedCount: 0, passRate: 50 },
          ],
        },
      ],
    },
  ],
};

describe('TruckCheckComparativePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getStations as ReturnType<typeof vi.fn>).mockResolvedValue(mockStations);
  });

  const renderWithProviders = async (component: React.ReactElement) => {
    let rendered;
    await act(async () => {
      rendered = render(
        <BrowserRouter>
          <AuthProvider>
            <StationProvider>{component}</StationProvider>
          </AuthProvider>
        </BrowserRouter>
      );
    });
    return rendered;
  };

  it('renders page header and station selector', async () => {
    await renderWithProviders(<TruckCheckComparativePage />);

    await waitFor(() => {
      expect(screen.getByText('Compare Vehicle Checks Across Stations')).toBeInTheDocument();
    });
    expect(screen.getByText('Select Stations to Compare:')).toBeInTheDocument();
  });

  it('shows a prompt to select stations before any are chosen', async () => {
    await renderWithProviders(<TruckCheckComparativePage />);

    await waitFor(() => {
      expect(screen.getByText('Select two or more stations, then click Compare.')).toBeInTheDocument();
    });
  });

  it('disables the Compare button until stations are selected', async () => {
    await renderWithProviders(<TruckCheckComparativePage />);

    await waitFor(() => {
      expect(screen.getByText('Compare')).toBeInTheDocument();
    });
    expect(screen.getByText('Compare')).toBeDisabled();
  });

  it('fetches and renders the comparative report after selecting stations', async () => {
    (api.getTruckCheckComparative as ReturnType<typeof vi.fn>).mockResolvedValue(mockComparative);

    await renderWithProviders(
      <StationsLoader>
        <TruckCheckComparativePage />
      </StationsLoader>
    );

    await waitFor(() => {
      expect(screen.getByText('Select Stations to Compare:')).toBeInTheDocument();
    });

    // Open the multi-station selector dropdown and pick both stations.
    fireEvent.click(screen.getByText('Select stations...'));

    await waitFor(() => {
      expect(screen.getByText('Blacktown Fire Station')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Blacktown Fire Station'));
    fireEvent.click(screen.getByText('Penrith Fire Station'));

    fireEvent.click(screen.getByText('Compare'));

    await waitFor(() => {
      expect(api.getTruckCheckComparative).toHaveBeenCalledWith(
        expect.arrayContaining(['station-1', 'station-2']),
        expect.any(String),
        expect.any(String)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Cat 1 Tanker')).toBeInTheDocument();
    });
    expect(screen.getByText('Tyre Condition')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
