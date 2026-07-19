import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeviceInfoBadge } from './DeviceInfoBadge';

describe('DeviceInfoBadge', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders nothing outside kiosk mode', () => {
    const { container } = render(<DeviceInfoBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the device name and expiry once validated', async () => {
    sessionStorage.setItem('kioskBrigadeToken', 'a-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        name: 'Main shed kiosk',
        type: 'kiosk',
        stationName: 'Bungendore Station',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    }) as unknown as typeof fetch;

    render(<DeviceInfoBadge />);

    const trigger = await screen.findByRole('button', { name: /device info for main shed kiosk/i });
    fireEvent.click(trigger);

    expect(await screen.findByText(/main shed kiosk \(kiosk\)/i)).toBeInTheDocument();
    expect(screen.getByText('Bungendore Station')).toBeInTheDocument();
    expect(screen.getByText(/expires/i)).toBeInTheDocument();
  });

  it('falls back to a generic label for a legacy token with no device name', async () => {
    sessionStorage.setItem('kioskBrigadeToken', 'legacy-token');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, expiresAt: null }),
    }) as unknown as typeof fetch;

    render(<DeviceInfoBadge />);

    const trigger = await screen.findByRole('button', { name: /device info for this device/i });
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByText(/no expiry/i)).toBeInTheDocument());
  });
});
