/**
 * Export API Route Tests
 * 
 * Tests for all data export endpoints:
 * - GET /api/export/members - Export members to CSV
 * - GET /api/export/checkins - Export check-ins to CSV (with date range)
 * - GET /api/export/events - Export events to CSV (with date range)
 * - GET /api/export/truckcheck-results - Export truck check results to CSV (with date range)
 */

import request from 'supertest';
import express, { Express } from 'express';
import exportRouter from '../routes/export';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';

let app: Express;

beforeAll(async () => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/export', exportRouter);

  // Initialize databases
  await ensureDatabase();
  await ensureTruckChecksDatabase();
});

describe('Export API', () => {
  describe('GET /api/export/members', () => {
    it('should export members to CSV', async () => {
      const response = await request(app)
        .get('/api/export/members')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('members-');
      expect(response.text).toContain('ID');
      expect(response.text).toContain('Name');
      expect(response.text).toContain('QR Code');
    });

    it('should include all member fields in CSV', async () => {
      const response = await request(app)
        .get('/api/export/members')
        .expect(200);

      expect(response.text).toContain('First Name');
      expect(response.text).toContain('Last Name');
      expect(response.text).toContain('Rank');
      expect(response.text).toContain('Member Number');
      expect(response.text).toContain('Station ID');
      expect(response.text).toContain('Created At');
    });
  });

  describe('GET /api/export/checkins', () => {
    it('should export check-ins to CSV', async () => {
      const response = await request(app)
        .get('/api/export/checkins')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('checkins-');
      expect(response.text).toContain('ID');
      expect(response.text).toContain('Member Name');
      expect(response.text).toContain('Activity Name');
    });

    it('should filter check-ins by start date', async () => {
      const response = await request(app)
        .get('/api/export/checkins')
        .query({ startDate: '2024-01-01' })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('2024-01-01');
    });

    it('should filter check-ins by date range', async () => {
      const response = await request(app)
        .get('/api/export/checkins')
        .query({ 
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('2024-01-01-to-2024-01-31');
    });

    it('should return 400 for invalid start date', async () => {
      const response = await request(app)
        .get('/api/export/checkins')
        .query({ startDate: 'invalid-date' })
        .expect(400);

      expect(response.body.error).toContain('Invalid startDate');
    });

    it('should return 400 for invalid end date', async () => {
      const response = await request(app)
        .get('/api/export/checkins')
        .query({ endDate: 'invalid-date' })
        .expect(400);

      expect(response.body.error).toContain('Invalid endDate');
    });
  });

  describe('GET /api/export/events', () => {
    it('should export events to CSV', async () => {
      const response = await request(app)
        .get('/api/export/events')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('events-');
      expect(response.text).toContain('Event ID');
      expect(response.text).toContain('Activity Name');
      expect(response.text).toContain('Participant Member Name');
    });

    it('should filter events by start date', async () => {
      const response = await request(app)
        .get('/api/export/events')
        .query({ startDate: '2024-01-01' })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('2024-01-01');
    });

    it('should filter events by date range', async () => {
      const response = await request(app)
        .get('/api/export/events')
        .query({ 
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('2024-01-01-to-2024-12-31');
    });

    it('should return 400 for invalid start date', async () => {
      const response = await request(app)
        .get('/api/export/events')
        .query({ startDate: 'not-a-date' })
        .expect(400);

      expect(response.body.error).toContain('Invalid startDate');
    });
  });

  describe('GET /api/export/truckcheck-results', () => {
    it('should export truck check results to CSV', async () => {
      const response = await request(app)
        .get('/api/export/truckcheck-results')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('truckcheck-results-');
      expect(response.text).toContain('Run ID');
      expect(response.text).toContain('Appliance Name');
      expect(response.text).toContain('Item Name');
    });

    it('should filter truck check results by start date', async () => {
      const response = await request(app)
        .get('/api/export/truckcheck-results')
        .query({ startDate: '2024-01-01' })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('2024-01-01');
    });

    it('should filter truck check results by date range', async () => {
      const response = await request(app)
        .get('/api/export/truckcheck-results')
        .query({ 
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('2024-01-01-to-2024-12-31');
    });

    it('should return 400 for invalid end date', async () => {
      const response = await request(app)
        .get('/api/export/truckcheck-results')
        .query({ endDate: 'bad-date' })
        .expect(400);

      expect(response.body.error).toContain('Invalid endDate');
    });
  });
});
