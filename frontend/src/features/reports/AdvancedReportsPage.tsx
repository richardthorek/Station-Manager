/**
 * Advanced Reports Page Component
 *
 * Advanced analytics dashboard with trend analysis and heat maps.
 *
 * Features:
 * - Trend analysis (month-over-month growth for attendance and events)
 * - Member growth tracking
 * - Activity heat map (by day of week and hour)
 * - Date range selector
 * - Loading states and error handling
 * - Responsive design for mobile, tablet, and desktop
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { PageTransition } from '../../components/PageTransition';
import { SkeletonReportCard, Skeleton } from '../../components/Skeleton';
import { contentFadeIn } from '../../utils/animations';
import { api } from '../../services/api';
import './AdvancedReportsPage.css';

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

type DateRange = 'last30' | 'last90' | 'last12months' | 'custom';

interface TrendData {
  attendanceTrend: Array<{ month: string; count: number; change: number; changePercent: number }>;
  eventsTrend: Array<{ month: string; count: number; change: number; changePercent: number }>;
  memberGrowth: { currentTotal: number; previousTotal: number; change: number; changePercent: number };
}

interface HeatMapData {
  day: number;
  hour: number;
  count: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export function AdvancedReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('last90');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report data
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [heatMapData, setHeatMapData] = useState<HeatMapData[]>([]);

  // Fetch all reports
  const fetchReports = useCallback(async () => {
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
          startDate = customStartDate ? new Date(customStartDate) : subDays(endDate, 90);
          if (customEndDate) {
            endDate.setTime(new Date(customEndDate).getTime());
          }
          break;
        default:
          startDate = subDays(endDate, 90);
      }

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Fetch all reports in parallel
      const [
        trendsRes,
        heatMapRes,
      ] = await Promise.all([
        api.getTrendAnalysis(startDateStr, endDateStr),
        api.getActivityHeatMap(startDateStr, endDateStr),
      ]);

      setTrendData(trendsRes.trends);
      setHeatMapData(heatMapRes.heatMap);
    } catch (err) {
      console.error('Error fetching advanced reports:', err);
      setError('Failed to load advanced analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customStartDate, customEndDate]);

  // Fetch reports on mount and when date range changes
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

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

  // Prepare data for trend charts
  const attendanceTrendData = trendData?.attendanceTrend.map(item => ({
    month: formatMonth(item.month),
    Attendance: item.count,
    Change: item.changePercent,
  })) || [];

  const eventsTrendData = trendData?.eventsTrend.map(item => ({
    month: formatMonth(item.month),
    Events: item.count,
    Change: item.changePercent,
  })) || [];

  // Format heat map data for display
  const getHeatMapColor = (count: number, maxCount: number): string => {
    if (count === 0) return '#f5f5f5';
    const intensity = Math.min(count / maxCount, 1);

    if (intensity < 0.25) return '#fdd8d4'; // Light red
    if (intensity < 0.5) return '#f9a69a';  // Medium red
    if (intensity < 0.75) return '#f4756c'; // Strong red
    return CHART_COLORS.primary; // Full red
  };

  const maxHeatMapCount = Math.max(...heatMapData.map(d => d.count), 1);

  return (
    <PageTransition variant="slideFromBottom">
      <div className="advanced-reports-page">
        <header className="reports-header">
          <Link to="/reports" className="back-link">← Back to Reports</Link>
          <h1>Advanced Analytics</h1>
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
          <motion.div
            className="loading-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <section className="statistics-cards-skeleton" aria-label="Loading statistics">
              <SkeletonReportCard count={3} />
            </section>

            <section className="chart-skeleton" aria-label="Loading charts">
              <Skeleton variant="rectangle" height={300} />
              <Skeleton variant="rectangle" height={400} />
            </section>
          </motion.div>
        )}

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchReports}>Retry</button>
          </div>
        )}

        {!loading && !error && trendData && (
          <motion.main
            className="reports-main"
            id="main-content"
            tabIndex={-1}
            {...contentFadeIn.fromSkeleton}
          >
            {/* Member Growth Card */}
            <section className="statistics-cards">
              <h2>Member Growth</h2>
              <div className="stat-cards-grid">
                <div className="stat-card">
                  <div className="stat-value">{trendData.memberGrowth.currentTotal}</div>
                  <div className="stat-label">Current Members</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{trendData.memberGrowth.previousTotal}</div>
                  <div className="stat-label">Previous Period</div>
                </div>
                <div className="stat-card">
                  <div
                    className="stat-value"
                    style={{
                      color: trendData.memberGrowth.change >= 0 ? CHART_COLORS.green : CHART_COLORS.primary
                    }}
                  >
                    {trendData.memberGrowth.change >= 0 ? '+' : ''}{trendData.memberGrowth.change}
                  </div>
                  <div className="stat-label">Change ({trendData.memberGrowth.changePercent}%)</div>
                </div>
              </div>
            </section>

            {/* Attendance Trend Chart */}
            <section className="chart-section">
              <h2>Attendance Trend (Month-over-Month)</h2>
              <div className="chart-container">
                {attendanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={attendanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="Attendance"
                        stroke={CHART_COLORS.primary}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="Change"
                        stroke={CHART_COLORS.green}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="% Change"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="no-data">No attendance trend data available for this period</div>
                )}
              </div>
            </section>

            {/* Events Trend Chart */}
            <section className="chart-section">
              <h2>Events Trend (Month-over-Month)</h2>
              <div className="chart-container">
                {eventsTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={eventsTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="Events"
                        stroke={CHART_COLORS.blue}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="Change"
                        stroke={CHART_COLORS.green}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="% Change"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="no-data">No events trend data available for this period</div>
                )}
              </div>
            </section>

            {/* Activity Heat Map */}
            <section className="chart-section">
              <h2>Activity Heat Map (By Day & Hour)</h2>
              <div className="heatmap-container">
                <div className="heatmap">
                  <div className="heatmap-yaxis">
                    {HOURS.map((hour, index) => (
                      <div key={index} className="heatmap-yaxis-label">{hour}</div>
                    ))}
                  </div>
                  <div className="heatmap-grid">
                    <div className="heatmap-xaxis">
                      {DAYS.map((day, index) => (
                        <div key={index} className="heatmap-xaxis-label">{day}</div>
                      ))}
                    </div>
                    <div className="heatmap-cells">
                      {HOURS.map((_, hourIndex) => (
                        <div key={hourIndex} className="heatmap-row">
                          {DAYS.map((_, dayIndex) => {
                            const dataPoint = heatMapData.find(d => d.day === dayIndex && d.hour === hourIndex);
                            const count = dataPoint?.count || 0;
                            const color = getHeatMapColor(count, maxHeatMapCount);

                            return (
                              <div
                                key={`${dayIndex}-${hourIndex}`}
                                className="heatmap-cell"
                                style={{ backgroundColor: color }}
                                title={`${DAYS[dayIndex]} ${HOURS[hourIndex]}: ${count} activities`}
                              >
                                {count > 0 ? count : ''}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="heatmap-legend">
                  <span>Less</span>
                  <div className="heatmap-legend-gradient" />
                  <span>More</span>
                </div>
              </div>
            </section>
          </motion.main>
        )}
      </div>
    </PageTransition>
  );
}
