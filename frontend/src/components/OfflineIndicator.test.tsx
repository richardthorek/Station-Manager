import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfflineIndicator } from './OfflineIndicator';
import * as offlineStorage from '../services/offlineStorage';
import { offlineQueue } from '../services/offlineQueue';

// Mock the services
vi.mock('../services/offlineStorage', () => ({
  getAllQueuedActions: vi.fn(() => Promise.resolve([])),
  initDB: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../services/offlineQueue', () => ({
  offlineQueue: {
    onSyncComplete: vi.fn(() => vi.fn()),
    forceSyncNow: vi.fn(() => Promise.resolve()),
  },
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when online with no queued actions', async () => {
    vi.mocked(offlineStorage.getAllQueuedActions).mockResolvedValue([]);
    
    const { container } = render(<OfflineIndicator />);
    
    await waitFor(() => {
      expect(container.querySelector('.offline-indicator')).not.toBeInTheDocument();
    });
  });

  it('should render offline banner when offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(<OfflineIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/Offline - Changes will sync when connected/i)).toBeInTheDocument();
    });
  });

  it('should show queued actions when available', async () => {
    const mockActions = [
      {
        id: '1',
        type: 'checkin' as const,
        endpoint: '/api/checkins',
        method: 'POST' as const,
        data: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending' as const,
      },
    ];

    vi.mocked(offlineStorage.getAllQueuedActions).mockResolvedValue(mockActions);

    render(<OfflineIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/1 action\(s\) pending/i)).toBeInTheDocument();
    });
  });

  it('should toggle queue visibility when View button is clicked', async () => {
    const user = userEvent.setup();
    const mockActions = [
      {
        id: '1',
        type: 'checkin' as const,
        endpoint: '/api/checkins',
        method: 'POST' as const,
        data: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending' as const,
      },
    ];

    vi.mocked(offlineStorage.getAllQueuedActions).mockResolvedValue(mockActions);

    render(<OfflineIndicator />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/View/i)).toBeInTheDocument();
    });

    // Click view button
    const viewButton = screen.getByText(/View/i);
    await user.click(viewButton);

    // Queue should be visible
    await waitFor(() => {
      expect(screen.getByText(/Queued Actions/i)).toBeInTheDocument();
    });
  });

  it('should call forceSyncNow when Sync Now button is clicked', async () => {
    const user = userEvent.setup();
    const mockActions = [
      {
        id: '1',
        type: 'checkin' as const,
        endpoint: '/api/checkins',
        method: 'POST' as const,
        data: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending' as const,
      },
    ];

    vi.mocked(offlineStorage.getAllQueuedActions).mockResolvedValue(mockActions);

    render(<OfflineIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/Sync Now/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/Sync Now/i);
    await user.click(syncButton);

    expect(offlineQueue.forceSyncNow).toHaveBeenCalled();
  });
});
