import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleFormModal } from './VehicleFormModal';
import type { Appliance } from '../../types';

// Mirrors the real ApiLimitError shape (services/api.ts) without importActual —
// importActual would load and execute the entire (large, otherwise-untouched)
// api.ts module for real, which blew up global coverage denominators for a
// file no other test exercises. Defined inline (not hoisted above vi.mock) so
// Vitest's mock-factory hoisting doesn't hit a temporal-dead-zone reference;
// VehicleFormModal.tsx's `instanceof` check only needs the same class
// identity as this mocked module, satisfied by importing it back below.
vi.mock('../../services/api', () => ({
  ApiLimitError: class ApiLimitError extends Error {
    readonly upgradeRequired = true;
    constructor(message: string) {
      super(message);
      this.name = 'ApiLimitError';
    }
  },
  api: {
    getVehicleTypes: vi.fn(),
    createAppliance: vi.fn(),
    updateAppliance: vi.fn(),
    uploadAppliancePhoto: vi.fn(),
  },
}));

import { api, ApiLimitError } from '../../services/api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const mockVehicle: Appliance = {
  id: 'app-1',
  name: 'Tanker 1',
  registration: 'ABC-123',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getVehicleTypes.mockResolvedValue([]);
});

describe('VehicleFormModal', () => {
  it('renders "Add New Vehicle" and creates a vehicle on save', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    mockApi.createAppliance.mockResolvedValue({ ...mockVehicle, id: 'new-id', name: 'Pumper 2' });

    render(<VehicleFormModal vehicle={null} onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByText('Add New Vehicle')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Name/), 'Pumper 2');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mockApi.createAppliance).toHaveBeenCalledWith(
      'Pumper 2', undefined, undefined, undefined,
      expect.objectContaining({ vehicleTypeId: undefined }),
    ));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('prefills fields and updates a vehicle in edit mode', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockApi.updateAppliance.mockResolvedValue(mockVehicle);

    render(<VehicleFormModal vehicle={mockVehicle} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByText('Edit Vehicle')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tanker 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ABC-123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(mockApi.updateAppliance).toHaveBeenCalledWith(
      'app-1', 'Tanker 1', undefined, undefined, undefined,
      expect.objectContaining({ registration: 'ABC-123' }),
    ));
    expect(onSaved).toHaveBeenCalled();
  });

  it('rejects an empty name without calling the API', async () => {
    const user = userEvent.setup();
    render(<VehicleFormModal vehicle={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Vehicle name is required')).toBeInTheDocument();
    expect(mockApi.createAppliance).not.toHaveBeenCalled();
  });

  it('shows an upgrade link when the plan vehicle limit is hit', async () => {
    const user = userEvent.setup();
    mockApi.createAppliance.mockRejectedValue(new ApiLimitError('Vehicle limit reached'));

    render(<VehicleFormModal vehicle={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/Name/), 'Pumper 3');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Vehicle limit reached')).toBeInTheDocument();
    expect(screen.getByText('Upgrade plan →')).toBeInTheDocument();
  });

  it('closes on Cancel without saving', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<VehicleFormModal vehicle={null} onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(mockApi.createAppliance).not.toHaveBeenCalled();
  });
});
