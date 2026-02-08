/**
 * Tests for brigade/station-specific URL check-in
 * 
 * Validates:
 * - stationId parameter is extracted from request body
 * - stationId is prioritized over header
 * - Backward compatibility with no stationId parameter
 */

import request from 'supertest';
import express, { Express } from 'express';
import checkinsRouter from '../routes/checkins';
import { ensureDatabase } from '../services/dbFactory';
import { stationMiddleware } from '../middleware/stationMiddleware';

describe('POST /api/checkins/url-checkin - Brigade/Station-Specific Check-In', () => {
  let app: Express;
  let testMemberId: string;
  let testActivityId: string;
  const testStationId = 'test-station-1';
  const testStationId2 = 'test-station-2';

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(stationMiddleware);
    app.use('/api/checkins', checkinsRouter);

    const db = await ensureDatabase();
    
    // Create test members in different stations
    const member1 = await db.createMember('Station1 Member', { stationId: testStationId });
    const member2 = await db.createMember('Station2 Member', { stationId: testStationId2 });
    testMemberId = member1.id;

    // Create test activity
    const activity = await db.createActivity('Training', false);
    testActivityId = activity.id;

    // Set active activity for both stations
    await db.setActiveActivity(testActivityId, testStationId, 'test-user');
    await db.setActiveActivity(testActivityId, testStationId2, 'test-user');
  });

  afterAll(async () => {
    const db = await ensureDatabase();
    await db.clearAllData();
  });

  beforeEach(async () => {
    const db = await ensureDatabase();
    // Clear check-ins before each test
    const checkIns = await db.getAllCheckIns();
    for (const checkIn of checkIns) {
      if (checkIn.isActive) {
        await db.endCheckIn(checkIn.memberId);
      }
    }
  });

  it('should check in member when stationId is provided in request body', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .send({
        identifier: 'Station1 Member',
        stationId: testStationId,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      action: 'checked-in',
      member: 'Station1 Member',
    });
    expect(response.body.checkIn).toBeDefined();
  });

  it('should prioritize stationId from body over header', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .set('X-Station-Id', testStationId2)
      .send({
        identifier: 'Station1 Member',
        stationId: testStationId, // This should be used
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      action: 'checked-in',
      member: 'Station1 Member',
    });
  });

  it('should fall back to header stationId when not in body', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .set('X-Station-Id', testStationId)
      .send({
        identifier: 'Station1 Member',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      action: 'checked-in',
      member: 'Station1 Member',
    });
  });

  it('should not find member when checking into wrong station', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .send({
        identifier: 'Station1 Member',
        stationId: testStationId2, // Wrong station
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found');
  });

  it('should validate stationId is a string when provided', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .send({
        identifier: 'Station1 Member',
        stationId: 12345, // Invalid type
      });

    expect(response.status).toBe(400);
  });

  it('should maintain backward compatibility when no stationId provided', async () => {
    // Should use default station ID from header or middleware
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .set('X-Station-Id', testStationId)
      .send({
        identifier: 'Station1 Member',
      });

    expect(response.status).toBe(201);
    expect(response.body.action).toBe('checked-in');
  });
});
