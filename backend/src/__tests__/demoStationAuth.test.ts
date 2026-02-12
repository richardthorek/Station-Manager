/**
 * Demo Station Authentication Bypass Tests
 * 
 * Tests that demo station endpoints allow access (bypass authentication)
 * when the demo station ID is provided.
 * 
 * Note: These tests verify the bypass logic works correctly.
 * Auth enforcement is controlled by the ENABLE_DATA_PROTECTION environment variable.
 */

import request from 'supertest';
import express from 'express';
import membersRouter from '../routes/members';
import activitiesRouter from '../routes/activities';
import eventsRouter from '../routes/events';
import { ensureDatabase } from '../services/dbFactory';
import { DEMO_STATION_ID } from '../constants/stations';

describe('Demo Station Authentication Bypass', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Set up Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/members', membersRouter);
    app.use('/api/activities', activitiesRouter);
    app.use('/api/events', eventsRouter);

    // Seed demo station data
    const db = await ensureDatabase();
    
    // Create demo station
    await db.createStation({
      id: DEMO_STATION_ID,
      name: 'Demo Station',
      brigadeId: 'demo-brigade',
      brigadeName: 'Demo Brigade',
      hierarchy: {
        jurisdiction: 'NSW',
        area: 'Demo Area',
        district: 'Demo District',
        brigade: 'Demo Brigade',
        station: 'Demo Station',
      },
      isActive: true,
    });

    // Create demo members
    await db.createMember('Test Member 1', { stationId: DEMO_STATION_ID });
    await db.createMember('Test Member 2', { stationId: DEMO_STATION_ID });

    // Create demo activities
    await db.createActivity('Training', undefined, DEMO_STATION_ID);
    await db.createActivity('Meeting', undefined, DEMO_STATION_ID);
  });

  describe('Demo Station Access', () => {
    it('should allow access to /api/members with demo station ID', async () => {
      const response = await request(app)
        .get('/api/members')
        .set('X-Station-Id', DEMO_STATION_ID)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow access to /api/activities with demo station ID', async () => {
      const response = await request(app)
        .get('/api/activities')
        .set('X-Station-Id', DEMO_STATION_ID)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should allow access to /api/events with demo station ID', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('X-Station-Id', DEMO_STATION_ID)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Demo Station Data Filtering', () => {
    it('should return only demo station members when querying demo station', async () => {
      // Create non-demo member
      const db = await ensureDatabase();
      await db.createMember('Non-Demo Member', { stationId: 'other-station' });

      const response = await request(app)
        .get('/api/members')
        .set('X-Station-Id', DEMO_STATION_ID)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // All returned members should belong to demo station
      response.body.forEach((member: any) => {
        expect(member.stationId).toBe(DEMO_STATION_ID);
      });

      // Non-demo member should not be included
      const nonDemoMember = response.body.find((m: any) => m.name === 'Non-Demo Member');
      expect(nonDemoMember).toBeUndefined();
    });
  });
});
