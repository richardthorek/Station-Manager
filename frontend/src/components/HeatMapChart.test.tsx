/**
 * HeatMapChart Component Tests
 *
 * Tests for the heat map visualization:
 * - Day/hour grid rendering
 * - Color intensity based on value
 * - Legend display
 * - Tooltips and accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeatMapChart } from './HeatMapChart';

const mockData = [
  { checkInTime: '2024-01-01T09:00:00Z' }, // Monday 9am
  { checkInTime: '2024-01-01T09:30:00Z' }, // Monday 9am
  { checkInTime: '2024-01-01T14:00:00Z' }, // Monday 2pm
  { checkInTime: '2024-01-02T10:00:00Z' }, // Tuesday 10am
  { checkInTime: '2024-01-03T09:00:00Z' }, // Wednesday 9am
  { checkInTime: '2024-01-03T09:15:00Z' }, // Wednesday 9am
  { checkInTime: '2024-01-03T09:45:00Z' }, // Wednesday 9am
];

describe('HeatMapChart', () => {
  it('renders day labels', () => {
    render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(screen.getByText('Thursday')).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
  });

  it('renders hour labels', () => {
    render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    expect(screen.getByText('12am')).toBeInTheDocument();
    expect(screen.getByText('12pm')).toBeInTheDocument();
  });

  it('renders grid cells for all days and hours', () => {
    const { container } = render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    // 7 days * 24 hours = 168 cells
    const cells = container.querySelectorAll('.heat-map__cell');
    expect(cells).toHaveLength(168);
  });

  it('displays count in cells with check-ins', () => {
    const { container } = render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    // Monday 9am should have 2 check-ins
    const cells = container.querySelectorAll('.heat-map__cell');
    const cellsWithCount = Array.from(cells).filter(cell => cell.textContent === '2');
    expect(cellsWithCount.length).toBeGreaterThan(0);
  });

  it('renders legend', () => {
    render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('displays peak activity info when data present', () => {
    render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    expect(screen.getByText(/Peak activity:/)).toBeInTheDocument();
  });

  it('renders cells with accessibility labels', () => {
    const { container } = render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    const cells = container.querySelectorAll('.heat-map__cell[role="gridcell"]');
    expect(cells.length).toBe(168);

    // Check that cells have aria-label
    const firstCell = cells[0];
    expect(firstCell).toHaveAttribute('aria-label');
  });

  it('applies different colors based on intensity', () => {
    const { container } = render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    const cells = container.querySelectorAll('.heat-map__cell');
    const backgroundColors = Array.from(cells).map(
      cell => window.getComputedStyle(cell).backgroundColor
    );

    // Should have multiple different colors (not all the same)
    const uniqueColors = new Set(backgroundColors);
    expect(uniqueColors.size).toBeGreaterThan(1);
  });

  it('handles empty data gracefully', () => {
    const { container } = render(
      <HeatMapChart
        data={[]}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    // Should still render grid
    const cells = container.querySelectorAll('.heat-map__cell');
    expect(cells).toHaveLength(168);

    // Cells should be empty (no counts)
    const cellsWithNumbers = Array.from(cells).filter(cell => /\d/.test(cell.textContent || ''));
    expect(cellsWithNumbers).toHaveLength(0);
  });

  it('renders legend scale boxes', () => {
    const { container } = render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    const legendBoxes = container.querySelectorAll('.heat-map__legend-box');
    expect(legendBoxes).toHaveLength(5); // 5 intensity levels
  });

  it('shows tooltip title on hover', () => {
    const { container } = render(
      <HeatMapChart
        data={mockData}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-07')}
      />
    );

    const cells = container.querySelectorAll('.heat-map__cell');
    const firstCell = cells[0];

    // Should have title attribute for tooltip
    expect(firstCell).toHaveAttribute('title');
  });
});
