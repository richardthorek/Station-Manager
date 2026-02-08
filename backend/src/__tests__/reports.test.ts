/**
 * Reports API Route Tests
 * 
 * Tests for all reporting endpoints:
 * - GET /api/reports/attendance-summary - Monthly attendance statistics
 * - GET /api/reports/member-participation - Top members by participation
 * - GET /api/reports/activity-breakdown - Activity category breakdown
 * - GET /api/reports/event-statistics - Event statistics
 * - GET /api/reports/truckcheck-compliance - Truck check compliance
 */

import request from 'supertest';
import express, { Express } from 'express';
import reportsRouter from '../routes/reports';

let app: Express;

beforeAll(() => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/reports', reportsRouter);
});

describe('Reports API', () => {
  describe('GET /api/reports/attendance-summary', () => {
    it('should return attendance summary with date range', async () => {
      const response = await request(app)
        .get('/api/reports/attendance-summary')
        .expect(200);

      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.summary)).toBe(true);
    });

    it('should accept custom date range', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/reports/attendance-summary')
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.startDate).toBe(startDate);
      expect(response.body.endDate).toBe(endDate);
    });

    it('should return summary with month and count fields', async () => {
      const response = await request(app)
        .get('/api/reports/attendance-summary')
        .expect(200);

      if (response.body.summary.length > 0) {
        const item = response.body.summary[0];
        expect(item).toHaveProperty('month');
        expect(item).toHaveProperty('count');
        expect(typeof item.count).toBe('number');
      }
    });
  });

  describe('GET /api/reports/member-participation', () => {
    it('should return member participation data', async () => {
      const response = await request(app)
        .get('/api/reports/member-participation')
        .expect(200);

      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('participation');
      expect(Array.isArray(response.body.participation)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/reports/member-participation')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.participation.length).toBeLessThanOrEqual(5);
    });

    it('should return participation with required fields', async () => {
      const response = await request(app)
        .get('/api/reports/member-participation')
        .expect(200);

      if (response.body.participation.length > 0) {
        const member = response.body.participation[0];
        expect(member).toHaveProperty('memberId');
        expect(member).toHaveProperty('memberName');
        expect(member).toHaveProperty('participationCount');
        expect(member).toHaveProperty('lastCheckIn');
        expect(typeof member.participationCount).toBe('number');
      }
    });
  });

  describe('GET /api/reports/activity-breakdown', () => {
    it('should return activity breakdown', async () => {
      const response = await request(app)
        .get('/api/reports/activity-breakdown')
        .expect(200);

      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('breakdown');
      expect(Array.isArray(response.body.breakdown)).toBe(true);
    });

    it('should return breakdown with category, count, and percentage', async () => {
      const response = await request(app)
        .get('/api/reports/activity-breakdown')
        .expect(200);

      if (response.body.breakdown.length > 0) {
        const category = response.body.breakdown[0];
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('count');
        expect(category).toHaveProperty('percentage');
        expect(typeof category.count).toBe('number');
        expect(typeof category.percentage).toBe('number');
      }
    });
  });

  describe('GET /api/reports/event-statistics', () => {
    it('should return event statistics', async () => {
      const response = await request(app)
        .get('/api/reports/event-statistics')
        .expect(200);

      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('statistics');
      
      const stats = response.body.statistics;
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('activeEvents');
      expect(stats).toHaveProperty('completedEvents');
      expect(stats).toHaveProperty('totalParticipants');
      expect(stats).toHaveProperty('averageParticipantsPerEvent');
      expect(stats).toHaveProperty('averageDuration');
    });

    it('should return numeric statistics', async () => {
      const response = await request(app)
        .get('/api/reports/event-statistics')
        .expect(200);

      const stats = response.body.statistics;
      expect(typeof stats.totalEvents).toBe('number');
      expect(typeof stats.activeEvents).toBe('number');
      expect(typeof stats.completedEvents).toBe('number');
      expect(typeof stats.totalParticipants).toBe('number');
      expect(typeof stats.averageParticipantsPerEvent).toBe('number');
      expect(typeof stats.averageDuration).toBe('number');
    });
  });

  describe('GET /api/reports/truckcheck-compliance', () => {
    it('should return truck check compliance data', async () => {
      const response = await request(app)
        .get('/api/reports/truckcheck-compliance')
        .expect(200);

      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('compliance');
      
      const compliance = response.body.compliance;
      expect(compliance).toHaveProperty('totalChecks');
      expect(compliance).toHaveProperty('completedChecks');
      expect(compliance).toHaveProperty('inProgressChecks');
      expect(compliance).toHaveProperty('checksWithIssues');
      expect(compliance).toHaveProperty('complianceRate');
      expect(compliance).toHaveProperty('applianceStats');
    });

    it('should return numeric compliance values', async () => {
      const response = await request(app)
        .get('/api/reports/truckcheck-compliance')
        .expect(200);

      const compliance = response.body.compliance;
      expect(typeof compliance.totalChecks).toBe('number');
      expect(typeof compliance.completedChecks).toBe('number');
      expect(typeof compliance.inProgressChecks).toBe('number');
      expect(typeof compliance.checksWithIssues).toBe('number');
      expect(typeof compliance.complianceRate).toBe('number');
      expect(Array.isArray(compliance.applianceStats)).toBe(true);
    });

    it('should return compliance rate as percentage (0-100)', async () => {
      const response = await request(app)
        .get('/api/reports/truckcheck-compliance')
        .expect(200);

      const complianceRate = response.body.compliance.complianceRate;
      expect(complianceRate).toBeGreaterThanOrEqual(0);
      expect(complianceRate).toBeLessThanOrEqual(100);
    });

    it('should return appliance stats with required fields', async () => {
      const response = await request(app)
        .get('/api/reports/truckcheck-compliance')
        .expect(200);

      const applianceStats = response.body.compliance.applianceStats;
      if (applianceStats.length > 0) {
        const appliance = applianceStats[0];
        expect(appliance).toHaveProperty('applianceId');
        expect(appliance).toHaveProperty('applianceName');
        expect(appliance).toHaveProperty('checkCount');
        expect(appliance).toHaveProperty('lastCheckDate');
      }
    });
  });

  describe('Date Range Parsing', () => {
    it('should default to last 30 days when no dates provided', async () => {
      const response = await request(app)
        .get('/api/reports/attendance-summary')
        .expect(200);

      const startDate = new Date(response.body.startDate);
      const endDate = new Date(response.body.endDate);
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Should be approximately 30 days
      expect(daysDiff).toBeGreaterThan(28);
      expect(daysDiff).toBeLessThan(32);
    });

    it('should handle ISO date strings', async () => {
      const startDate = '2024-06-01T00:00:00.000Z';
      const endDate = '2024-06-30T23:59:59.999Z';

      const response = await request(app)
        .get('/api/reports/event-statistics')
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.startDate).toBe(startDate);
      expect(response.body.endDate).toBe(endDate);
    });
  });

  describe('Advanced Analytics Endpoints', () => {
    describe('GET /api/reports/advanced/trend-analysis', () => {
      it('should return trend analysis data', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/trend-analysis')
          .expect(200);

        expect(response.body).toHaveProperty('startDate');
        expect(response.body).toHaveProperty('endDate');
        expect(response.body).toHaveProperty('trends');
        expect(response.body.trends).toHaveProperty('attendanceTrend');
        expect(response.body.trends).toHaveProperty('eventsTrend');
        expect(response.body.trends).toHaveProperty('memberGrowth');
      });

      it('should return attendance trend with required fields', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/trend-analysis')
          .expect(200);

        const attendanceTrend = response.body.trends.attendanceTrend;
        expect(Array.isArray(attendanceTrend)).toBe(true);

        if (attendanceTrend.length > 0) {
          const item = attendanceTrend[0];
          expect(item).toHaveProperty('month');
          expect(item).toHaveProperty('count');
          expect(item).toHaveProperty('change');
          expect(item).toHaveProperty('changePercent');
          expect(typeof item.count).toBe('number');
          expect(typeof item.change).toBe('number');
          expect(typeof item.changePercent).toBe('number');
        }
      });

      it('should return events trend with required fields', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/trend-analysis')
          .expect(200);

        const eventsTrend = response.body.trends.eventsTrend;
        expect(Array.isArray(eventsTrend)).toBe(true);

        if (eventsTrend.length > 0) {
          const item = eventsTrend[0];
          expect(item).toHaveProperty('month');
          expect(item).toHaveProperty('count');
          expect(item).toHaveProperty('change');
          expect(item).toHaveProperty('changePercent');
        }
      });

      it('should return member growth with required fields', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/trend-analysis')
          .expect(200);

        const memberGrowth = response.body.trends.memberGrowth;
        expect(memberGrowth).toHaveProperty('currentTotal');
        expect(memberGrowth).toHaveProperty('previousTotal');
        expect(memberGrowth).toHaveProperty('change');
        expect(memberGrowth).toHaveProperty('changePercent');
        expect(typeof memberGrowth.currentTotal).toBe('number');
        expect(typeof memberGrowth.previousTotal).toBe('number');
        expect(typeof memberGrowth.change).toBe('number');
        expect(typeof memberGrowth.changePercent).toBe('number');
      });

      it('should accept custom date range', async () => {
        const startDate = new Date('2024-01-01').toISOString();
        const endDate = new Date('2024-12-31').toISOString();

        const response = await request(app)
          .get('/api/reports/advanced/trend-analysis')
          .query({ startDate, endDate })
          .expect(200);

        expect(response.body.startDate).toBe(startDate);
        expect(response.body.endDate).toBe(endDate);
      });
    });

    describe('GET /api/reports/advanced/heat-map', () => {
      it('should return activity heat map data', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/heat-map')
          .expect(200);

        expect(response.body).toHaveProperty('startDate');
        expect(response.body).toHaveProperty('endDate');
        expect(response.body).toHaveProperty('heatMap');
        expect(Array.isArray(response.body.heatMap)).toBe(true);
      });

      it('should return heat map with day, hour, and count fields', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/heat-map')
          .expect(200);

        const heatMap = response.body.heatMap;
        expect(heatMap.length).toBeGreaterThan(0);

        // Heat map should have 7 days * 24 hours = 168 entries
        expect(heatMap.length).toBe(168);

        const item = heatMap[0];
        expect(item).toHaveProperty('day');
        expect(item).toHaveProperty('hour');
        expect(item).toHaveProperty('count');
        expect(typeof item.day).toBe('number');
        expect(typeof item.hour).toBe('number');
        expect(typeof item.count).toBe('number');
      });

      it('should return days 0-6 and hours 0-23', async () => {
        const response = await request(app)
          .get('/api/reports/advanced/heat-map')
          .expect(200);

        const heatMap = response.body.heatMap;

        // Check day range
        const days = [...new Set(heatMap.map((item: { day: number }) => item.day))];
        expect(days.length).toBe(7);
        expect(Math.min(...days)).toBe(0);
        expect(Math.max(...days)).toBe(6);

        // Check hour range
        const hours = [...new Set(heatMap.map((item: { hour: number }) => item.hour))];
        expect(hours.length).toBe(24);
        expect(Math.min(...hours)).toBe(0);
        expect(Math.max(...hours)).toBe(23);
      });

      it('should accept custom date range', async () => {
        const startDate = new Date('2024-06-01').toISOString();
        const endDate = new Date('2024-06-30').toISOString();

        const response = await request(app)
          .get('/api/reports/advanced/heat-map')
          .query({ startDate, endDate })
          .expect(200);

        expect(response.body.startDate).toBe(startDate);
        expect(response.body.endDate).toBe(endDate);
      });
    });
  });
});
