/**
 * StationTokenCard — Devices section tests (AC-5)
 *
 * The card is presentation + callback delegation only (no API calls inside),
 * so these tests exercise the enroll/rename/revoke/delete interactions
 * against mocked callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StationTokenCard } from './StationTokenCard';
import type { Station, Device } from '../../../types';

const station: Station = {
  id: 'station-1',
  name: 'Test Station',
  brigadeId: 'brigade-1',
  brigadeName: 'Test Brigade',
  hierarchy: {
    jurisdiction: 'NSW', area: 'Area', district: 'District',
    brigade: 'Test Brigade', station: 'Test Station',
  },
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const activeDevice: Device = {
  id: 'device-1',
  stationId: 'station-1',
  type: 'kiosk',
  name: 'Main shed kiosk',
  token: '11111111-1111-1111-1111-111111111111',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function renderCard(overrides: Partial<React.ComponentProps<typeof StationTokenCard>> = {}) {
  const props = {
    station,
    tokens: [],
    onGenerateToken: vi.fn(),
    onRevokeToken: vi.fn(),
    isGenerating: false,
    devices: [],
    onEnrollDevice: vi.fn(),
    onRenameDevice: vi.fn(),
    onSetDeviceStatus: vi.fn(),
    onDeleteDevice: vi.fn(),
    isEnrolling: false,
    ...overrides,
  };
  render(<StationTokenCard {...props} />);
  return props;
}

describe('StationTokenCard — Devices section', () => {
  it('shows an empty state when no devices are enrolled', () => {
    renderCard();
    expect(screen.getByText('No devices enrolled for this station.')).toBeInTheDocument();
  });

  it('enrolls a device with the entered name and selected type', () => {
    const props = renderCard();
    fireEvent.change(screen.getByPlaceholderText('Device name (e.g. Main shed kiosk)'), {
      target: { value: 'Captain tablet' },
    });
    fireEvent.change(screen.getByDisplayValue('🖥️ Kiosk'), { target: { value: 'tablet' } });
    fireEvent.click(screen.getByText('+ Enroll Device'));

    expect(props.onEnrollDevice).toHaveBeenCalledWith('Captain tablet', 'tablet');
  });

  it('disables Enroll Device until a name is entered', () => {
    renderCard();
    expect(screen.getByText('+ Enroll Device')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Device name (e.g. Main shed kiosk)'), {
      target: { value: 'X' },
    });
    expect(screen.getByText('+ Enroll Device')).not.toBeDisabled();
  });

  it('renders an existing device with its kiosk URL and lets you rename it', () => {
    const props = renderCard({ devices: [activeDevice] });
    expect(screen.getByText('Main shed kiosk')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/\/signin\?brigade=11111111-1111-1111-1111-111111111111/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('✏️ Rename'));
    const input = screen.getByDisplayValue('Main shed kiosk') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed kiosk' } });
    fireEvent.click(screen.getByText('Save'));

    expect(props.onRenameDevice).toHaveBeenCalledWith('device-1', 'Renamed kiosk');
  });

  it('revokes an active device after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderCard({ devices: [activeDevice] });

    fireEvent.click(screen.getByText('🚫 Revoke'));

    expect(props.onSetDeviceStatus).toHaveBeenCalledWith('device-1', 'revoked');
    vi.restoreAllMocks();
  });

  it('shows a Reactivate action and a revoked badge for a revoked device', () => {
    const props = renderCard({ devices: [{ ...activeDevice, status: 'revoked' }] });
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✅ Reactivate'));
    expect(props.onSetDeviceStatus).toHaveBeenCalledWith('device-1', 'active');
  });

  it('deletes a device after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderCard({ devices: [activeDevice] });

    fireEvent.click(screen.getByText('🗑️ Remove'));

    expect(props.onDeleteDevice).toHaveBeenCalledWith('device-1');
    vi.restoreAllMocks();
  });
});
