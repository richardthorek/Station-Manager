/**
 * Analytics Helper Utilities
 *
 * Provides intelligence functions for anomaly detection, trend analysis,
 * and generating plain-language insights for reports data.
 */

export interface DataPoint {
  value: number;
  label: string;
}

export interface Insight {
  type: 'success' | 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  recommendation?: string;
}

/**
 * Calculate the average of an array of numbers
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = calculateAverage(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Detect anomalies in a time series (values significantly above/below average)
 * Returns indices of anomalous data points
 */
export function detectAnomalies(values: number[], threshold = 2): number[] {
  if (values.length < 3) return [];

  const avg = calculateAverage(values);
  const stdDev = calculateStdDev(values);

  if (stdDev === 0) return [];

  const anomalies: number[] = [];
  values.forEach((value, index) => {
    const zScore = Math.abs((value - avg) / stdDev);
    if (zScore > threshold) {
      anomalies.push(index);
    }
  });

  return anomalies;
}

/**
 * Calculate trend direction and strength
 */
export function analyzeTrend(values: number[]): {
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: 'strong' | 'moderate' | 'weak';
  percentage: number;
} {
  if (values.length < 2) {
    return { direction: 'stable', strength: 'weak', percentage: 0 };
  }

  // Simple linear regression slope
  const n = values.length;
  const xValues = Array.from({ length: n }, (_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = calculateAverage(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (values[i] - yMean);
    denominator += Math.pow(xValues[i] - xMean, 2);
  }

  // Calculate slope for trend analysis
  // const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate percentage change from first to last
  const firstValue = values[0] || 1;
  const lastValue = values[values.length - 1] || 0;
  const percentageChange = ((lastValue - firstValue) / firstValue) * 100;

  // Determine direction and strength
  let direction: 'increasing' | 'decreasing' | 'stable';
  let strength: 'strong' | 'moderate' | 'weak';

  if (Math.abs(percentageChange) < 5) {
    direction = 'stable';
    strength = 'weak';
  } else if (percentageChange > 0) {
    direction = 'increasing';
    strength = Math.abs(percentageChange) > 20 ? 'strong' : 'moderate';
  } else {
    direction = 'decreasing';
    strength = Math.abs(percentageChange) > 20 ? 'strong' : 'moderate';
  }

  return { direction, strength, percentage: percentageChange };
}

/**
 * Generate insights for attendance data
 */
export function generateAttendanceInsights(
  checkInCounts: number[],
  comparisonPeriod?: number
): Insight[] {
  const insights: Insight[] = [];

  if (checkInCounts.length === 0) {
    return [{
      type: 'info',
      title: 'No Data',
      message: 'No attendance data available for the selected period.',
    }];
  }

  const trend = analyzeTrend(checkInCounts);
  const totalCheckIns = checkInCounts.reduce((sum, val) => sum + val, 0);
  const avgCheckIns = calculateAverage(checkInCounts);
  const anomalies = detectAnomalies(checkInCounts);

  // Trend insight
  if (trend.direction === 'increasing' && trend.strength !== 'weak') {
    insights.push({
      type: 'success',
      title: 'Growing Participation',
      message: `Attendance has increased by ${Math.abs(trend.percentage).toFixed(1)}% over the period.`,
      recommendation: 'Maintain current engagement strategies.',
    });
  } else if (trend.direction === 'decreasing' && trend.strength !== 'weak') {
    insights.push({
      type: 'warning',
      title: 'Declining Attendance',
      message: `Attendance has decreased by ${Math.abs(trend.percentage).toFixed(1)}% over the period.`,
      recommendation: 'Consider scheduling more training events or checking in with members.',
    });
  }

  // Comparison period insight
  if (comparisonPeriod !== undefined && comparisonPeriod > 0) {
    const change = ((totalCheckIns - comparisonPeriod) / comparisonPeriod) * 100;
    if (Math.abs(change) > 10) {
      insights.push({
        type: change > 0 ? 'success' : 'warning',
        title: 'Period Comparison',
        message: `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change).toFixed(1)}% vs previous period.`,
      });
    }
  }

  // Anomaly detection
  if (anomalies.length > 0) {
    const lastAnomaly = anomalies[anomalies.length - 1];
    const isRecent = lastAnomaly >= checkInCounts.length - 2;

    if (isRecent) {
      insights.push({
        type: 'info',
        title: 'Unusual Activity',
        message: 'Recent check-in activity is significantly different from the pattern.',
        recommendation: 'Verify if there was a special event or incident.',
      });
    }
  }

  // Low activity warning
  if (avgCheckIns < 5) {
    insights.push({
      type: 'warning',
      title: 'Low Activity',
      message: `Average of ${avgCheckIns.toFixed(1)} check-ins per period.`,
      recommendation: 'Consider organizing events to increase member engagement.',
    });
  }

  return insights;
}

/**
 * Generate insights for truck check compliance
 */
export function generateComplianceInsights(
  complianceRate: number,
  checksWithIssues: number,
  totalChecks: number
): Insight[] {
  const insights: Insight[] = [];

  // Compliance rate insights
  if (complianceRate >= 90) {
    insights.push({
      type: 'success',
      title: 'Excellent Compliance',
      message: `${complianceRate}% of truck checks are completed on time.`,
      recommendation: 'Maintain current maintenance schedule.',
    });
  } else if (complianceRate >= 70) {
    insights.push({
      type: 'warning',
      title: 'Moderate Compliance',
      message: `${complianceRate}% compliance rate - room for improvement.`,
      recommendation: 'Set reminders for upcoming check deadlines.',
    });
  } else {
    insights.push({
      type: 'critical',
      title: 'Low Compliance',
      message: `Only ${complianceRate}% of truck checks are compliant.`,
      recommendation: 'Urgent: Schedule immediate checks for all appliances.',
    });
  }

  // Issues detected
  if (checksWithIssues > 0) {
    const issueRate = (checksWithIssues / totalChecks) * 100;
    insights.push({
      type: issueRate > 30 ? 'critical' : 'warning',
      title: 'Issues Detected',
      message: `${checksWithIssues} checks (${issueRate.toFixed(1)}%) have reported issues.`,
      recommendation: 'Review and address flagged maintenance items.',
    });
  }

  // No recent checks
  if (totalChecks === 0) {
    insights.push({
      type: 'critical',
      title: 'No Recent Checks',
      message: 'No truck checks recorded in this period.',
      recommendation: 'Initiate vehicle inspections as per RFS guidelines.',
    });
  }

  return insights;
}

/**
 * Generate insights for member participation
 */
export function generateParticipationInsights(
  topMemberCount: number,
  totalMembers: number,
  totalEvents: number
): Insight[] {
  const insights: Insight[] = [];

  if (totalMembers === 0 || totalEvents === 0) {
    insights.push({
      type: 'info',
      title: 'Limited Data',
      message: 'Insufficient participation data for analysis.',
    });
    return insights;
  }

  const participationRate = (topMemberCount / totalMembers) * 100;

  if (participationRate < 30) {
    insights.push({
      type: 'warning',
      title: 'Low Engagement',
      message: `Only ${participationRate.toFixed(1)}% of members are actively participating.`,
      recommendation: 'Reach out to inactive members and promote upcoming events.',
    });
  } else if (participationRate > 70) {
    insights.push({
      type: 'success',
      title: 'High Engagement',
      message: `${participationRate.toFixed(1)}% of members are actively participating.`,
      recommendation: 'Great community engagement!',
    });
  }

  return insights;
}

/**
 * Generate overall station health score (0-100)
 */
export function calculateStationHealth(
  complianceRate: number,
  avgAttendance: number,
  participationRate: number,
  recentActivity: boolean
): {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'needs-attention';
  label: string;
} {
  // Weighted scoring
  const complianceScore = complianceRate;
  const attendanceScore = Math.min((avgAttendance / 20) * 100, 100); // 20+ avg = 100
  const participationScore = participationRate;
  const activityScore = recentActivity ? 100 : 50;

  const weightedScore =
    complianceScore * 0.35 +
    attendanceScore * 0.30 +
    participationScore * 0.25 +
    activityScore * 0.10;

  const score = Math.round(weightedScore);

  let status: 'excellent' | 'good' | 'fair' | 'needs-attention';
  let label: string;

  if (score >= 85) {
    status = 'excellent';
    label = 'Station operating at peak performance';
  } else if (score >= 70) {
    status = 'good';
    label = 'Station operating well with minor areas to improve';
  } else if (score >= 55) {
    status = 'fair';
    label = 'Station needs attention in several areas';
  } else {
    status = 'needs-attention';
    label = 'Station requires immediate attention';
  }

  return { score, status, label };
}

/**
 * Format trend explanation for display
 */
export function formatTrendExplanation(
  trend: ReturnType<typeof analyzeTrend>,
  dataLabel: string
): string {
  const { direction, strength, percentage } = trend;

  if (direction === 'stable') {
    return `${dataLabel} has remained relatively stable over this period.`;
  }

  const strengthWord = strength === 'strong' ? 'significantly' : strength === 'moderate' ? 'moderately' : 'slightly';
  const directionWord = direction === 'increasing' ? 'increased' : 'decreased';

  return `${dataLabel} has ${strengthWord} ${directionWord} by ${Math.abs(percentage).toFixed(1)}% over this period.`;
}
