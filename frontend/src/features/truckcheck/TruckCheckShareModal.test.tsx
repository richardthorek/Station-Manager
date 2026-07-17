import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TruckCheckShareModal } from './TruckCheckShareModal';

vi.mock('../../services/api', () => ({
  api: {
    generateBrigadeAccessToken: vi.fn(),
  },
}));

const mockIsKioskMode = vi.fn();
const mockGenerateKioskUrl = vi.fn();
vi.mock('../../utils/kioskMode', () => ({
  isKioskMode: () => mockIsKioskMode(),
  generateKioskUrl: (path: string) => mockGenerateKioskUrl(path),
}));

import { api } from '../../services/api';

const mockApi = api as unknown as { generateBrigadeAccessToken: ReturnType<typeof vi.fn> };

describe('TruckCheckShareModal (AC-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('reuses the existing device token when already in kiosk mode (no API call)', async () => {
    mockIsKioskMode.mockReturnValue(true);
    mockGenerateKioskUrl.mockReturnValue('/truckcheck/check/app-1?brigade=existing-token');

    render(
      <TruckCheckShareModal applianceId="app-1" stationId="station-1" brigadeId="brigade-1" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Share link')).toHaveValue(
        `${window.location.origin}/truckcheck/check/app-1?brigade=existing-token`
      );
    });
    expect(mockApi.generateBrigadeAccessToken).not.toHaveBeenCalled();
  });

  it('mints a new station-scoped token when not in kiosk mode', async () => {
    mockIsKioskMode.mockReturnValue(false);
    mockApi.generateBrigadeAccessToken.mockResolvedValue({
      success: true,
      token: 'fresh-token',
      brigadeId: 'brigade-1',
      stationId: 'station-1',
      createdAt: new Date().toISOString(),
      kioskUrl: 'https://example.test/signin?brigade=fresh-token',
    });

    render(
      <TruckCheckShareModal applianceId="app-1" stationId="station-1" brigadeId="brigade-1" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Share link')).toHaveValue(
        `${window.location.origin}/truckcheck/check/app-1?brigade=fresh-token`
      );
    });
    expect(mockApi.generateBrigadeAccessToken).toHaveBeenCalledWith({
      brigadeId: 'brigade-1',
      stationId: 'station-1',
      description: 'Truck check share — app-1',
      expiresInDays: 1,
    });
  });

  it('shows an error message when minting a token fails', async () => {
    mockIsKioskMode.mockReturnValue(false);
    mockApi.generateBrigadeAccessToken.mockRejectedValue(new Error('network error'));

    render(
      <TruckCheckShareModal applianceId="app-1" stationId="station-1" brigadeId="brigade-1" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Could not generate a share link. Try again.')).toBeInTheDocument();
    });
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    mockIsKioskMode.mockReturnValue(true);
    mockGenerateKioskUrl.mockReturnValue('/truckcheck/check/app-1?brigade=t');
    const onClose = vi.fn();

    render(
      <TruckCheckShareModal applianceId="app-1" stationId="station-1" brigadeId="brigade-1" onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: 'Close share dialog' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies the link to the clipboard', async () => {
    mockIsKioskMode.mockReturnValue(true);
    mockGenerateKioskUrl.mockReturnValue('/truckcheck/check/app-1?brigade=t');

    render(
      <TruckCheckShareModal applianceId="app-1" stationId="station-1" brigadeId="brigade-1" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Share link')).toHaveValue(`${window.location.origin}/truckcheck/check/app-1?brigade=t`);
    });
    // fireEvent (not user-event) so user-event's own clipboard polyfill doesn't
    // shadow the vi.fn() stub defined in beforeEach.
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/truckcheck/check/app-1?brigade=t`
      );
    });
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });
});
