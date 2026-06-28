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

  it('shows fallback message when seed returns 0 zones', async () => {
    const user = userEvent.setup();
    mockApi.seedZones.mockResolvedValue({ seeded: 0, zones: [], message: 'No vocabulary for this type.' });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: /seed from vehicle type/i }));
    expect(await screen.findByText('No vocabulary for this type.')).toBeInTheDocument();
  });

  it('shows error message when seed fails', async () => {
    const user = userEvent.setup();
    mockApi.seedZones.mockRejectedValue(new Error('network'));

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: /seed from vehicle type/i }));
    expect(await screen.findByText(/seed failed/i)).toBeInTheDocument();
  });

  it('opens inline zone edit form and cancels', async () => {
    const user = userEvent.setup();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: 'Edit Driver Side' }));
    expect(screen.getByLabelText('Zone name')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Zone name')).not.toBeInTheDocument();
  });

  it('saves zone inline edit', async () => {
    const user = userEvent.setup();
    mockApi.updateZone.mockResolvedValue({ ...mockZone, name: 'Rear Compartment' });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: 'Edit Driver Side' }));
    const nameInput = screen.getByLabelText('Zone name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Rear Compartment');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockApi.updateZone).toHaveBeenCalledWith('zone-1', expect.objectContaining({ name: 'Rear Compartment' })));
    expect(mockApi.getZones).toHaveBeenCalledTimes(2);
  });

  it('deletes a zone after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi.deleteZone.mockResolvedValue(undefined);

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: 'Delete Driver Side' }));

    await waitFor(() => expect(mockApi.deleteZone).toHaveBeenCalledWith('zone-1'));
    expect(mockApi.getZones).toHaveBeenCalledTimes(2);
  });

  it('does not delete zone when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Driver Side'));

    await user.click(screen.getByRole('button', { name: 'Delete Driver Side' }));
    expect(mockApi.deleteZone).not.toHaveBeenCalled();
  });

  // ── Equipment tab ────────────────────────────────────────────────────────────

  it('shows validation error when equipment add submitted with empty name', async () => {
    const user = userEvent.setup();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => screen.getByText('Hose Reel'));

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(mockApi.createEquipment).not.toHaveBeenCalled();
  });

  it('adds equipment and refreshes', async () => {
    const user = userEvent.setup();
    mockApi.createEquipment.mockResolvedValue({ ...mockEquipment, id: 'equip-2', name: 'Nozzle' });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => screen.getByText('Hose Reel'));

    await user.type(screen.getByLabelText('New equipment name'), 'Nozzle');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(mockApi.createEquipment).toHaveBeenCalledWith('app-1', expect.objectContaining({ name: 'Nozzle' })));
    expect(mockApi.getEquipment).toHaveBeenCalledTimes(2);
  });

  it('opens equipment inline edit and cancels', async () => {
    const user = userEvent.setup();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => screen.getByText('Hose Reel'));

    await user.click(screen.getByRole('button', { name: 'Edit Hose Reel' }));
    expect(screen.getByLabelText('Equipment name')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Equipment name')).not.toBeInTheDocument();
  });

  it('saves equipment inline edit', async () => {
    const user = userEvent.setup();
    mockApi.updateEquipment.mockResolvedValue({ ...mockEquipment, name: 'Updated Reel' });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => screen.getByText('Hose Reel'));

    await user.click(screen.getByRole('button', { name: 'Edit Hose Reel' }));
    const nameInput = screen.getByLabelText('Equipment name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Reel');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockApi.updateEquipment).toHaveBeenCalledWith('equip-1', expect.objectContaining({ name: 'Updated Reel' })));
    expect(mockApi.getEquipment).toHaveBeenCalledTimes(2);
  });

  it('retires active equipment after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi.updateEquipment.mockResolvedValue({ ...mockEquipment, active: false });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => screen.getByText('Hose Reel'));

    await user.click(screen.getByRole('button', { name: 'Retire Hose Reel' }));

    await waitFor(() => expect(mockApi.updateEquipment).toHaveBeenCalledWith('equip-1', { active: false }));
    expect(mockApi.getEquipment).toHaveBeenCalledTimes(2);
  });

  it('restores retired equipment after confirmation', async () => {
    const user = userEvent.setup();
    const retiredEquipment: ApplianceEquipment = { ...mockEquipment, active: false };
    mockApi.getEquipment.mockResolvedValue([retiredEquipment]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi.updateEquipment.mockResolvedValue({ ...retiredEquipment, active: true });

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));

    // Need to show retired to see the item
    const toggle = await screen.findByLabelText(/show retired/i);
    await user.click(toggle);

    await user.click(screen.getByRole('button', { name: 'Restore Hose Reel' }));

    await waitFor(() => expect(mockApi.updateEquipment).toHaveBeenCalledWith('equip-1', { active: true }));
  });

  it('deletes equipment after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi.deleteEquipment.mockResolvedValue(undefined);

    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => screen.getByText('Hose Reel'));

    await user.click(screen.getByRole('button', { name: 'Delete Hose Reel' }));

    await waitFor(() => expect(mockApi.deleteEquipment).toHaveBeenCalledWith('equip-1'));
    expect(mockApi.getEquipment).toHaveBeenCalledTimes(2);
  });

  it('shows error when equipment load fails', async () => {
    mockApi.getEquipment.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<ApplianceZonesModal appliance={mockAppliance} onClose={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: /equipment/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
