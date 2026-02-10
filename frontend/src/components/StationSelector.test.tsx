/**
 * Station Selector Component Tests
 * 
 * NOTE: StationSelector component is deprecated and no longer used in the application.
 * Station selection now happens automatically through:
 * - Brigade token in URL (kiosk mode)
 * - Default/demo station (normal mode)
 * 
 * These tests are kept for reference but skipped since the component is not in use.
 * 
 * Tests for station selector dropdown including:
 * - Rendering and display
 * - Search/filter functionality
 * - Keyboard navigation
 * - Station selection
 * - Accessibility features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StationSelector } from './StationSelector';
import { StationProvider, DEMO_STATION_ID, DEFAULT_STATION_ID } from '../contexts/StationContext';
import { AuthProvider } from '../contexts/AuthContext';
import type { Station } from '../types';

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getStations: vi.fn(),
    getDemoStation: vi.fn(),
  },
  setCurrentStationId: vi.fn(),
  getCurrentStationId: vi.fn(() => 'default-station'),
}));

import { api } from '../services/api';

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
    name: 'Bungendore North',
    brigadeId: 'bungendore-brigade',
    brigadeName: 'Bungendore',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Far South Coast',
      district: 'Monaro',
      brigade: 'Bungendore',
      station: 'Bungendore North',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe.skip('StationSelector (deprecated)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.getStations).mockResolvedValue(mockStations);
  });

  const renderWithProvider = () => {
    return render(
      <AuthProvider>
        <StationProvider>
          <StationSelector />
        </StationProvider>
      </AuthProvider>
    );
  };

  // Helper to open dropdown and wait for stations to load
  const openDropdownAndWaitForStations = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    // Wait for dropdown to open
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    // Wait for stations to load
    await waitFor(() => {
      expect(api.getStations).toHaveBeenCalled();
    });
  };

  it('should render the station selector button', async () => {
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
  });

  it('should display selected station name', async () => {
    // Set up localStorage with a selected station first
    localStorage.setItem('selectedStationId', DEFAULT_STATION_ID);
    
    renderWithProvider();
    
    await waitFor(() => {
      // Station name should be displayed (even though full station list not loaded yet)
      expect(screen.getByText('Select Station')).toBeInTheDocument();
    });
  });

  it('should open dropdown when button clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    // Dropdown opens and shows loading or stations
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/search stations/i)).toBeInTheDocument();
    
    // Wait for stations to load
    await waitFor(() => {
      expect(api.getStations).toHaveBeenCalled();
    });
  });

  it('should close dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    
    await user.click(document.body);
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should filter stations by search query', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    // Wait for stations to load
    await waitFor(() => {
      expect(api.getStations).toHaveBeenCalled();
    });
    
    const searchInput = screen.getByPlaceholderText(/search stations/i);
    await user.type(searchInput, 'demo');
    
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      
      // Check that demo station is in the list
      expect(within(listbox).getByText(/Demo Brigade - Demo Station/i)).toBeInTheDocument();
      
      // Check that the default station option is NOT in the list (filtered out)
      const defaultOption = within(listbox).queryByRole('option', { name: /Default Brigade - Default Station/i });
      expect(defaultOption).not.toBeInTheDocument();
    });
  });

  it('should filter stations by area', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    
    const searchInput = screen.getByPlaceholderText(/search stations/i);
    await user.type(searchInput, 'far south');
    
    await waitFor(() => {
      expect(screen.getByText(/Bungendore North/i)).toBeInTheDocument();
      expect(screen.queryByText('Demo Station')).not.toBeInTheDocument();
    });
  });

  it('should select a station when clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    
    await waitFor(() => {
      expect(screen.getByText(/Demo Brigade - Demo Station/i)).toBeInTheDocument();
    });
    
    const demoOption = screen.getByText(/Demo Brigade - Demo Station/i);
    await user.click(demoOption);
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
    
    // Verify the button now shows the demo station (just brigade name when they match)
    await waitFor(() => {
      expect(screen.getByText(/Demo/i)).toBeInTheDocument();
    });
  });

  it('should highlight demo stations with special badge', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    
    await waitFor(() => {
      expect(screen.getByText('DEMO')).toBeInTheDocument();
    });
  });

  it('should show station hierarchy information', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    
    await waitFor(() => {
      expect(screen.getByText(/Demo Area › Demo District/i)).toBeInTheDocument();
      expect(screen.getByText(/Far South Coast › Monaro/i)).toBeInTheDocument();
    });
  });

  it('should display brigade name with station name when different', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    
    await waitFor(() => {
      expect(screen.getByText(/Bungendore - Bungendore North/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no stations match search', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    const searchInput = screen.getByPlaceholderText(/search stations/i);
    await user.type(searchInput, 'nonexistent station');
    
    await waitFor(() => {
      expect(screen.getByText(/no stations found/i)).toBeInTheDocument();
    });
  });

  it('should support keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    button.focus();
    
    // Open with Enter key
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    // Wait for stations to load
    await waitFor(() => {
      expect(api.getStations).toHaveBeenCalled();
    });
    
    // Navigate with arrow down
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    
    // Select with Enter
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should close dropdown with Escape key', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    await user.keyboard('{Escape}');
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should have proper ARIA attributes for accessibility', async () => {
    renderWithProvider();
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /select station/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });

  it('should mark selected station with checkmark', async () => {
    // Set up localStorage with a selected station first
    localStorage.setItem('selectedStationId', DEFAULT_STATION_ID);
    
    const user = userEvent.setup();
    renderWithProvider();
    
    await openDropdownAndWaitForStations(user);
    
    await waitFor(() => {
      const selectedItems = screen.getAllByText('✓');
      expect(selectedItems.length).toBeGreaterThan(0);
    });
  });

  it('should focus search input when dropdown opens', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select station/i })).toBeInTheDocument();
    });
    
    const button = screen.getByRole('button', { name: /select station/i });
    await user.click(button);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search stations/i);
      expect(searchInput).toHaveFocus();
    });
  });
});
