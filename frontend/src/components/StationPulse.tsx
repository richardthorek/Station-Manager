/**
 * StationPulse Component
 *
 * AI-assisted station overview widget that displays:
 * - Overall station health score
 * - Critical insights and recommendations
 * - Quick status indicators for key areas
 *
 * This component provides "god-mode" visibility at a glance,
 * prioritizing urgent items and actionable insights.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { InsightCard } from './InsightCard';
import type { Insight } from '../utils/analyticsHelpers';
import {
  calculateStationHealth,
  generateAttendanceInsights,
  generateComplianceInsights,
  generateParticipationInsights,
} from '../utils/analyticsHelpers';
import './StationPulse.css';

interface StationPulseProps {
  // Attendance data
  checkInCounts: number[];
  previousCheckInTotal?: number;

  // Compliance data
  complianceRate: number;
  checksWithIssues: number;
  totalChecks: number;
  applianceCount: number;

  // Participation data
  topMemberCount: number;
  totalMembers: number;
  totalEvents: number;

  // Flags
  hasRecentActivity: boolean;
}

export function StationPulse({
  checkInCounts,
  previousCheckInTotal,
  complianceRate,
  checksWithIssues,
  totalChecks,
  applianceCount,
  topMemberCount,
  totalMembers,
  totalEvents,
  hasRecentActivity,
}: StationPulseProps) {
  // Calculate overall station health
  const health = useMemo(() => {
    const avgAttendance = checkInCounts.length > 0
      ? checkInCounts.reduce((sum, val) => sum + val, 0) / checkInCounts.length
      : 0;

    const participationRate = totalMembers > 0
      ? (topMemberCount / totalMembers) * 100
      : 0;

    return calculateStationHealth(
      complianceRate,
      avgAttendance,
      participationRate,
      hasRecentActivity
    );
  }, [checkInCounts, complianceRate, topMemberCount, totalMembers, hasRecentActivity]);

  // Generate insights from all data sources
  const allInsights = useMemo(() => {
    const insights: Insight[] = [];

    // Attendance insights
    const attendanceInsights = generateAttendanceInsights(
      checkInCounts,
      previousCheckInTotal
    );
    insights.push(...attendanceInsights);

    // Compliance insights
    const complianceInsights = generateComplianceInsights(
      complianceRate,
      checksWithIssues,
      totalChecks
    );
    insights.push(...complianceInsights);

    // Participation insights
    const participationInsights = generateParticipationInsights(
      topMemberCount,
      totalMembers,
      totalEvents
    );
    insights.push(...participationInsights);

    return insights;
  }, [
    checkInCounts,
    previousCheckInTotal,
    complianceRate,
    checksWithIssues,
    totalChecks,
    applianceCount,
    topMemberCount,
    totalMembers,
    totalEvents,
  ]);

  // Prioritize critical and warning insights
  const prioritizedInsights = useMemo(() => {
    const critical = allInsights.filter((i) => i.type === 'critical');
    const warnings = allInsights.filter((i) => i.type === 'warning');
    const others = allInsights.filter((i) => i.type !== 'critical' && i.type !== 'warning');

    return [...critical, ...warnings, ...others].slice(0, 5); // Show top 5 insights
  }, [allInsights]);

  // Count critical items
  const criticalCount = allInsights.filter((i) => i.type === 'critical').length;
  const warningCount = allInsights.filter((i) => i.type === 'warning').length;

  return (
    <section className="station-pulse" aria-labelledby="station-pulse-title">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="station-pulse__header">
          <h2 id="station-pulse-title" className="station-pulse__title">
            Station Pulse
          </h2>
          <p className="station-pulse__subtitle">
            AI-powered insights and recommended actions
          </p>
        </div>

        <div className="station-pulse__content">
          {/* Health Score Card */}
          <div className={`station-pulse__health-card station-pulse__health-card--${health.status}`}>
            <div className="health-card__score-container">
              <div className="health-card__score">{health.score}</div>
              <div className="health-card__score-label">Health Score</div>
            </div>
            <div className="health-card__details">
              <div className={`health-card__status health-card__status--${health.status}`}>
                {health.status.replace('-', ' ').toUpperCase()}
              </div>
              <div className="health-card__label">{health.label}</div>
              <div className="health-card__metrics">
                {criticalCount > 0 && (
                  <span className="health-card__metric health-card__metric--critical">
                    {criticalCount} Critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="health-card__metric health-card__metric--warning">
                    {warningCount} Warnings
                  </span>
                )}
                {criticalCount === 0 && warningCount === 0 && (
                  <span className="health-card__metric health-card__metric--success">
                    No Issues
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Insights Grid */}
          {prioritizedInsights.length > 0 && (
            <div className="station-pulse__insights" role="list">
              {prioritizedInsights.map((insight, index) => (
                <div key={index} role="listitem">
                  <InsightCard
                    type={insight.type}
                    title={insight.title}
                    message={insight.message}
                    recommendation={insight.recommendation}
                  />
                </div>
              ))}
            </div>
          )}

          {prioritizedInsights.length === 0 && (
            <div className="station-pulse__no-insights">
              <p>No significant insights to display. Station operating normally.</p>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
