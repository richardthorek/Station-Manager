/**
 * Events API Route Tests
 * 
 * Tests for all event management endpoints:
 * - GET /api/events - Get events with pagination
 * - GET /api/events/active - Get active events
 * - GET /api/events/:eventId - Get specific event
 * - POST /api/events - Create new event
 * - PUT /api/events/:eventId/end - End event
 * - POST /api/events/:eventId/participants - Add participant to event
 * - DELETE /api/events/:eventId/participants/:participantId - Remove participant
 */

import request from 'supertest';
import express, { Express } from 'express';
import eventsRouter from '../routes/events';
import activitiesRouter from '../routes/activities';
import membersRouter from '../routes/members';
import { ensureDatabase } from '../services/dbFactory';

let app: Express;
let testEventId: string;
let testActivityId: string;
let testMemberId: string;

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

describe('Events API', () => {
  describe('GET /api/events', () => {
    it('should return an array of events', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support pagination with limit parameter', async () => {
      const response = await request(app)
        .get('/api/events?limit=5')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });

    it('should support pagination with offset parameter', async () => {
      const response = await request(app)
        .get('/api/events?limit=5&offset=2')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should cap limit at 100 max', async () => {
      const response = await request(app)
        .get('/api/events?limit=200')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(100);
    });

    it('should handle negative offset gracefully', async () => {
      const response = await request(app)
        .get('/api/events?offset=-10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return events with participant information', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200);

      if (response.body.length > 0) {
        const event = response.body[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('activityId');
        expect(event).toHaveProperty('startTime');
        expect(event).toHaveProperty('participants');
        expect(Array.isArray(event.participants)).toBe(true);
      }
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event successfully', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ 
          activityId: testActivityId,
          createdBy: testMemberId
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('activityId', testActivityId);
      expect(response.body).toHaveProperty('startTime');
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).toHaveProperty('participants');

      // Store for later tests
      testEventId = response.body.id;
    });

    it('should return 400 if activityId is missing', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ createdBy: testMemberId })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Activity ID is required');
    });

    it('should return 404 if activity does not exist', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ 
          activityId: 'non-existent-activity',
          createdBy: testMemberId
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Activity not found');
    });
  });

  describe('GET /api/events/active', () => {
    it('should return active events', async () => {
      const response = await request(app)
        .get('/api/events/active')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // All returned events should be active
      response.body.forEach((event: any) => {
        expect(event.isActive).toBe(true);
        expect(event).toHaveProperty('participants');
        expect(event).toHaveProperty('participantCount');
      });
    });

    it('should include participant details in active events', async () => {
      const response = await request(app)
        .get('/api/events/active')
        .expect(200);

      if (response.body.length > 0) {
        const event = response.body[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('participants');
        expect(Array.isArray(event.participants)).toBe(true);
        expect(event).toHaveProperty('participantCount');
        expect(typeof event.participantCount).toBe('number');
      }
    });
  });

  describe('GET /api/events/:eventId', () => {
    it('should return a specific event with participants', async () => {
      // Create an event first
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: testActivityId, createdBy: testMemberId });

      const eventId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', eventId);
      expect(response.body).toHaveProperty('activityId');
      expect(response.body).toHaveProperty('participants');
      expect(Array.isArray(response.body.participants)).toBe(true);
    });

    it('should return 404 if event does not exist', async () => {
      const response = await request(app)
        .get('/api/events/non-existent-event')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Event not found');
    });
  });

  describe('POST /api/events/:eventId/participants', () => {
    let eventId: string;

    beforeEach(async () => {
      // Create a fresh event for each test
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: testActivityId, createdBy: testMemberId });
      eventId = createResponse.body.id;
    });

    it('should add a participant to an event', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ 
          memberId: testMemberId,
          method: 'kiosk'
        })
        .expect(201);

      expect(response.body).toHaveProperty('action', 'added');
      expect(response.body).toHaveProperty('participant');
      expect(response.body.participant).toHaveProperty('memberId', testMemberId);
      expect(response.body.participant).toHaveProperty('eventId', eventId);
    });

    it('should remove participant if already checked in (toggle)', async () => {
      // First check-in
      await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ memberId: testMemberId, method: 'kiosk' })
        .expect(201);

      // Second check-in (should remove)
      const response = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ memberId: testMemberId, method: 'kiosk' })
        .expect(200);

      expect(response.body).toHaveProperty('action', 'removed');
      expect(response.body).toHaveProperty('participant');
    });

    it('should return 400 if memberId is missing', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ method: 'kiosk' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Member ID is required');
    });

    it('should return 404 if event does not exist', async () => {
      const response = await request(app)
        .post('/api/events/non-existent-event/participants')
        .send({ memberId: testMemberId, method: 'kiosk' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Event not found');
    });

    it('should return 400 if trying to add participant to ended event', async () => {
      // End the event first
      await request(app)
        .put(`/api/events/${eventId}/end`)
        .expect(200);

      // Try to add participant
      const response = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ memberId: testMemberId, method: 'kiosk' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Cannot add participants to an ended event');
    });

    it('should support optional location and isOffsite parameters', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ 
          memberId: testMemberId,
          method: 'mobile',
          location: 'Station 42',
          isOffsite: false
        })
        .expect(201);

      expect(response.body).toHaveProperty('action', 'added');
      expect(response.body.participant).toHaveProperty('checkInMethod', 'mobile');
    });
  });

  describe('PUT /api/events/:eventId/end', () => {
    it('should end an active event', async () => {
      // Create an event
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: testActivityId, createdBy: testMemberId });
      const eventId = createResponse.body.id;

      // End the event
      const response = await request(app)
        .put(`/api/events/${eventId}/end`)
        .expect(200);

      expect(response.body).toHaveProperty('id', eventId);
      expect(response.body).toHaveProperty('isActive', false);
      expect(response.body).toHaveProperty('endTime');
      expect(response.body.endTime).toBeTruthy();
    });

    it('should return 404 if event does not exist', async () => {
      const response = await request(app)
        .put('/api/events/non-existent-event/end')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Event not found');
    });

    it('should be idempotent (ending an ended event should work)', async () => {
      // Create and end an event
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: testActivityId, createdBy: testMemberId });
      const eventId = createResponse.body.id;

      await request(app)
        .put(`/api/events/${eventId}/end`)
        .expect(200);

      // End it again
      const response = await request(app)
        .put(`/api/events/${eventId}/end`)
        .expect(200);

      expect(response.body).toHaveProperty('isActive', false);
    });
  });

  describe('DELETE /api/events/:eventId/participants/:participantId', () => {
    it('should remove a participant from an event', async () => {
      // Create event and add participant
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: testActivityId, createdBy: testMemberId });
      const eventId = createResponse.body.id;

      const addResponse = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .send({ memberId: testMemberId, method: 'kiosk' });
      const participantId = addResponse.body.participant.id;

      // Remove participant
      const response = await request(app)
        .delete(`/api/events/${eventId}/participants/${participantId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('removed successfully');
    });

    it('should return 404 if participant does not exist', async () => {
      // Create event
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: testActivityId, createdBy: testMemberId });
      const eventId = createResponse.body.id;

      const response = await request(app)
        .delete(`/api/events/${eventId}/participants/non-existent-participant`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Participant not found');
    });
  });
});
