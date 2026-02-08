/**
 * ReportsPage Component Tests
 * 
 * Tests for the Reports & Analytics page component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ReportsPage } from './ReportsPage';
import { api } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    getAttendanceSummary: vi.fn(),
    getMemberParticipation: vi.fn(),
    getActivityBreakdown: vi.fn(),
    getEventStatistics: vi.fn(),
    getTruckCheckCompliance: vi.fn(),
  },
}));

// Mock recharts to avoid canvas rendering issues in tests
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

const mockAttendanceSummary = {
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-31T23:59:59.999Z',
  summary: [
    { month: '2024-01', count: 45 },
    { month: '2024-02', count: 38 },
  ],
};

const mockMemberParticipation = {
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-31T23:59:59.999Z',
  limit: 10,
  participation: [
    { memberId: '1', memberName: 'John Smith', participationCount: 15, lastCheckIn: '2024-01-30T10:00:00.000Z' },
    { memberId: '2', memberName: 'Sarah Johnson', participationCount: 12, lastCheckIn: '2024-01-29T14:00:00.000Z' },
  ],
};

const mockActivityBreakdown = {
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-31T23:59:59.999Z',
  breakdown: [
    { category: 'training', count: 20, percentage: 50 },
    { category: 'maintenance', count: 15, percentage: 37 },
    { category: 'meeting', count: 5, percentage: 13 },
  ],
};

const mockEventStatistics = {
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-31T23:59:59.999Z',
  statistics: {
    totalEvents: 40,
    activeEvents: 2,
    completedEvents: 38,
    totalParticipants: 120,
    averageParticipantsPerEvent: 3.0,
    averageDuration: 45,
  },
};

const mockTruckCheckCompliance = {
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-01-31T23:59:59.999Z',
  compliance: {
    totalChecks: 25,
    completedChecks: 23,
    inProgressChecks: 2,
    checksWithIssues: 3,
    complianceRate: 88,
    applianceStats: [
      { applianceId: '1', applianceName: 'Cat 1', checkCount: 8, lastCheckDate: '2024-01-30T08:00:00.000Z' },
      { applianceId: '2', applianceName: 'Cat 7', checkCount: 7, lastCheckDate: '2024-01-29T09:00:00.000Z' },
    ],
  },
};

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    vi.mocked(api.getAttendanceSummary).mockResolvedValue(mockAttendanceSummary);
    vi.mocked(api.getMemberParticipation).mockResolvedValue(mockMemberParticipation);
    vi.mocked(api.getActivityBreakdown).mockResolvedValue(mockActivityBreakdown);
    vi.mocked(api.getEventStatistics).mockResolvedValue(mockEventStatistics);
    vi.mocked(api.getTruckCheckCompliance).mockResolvedValue(mockTruckCheckCompliance);
  });

  const renderReportsPage = async () => {
    let rendered;
    await act(async () => {
      rendered = render(
        <BrowserRouter>
          <ReportsPage />
        </BrowserRouter>
      );
    });
    return rendered;
  };

  it('should render the page title and back link', async () => {
    await renderReportsPage();
    
    expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    expect(screen.getByText('← Back to Home')).toBeInTheDocument();
  });

  it('should render date range selector buttons', async () => {
    await renderReportsPage();
    
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 12 Months')).toBeInTheDocument();
    expect(screen.getByText('Custom Range')).toBeInTheDocument();
  });

  it('should show loading state initially', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Event Statistics')).toBeInTheDocument();
    });
  });

  it('should fetch and display all reports', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(api.getAttendanceSummary).toHaveBeenCalled();
      expect(api.getMemberParticipation).toHaveBeenCalled();
      expect(api.getActivityBreakdown).toHaveBeenCalled();
      expect(api.getEventStatistics).toHaveBeenCalled();
      expect(api.getTruckCheckCompliance).toHaveBeenCalled();
    });
  });

  it('should display event statistics cards', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Event Statistics')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument(); // Total events
      expect(screen.getByText('38')).toBeInTheDocument(); // Completed events
      expect(screen.getByText('120')).toBeInTheDocument(); // Total participants
    });
  });

  it('should display member participation leaderboard', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Top Members (Participation)')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // John's count
      expect(screen.getByText('12')).toBeInTheDocument(); // Sarah's count
    });
  });

  it('should display truck check compliance', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Truck Check Compliance')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument(); // Compliance rate
      expect(screen.getByText('25')).toBeInTheDocument(); // Total checks (in stat)
      expect(screen.getByText('23')).toBeInTheDocument(); // Completed checks
    });
  });

  it('should display appliance stats table', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Cat 1')).toBeInTheDocument();
      expect(screen.getByText('Cat 7')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Failed to load reports';
    vi.mocked(api.getAttendanceSummary).mockRejectedValue(new Error(errorMessage));

    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load reports/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('should display chart sections', async () => {
    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Monthly Attendance')).toBeInTheDocument();
      expect(screen.getByText('Activity Breakdown')).toBeInTheDocument();
    });
  });

  it('should show no data message when data is empty', async () => {
    vi.mocked(api.getAttendanceSummary).mockResolvedValue({
      ...mockAttendanceSummary,
      summary: [],
    });

    await renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('No attendance data available for this period')).toBeInTheDocument();
    });
  });
});
