/**
 * Activities API Route Tests
 * 
 * Tests for all activity management endpoints:
 * - GET /api/activities - Get all activities
 * - POST /api/activities - Create custom activity
 * - GET /api/activities/active - Get current active activity
 * - POST /api/activities/active - Set active activity
 */

import request from 'supertest';
import express, { Express } from 'express';
import activitiesRouter from '../routes/activities';

let app: Express;

beforeAll(() => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/activities', activitiesRouter);
});

describe('Activities API', () => {
  describe('GET /api/activities', () => {
    it('should return an array of activities', async () => {
      const response = await request(app)
        .get('/api/activities')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify activity structure
      const activity = response.body[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('name');
      expect(activity).toHaveProperty('isCustom');
      expect(activity).toHaveProperty('createdAt');
    });

    it('should include default activities (Training, Maintenance, Meeting)', async () => {
      const response = await request(app)
        .get('/api/activities')
        .expect(200);

      const activityNames = response.body.map((a: { name: string }) => a.name);
      expect(activityNames).toContain('Training');
      expect(activityNames).toContain('Maintenance');
      expect(activityNames).toContain('Meeting');
    });

    it('should mark default activities as not custom', async () => {
      const response = await request(app)
        .get('/api/activities')
        .expect(200);

      const defaultActivities = response.body.filter((a: { name: string }) => 
        ['Training', 'Maintenance', 'Meeting'].includes(a.name)
      );
      
      defaultActivities.forEach((activity: { isCustom: boolean }) => {
        expect(activity.isCustom).toBe(false);
      });
    });
  });

  describe('POST /api/activities', () => {
    it('should create a new custom activity', async () => {
      const activityName = 'Test Activity ' + Date.now();
      
      const response = await request(app)
        .post('/api/activities')
        .send({ name: activityName })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(activityName);
      expect(response.body.isCustom).toBe(true);
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should trim whitespace from activity name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: '  Whitespace Activity  ' })
        .expect(201);

      expect(response.body.name).toBe('Whitespace Activity');
    });

    it('should include createdBy field when provided', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ 
          name: 'Created By Activity',
          createdBy: 'test-user-id'
        })
        .expect(201);

      expect(response.body.createdBy).toBe('test-user-id');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('name is required');
    });

    it('should return 400 for empty name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: '   ' })
        .expect(400);

      expect(response.body.error).toContain('name is required');
    });

    it('should return 400 for non-string name', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({ name: 123 })
        .expect(400);

      expect(response.body.error).toContain('name is required');
    });
  });

  describe('GET /api/activities/active', () => {
    it('should return the current active activity', async () => {
      const response = await request(app)
        .get('/api/activities/active')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('activityId');
      expect(response.body).toHaveProperty('setAt');
      expect(response.body).toHaveProperty('activity');
      
      // Verify nested activity object
      expect(response.body.activity).toHaveProperty('id');
      expect(response.body.activity).toHaveProperty('name');
    });

    it('should return activity details in nested object', async () => {
      const response = await request(app)
        .get('/api/activities/active')
        .expect(200);

      const activity = response.body.activity;
      expect(activity.id).toBe(response.body.activityId);
      expect(activity).toHaveProperty('name');
      expect(activity).toHaveProperty('isCustom');
    });
  });

  describe('POST /api/activities/active', () => {
    it('should set a new active activity', async () => {
      // First get all activities to get a valid activity ID
      const activitiesResponse = await request(app).get('/api/activities');
      const testActivity = activitiesResponse.body[0];

      const response = await request(app)
        .post('/api/activities/active')
        .send({ activityId: testActivity.id })
        .expect(200);

      expect(response.body.activityId).toBe(testActivity.id);
      expect(response.body).toHaveProperty('setAt');
      expect(response.body.activity.name).toBe(testActivity.name);
    });

    it('should include setBy field when provided', async () => {
      const activitiesResponse = await request(app).get('/api/activities');
      const testActivity = activitiesResponse.body[0];

      const response = await request(app)
        .post('/api/activities/active')
        .send({ 
          activityId: testActivity.id,
          setBy: 'test-user-id'
        })
        .expect(200);

      expect(response.body.setBy).toBe('test-user-id');
    });

    it('should return 400 for missing activityId', async () => {
      const response = await request(app)
        .post('/api/activities/active')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Activity ID is required');
    });

    it('should return 404 for non-existent activity', async () => {
      const response = await request(app)
        .post('/api/activities/active')
        .send({ activityId: 'non-existent-id' })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('Activity Integration', () => {
    it('should be able to create custom activity and set it as active', async () => {
      // Create a custom activity
      const createResponse = await request(app)
        .post('/api/activities')
        .send({ name: 'Integration Test Activity' })
        .expect(201);

      const customActivityId = createResponse.body.id;

      // Set it as active
      const setActiveResponse = await request(app)
        .post('/api/activities/active')
        .send({ activityId: customActivityId })
        .expect(200);

      expect(setActiveResponse.body.activityId).toBe(customActivityId);

      // Verify it's active
      const getActiveResponse = await request(app)
        .get('/api/activities/active')
        .expect(200);

      expect(getActiveResponse.body.activityId).toBe(customActivityId);
      expect(getActiveResponse.body.activity.name).toBe('Integration Test Activity');
      expect(getActiveResponse.body.activity.isCustom).toBe(true);
    });
  });
});
