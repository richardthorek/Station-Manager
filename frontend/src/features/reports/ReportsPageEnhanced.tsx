/**
 * Enhanced Reports Page Component
 *
 * Interactive dashboard displaying station activity analytics with:
 * - Animated KPI cards with sparklines
 * - Interactive charts (bar, line, pie, heat map)
 * - Enhanced data tables with sorting and filtering
 * - Export functionality (PDF, Excel, PNG)
 * - Advanced date range picker
 * - Loading skeletons and error handling
 * - Responsive design for all devices
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { PageTransition } from '../../components/PageTransition';
import { KPICard } from '../../components/KPICard';
import { DataTable, type Column } from '../../components/DataTable';
import { ExportMenu } from '../../components/ExportMenu';
import { HeatMapChart } from '../../components/HeatMapChart';
import { api } from '../../services/api';
import { exportAsPDF, exportAsExcel, exportAllChartsAsPNG } from '../../utils/exportUtils.lazy';
import './ReportsPage.css';

// RFS brand colors for charts
const CHART_COLORS = {
  primary: '#e5281B',     // RFS red
  lime: '#cbdb2a',        // RFS lime
  blue: '#215e9e',        // UI blue
  green: '#008550',       // UI green
  amber: '#fbb034',       // UI amber
  darkGrey: '#4d4d4f',    // Dark grey
  lightGrey: '#bcbec0',   // Light grey
};

const ACTIVITY_COLORS: Record<string, string> = {
  training: CHART_COLORS.green,
  maintenance: CHART_COLORS.amber,
  meeting: CHART_COLORS.blue,
  other: CHART_COLORS.lightGrey,
};

type DateRange = 'last7' | 'last30' | 'last90' | 'last12months' | 'custom';

interface AttendanceSummary {
  month: string;
  count: number;
}

interface MemberParticipation {
  memberId: string;
  memberName: string;
  participationCount: number;
  lastCheckIn: string;
}

interface ActivityBreakdown {
  category: string;
  count: number;
  percentage: number;
}

interface EventStatistics {
  totalEvents: number;
  activeEvents: number;
  completedEvents: number;
  totalParticipants: number;
  averageParticipantsPerEvent: number;
  averageDuration: number;
}

interface TruckCheckCompliance {
  totalChecks: number;
  completedChecks: number;
  inProgressChecks: number;
  checksWithIssues: number;
  complianceRate: number;
  applianceStats: Array<{
    applianceId: string;
    applianceName: string;
    checkCount: number;
    lastCheckDate: string | null;
  }>;
}

export function ReportsPageEnhanced() {
  const [dateRange, setDateRange] = useState<DateRange>('last30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report data
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [previousAttendance, setPreviousAttendance] = useState<AttendanceSummary[]>([]);
  const [memberParticipation, setMemberParticipation] = useState<MemberParticipation[]>([]);
  const [activityBreakdown, setActivityBreakdown] = useState<ActivityBreakdown[]>([]);
  const [eventStatistics, setEventStatistics] = useState<EventStatistics | null>(null);
  const [previousEventStats, setPreviousEventStats] = useState<EventStatistics | null>(null);
  const [truckCheckCompliance, setTruckCheckCompliance] = useState<TruckCheckCompliance | null>(null);
  const [checkInData, setCheckInData] = useState<Array<{ checkInTime: string }>>([]);

  // Calculate current and previous date ranges
  const dateRangeInfo = useMemo(() => {
    const endDate = new Date();
    let startDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    switch (dateRange) {
      case 'last7':
        startDate = subDays(endDate, 7);
        prevStartDate = subDays(startDate, 7);
        prevEndDate = startDate;
        break;
      case 'last30':
        startDate = subDays(endDate, 30);
        prevStartDate = subDays(startDate, 30);
        prevEndDate = startDate;
        break;
      case 'last90':
        startDate = subDays(endDate, 90);
        prevStartDate = subDays(startDate, 90);
        prevEndDate = startDate;
        break;
      case 'last12months':
        startDate = subMonths(endDate, 12);
        prevStartDate = subMonths(startDate, 12);
        prevEndDate = startDate;
        break;
      case 'custom': {
        startDate = customStartDate ? new Date(customStartDate) : subDays(endDate, 30);
        const customEnd = customEndDate ? new Date(customEndDate) : endDate;
        const rangeDays = Math.round((customEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        prevStartDate = subDays(startDate, rangeDays);
        prevEndDate = startDate;
        endDate.setTime(customEnd.getTime());
        break;
      }
      default:
        startDate = subDays(endDate, 30);
        prevStartDate = subDays(startDate, 30);
        prevEndDate = startDate;
    }

    return {
      start: startDate,
      end: endDate,
      prevStart: prevStartDate,
      prevEnd: prevEndDate,
      label: `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`,
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Fetch all reports
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const startDateStr = dateRangeInfo.start.toISOString();
      const endDateStr = dateRangeInfo.end.toISOString();
      const prevStartStr = dateRangeInfo.prevStart.toISOString();
      const prevEndStr = dateRangeInfo.prevEnd.toISOString();

      // Fetch current period data
      const [
        attendanceRes,
        participationRes,
        breakdownRes,
        statisticsRes,
        complianceRes,
      ] = await Promise.all([
        api.getAttendanceSummary(startDateStr, endDateStr),
        api.getMemberParticipation(startDateStr, endDateStr, 10),
        api.getActivityBreakdown(startDateStr, endDateStr),
        api.getEventStatistics(startDateStr, endDateStr),
        api.getTruckCheckCompliance(startDateStr, endDateStr),
      ]);

      setAttendanceSummary(Array.isArray(attendanceRes.summary) ? attendanceRes.summary : []);
      setMemberParticipation(Array.isArray(participationRes.participation) ? participationRes.participation : []);
      setActivityBreakdown(Array.isArray(breakdownRes.breakdown) ? breakdownRes.breakdown : []);
      setEventStatistics(statisticsRes.statistics);
      setTruckCheckCompliance(complianceRes.compliance);

      // Fetch previous period data if comparison enabled
      if (comparePrevious) {
        const [prevAttendanceRes, prevStatisticsRes] = await Promise.all([
          api.getAttendanceSummary(prevStartStr, prevEndStr),
          api.getEventStatistics(prevStartStr, prevEndStr),
        ]);
        setPreviousAttendance(Array.isArray(prevAttendanceRes.summary) ? prevAttendanceRes.summary : []);
        setPreviousEventStats(prevStatisticsRes.statistics);
      }

      // Fetch check-in data for heat map (from API if available, or mock for now)
      // TODO: Add API endpoint for check-in timestamps
      setCheckInData([]);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRangeInfo, comparePrevious]);

  // Fetch reports on mount and when dependencies change
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Calculate KPI sparkline data
  const attendanceSparkline = useMemo(() => {
    return attendanceSummary.slice(-6).map(item => item.count);
  }, [attendanceSummary]);

  // Calculate total check-ins
  const totalCheckIns = useMemo(() => {
    return attendanceSummary.reduce((sum, item) => sum + item.count, 0);
  }, [attendanceSummary]);

  const previousTotalCheckIns = useMemo(() => {
    return previousAttendance.reduce((sum, item) => sum + item.count, 0);
  }, [previousAttendance]);

  // Prepare data for charts
  const attendanceChartData = useMemo(() => {
    return attendanceSummary.map(item => ({
      month: format(new Date(item.month), 'MMM yyyy'),
      Attendance: item.count,
    }));
  }, [attendanceSummary]);

  const activityPieData = useMemo(() => {
    return activityBreakdown.map(item => ({
      name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
      value: item.count,
    }));
  }, [activityBreakdown]);

  // Table columns for member participation
  const participationColumns: Column<MemberParticipation>[] = [
    {
      key: 'memberName',
      header: 'Member',
      sortable: true,
      filterable: true,
    },
    {
      key: 'participationCount',
      header: 'Events',
      sortable: true,
      render: (row) => <strong>{row.participationCount}</strong>,
      width: '100px',
    },
    {
      key: 'lastCheckIn',
      header: 'Last Activity',
      sortable: true,
      render: (row) => format(new Date(row.lastCheckIn), 'MMM d, yyyy'),
      width: '150px',
    },
  ];

  // Export handlers
  const handleExportPDF = async () => {
    await exportAsPDF(
      'Station Reports',
      {
        kpis: [
          { label: 'Total Check-ins', value: totalCheckIns.toString() },
          { label: 'Total Events', value: eventStatistics?.totalEvents.toString() || '0' },
          { label: 'Total Participants', value: eventStatistics?.totalParticipants.toString() || '0' },
          { label: 'Compliance Rate', value: `${truckCheckCompliance?.complianceRate || 0}%` },
        ],
        tables: [
          {
            title: 'Top Members by Participation',
            headers: ['Rank', 'Member', 'Events'],
            rows: memberParticipation.map((m, i) => [
              (i + 1).toString(),
              m.memberName,
              m.participationCount.toString(),
            ]),
          },
        ],
        charts: [
          { title: 'Monthly Attendance', elementId: 'attendance-chart' },
          { title: 'Activity Breakdown', elementId: 'activity-chart' },
        ],
      },
      {
        dateRange: dateRangeInfo.label,
        stationName: 'Station Manager',
      }
    );
  };

  const handleExportExcel = async () => {
    await exportAsExcel('Station_Reports', [
      {
        name: 'Attendance',
        data: attendanceSummary.map(item => ({
          Month: item.month,
          'Check-ins': item.count,
        })),
      },
      {
        name: 'Member Participation',
        data: memberParticipation.map((m, i) => ({
          Rank: i + 1,
          Member: m.memberName,
          Events: m.participationCount,
          'Last Check-in': format(new Date(m.lastCheckIn), 'yyyy-MM-dd'),
        })),
      },
      {
        name: 'Activity Breakdown',
        data: activityBreakdown.map(item => ({
          Category: item.category,
          Count: item.count,
          Percentage: `${item.percentage}%`,
        })),
      },
    ]);
  };

  const handleExportPNG = async () => {
    await exportAllChartsAsPNG([
      { id: 'attendance-chart', name: 'Monthly_Attendance' },
      { id: 'activity-chart', name: 'Activity_Breakdown' },
      { id: 'heat-map-chart', name: 'Check-in_Heat_Map' },
    ]);
  };

  return (
    <PageTransition variant="slideFromBottom">
      <div className="reports-page">
        <header className="reports-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Reports & Analytics</h1>
          <div className="reports-header__actions">
            <ExportMenu
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
              onExportPNG={handleExportPNG}
              disabled={loading || !!error}
            />
            <Link to="/reports/cross-station" className="cross-station-link">
              Cross-Station →
            </Link>
          </div>
        </header>

        {/* Date Range Selector */}
        <div className="date-range-selector">
          <div className="date-range-buttons">
            <button
              className={dateRange === 'last7' ? 'active' : ''}
              onClick={() => setDateRange('last7')}
            >
              Last 7 Days
            </button>
            <button
              className={dateRange === 'last30' ? 'active' : ''}
              onClick={() => setDateRange('last30')}
            >
              Last 30 Days
            </button>
            <button
              className={dateRange === 'last90' ? 'active' : ''}
              onClick={() => setDateRange('last90')}
            >
              Last 90 Days
            </button>
            <button
              className={dateRange === 'last12months' ? 'active' : ''}
              onClick={() => setDateRange('last12months')}
            >
              Last 12 Months
            </button>
            <button
              className={dateRange === 'custom' ? 'active' : ''}
              onClick={() => setDateRange('custom')}
            >
              Custom Range
            </button>
          </div>

          {dateRange === 'custom' && (
            <div className="custom-date-range">
              <div className="date-input-group">
                <label htmlFor="start-date">Start Date:</label>
                <input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="date-input-group">
                <label htmlFor="end-date">End Date:</label>
                <input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="compare-toggle">
            <label>
              <input
                type="checkbox"
                checked={comparePrevious}
                onChange={(e) => setComparePrevious(e.target.checked)}
              />
              <span>Compare with previous period</span>
            </label>
          </div>

          <div className="date-range-label">
            Showing data for: <strong>{dateRangeInfo.label}</strong>
          </div>
        </div>

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading reports...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchReports}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <main className="reports-main" id="main-content" tabIndex={-1}>
            {/* KPI Dashboard Cards */}
            <section className="kpi-dashboard">
              <h2 className="section-title">Key Metrics</h2>
              <div className="kpi-grid">
                <KPICard
                  title="Total Check-ins"
                  value={totalCheckIns}
                  previousValue={comparePrevious ? previousTotalCheckIns : undefined}
                  sparklineData={attendanceSparkline}
                  color="red"
                  icon="📊"
                />
                <KPICard
                  title="Total Events"
                  value={eventStatistics?.totalEvents || 0}
                  previousValue={comparePrevious ? previousEventStats?.totalEvents : undefined}
                  color="blue"
                  icon="📅"
                />
                <KPICard
                  title="Total Participants"
                  value={eventStatistics?.totalParticipants || 0}
                  previousValue={comparePrevious ? previousEventStats?.totalParticipants : undefined}
                  color="green"
                  icon="👥"
                />
                <KPICard
                  title="Avg Duration"
                  value={eventStatistics?.averageDuration || 0}
                  suffix=" min"
                  previousValue={comparePrevious ? previousEventStats?.averageDuration : undefined}
                  color="amber"
                  icon="⏱️"
                />
              </div>
            </section>

            {/* Monthly Attendance Chart */}
            <section className="chart-section" id="attendance-chart">
              <h2>Monthly Attendance</h2>
              <div className="chart-container">
                {attendanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={attendanceChartData}>
                      <defs>
                        <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="Attendance"
                        stroke={CHART_COLORS.primary}
                        fill="url(#colorAttendance)"
                        animationDuration={800}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="no-data">No attendance data available for this period</div>
                )}
              </div>
            </section>

            {/* Two-column layout for charts */}
            <div className="charts-row">
              {/* Activity Breakdown Pie Chart */}
              <section className="chart-section" id="activity-chart">
                <h2>Activity Breakdown</h2>
                <div className="chart-container">
                  {activityPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={activityPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          animationDuration={800}
                        >
                          {activityPieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={ACTIVITY_COLORS[entry.name.toLowerCase()] || CHART_COLORS.lightGrey}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="no-data">No activity data available for this period</div>
                  )}
                </div>
              </section>

              {/* Member Participation Table */}
              <section className="chart-section">
                <h2>Top Members (Participation)</h2>
                <div className="table-container">
                  {memberParticipation.length > 0 ? (
                    <DataTable
                      data={memberParticipation}
                      columns={participationColumns}
                      pageSize={10}
                      showSearch={true}
                    />
                  ) : (
                    <div className="no-data">No participation data available for this period</div>
                  )}
                </div>
              </section>
            </div>

            {/* Heat Map Chart */}
            {checkInData.length > 0 && (
              <section className="chart-section" id="heat-map-chart">
                <h2>Check-in Patterns (Day & Time)</h2>
                <HeatMapChart
                  data={checkInData}
                  startDate={dateRangeInfo.start}
                  endDate={dateRangeInfo.end}
                />
              </section>
            )}

            {/* Truck Check Compliance */}
            {truckCheckCompliance && (
              <section className="chart-section">
                <h2>Truck Check Compliance</h2>
                <div className="compliance-container">
                  <div className="compliance-gauge">
                    <div className="gauge-value" style={{
                      color: truckCheckCompliance.complianceRate >= 80 ? CHART_COLORS.green :
                             truckCheckCompliance.complianceRate >= 60 ? CHART_COLORS.amber :
                             CHART_COLORS.primary
                    }}>
                      {truckCheckCompliance.complianceRate}%
                    </div>
                    <div className="gauge-label">Compliance Rate</div>
                  </div>

                  <div className="compliance-stats">
                    <div className="compliance-stat">
                      <span className="stat-label">Total Checks:</span>
                      <span className="stat-value">{truckCheckCompliance.totalChecks}</span>
                    </div>
                    <div className="compliance-stat">
                      <span className="stat-label">Completed:</span>
                      <span className="stat-value">{truckCheckCompliance.completedChecks}</span>
                    </div>
                    <div className="compliance-stat">
                      <span className="stat-label">In Progress:</span>
                      <span className="stat-value">{truckCheckCompliance.inProgressChecks}</span>
                    </div>
                    <div className="compliance-stat">
                      <span className="stat-label">With Issues:</span>
                      <span className="stat-value">{truckCheckCompliance.checksWithIssues}</span>
                    </div>
                  </div>

                  {truckCheckCompliance.applianceStats.length > 0 && (
                    <div className="appliance-stats">
                      <h3>Checks by Appliance</h3>
                      <table className="appliance-table">
                        <thead>
                          <tr>
                            <th>Appliance</th>
                            <th>Checks</th>
                            <th>Last Check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {truckCheckCompliance.applianceStats.map(appliance => (
                            <tr key={appliance.applianceId}>
                              <td>{appliance.applianceName}</td>
                              <td>{appliance.checkCount}</td>
                              <td>
                                {appliance.lastCheckDate
                                  ? format(new Date(appliance.lastCheckDate), 'MMM d, yyyy')
                                  : 'Never'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}
          </main>
        )}
      </div>
    </PageTransition>
  );
}
