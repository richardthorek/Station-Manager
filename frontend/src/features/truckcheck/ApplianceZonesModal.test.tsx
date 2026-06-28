import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplianceZonesModal } from './ApplianceZonesModal';
import type { Appliance, ApplianceZone, ApplianceEquipment } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getZones: vi.fn(),
    createZone: vi.fn(),
    updateZone: vi.fn(),
    deleteZone: vi.fn(),
    seedZones: vi.fn(),
    getEquipment: vi.fn(),
    createEquipment: vi.fn(),
    updateEquipment: vi.fn(),
    deleteEquipment: vi.fn(),
  },
}));

import { api } from '../../services/api';

const mockApi = api as Record<string, ReturnType<typeof vi.fn>>;

const mockAppliance: Appliance = {
  id: 'app-1',
  name: 'Tanker 1',
  vehicleTypeId: 'vt-cat1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockZone: ApplianceZone = {
  id: 'zone-1',
  applianceId: 'app-1',
  name: 'Driver Side',
  side: 'driver',
  order: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockEquipment: ApplianceEquipment = {
  id: 'equip-1',
  applianceId: 'app-1',
  name: 'Hose Reel',
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getZones.mockResolvedValue([mockZone]);
  mockApi.getEquipment.mockResolvedValue([mockEquipment]);
});

describe('ApplianceZonesModal', () => {
  it('renders vehicle name in title', async () => {
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    expect(screen.getByText('Tanker 1')).toBeInTheDocument();
  });

  it('shows zones tab by default and loads zones', async () => {
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Driver Side')).toBeInTheDocument());
    expect(mockApi.getZones).toHaveBeenCalledWith('app-1');
  });

  it('switches to equipment tab on click', async () => {
    const user = userEvent.setup();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);

    const equipTab = screen.getByRole('tab', { name: /equipment/i });
    await user.click(equipTab);

    await waitFor(() => expect(screen.getByText('Hose Reel')).toBeInTheDocument());
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows seed-from-vehicle-type button when vehicleTypeId present', async () => {
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    const seedBtn = await screen.findByRole('button', { name: /seed from vehicle type/i });
    expect(seedBtn).not.toBeDisabled();
  });

  it('disables seed button when no vehicleTypeId', async () => {
    const noTypeAppliance = { ...mockAppliance, vehicleTypeId: undefined };
    render(<ApplianceZonesModal appliance={noTypeAppliance} onClose={vi.fn()} />);
    const seedBtn = await screen.findByRole('button', { name: /seed from vehicle type/i });
    expect(seedBtn).toBeDisabled();
  });

  it('shows error when zone load fails', async () => {
    mockApi.getZones.mockRejectedValue(new Error('network'));
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('calls createZone and refreshes on add', async () => {
    const user = userEvent.setup();
    mockApi.createZone.mockResolvedValue({ ...mockZone, id: 'zone-2', name: 'Rear Compartment' });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    const nameInput = screen.getByLabelText('New zone name');
    await user.type(nameInput, 'Rear Compartment');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(mockApi.createZone).toHaveBeenCalledWith('app-1', expect.objectContaining({ name: 'Rear Compartment' })));
    expect(mockApi.getZones).toHaveBeenCalledTimes(2);
  });

  it('shows validation error when add zone submitted with empty name', async () => {
    const user = userEvent.setup();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(mockApi.createZone).not.toHaveBeenCalled();
  });

  it('calls seedZones and refreshes on seed click', async () => {
    const user = userEvent.setup();
    mockApi.seedZones.mockResolvedValue({ seeded: 6, zones: [] });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    const seedBtn = screen.getByRole('button', { name: /seed from vehicle type/i });
    await user.click(seedBtn);

    await waitFor(() => expect(mockApi.seedZones).toHaveBeenCalledWith('app-1', false));
    expect(await screen.findByText(/seeded 6 zones/i)).toBeInTheDocument();
  });
});
