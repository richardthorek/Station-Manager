/**
 * MultiStationSelector Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiStationSelector } from './MultiStationSelector';
import type { Station } from '../types';

const mockStations: Station[] = [
  {
    id: 'station-1',
    name: 'Blacktown Fire Station',
    brigadeId: 'brigade-1',
    brigadeName: 'Blacktown Brigade',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Greater Sydney',
      district: 'Western Sydney',
      brigade: 'Blacktown Brigade',
      station: 'Blacktown Fire Station',
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
      jurisdiction: 'NSW',
      area: 'Greater Sydney',
      district: 'Western Sydney',
      brigade: 'Blacktown Brigade',
      station: 'Penrith Fire Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'station-3',
    name: 'Richmond Fire Station',
    brigadeId: 'brigade-2',
    brigadeName: 'Richmond Brigade',
    hierarchy: {
      jurisdiction: 'NSW',
      area: 'Greater Sydney',
      district: 'Hawkesbury',
      brigade: 'Richmond Brigade',
      station: 'Richmond Fire Station',
    },
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

describe('MultiStationSelector', () => {
  it('renders with placeholder text', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
        placeholder="Select stations..."
      />
    );

    expect(screen.getByText('Select stations...')).toBeInTheDocument();
  });

  it('opens dropdown when button is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByPlaceholderText('Search stations...')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('displays all stations grouped by brigade', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Blacktown Brigade')).toBeInTheDocument();
    expect(screen.getByText('Richmond Brigade')).toBeInTheDocument();
    expect(screen.getByText('Blacktown Fire Station')).toBeInTheDocument();
    expect(screen.getByText('Penrith Fire Station')).toBeInTheDocument();
    expect(screen.getByText('Richmond Fire Station')).toBeInTheDocument();
  });

  it('selects a station when checkbox is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onSelectionChange).toHaveBeenCalledWith(['station-1']);
  });

  it('deselects a station when checkbox is clicked again', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={['station-1']}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('displays selected count in button text', () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={['station-1']}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByText('Blacktown Fire Station')).toBeInTheDocument();

    rerender(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={['station-1', 'station-2']}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByText('2 stations selected')).toBeInTheDocument();
  });

  it('filters stations based on search query', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const searchInput = screen.getByPlaceholderText('Search stations...');
    fireEvent.change(searchInput, { target: { value: 'Richmond' } });

    expect(screen.getByText('Richmond Fire Station')).toBeInTheDocument();
    expect(screen.queryByText('Blacktown Fire Station')).not.toBeInTheDocument();
  });

  it('selects all filtered stations when Select All is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const selectAllButton = screen.getByText('Select All');
    fireEvent.click(selectAllButton);

    expect(onSelectionChange).toHaveBeenCalledWith(['station-1', 'station-2', 'station-3']);
  });

  it('clears all selections when Clear All is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={['station-1', 'station-2']}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const clearAllButton = screen.getByText('Clear All');
    fireEvent.click(clearAllButton);

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('selects all stations in a brigade when Select Brigade is clicked', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const selectBrigadeButtons = screen.getAllByText('Select Brigade');
    fireEvent.click(selectBrigadeButtons[0]); // Select Blacktown Brigade

    expect(onSelectionChange).toHaveBeenCalledWith(['station-1', 'station-2']);
  });

  it('shows station count per brigade', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('(2)')).toBeInTheDocument(); // Blacktown Brigade has 2 stations
    expect(screen.getByText('(1)')).toBeInTheDocument(); // Richmond Brigade has 1 station
  });

  it('displays "No stations found" when search returns no results', () => {
    const onSelectionChange = vi.fn();
    render(
      <MultiStationSelector
        stations={mockStations}
        selectedStationIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const searchInput = screen.getByPlaceholderText('Search stations...');
    fireEvent.change(searchInput, { target: { value: 'NonexistentStation' } });

    expect(screen.getByText('No stations found')).toBeInTheDocument();
  });
});
