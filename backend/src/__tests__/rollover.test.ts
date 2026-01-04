/**
 * Rollover Service Tests
 * 
 * Tests for event auto-expiry and rollover functionality:
 * - Event expiry detection based on start time + expiry hours
 * - Manual rollover trigger
 * - Event reactivation
 * - Active events auto-expiry (expired events become inactive but remain visible)
 * - Expired events are marked with isActive=false but still appear in event lists
 */

import request from 'supertest';
import express, { Express } from 'express';
import eventsRouter from '../routes/events';
import activitiesRouter from '../routes/activities';
import { isEventExpired, autoExpireEvents, EVENT_EXPIRY_HOURS } from '../services/rolloverService';
import type { Event } from '../types';

let app: Express;

beforeAll(() => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/events', eventsRouter);
  app.use('/api/activities', activitiesRouter);
});

describe('Rollover Service', () => {
  describe('isEventExpired', () => {
    it('should return false for active events within expiry time', () => {
      const event: Event = {
        id: 'test-event-1',
        activityId: 'test-activity-1',
        activityName: 'Training',
        startTime: new Date(), // Just started
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      expect(isEventExpired(event)).toBe(false);
    });

    it('should return true for events older than expiry hours', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - (EVENT_EXPIRY_HOURS + 1) * 60 * 60 * 1000);
      
      const event: Event = {
        id: 'test-event-2',
        activityId: 'test-activity-1',
        activityName: 'Training',
        startTime,
        isActive: true,
        createdAt: startTime,
        updatedAt: startTime,
      };
      
      expect(isEventExpired(event)).toBe(true);
    });

    it('should return true for already inactive events that are old', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - (EVENT_EXPIRY_HOURS + 1) * 60 * 60 * 1000);
      
      const event: Event = {
        id: 'test-event-3',
        activityId: 'test-activity-1',
        activityName: 'Training',
        startTime,
        endTime: new Date(),
        isActive: false,
        createdAt: startTime,
        updatedAt: new Date(),
      };
      
      // isEventExpired checks time only, not isActive flag
      expect(isEventExpired(event)).toBe(true);
    });

    it('should respect custom expiry hours', () => {
      const now = new Date();
      const customExpiryHours = 6;
      const startTime = new Date(now.getTime() - (customExpiryHours + 1) * 60 * 60 * 1000);
      
      const event: Event = {
        id: 'test-event-4',
        activityId: 'test-activity-1',
        activityName: 'Training',
        startTime,
        isActive: true,
        createdAt: startTime,
        updatedAt: startTime,
      };
      
      expect(isEventExpired(event, customExpiryHours)).toBe(true);
    });

    it('should return true for events exactly at expiry time', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - EVENT_EXPIRY_HOURS * 60 * 60 * 1000);
      
      const event: Event = {
        id: 'test-event-5',
        activityId: 'test-activity-1',
        activityName: 'Training',
        startTime,
        isActive: true,
        createdAt: startTime,
        updatedAt: startTime,
      };
      
      // At exactly the expiry time, should be expired (>= check)
      expect(isEventExpired(event)).toBe(true);
    });
  });
});

describe('Events API - Rollover Features', () => {
  let testEvent: any;

  beforeEach(async () => {
    // Get available activities
    const activitiesResponse = await request(app).get('/api/activities');
    const activities = activitiesResponse.body;
    const testActivity = activities[0];

    // Create a test event
    const createResponse = await request(app)
      .post('/api/events')
      .send({ activityId: testActivity.id })
      .expect(201);
    
    testEvent = createResponse.body;
  });

  describe('PUT /api/events/:eventId/reactivate', () => {
    it('should reactivate an ended event', async () => {
      // First, end the event
      await request(app)
        .put(`/api/events/${testEvent.id}/end`)
        .expect(200);

      // Then reactivate it
      const response = await request(app)
        .put(`/api/events/${testEvent.id}/reactivate`)
        .expect(200);

      expect(response.body.isActive).toBe(true);
      expect(response.body.endTime).toBeUndefined();
      expect(response.body.id).toBe(testEvent.id);
    });

    it('should return 404 for non-existent event', async () => {
      await request(app)
        .put('/api/events/non-existent-id/reactivate')
        .expect(404);
    });

    it('should handle invalid event ID gracefully', async () => {
      // Empty event ID returns 404 (route not matched)
      await request(app)
        .put('/api/events//reactivate')
        .expect(404);
    });

    it('should update event timestamp when reactivating', async () => {
      // End the event
      await request(app)
        .put(`/api/events/${testEvent.id}/end`)
        .expect(200);

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 10));

      // Reactivate
      const response = await request(app)
        .put(`/api/events/${testEvent.id}/reactivate`)
        .expect(200);

      const originalUpdatedAt = new Date(testEvent.updatedAt).getTime();
      const newUpdatedAt = new Date(response.body.updatedAt).getTime();
      
      expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });

  describe('POST /api/events/admin/rollover', () => {
    it('should successfully trigger manual rollover', async () => {
      const response = await request(app)
        .post('/api/events/admin/rollover')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('deactivatedCount');
      expect(response.body).toHaveProperty('deactivatedEventIds');
      expect(response.body).toHaveProperty('expiryHours');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.deactivatedEventIds)).toBe(true);
    });

    it('should not deactivate recently created events', async () => {
      // Create a fresh event
      const activitiesResponse = await request(app).get('/api/activities');
      const activity = activitiesResponse.body[0];
      await request(app)
        .post('/api/events')
        .send({ activityId: activity.id })
        .expect(201);

      // Trigger rollover
      const response = await request(app)
        .post('/api/events/admin/rollover')
        .expect(200);

      // Should not deactivate the recently created event
      expect(response.body.deactivatedCount).toBe(0);
    });

    it('should return correct expiry hours configuration', async () => {
      const response = await request(app)
        .post('/api/events/admin/rollover')
        .expect(200);

      expect(response.body.expiryHours).toBe(EVENT_EXPIRY_HOURS);
    });
  });

  describe('GET /api/events/active - with auto-expiry', () => {
    it('should not include expired events in active events list', async () => {
      // Get active events - this triggers auto-expiry
      const response = await request(app)
        .get('/api/events/active')
        .expect(200);

      // All returned events should be marked as active and recent
      const now = new Date();
      response.body.forEach((event: any) => {
        expect(event.isActive).toBe(true);
        const eventStart = new Date(event.startTime);
        const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
        
        // Events should be within the expiry window
        expect(hoursSinceStart).toBeLessThan(EVENT_EXPIRY_HOURS);
      });
    });

    it('should include recently created events', async () => {
      // Get active events before
      const beforeResponse = await request(app).get('/api/events/active');
      const beforeCount = beforeResponse.body.length;

      // Create a new event
      const activitiesResponse = await request(app).get('/api/activities');
      const activity = activitiesResponse.body[0];
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: activity.id })
        .expect(201);

      // Get active events after
      const afterResponse = await request(app).get('/api/events/active');
      
      expect(afterResponse.body.length).toBe(beforeCount + 1);
      expect(afterResponse.body.some((e: any) => e.id === createResponse.body.id)).toBe(true);
    });

    it('should mark expired events as inactive but keep them visible in all events', async () => {
      // Create a new event
      const activitiesResponse = await request(app).get('/api/activities');
      const activity = activitiesResponse.body[0];
      const createResponse = await request(app)
        .post('/api/events')
        .send({ activityId: activity.id })
        .expect(201);
      
      const eventId = createResponse.body.id;

      // Manually end it to simulate expiry
      await request(app)
        .put(`/api/events/${eventId}/end`)
        .expect(200);

      // Event should NOT be in active events
      const activeResponse = await request(app).get('/api/events/active');
      expect(activeResponse.body.some((e: any) => e.id === eventId)).toBe(false);

      // But event SHOULD still be in all events
      const allEventsResponse = await request(app).get('/api/events');
      const foundEvent = allEventsResponse.body.find((e: any) => e.id === eventId);
      expect(foundEvent).toBeDefined();
      expect(foundEvent.isActive).toBe(false);
    });
  });
});
