/**
 * Event Audit Logging Tests
 * 
 * Tests for event membership change audit logging:
 * - Audit log creation when adding participants
 * - Audit log creation when removing participants
 * - Device and location information capture
 * - GET /api/events/:eventId/audit - Get audit logs for an event
 */

import request from 'supertest';
import express, { Express } from 'express';
import eventsRouter from '../routes/events';
import activitiesRouter from '../routes/activities';
import membersRouter from '../routes/members';

let app: Express;
let testEventId: string;
let testActivityId: string;
let testMemberId: string;
let testParticipantId: string;

beforeAll(async () => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/events', eventsRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/members', membersRouter);

  // Get test data
  const activitiesResponse = await request(app).get('/api/activities');
  testActivityId = activitiesResponse.body[0].id;

  const membersResponse = await request(app).get('/api/members');
  testMemberId = membersResponse.body[0].id;
});

describe('Event Audit Logging', () => {
  beforeEach(async () => {
    // Create a fresh event for each test
    const eventResponse = await request(app)
      .post('/api/events')
      .send({ activityId: testActivityId, createdBy: 'test-user' });
    
    testEventId = eventResponse.body.id;
  });

  describe('Audit log creation on participant add', () => {
    it('should create an audit log when adding a participant', async () => {
      // Add participant
      const addResponse = await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
          performedBy: 'test-user',
        })
        .expect(201);

      expect(addResponse.body.action).toBe('added');
      testParticipantId = addResponse.body.participant.id;

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      expect(auditResponse.body).toHaveProperty('logs');
      expect(Array.isArray(auditResponse.body.logs)).toBe(true);
      expect(auditResponse.body.logs.length).toBeGreaterThan(0);

      // Verify audit log content
      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.action).toBe('participant-added');
      expect(auditLog.eventId).toBe(testEventId);
      expect(auditLog.memberId).toBe(testMemberId);
      expect(auditLog.participantId).toBe(testParticipantId);
      expect(auditLog.checkInMethod).toBe('mobile');
      expect(auditLog.performedBy).toBe('test-user');
      expect(auditLog).toHaveProperty('timestamp');
      expect(auditLog).toHaveProperty('deviceInfo');
    });

    it('should capture device information in audit log', async () => {
      // Add participant with custom user agent
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .set('User-Agent', 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')
        .send({
          memberId: testMemberId,
          method: 'mobile',
        })
        .expect(201);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.deviceInfo).toBeDefined();
      expect(auditLog.deviceInfo.type).toBe('tablet');
      expect(auditLog.deviceInfo.userAgent).toContain('iPad');
    });

    it('should capture location information in audit log', async () => {
      // Add participant with location data
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
          latitude: -35.2809,
          longitude: 149.1300,
          accuracy: 10,
          address: 'Canberra, ACT',
        })
        .expect(201);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.locationInfo).toBeDefined();
      expect(auditLog.locationInfo.latitude).toBe(-35.2809);
      expect(auditLog.locationInfo.longitude).toBe(149.1300);
      expect(auditLog.locationInfo.accuracy).toBe(10);
      expect(auditLog.locationInfo.address).toBe('Canberra, ACT');
    });

    it('should capture notes in audit log', async () => {
      // Add participant with notes
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
          notes: 'Late arrival due to traffic',
        })
        .expect(201);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.notes).toBe('Late arrival due to traffic');
    });
  });

  describe('Audit log creation on participant removal', () => {
    beforeEach(async () => {
      // Add a participant first
      const addResponse = await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
        });
      
      testParticipantId = addResponse.body.participant.id;
    });

    it('should create an audit log when removing a participant', async () => {
      // Remove participant
      await request(app)
        .delete(`/api/events/${testEventId}/participants/${testParticipantId}`)
        .send({
          performedBy: 'admin-user',
          notes: 'Member left early',
        })
        .expect(200);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      // Should have 2 logs: add and remove
      expect(auditResponse.body.logs.length).toBe(2);

      // Verify removal log
      const removalLog = auditResponse.body.logs[1];
      expect(removalLog.action).toBe('participant-removed');
      expect(removalLog.eventId).toBe(testEventId);
      expect(removalLog.participantId).toBe(testParticipantId);
      expect(removalLog.performedBy).toBe('admin-user');
      expect(removalLog.notes).toBe('Member left early');
    });

    it('should create removal audit log when toggling participant off', async () => {
      // Toggle participant off (second POST removes them)
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
          performedBy: 'self-undo',
        })
        .expect(200);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      // Should have 2 logs: initial add and toggle removal
      expect(auditResponse.body.logs.length).toBe(2);
      
      const removalLog = auditResponse.body.logs[1];
      expect(removalLog.action).toBe('participant-removed');
      expect(removalLog.notes).toContain('Undo check-in');
    });
  });

  describe('GET /api/events/:eventId/audit', () => {
    it('should return 404 for non-existent event', async () => {
      await request(app)
        .get('/api/events/non-existent-id/audit')
        .expect(404);
    });

    it('should return empty logs for event with no participants', async () => {
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      expect(auditResponse.body.logs).toEqual([]);
      expect(auditResponse.body.totalLogs).toBe(0);
    });

    it('should return logs in chronological order', async () => {
      // Add multiple participants to create multiple log entries
      const member2Response = await request(app).get('/api/members');
      const member2Id = member2Response.body[1]?.id;

      // Add first participant
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({ memberId: testMemberId, method: 'mobile' });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Add second participant
      if (member2Id) {
        await request(app)
          .post(`/api/events/${testEventId}/participants`)
          .send({ memberId: member2Id, method: 'kiosk' });
      }

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const logs = auditResponse.body.logs;
      expect(logs.length).toBeGreaterThan(0);

      // Verify chronological order (earliest first)
      for (let i = 1; i < logs.length; i++) {
        const prevTimestamp = new Date(logs[i - 1].timestamp).getTime();
        const currentTimestamp = new Date(logs[i].timestamp).getTime();
        expect(currentTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
      }
    });

    it('should include complete audit trail for complex event', async () => {
      // Simulate a complex event with multiple additions and removals
      
      // Add participant
      const add1 = await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({ memberId: testMemberId, method: 'mobile' });
      const participantId = add1.body.participant.id;

      // Remove participant
      await request(app)
        .delete(`/api/events/${testEventId}/participants/${participantId}`)
        .send({ notes: 'Member left' });

      // Add participant again
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({ memberId: testMemberId, method: 'kiosk' });

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      expect(auditResponse.body.totalLogs).toBe(3);
      expect(auditResponse.body.logs[0].action).toBe('participant-added');
      expect(auditResponse.body.logs[1].action).toBe('participant-removed');
      expect(auditResponse.body.logs[2].action).toBe('participant-added');
    });
  });

  describe('Privacy and security', () => {
    it('should sanitize notes to prevent injection', async () => {
      // Try to add participant with malicious notes
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
          notes: 'Test\x00\x01\x02 <script>alert("xss")</script>',
        })
        .expect(201);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      // Should have control characters removed
      expect(auditLog.notes).not.toContain('\x00');
      expect(auditLog.notes).not.toContain('\x01');
      expect(auditLog.notes).not.toContain('\x02');
    });

    it('should limit notes length', async () => {
      // Try to add participant with very long notes
      const longNotes = 'A'.repeat(1000);
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .send({
          memberId: testMemberId,
          method: 'mobile',
          notes: longNotes,
        })
        .expect(201);

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      // Should be limited to 500 characters
      expect(auditLog.notes?.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Device type detection', () => {
    it('should detect mobile device', async () => {
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .send({ memberId: testMemberId, method: 'mobile' })
        .expect(201);

      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.deviceInfo.type).toBe('mobile');
    });

    it('should detect tablet device', async () => {
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .set('User-Agent', 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')
        .send({ memberId: testMemberId, method: 'mobile' })
        .expect(201);

      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.deviceInfo.type).toBe('tablet');
    });

    it('should detect kiosk device', async () => {
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .set('User-Agent', 'station-manager-kiosk/1.0')
        .send({ memberId: testMemberId, method: 'kiosk' })
        .expect(201);

      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.deviceInfo.type).toBe('kiosk');
    });

    it('should default to desktop for unknown user agent', async () => {
      await request(app)
        .post(`/api/events/${testEventId}/participants`)
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        .send({ memberId: testMemberId, method: 'mobile' })
        .expect(201);

      const auditResponse = await request(app)
        .get(`/api/events/${testEventId}/audit`)
        .expect(200);

      const auditLog = auditResponse.body.logs[0];
      expect(auditLog.deviceInfo.type).toBe('desktop');
    });
  });
});
