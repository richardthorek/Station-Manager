/**
 * Cross-Station Reports Page Component
 * 
 * Interactive dashboard for viewing aggregated reports across multiple stations.
 * 
 * Features:
 * - Multi-station selector
 * - Attendance comparison chart (side-by-side bars)
 * - Member participation comparison (top performers per station)
 * - Activity breakdown comparison (pie charts per station)
 * - Event statistics comparison
 * - Brigade-level summary
 * - CSV export functionality
 * - Date range selector
 * - Loading states and error handling
 * - Responsive design
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { useStation } from '../../contexts/StationContext';
import { MultiStationSelector } from '../../components/MultiStationSelector';
import { api } from '../../services/api';
import './CrossStationReportsPage.css';

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

const STATION_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.lime,
  CHART_COLORS.darkGrey,
  '#9c27b0', // Purple
  '#ff9800', // Orange
  '#00bcd4', // Cyan
  '#4caf50', // Light green
];

const ACTIVITY_COLORS: Record<string, string> = {
  training: CHART_COLORS.green,
  maintenance: CHART_COLORS.amber,
  meeting: CHART_COLORS.blue,
  other: CHART_COLORS.lightGrey,
};

type DateRange = 'last30' | 'last90' | 'last12months' | 'custom';
type ViewMode = 'stations' | 'brigade';

export function CrossStationReportsPage() {
  const { stations } = useStation();
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('last30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('stations');
  const [selectedBrigadeId, setSelectedBrigadeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Report data
  const [attendanceSummaries, setAttendanceSummaries] = useState<Record<string, Array<{ month: string; count: number }>>>({});
  const [memberParticipation, setMemberParticipation] = useState<Record<string, Array<{
    memberId: string;
    memberName: string;
    participationCount: number;
    lastCheckIn: string;
  }>>>({});
  const [activityBreakdowns, setActivityBreakdowns] = useState<Record<string, Array<{
    category: string;
    count: number;
    percentage: number;
  }>>>({});
  const [eventStatistics, setEventStatistics] = useState<Record<string, {
    totalEvents: number;
    activeEvents: number;
    completedEvents: number;
    totalParticipants: number;
    averageParticipantsPerEvent: number;
    averageDuration: number;
  }>>({});
  const [brigadeSummary, setBrigadeSummary] = useState<{
    stations: Array<{ id: string; name: string }>;
    summary: {
      totalEvents: number;
      totalParticipants: number;
      totalCompletedEvents: number;
      totalStations: number;
      averageEventsPerStation: number;
      averageParticipantsPerStation: number;
    };
  } | null>(null);

  /**
   * Get list of unique brigades
   */
  const brigades = Array.from(new Set(stations.map(s => s.brigadeId)))
    .map(brigadeId => {
      const station = stations.find(s => s.brigadeId === brigadeId);
      return {
        id: brigadeId,
        name: station?.brigadeName || brigadeId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  /**
   * Fetch cross-station reports
   */
  const fetchReports = useCallback(async () => {
    if (selectedStationIds.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Calculate date range
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
            endDate.setTime(new Date(customEndDate).getTime());
          }
          break;
        default:
          startDate = subDays(endDate, 30);
      }

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Fetch all reports in parallel
      const [
        attendanceRes,
        participationRes,
        breakdownRes,
        statisticsRes,
      ] = await Promise.all([
        api.getCrossStationAttendanceSummary(selectedStationIds, startDateStr, endDateStr),
        api.getCrossStationMemberParticipation(selectedStationIds, startDateStr, endDateStr, 10),
        api.getCrossStationActivityBreakdown(selectedStationIds, startDateStr, endDateStr),
        api.getCrossStationEventStatistics(selectedStationIds, startDateStr, endDateStr),
      ]);

      setAttendanceSummaries(attendanceRes.summaries);
      setMemberParticipation(participationRes.participation);
      setActivityBreakdowns(breakdownRes.breakdowns);
      setEventStatistics(statisticsRes.statistics);
    } catch (err) {
      console.error('Error fetching cross-station reports:', err);
      setError('Failed to load cross-station reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedStationIds, dateRange, customStartDate, customEndDate]);

  /**
   * Fetch brigade summary
   */
  const fetchBrigadeSummary = useCallback(async () => {
    if (!selectedBrigadeId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

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
            endDate.setTime(new Date(customEndDate).getTime());
          }
          break;
        default:
          startDate = subDays(endDate, 30);
      }

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      const summaryRes = await api.getBrigadeSummary(selectedBrigadeId, startDateStr, endDateStr);
      setBrigadeSummary(summaryRes);
    } catch (err) {
      console.error('Error fetching brigade summary:', err);
      setError('Failed to load brigade summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedBrigadeId, dateRange, customStartDate, customEndDate]);

  /**
   * Fetch reports when dependencies change
   */
  useEffect(() => {
    if (viewMode === 'stations') {
      fetchReports();
    } else {
      fetchBrigadeSummary();
    }
  }, [viewMode, fetchReports, fetchBrigadeSummary]);

  /**
   * Export to CSV
   */
  const exportToCSV = () => {
    if (selectedStationIds.length === 0) {
      return;
    }

    const csvRows: string[] = [];
    csvRows.push('Cross-Station Report');
    csvRows.push(`Generated: ${new Date().toLocaleString()}`);
    csvRows.push('');

    // Event Statistics
    csvRows.push('Event Statistics by Station');
    csvRows.push('Station,Total Events,Completed Events,Total Participants,Avg Participants/Event,Avg Duration (min)');
    
    selectedStationIds.forEach(stationId => {
      const station = stations.find(s => s.id === stationId);
      const stats = eventStatistics[stationId];
      if (station && stats) {
        csvRows.push(
          `"${station.name}",${stats.totalEvents},${stats.completedEvents},${stats.totalParticipants},${stats.averageParticipantsPerEvent},${stats.averageDuration}`
        );
      }
    });

    csvRows.push('');
    csvRows.push('Top Members by Station');
    
    selectedStationIds.forEach(stationId => {
      const station = stations.find(s => s.id === stationId);
      const participation = memberParticipation[stationId] || [];
      
      if (station && participation.length > 0) {
        csvRows.push('');
        csvRows.push(`Station: ${station.name}`);
        csvRows.push('Member,Participation Count');
        participation.forEach(member => {
          csvRows.push(`"${member.memberName}",${member.participationCount}`);
        });
      }
    });

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross-station-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  /**
   * Format month for display
   */
  const formatMonth = (monthStr: string): string => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, 'MMM yyyy');
    } catch {
      return monthStr;
    }
  };

  /**
   * Prepare attendance comparison data
   */
  const attendanceComparisonData = () => {
    const allMonths = new Set<string>();
    Object.values(attendanceSummaries).forEach(summary => {
      summary.forEach(item => allMonths.add(item.month));
    });

    const months = Array.from(allMonths).sort();
    
    return months.map(month => {
      const dataPoint: Record<string, string | number> = {
        month: formatMonth(month),
      };

      selectedStationIds.forEach(stationId => {
        const station = stations.find(s => s.id === stationId);
        const summary = attendanceSummaries[stationId] || [];
        const monthData = summary.find(s => s.month === month);
        
        if (station) {
          dataPoint[station.name] = monthData?.count || 0;
        }
      });

      return dataPoint;
    });
  };

  return (
    <div className="cross-station-reports-page">
      <header className="reports-header">
        <Link to="/reports" className="back-link">← Back to Reports</Link>
        <h1>Cross-Station Reports</h1>
        <p className="subtitle">Compare performance and activity across multiple stations</p>
      </header>

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button
          className={viewMode === 'stations' ? 'active' : ''}
          onClick={() => setViewMode('stations')}
        >
          Station View
        </button>
        <button
          className={viewMode === 'brigade' ? 'active' : ''}
          onClick={() => setViewMode('brigade')}
        >
          Brigade View
        </button>
      </div>

      {/* Station Selection or Brigade Selection */}
      {viewMode === 'stations' ? (
        <div className="station-selection">
          <label htmlFor="multi-station-selector">
            <strong>Select Stations to Compare:</strong>
          </label>
          <MultiStationSelector
            stations={stations}
            selectedStationIds={selectedStationIds}
            onSelectionChange={setSelectedStationIds}
          />
        </div>
      ) : (
        <div className="brigade-selection">
          <label htmlFor="brigade-selector">
            <strong>Select Brigade:</strong>
          </label>
          <select
            id="brigade-selector"
            className="brigade-selector"
            value={selectedBrigadeId || ''}
            onChange={(e) => setSelectedBrigadeId(e.target.value || null)}
          >
            <option value="">Choose a brigade...</option>
            {brigades.map(brigade => (
              <option key={brigade.id} value={brigade.id}>
                {brigade.name}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Export Button */}
      {viewMode === 'stations' && selectedStationIds.length > 0 && (
        <div className="export-section">
          <button className="export-button" onClick={exportToCSV}>
            📥 Export to CSV
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading reports...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={() => viewMode === 'stations' ? fetchReports() : fetchBrigadeSummary()}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && viewMode === 'brigade' && brigadeSummary && (
        <main className="reports-main">
          <section className="brigade-summary-section">
            <h2>Brigade Summary: {brigades.find(b => b.id === selectedBrigadeId)?.name}</h2>
            
            <div className="stat-cards-grid">
              <div className="stat-card">
                <div className="stat-value">{brigadeSummary.summary.totalStations}</div>
                <div className="stat-label">Total Stations</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{brigadeSummary.summary.totalEvents}</div>
                <div className="stat-label">Total Events</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{brigadeSummary.summary.totalParticipants}</div>
                <div className="stat-label">Total Participants</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{brigadeSummary.summary.averageEventsPerStation}</div>
                <div className="stat-label">Avg Events/Station</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{brigadeSummary.summary.averageParticipantsPerStation}</div>
                <div className="stat-label">Avg Participants/Station</div>
              </div>
            </div>

            <div className="brigade-stations-list">
              <h3>Stations in Brigade</h3>
              <ul>
                {brigadeSummary.stations.map(station => (
                  <li key={station.id}>{station.name}</li>
                ))}
              </ul>
            </div>
          </section>
        </main>
      )}

      {!loading && !error && viewMode === 'stations' && selectedStationIds.length > 0 && (
        <main className="reports-main">
          {/* Attendance Comparison Chart */}
          <section className="chart-section">
            <h2>Attendance Comparison</h2>
            <div className="chart-container">
              {Object.keys(attendanceSummaries).length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={attendanceComparisonData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {selectedStationIds.map((stationId, index) => {
                      const station = stations.find(s => s.id === stationId);
                      return station ? (
                        <Bar
                          key={stationId}
                          dataKey={station.name}
                          fill={STATION_COLORS[index % STATION_COLORS.length]}
                        />
                      ) : null;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">No attendance data available for selected stations</div>
              )}
            </div>
          </section>

          {/* Event Statistics Comparison */}
          <section className="statistics-comparison-section">
            <h2>Event Statistics Comparison</h2>
            <div className="station-stats-grid">
              {selectedStationIds.map(stationId => {
                const station = stations.find(s => s.id === stationId);
                const stats = eventStatistics[stationId];

                if (!station || !stats) return null;

                return (
                  <div key={stationId} className="station-stats-card">
                    <h3>{station.name}</h3>
                    <div className="stat-cards-grid">
                      <div className="stat-card-mini">
                        <div className="stat-value-mini">{stats.totalEvents}</div>
                        <div className="stat-label-mini">Total Events</div>
                      </div>
                      <div className="stat-card-mini">
                        <div className="stat-value-mini">{stats.totalParticipants}</div>
                        <div className="stat-label-mini">Participants</div>
                      </div>
                      <div className="stat-card-mini">
                        <div className="stat-value-mini">{stats.averageParticipantsPerEvent}</div>
                        <div className="stat-label-mini">Avg/Event</div>
                      </div>
                      <div className="stat-card-mini">
                        <div className="stat-value-mini">{stats.averageDuration}</div>
                        <div className="stat-label-mini">Avg Duration (min)</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Member Participation Comparison */}
          <section className="participation-comparison-section">
            <h2>Top Members by Station</h2>
            <div className="leaderboards-grid">
              {selectedStationIds.map(stationId => {
                const station = stations.find(s => s.id === stationId);
                const participation = memberParticipation[stationId] || [];

                if (!station) return null;

                return (
                  <div key={stationId} className="leaderboard-card">
                    <h3>{station.name}</h3>
                    {participation.length > 0 ? (
                      <table className="leaderboard-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Member</th>
                            <th>Events</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participation.map((member, index) => (
                            <tr key={member.memberId}>
                              <td className="rank">{index + 1}</td>
                              <td className="member-name">{member.memberName}</td>
                              <td className="count">{member.participationCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="no-data-small">No participation data</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Activity Breakdown Comparison */}
          <section className="breakdown-comparison-section">
            <h2>Activity Breakdown by Station</h2>
            <div className="pie-charts-grid">
              {selectedStationIds.map(stationId => {
                const station = stations.find(s => s.id === stationId);
                const breakdown = activityBreakdowns[stationId] || [];

                if (!station) return null;

                const pieData = breakdown.map(item => ({
                  name: item.category.charAt(0).toUpperCase() + item.category.slice(1),
                  value: item.count,
                }));

                return (
                  <div key={stationId} className="pie-chart-card">
                    <h3>{station.name}</h3>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${entry.value}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={ACTIVITY_COLORS[entry.name.toLowerCase()] || CHART_COLORS.lightGrey}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="no-data-small">No activity data</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      )}

      {!loading && !error && viewMode === 'stations' && selectedStationIds.length === 0 && (
        <div className="empty-state">
          <p>Please select one or more stations to view cross-station reports.</p>
        </div>
      )}

      {!loading && !error && viewMode === 'brigade' && !selectedBrigadeId && (
        <div className="empty-state">
          <p>Please select a brigade to view brigade-level summary.</p>
        </div>
      )}
    </div>
  );
}
