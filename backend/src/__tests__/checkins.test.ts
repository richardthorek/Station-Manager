/**
 * Check-Ins API Route Tests
 * 
 * Tests for all check-in management endpoints:
 * - GET /api/checkins/active - Get all active check-ins
 * - POST /api/checkins - Check in or toggle check-in status
 */

import request from 'supertest';
import express, { Express } from 'express';
import checkinsRouter from '../routes/checkins';
import membersRouter from '../routes/members';
import activitiesRouter from '../routes/activities';

let app: Express;

beforeAll(() => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  app.use('/api/checkins', checkinsRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/activities', activitiesRouter);
});

describe('Check-Ins API', () => {
  describe('GET /api/checkins/active', () => {
    it('should return an array of active check-ins', async () => {
      const response = await request(app)
        .get('/api/checkins/active')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include member and activity details in check-ins', async () => {
      // First, ensure there's an active check-in
      const membersResponse = await request(app).get('/api/members');
      const testMember = membersResponse.body[0];

      await request(app)
        .post('/api/checkins')
        .send({ memberId: testMember.id, method: 'kiosk' });

      const response = await request(app)
        .get('/api/checkins/active')
        .expect(200);

      if (response.body.length > 0) {
        const checkIn = response.body[0];
        expect(checkIn).toHaveProperty('id');
        expect(checkIn).toHaveProperty('memberId');
        expect(checkIn).toHaveProperty('activityId');
        expect(checkIn).toHaveProperty('memberName');
        expect(checkIn).toHaveProperty('activityName');
        expect(checkIn).toHaveProperty('checkInTime');
        expect(checkIn).toHaveProperty('isActive');
        expect(checkIn.isActive).toBe(true);
      }
    });
  });

  describe('POST /api/checkins - Check In', () => {
    it('should check in a member successfully', async () => {
      // Get a test member and make sure they're not checked in
      const membersResponse = await request(app).get('/api/members');
      const testMember = membersResponse.body.find((m: { name: string }) => 
        m.name.startsWith('Test Member ')
      ) || membersResponse.body[membersResponse.body.length - 1];

      // First ensure they're not checked in
      await request(app)
        .post('/api/checkins')
        .send({ memberId: testMember.id, method: 'mobile' });
      
      // Then toggle off to make sure they're not checked in
      await request(app)
        .post('/api/checkins')
        .send({ memberId: testMember.id, method: 'mobile' });

      // Now check in for real
      const response = await request(app)
        .post('/api/checkins')
        .send({ 
          memberId: testMember.id,
          method: 'mobile'
        })
        .expect(201);

      expect(response.body.action).toBe('checked-in');
      expect(response.body.checkIn).toHaveProperty('id');
      expect(response.body.checkIn.memberId).toBe(testMember.id);
      expect(response.body.checkIn.checkInMethod).toBe('mobile');
      expect(response.body.checkIn.isActive).toBe(true);
    });

    it('should use active activity when no activity specified', async () => {
      // Create a new member to avoid conflicts
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Activity Test Member' });
      
      const testMember = memberResponse.body;

      // Get active activity
      const activeActivityResponse = await request(app)
        .get('/api/activities/active');
      const activeActivity = activeActivityResponse.body;

      const response = await request(app)
        .post('/api/checkins')
        .send({ 
          memberId: testMember.id,
          method: 'kiosk'
        })
        .expect(201);

      expect(response.body.checkIn.activityId).toBe(activeActivity.activityId);
    });

    it('should accept different check-in methods', async () => {
      const methods = ['kiosk', 'mobile', 'qr'];
      
      for (const method of methods) {
        // Create a unique member for each test
        const memberResponse = await request(app)
          .post('/api/members')
          .send({ name: `Method Test ${method}` });
        
        const response = await request(app)
          .post('/api/checkins')
          .send({ 
            memberId: memberResponse.body.id,
            method: method
          })
          .expect(201);

        expect(response.body.checkIn.checkInMethod).toBe(method);
      }
    });

    it('should support location and offsite tracking', async () => {
      // Create a new member
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Location Test Member' });

      const response = await request(app)
        .post('/api/checkins')
        .send({ 
          memberId: memberResponse.body.id,
          method: 'mobile',
          location: 'Fire Scene',
          isOffsite: true
        })
        .expect(201);

      expect(response.body.checkIn.location).toBe('Fire Scene');
      expect(response.body.checkIn.isOffsite).toBe(true);
    });

    it('should return 400 for missing member ID', async () => {
      const response = await request(app)
        .post('/api/checkins')
        .send({ method: 'kiosk' })
        .expect(400);

      expect(response.body.error).toContain('Member ID is required');
    });

    it('should return 404 for non-existent member', async () => {
      const response = await request(app)
        .post('/api/checkins')
        .send({ 
          memberId: 'non-existent-member',
          method: 'kiosk'
        })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('should return 404 for non-existent activity', async () => {
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Invalid Activity Test' });

      const response = await request(app)
        .post('/api/checkins')
        .send({ 
          memberId: memberResponse.body.id,
          activityId: 'non-existent-activity',
          method: 'kiosk'
        })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/checkins - Toggle Check-In (Undo)', () => {
    it('should undo check-in for a member who is checked in', async () => {
      // Create and check in a member
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Toggle Test Member' });
      
      const memberId = memberResponse.body.id;

      // Check in
      await request(app)
        .post('/api/checkins')
        .send({ memberId, method: 'kiosk' })
        .expect(201);

      // Check out (toggle/undo)
      const response = await request(app)
        .post('/api/checkins')
        .send({ memberId, method: 'kiosk' })
        .expect(200);

      expect(response.body.action).toBe('undone');
      expect(response.body.checkIn).toHaveProperty('id');
    });

    it('should allow checking in again after checking out', async () => {
      // Create a member
      const memberResponse = await request(app)
        .post('/api/members')
        .send({ name: 'Re-check-in Test' });
      
      const memberId = memberResponse.body.id;

      // Check in
      const firstCheckIn = await request(app)
        .post('/api/checkins')
        .send({ memberId, method: 'kiosk' })
        .expect(201);

      // Check out
      await request(app)
        .post('/api/checkins')
        .send({ memberId, method: 'kiosk' })
        .expect(200);

      // Check in again
      const secondCheckIn = await request(app)
        .post('/api/checkins')
        .send({ memberId, method: 'mobile' })
        .expect(201);

      expect(secondCheckIn.body.action).toBe('checked-in');
      expect(secondCheckIn.body.checkIn.id).not.toBe(firstCheckIn.body.checkIn.id);
    });
  });

  describe('Check-In Integration', () => {
    it('should track multiple members checked in simultaneously', async () => {
      // Create multiple members
      const member1 = await request(app)
        .post('/api/members')
        .send({ name: 'Multi Test 1' });
      
      const member2 = await request(app)
        .post('/api/members')
        .send({ name: 'Multi Test 2' });

      // Check in both
      await request(app)
        .post('/api/checkins')
        .send({ memberId: member1.body.id, method: 'kiosk' });
      
      await request(app)
        .post('/api/checkins')
        .send({ memberId: member2.body.id, method: 'mobile' });

      // Get active check-ins
      const response = await request(app)
        .get('/api/checkins/active')
        .expect(200);

      const memberIds = response.body.map((c: { memberId: string }) => c.memberId);
      expect(memberIds).toContain(member1.body.id);
      expect(memberIds).toContain(member2.body.id);
    });
  });
});
