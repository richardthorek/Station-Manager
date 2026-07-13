import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FacilitySearch } from './FacilitySearch';
import type { FacilitySearchResult } from '../services/api';

const lookupFacilities = vi.fn();

vi.mock('../services/api', () => ({
  api: { lookupFacilities: (...args: unknown[]) => lookupFacilities(...args) },
}));

const RESULTS: FacilitySearchResult[] = [
  {
    facilityKey: 'rural-fire:101',
    objectid: '101',
    serviceType: 'rural-fire',
    name: 'Bungendore Rural Fire Brigade',
    suburb: 'Bungendore',
    state: 'NSW',
    postcode: '2621',
    latitude: -35.2,
    longitude: 149.4,
    operationalStatus: 'Operational',
    claimed: false,
  },
  {
    facilityKey: 'ses:201',
    objectid: '201',
    serviceType: 'ses',
    name: 'Bungendore SES Unit',
    suburb: 'Bungendore',
    state: 'NSW',
    postcode: '2621',
    latitude: -35.2,
    longitude: 149.4,
    operationalStatus: 'Operational',
    claimed: true,
  },
];

describe('FacilitySearch', () => {
  beforeEach(() => {
    lookupFacilities.mockReset();
    lookupFacilities.mockResolvedValue({ results: RESULTS, count: RESULTS.length });
  });

  it('searches and shows results with a claimed badge', async () => {
    const onSelect = vi.fn();
    render(<FacilitySearch onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText(/search for your unit/i), { target: { value: 'bungendore' } });

    await waitFor(() => expect(lookupFacilities).toHaveBeenCalled(), { timeout: 1000 });
    expect(await screen.findByText('Bungendore Rural Fire Brigade')).toBeInTheDocument();
    expect(screen.getByText('Bungendore SES Unit')).toBeInTheDocument();
    expect(screen.getByText(/already claimed/i)).toBeInTheDocument();
  });

  it('selecting an unclaimed result calls onSelect', async () => {
    const onSelect = vi.fn();
    render(<FacilitySearch onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText(/search for your unit/i), { target: { value: 'bungendore' } });
    const result = await screen.findByText('Bungendore Rural Fire Brigade');
    fireEvent.click(result.closest('button')!);

    expect(onSelect).toHaveBeenCalledWith(
      { facilityKey: 'rural-fire:101' },
      expect.stringContaining('Bungendore Rural Fire Brigade'),
    );
  });

  it('does not allow selecting a claimed result', async () => {
    const onSelect = vi.fn();
    render(<FacilitySearch onSelect={onSelect} />);

    fireEvent.change(screen.getByLabelText(/search for your unit/i), { target: { value: 'bungendore' } });
    const claimedResult = await screen.findByText('Bungendore SES Unit');
    const button = claimedResult.closest('button')!;
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('filters by service type', async () => {
    const onSelect = vi.fn();
    render(<FacilitySearch onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'SES' }));
    fireEvent.change(screen.getByLabelText(/search for your unit/i), { target: { value: 'bungendore' } });

    await waitFor(() =>
      expect(lookupFacilities).toHaveBeenCalledWith(expect.objectContaining({ serviceType: 'ses' })),
    );
  });

  it('custom entry: nudges toward a known facility while typing', async () => {
    const onSelect = vi.fn();
    render(<FacilitySearch onSelect={onSelect} />);

    fireEvent.click(screen.getByText(/my unit isn't listed/i));
    fireEvent.change(screen.getByLabelText(/unit \/ brigade name/i), { target: { value: 'bungendore' } });

    expect(await screen.findByText(/did you mean/i)).toBeInTheDocument();
    const suggestion = screen.getByText('Bungendore Rural Fire Brigade');
    fireEvent.click(suggestion.closest('button')!);

    expect(onSelect).toHaveBeenCalledWith(
      { facilityKey: 'rural-fire:101' },
      expect.stringContaining('Bungendore Rural Fire Brigade'),
    );
  });

  it('custom entry: submits a fully custom facility with no known match', async () => {
    lookupFacilities.mockResolvedValue({ results: [], count: 0 });
    const onSelect = vi.fn();
    render(<FacilitySearch onSelect={onSelect} />);

    fireEvent.click(screen.getByText(/my unit isn't listed/i));
    fireEvent.change(screen.getByLabelText(/unit \/ brigade name/i), { target: { value: 'My Unlisted Unit' } });
    fireEvent.change(screen.getByLabelText(/service type/i), { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText(/state \(optional\)/i), { target: { value: 'NSW' } });

    await waitFor(() => expect(lookupFacilities).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /use this unit/i }));

    expect(onSelect).toHaveBeenCalledWith(
      { custom: { name: 'My Unlisted Unit', serviceType: 'other', state: 'NSW' } },
      'My Unlisted Unit',
    );
  });
});
