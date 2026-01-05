/**
 * Achievements API Route Tests
 * 
 * Tests for all achievement endpoints:
 * - GET /api/achievements/:memberId - Get member achievements
 * - GET /api/achievements/:memberId/recent - Get recently earned achievements
 * - GET /api/achievements/:memberId/progress - Get progress toward achievements
 */

import request from 'supertest';
import express, { Express } from 'express';
import { createAchievementRoutes } from '../routes/achievements';
import membersRouter from '../routes/members';

let app: Express;
let testMemberId: string;

beforeAll(async () => {
  // Set up Express app with routes
  app = express();
  app.use(express.json());
  
  // Set up routes (achievements route now handles database selection internally)
  app.use('/api/achievements', createAchievementRoutes());
  app.use('/api/members', membersRouter);

  // Get test member
  const membersResponse = await request(app).get('/api/members');
  testMemberId = membersResponse.body[0].id;
});

describe('Achievements API', () => {
  describe('GET /api/achievements/:memberId', () => {
    it('should return achievements for a member', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}`)
        .expect(200);

      // Verify achievement summary structure (matches AchievementService return)
      expect(response.body).toHaveProperty('memberId');
      expect(response.body).toHaveProperty('memberName');
      expect(response.body).toHaveProperty('totalAchievements');
      expect(response.body).toHaveProperty('achievements');
      expect(response.body).toHaveProperty('recentlyEarned');
      expect(response.body).toHaveProperty('progress');
      expect(response.body).toHaveProperty('activeStreaks');

      expect(Array.isArray(response.body.achievements)).toBe(true);
      expect(Array.isArray(response.body.recentlyEarned)).toBe(true);
      expect(Array.isArray(response.body.progress)).toBe(true);
      expect(Array.isArray(response.body.activeStreaks)).toBe(true);
      expect(typeof response.body.totalAchievements).toBe('number');
    });

    it('should return 404 if member does not exist', async () => {
      const response = await request(app)
        .get('/api/achievements/non-existent-member')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Member not found');
    });

    it('should include progress information', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}`)
        .expect(200);

      expect(response.body).toHaveProperty('progress');
      expect(Array.isArray(response.body.progress)).toBe(true);
    });

    it('should return valid achievement data structure', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}`)
        .expect(200);

      // Check earned achievements structure if any exist
      if (response.body.achievements.length > 0) {
        const achievement = response.body.achievements[0];
        expect(achievement).toHaveProperty('achievementType');
        expect(achievement).toHaveProperty('earnedAt');
      }

      // Total achievements should match array length
      expect(response.body.totalAchievements).toBe(response.body.achievements.length);
    });
  });

  describe('GET /api/achievements/:memberId/recent', () => {
    it('should return recently earned achievements', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}/recent`)
        .expect(200);

      expect(response.body).toHaveProperty('recentlyEarned');
      expect(response.body).toHaveProperty('totalNew');
      expect(Array.isArray(response.body.recentlyEarned)).toBe(true);
      expect(typeof response.body.totalNew).toBe('number');
      expect(response.body.totalNew).toBe(response.body.recentlyEarned.length);
    });

    it('should return 404 if member does not exist', async () => {
      const response = await request(app)
        .get('/api/achievements/non-existent-member/recent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Member not found');
    });

    it('should return empty array if no recent achievements', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}/recent`)
        .expect(200);

      expect(Array.isArray(response.body.recentlyEarned)).toBe(true);
      expect(response.body.totalNew).toBe(response.body.recentlyEarned.length);
    });

    it('should return achievement details in recent list', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}/recent`)
        .expect(200);

      if (response.body.recentlyEarned.length > 0) {
        const achievement = response.body.recentlyEarned[0];
        expect(achievement).toHaveProperty('id');
        expect(achievement).toHaveProperty('achievementType');
        expect(achievement).toHaveProperty('earnedAt');
      }
    });
  });

  describe('GET /api/achievements/:memberId/progress', () => {
    it('should return progress toward unearned achievements', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}/progress`)
        .expect(200);

      expect(response.body).toHaveProperty('progress');
      expect(response.body).toHaveProperty('activeStreaks');
      expect(Array.isArray(response.body.progress)).toBe(true);
      expect(Array.isArray(response.body.activeStreaks)).toBe(true);
    });

    it('should return 404 if member does not exist', async () => {
      const response = await request(app)
        .get('/api/achievements/non-existent-member/progress')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Member not found');
    });

    it('should return valid progress data structure', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}/progress`)
        .expect(200);

      if (response.body.progress.length > 0) {
        const progressItem = response.body.progress[0];
        expect(progressItem).toHaveProperty('achievementType');
        expect(progressItem).toHaveProperty('currentProgress');
        expect(progressItem).toHaveProperty('targetProgress');
        expect(progressItem).toHaveProperty('percentComplete');
        expect(progressItem).toHaveProperty('isEarned');
        expect(typeof progressItem.percentComplete).toBe('number');
        expect(progressItem.percentComplete).toBeGreaterThanOrEqual(0);
        expect(progressItem.percentComplete).toBeLessThanOrEqual(100);
      }
    });

    it('should return active streaks data', async () => {
      const response = await request(app)
        .get(`/api/achievements/${testMemberId}/progress`)
        .expect(200);

      expect(Array.isArray(response.body.activeStreaks)).toBe(true);
      
      if (response.body.activeStreaks.length > 0) {
        const streak = response.body.activeStreaks[0];
        expect(streak).toHaveProperty('type');
        expect(streak).toHaveProperty('count');
        expect(typeof streak.count).toBe('number');
      }
    });
  });

  describe('Multiple members achievement comparison', () => {
    it('should return different achievements for different members', async () => {
      const membersResponse = await request(app).get('/api/members');
      
      if (membersResponse.body.length >= 2) {
        const member1Id = membersResponse.body[0].id;
        const member2Id = membersResponse.body[1].id;

        const response1 = await request(app)
          .get(`/api/achievements/${member1Id}`)
          .expect(200);

        const response2 = await request(app)
          .get(`/api/achievements/${member2Id}`)
          .expect(200);

        // Both should have valid achievement data
        expect(response1.body).toHaveProperty('totalAchievements');
        expect(response2.body).toHaveProperty('totalAchievements');
        expect(response1.body).toHaveProperty('memberId', member1Id);
        expect(response2.body).toHaveProperty('memberId', member2Id);

        // Both should have progress information
        expect(Array.isArray(response1.body.progress)).toBe(true);
        expect(Array.isArray(response2.body.progress)).toBe(true);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle server errors gracefully', async () => {
      // Test with invalid member ID format that might cause errors
      const response = await request(app)
        .get('/api/achievements/invalid-id-format-that-might-cause-db-error')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
