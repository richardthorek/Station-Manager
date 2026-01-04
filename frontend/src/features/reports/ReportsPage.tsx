/**
 * Reports Page Component
 * 
 * Interactive dashboard displaying station activity analytics and statistics.
 * 
 * Features:
 * - Monthly attendance chart (bar chart)
 * - Member participation leaderboard (top 10)
 * - Activity breakdown (pie chart)
 * - Event statistics cards
 * - Truck check compliance gauge
 * - Date range selector (Last 30 days, Last 90 days, Last 12 months, Custom)
 * - Loading states and error handling
 * - Responsive design for mobile, tablet, and desktop
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { api } from '../../services/api';
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

type DateRange = 'last30' | 'last90' | 'last12months' | 'custom';

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

export function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('last30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report data
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [memberParticipation, setMemberParticipation] = useState<MemberParticipation[]>([]);
  const [activityBreakdown, setActivityBreakdown] = useState<ActivityBreakdown[]>([]);
  const [eventStatistics, setEventStatistics] = useState<EventStatistics | null>(null);
  const [truckCheckCompliance, setTruckCheckCompliance] = useState<TruckCheckCompliance | null>(null);

  // Calculate date range
  const getDateRange = (): { startDate: Date; endDate: Date } => {
    const endDate = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'last30':
        startDate = subDays(endDate, 30);
        break;
      case 'last90':
        startDate = subDays(endDate, 90);
        break;
      case 'last12months':
        startDate = subMonths(endDate, 12);
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : subDays(endDate, 30);
        if (customEndDate) {
          return { startDate, endDate: new Date(customEndDate) };
        }
        return { startDate, endDate };
      default:
        startDate = subDays(endDate, 30);
    }

    return { startDate, endDate };
  };

  // Fetch all reports
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Fetch all reports in parallel
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

      setAttendanceSummary(attendanceRes.summary);
      setMemberParticipation(participationRes.participation);
      setActivityBreakdown(breakdownRes.breakdown);
      setEventStatistics(statisticsRes.statistics);
      setTruckCheckCompliance(complianceRes.compliance);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch reports on mount and when date range changes
  useEffect(() => {
    fetchReports();
  }, [dateRange, customStartDate, customEndDate]);

  // Format month for display
  const formatMonth = (monthStr: string): string => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, 'MMM yyyy');
    } catch {
      return monthStr;
    }
  };

  // Prepare data for charts
  const attendanceChartData = attendanceSummary.map(item => ({
    month: formatMonth(item.month),
    Attendance: item.count,
  }));

  const activityPieData = activityBreakdown.map(item => ({
    name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
    value: item.count,
  }));

  return (
    <div className="reports-page">
      <header className="reports-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Reports & Analytics</h1>
      </header>

      {/* Date Range Selector */}
      <div className="date-range-selector">
        <div className="date-range-buttons">
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
        <main className="reports-main">
          {/* Event Statistics Cards */}
          {eventStatistics && (
            <section className="statistics-cards">
              <h2>Event Statistics</h2>
              <div className="stat-cards-grid">
                <div className="stat-card">
                  <div className="stat-value">{eventStatistics.totalEvents}</div>
                  <div className="stat-label">Total Events</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{eventStatistics.completedEvents}</div>
                  <div className="stat-label">Completed Events</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{eventStatistics.totalParticipants}</div>
                  <div className="stat-label">Total Participants</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{eventStatistics.averageParticipantsPerEvent.toFixed(1)}</div>
                  <div className="stat-label">Avg Participants/Event</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{eventStatistics.averageDuration}</div>
                  <div className="stat-label">Avg Duration (min)</div>
                </div>
              </div>
            </section>
          )}

          {/* Monthly Attendance Chart */}
          <section className="chart-section">
            <h2>Monthly Attendance</h2>
            <div className="chart-container">
              {attendanceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Attendance" fill={CHART_COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No attendance data available for this period</div>
              )}
            </div>
          </section>

          {/* Two-column layout for charts */}
          <div className="charts-row">
            {/* Activity Breakdown Pie Chart */}
            <section className="chart-section">
              <h2>Activity Breakdown</h2>
              <div className="chart-container">
                {activityPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={activityPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
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

            {/* Member Participation Leaderboard */}
            <section className="chart-section">
              <h2>Top Members (Participation)</h2>
              <div className="leaderboard">
                {memberParticipation.length > 0 ? (
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Member</th>
                        <th>Events</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberParticipation.map((member, index) => (
                        <tr key={member.memberId}>
                          <td className="rank">{index + 1}</td>
                          <td className="member-name">{member.memberName}</td>
                          <td className="count">{member.participationCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No participation data available for this period</div>
                )}
              </div>
            </section>
          </div>

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
  );
}
