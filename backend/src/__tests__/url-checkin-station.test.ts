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

    // Create test activity (parameters: name, createdBy, stationId)
    const activity = await db.createActivity('Training', 'test-user', testStationId);
    testActivityId = activity.id;

    // Set active activity for both stations
    await db.setActiveActivity(testActivityId, testStationId, 'test-user');
    await db.setActiveActivity(testActivityId, testStationId2, 'test-user');
  });

  beforeEach(async () => {
    // Clear check-ins before each test for both test stations
    const stations = [testStationId, testStationId2];
    for (const station of stations) {
      const checkIns = await request(app)
        .get('/api/checkins/active')
        .set('X-Station-Id', station);
      for (const checkIn of checkIns.body) {
        if (checkIn.isActive) {
          await request(app)
            .delete(`/api/checkins/${checkIn.memberId}`)
            .set('X-Station-Id', station);
        }
      }
    }
  });

  it('should check in member when stationId is provided in request body', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .send({
        identifier: testMemberId, // Use member ID instead of name
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
        identifier: testMemberId, // Use member ID instead of name
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
        identifier: testMemberId, // Use member ID instead of name
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
        identifier: testMemberId, // Use member ID instead of name
        stationId: testStationId2, // Wrong station
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Member not found in this station');
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
        identifier: testMemberId, // Use member ID instead of name
      });

    expect(response.status).toBe(201);
    expect(response.body.action).toBe('checked-in');
  });

  it('should support name-based check-in for backward compatibility', async () => {
    const response = await request(app)
      .post('/api/checkins/url-checkin')
      .send({
        identifier: 'Station1 Member', // Use name for backward compatibility
        stationId: testStationId,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      action: 'checked-in',
      member: 'Station1 Member',
    });
  });
});
