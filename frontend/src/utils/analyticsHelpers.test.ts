/**
 * Tests for Analytics Helper Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAverage,
  calculateStdDev,
  detectAnomalies,
  analyzeTrend,
  generateAttendanceInsights,
  generateComplianceInsights,
  generateParticipationInsights,
  calculateStationHealth,
  formatTrendExplanation,
} from './analyticsHelpers';

describe('analyticsHelpers', () => {
  describe('calculateAverage', () => {
    it('should calculate average of numbers', () => {
      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateAverage([10, 20, 30])).toBe(20);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverage([])).toBe(0);
    });
  });

  describe('calculateStdDev', () => {
    it('should calculate standard deviation', () => {
      const result = calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(2, 0);
    });

    it('should return 0 for empty array', () => {
      expect(calculateStdDev([])).toBe(0);
    });

    it('should return 0 for constant values', () => {
      expect(calculateStdDev([5, 5, 5, 5])).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect outliers in data', () => {
      const data = [10, 12, 11, 10, 50, 11, 10]; // 50 is an outlier
      const anomalies = detectAnomalies(data, 2);
      expect(anomalies).toContain(4);
    });

    it('should return empty array for short datasets', () => {
      expect(detectAnomalies([1, 2], 2)).toEqual([]);
    });

    it('should return empty array for uniform data', () => {
      expect(detectAnomalies([10, 10, 10, 10], 2)).toEqual([]);
    });
  });

  describe('analyzeTrend', () => {
    it('should detect increasing trend', () => {
      const result = analyzeTrend([10, 15, 20, 25, 30]);
      expect(result.direction).toBe('increasing');
      expect(result.percentage).toBeGreaterThan(0);
    });

    it('should detect decreasing trend', () => {
      const result = analyzeTrend([30, 25, 20, 15, 10]);
      expect(result.direction).toBe('decreasing');
      expect(result.percentage).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const result = analyzeTrend([20, 21, 20, 19, 20]);
      expect(result.direction).toBe('stable');
    });

    it('should calculate strength correctly', () => {
      const strong = analyzeTrend([10, 50]); // 400% change
      expect(strong.strength).toBe('strong');

      const moderate = analyzeTrend([10, 11.5]); // 15% change - above 5 but below 20
      expect(moderate.strength).toBe('moderate');
    });

    it('should handle single value', () => {
      const result = analyzeTrend([10]);
      expect(result.direction).toBe('stable');
      expect(result.strength).toBe('weak');
    });
  });

  describe('generateAttendanceInsights', () => {
    it('should generate insights for increasing attendance', () => {
      const insights = generateAttendanceInsights([10, 15, 20, 25, 30]);
      expect(insights.length).toBeGreaterThan(0);

      const trendInsight = insights.find(i => i.title.includes('Growing'));
      expect(trendInsight).toBeDefined();
      expect(trendInsight?.type).toBe('success');
    });

    it('should generate warning for decreasing attendance', () => {
      const insights = generateAttendanceInsights([30, 25, 20, 15, 10]);
      const trendInsight = insights.find(i => i.title.includes('Declining'));
      expect(trendInsight).toBeDefined();
      expect(trendInsight?.type).toBe('warning');
    });

    it('should warn about low activity', () => {
      const insights = generateAttendanceInsights([2, 3, 2, 3]);
      const lowActivityInsight = insights.find(i => i.title === 'Low Activity');
      expect(lowActivityInsight).toBeDefined();
      expect(lowActivityInsight?.type).toBe('warning');
    });

    it('should handle empty data', () => {
      const insights = generateAttendanceInsights([]);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].type).toBe('info');
    });

    it('should generate comparison insight when provided', () => {
      const insights = generateAttendanceInsights([50, 55, 60], 40);
      const comparisonInsight = insights.find(i => i.title === 'Period Comparison');
      expect(comparisonInsight).toBeDefined();
    });
  });

  describe('generateComplianceInsights', () => {
    it('should generate success insight for excellent compliance', () => {
      const insights = generateComplianceInsights(95, 0, 100);
      const excellentInsight = insights.find(i => i.title === 'Excellent Compliance');
      expect(excellentInsight).toBeDefined();
      expect(excellentInsight?.type).toBe('success');
    });

    it('should generate warning for moderate compliance', () => {
      const insights = generateComplianceInsights(75, 5, 100);
      const moderateInsight = insights.find(i => i.title === 'Moderate Compliance');
      expect(moderateInsight).toBeDefined();
      expect(moderateInsight?.type).toBe('warning');
    });

    it('should generate critical insight for low compliance', () => {
      const insights = generateComplianceInsights(50, 10, 100);
      const lowInsight = insights.find(i => i.title === 'Low Compliance');
      expect(lowInsight).toBeDefined();
      expect(lowInsight?.type).toBe('critical');
    });

    it('should report issues detected', () => {
      const insights = generateComplianceInsights(80, 15, 100);
      const issuesInsight = insights.find(i => i.title === 'Issues Detected');
      expect(issuesInsight).toBeDefined();
    });

    it('should warn about no recent checks', () => {
      const insights = generateComplianceInsights(0, 0, 0);
      const noChecksInsight = insights.find(i => i.title === 'No Recent Checks');
      expect(noChecksInsight).toBeDefined();
      expect(noChecksInsight?.type).toBe('critical');
    });
  });

  describe('generateParticipationInsights', () => {
    it('should warn about low engagement', () => {
      const insights = generateParticipationInsights(5, 50, 10); // 10% participation
      const lowEngagementInsight = insights.find(i => i.title === 'Low Engagement');
      expect(lowEngagementInsight).toBeDefined();
      expect(lowEngagementInsight?.type).toBe('warning');
    });

    it('should celebrate high engagement', () => {
      const insights = generateParticipationInsights(40, 50, 10); // 80% participation
      const highEngagementInsight = insights.find(i => i.title === 'High Engagement');
      expect(highEngagementInsight).toBeDefined();
      expect(highEngagementInsight?.type).toBe('success');
    });

    it('should handle no data', () => {
      const insights = generateParticipationInsights(0, 0, 0);
      expect(insights[0].type).toBe('info');
      expect(insights[0].title).toBe('Limited Data');
    });
  });

  describe('calculateStationHealth', () => {
    it('should calculate excellent health score', () => {
      const health = calculateStationHealth(95, 25, 80, true);
      expect(health.score).toBeGreaterThan(80);
      expect(health.status).toBe('excellent');
    });

    it('should calculate good health score', () => {
      const health = calculateStationHealth(80, 15, 70, true);
      expect(health.score).toBeGreaterThanOrEqual(70);
      expect(health.score).toBeLessThan(85);
      expect(health.status).toBe('good');
    });

    it('should calculate fair health score', () => {
      const health = calculateStationHealth(65, 10, 50, true);
      expect(health.score).toBeGreaterThanOrEqual(55);
      expect(health.score).toBeLessThan(70);
      expect(health.status).toBe('fair');
    });

    it('should calculate needs-attention health score', () => {
      const health = calculateStationHealth(40, 3, 20, false);
      expect(health.score).toBeLessThan(55);
      expect(health.status).toBe('needs-attention');
    });

    it('should penalize lack of recent activity', () => {
      const withActivity = calculateStationHealth(80, 15, 70, true);
      const withoutActivity = calculateStationHealth(80, 15, 70, false);
      expect(withActivity.score).toBeGreaterThan(withoutActivity.score);
    });
  });

  describe('formatTrendExplanation', () => {
    it('should format increasing trend explanation', () => {
      const trend = { direction: 'increasing' as const, strength: 'strong' as const, percentage: 25 };
      const explanation = formatTrendExplanation(trend, 'Attendance');
      expect(explanation).toContain('increased');
      expect(explanation).toContain('25.0%');
    });

    it('should format decreasing trend explanation', () => {
      const trend = { direction: 'decreasing' as const, strength: 'moderate' as const, percentage: -15 };
      const explanation = formatTrendExplanation(trend, 'Participation');
      expect(explanation).toContain('decreased');
      expect(explanation).toContain('15.0%');
    });

    it('should format stable trend explanation', () => {
      const trend = { direction: 'stable' as const, strength: 'weak' as const, percentage: 2 };
      const explanation = formatTrendExplanation(trend, 'Events');
      expect(explanation).toContain('stable');
    });
  });
});
