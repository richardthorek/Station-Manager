/**
 * KPICard Component Tests
 *
 * Tests for the KPI card component with:
 * - Count-up animation
 * - Sparkline charts
 * - Trend indicators
 * - Gradient backgrounds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KPICard } from './KPICard';

describe('KPICard', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  it('renders with basic props', async () => {
    render(
      <KPICard
        title="Total Check-ins"
        value={150}
      />
    );

    expect(screen.getByText('Total Check-ins')).toBeInTheDocument();

    // Wait for count-up animation to complete
    await waitFor(() => {
      expect(screen.getByText(/150/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders with suffix', async () => {
    render(
      <KPICard
        title="Completion Rate"
        value={85}
        suffix="%"
      />
    );

    expect(screen.getByText('Completion Rate')).toBeInTheDocument();

    // Wait for count-up animation to complete
    await waitFor(() => {
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('displays trend indicator when previousValue provided', () => {
    render(
      <KPICard
        title="Total Check-ins"
        value={150}
        previousValue={100}
      />
    );

    // Should show positive trend (50% increase)
    expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/vs previous period/)).toBeInTheDocument();
  });

  it('shows up arrow for positive trend', () => {
    const { container } = render(
      <KPICard
        title="Total Check-ins"
        value={150}
        previousValue={100}
      />
    );

    expect(container.querySelector('.kpi-card__trend--up')).toBeInTheDocument();
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('shows down arrow for negative trend', () => {
    const { container } = render(
      <KPICard
        title="Total Check-ins"
        value={80}
        previousValue={100}
      />
    );

    expect(container.querySelector('.kpi-card__trend--down')).toBeInTheDocument();
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('renders sparkline when data provided', () => {
    const sparklineData = [10, 20, 15, 25, 30, 28];
    const { container } = render(
      <KPICard
        title="Total Check-ins"
        value={150}
        sparklineData={sparklineData}
      />
    );

    expect(container.querySelector('.kpi-card__sparkline')).toBeInTheDocument();
  });

  it('does not render sparkline when no data', () => {
    const { container } = render(
      <KPICard
        title="Total Check-ins"
        value={150}
      />
    );

    expect(container.querySelector('.kpi-card__sparkline')).not.toBeInTheDocument();
  });

  it('applies color theme class', () => {
    const { container } = render(
      <KPICard
        title="Total Check-ins"
        value={150}
        color="green"
      />
    );

    expect(container.querySelector('.kpi-card--green')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <KPICard
        title="Total Check-ins"
        value={150}
        icon={<span data-testid="test-icon">📊</span>}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('formats decimal values correctly', async () => {
    render(
      <KPICard
        title="Average Duration"
        value={45.678}
        decimals={1}
        suffix=" min"
      />
    );

    // Wait for count-up animation to complete
    // Should round to 1 decimal place
    await waitFor(() => {
      expect(screen.getByText(/45\.7 min/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('handles zero previous value gracefully', () => {
    render(
      <KPICard
        title="Total Check-ins"
        value={150}
        previousValue={0}
      />
    );

    // Should not crash, and not show invalid percentage
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
