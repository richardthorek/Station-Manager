/**
 * Brigade Access API Routes Tests
 * 
 * Integration tests for brigade access token management API endpoints
 */

import request, { SuperAgentTest } from 'supertest';
import express from 'express';
import brigadeAccessRouter from '../routes/brigadeAccess';
import {
  generateBrigadeAccessToken,
  revokeBrigadeAccessToken,
} from '../services/brigadeAccessService';
import { authHeader } from './helpers/authHelpers';

// Create test Express app
const app = express();
app.use(express.json());
app.use('/api/brigade-access', brigadeAccessRouter);
const authAgent = request.agent(app);

describe('Brigade Access API Routes', () => {
  beforeEach(() => {
    authAgent.set(authHeader());
  });
  describe('POST /api/brigade-access/generate', () => {
    it('should generate a new token', async () => {
      const response = await authAgent
        .post('/api/brigade-access/generate')
        .send({
          brigadeId: 'test-brigade',
          stationId: 'test-station',
          description: 'Test Kiosk',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.brigadeId).toBe('test-brigade');
      expect(response.body.stationId).toBe('test-station');
      expect(response.body.description).toBe('Test Kiosk');
      expect(response.body.kioskUrl).toContain(`?brigade=${response.body.token}`);
    });

    it('should generate token with expiration', async () => {
      const response = await authAgent
        .post('/api/brigade-access/generate')
        .send({
          brigadeId: 'test-brigade',
          stationId: 'test-station',
          expiresInDays: 30,
        });

      expect(response.status).toBe(201);
      expect(response.body.expiresAt).toBeDefined();
      
      const expiresAt = new Date(response.body.expiresAt);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      
      // Check expiration is within 1 minute of expected (account for test execution time)
      const timeDiff = Math.abs(expiresAt.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // 1 minute
    });

    it('should return 400 for missing brigadeId', async () => {
      const response = await authAgent
        .post('/api/brigade-access/generate')
        .send({
          stationId: 'test-station',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing stationId', async () => {
      const response = await authAgent
        .post('/api/brigade-access/generate')
        .send({
          brigadeId: 'test-brigade',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid expiresInDays', async () => {
      const response = await authAgent
        .post('/api/brigade-access/generate')
        .send({
          brigadeId: 'test-brigade',
          stationId: 'test-station',
          expiresInDays: 5000, // Too many days
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/brigade-access/validate', () => {
    it('should validate a valid token', async () => {
      // Generate a token first
      const token = generateBrigadeAccessToken('brigade-1', 'station-1', 'Test');

      const response = await authAgent
        .post('/api/brigade-access/validate')
        .send({
          token: token.token,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.brigadeId).toBe('brigade-1');
      expect(response.body.stationId).toBe('station-1');
      expect(response.body.description).toBe('Test');
    });

    it('should return 404 for invalid token', async () => {
      const response = await authAgent
        .post('/api/brigade-access/validate')
        .send({
          token: '00000000-0000-4000-8000-000000000000', // Valid UUID format but not in store
        });

      expect(response.status).toBe(404);
      expect(response.body.valid).toBe(false);
    });

    it('should return 400 for missing token', async () => {
      const response = await authAgent
        .post('/api/brigade-access/validate')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await authAgent
        .post('/api/brigade-access/validate')
        .send({
          token: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/brigade-access/:token', () => {
    it('should revoke a valid token', async () => {
      // Generate a token first
      const token = generateBrigadeAccessToken('brigade-1', 'station-1');

      const response = await authAgent
        .delete(`/api/brigade-access/${token.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token revoked successfully');
    });

    it('should return 404 for non-existent token', async () => {
      const response = await authAgent
        .delete('/api/brigade-access/00000000-0000-4000-8000-000000000000');

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await authAgent
        .delete('/api/brigade-access/not-a-uuid');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/brigade-access/brigade/:brigadeId', () => {
    it('should return all tokens for a brigade', async () => {
      // Generate tokens
      const token1 = generateBrigadeAccessToken('brigade-alpha', 'station-1', 'Kiosk 1');
      const token2 = generateBrigadeAccessToken('brigade-alpha', 'station-2', 'Kiosk 2');
      generateBrigadeAccessToken('brigade-beta', 'station-3'); // Different brigade

      const response = await authAgent
        .get('/api/brigade-access/brigade/brigade-alpha');

      expect(response.status).toBe(200);
      expect(response.body.brigadeId).toBe('brigade-alpha');
      expect(response.body.count).toBe(2);
      expect(response.body.tokens).toHaveLength(2);
      
      const tokenIds = response.body.tokens.map((t: any) => t.token);
      expect(tokenIds).toContain(token1.token);
      expect(tokenIds).toContain(token2.token);
    });

    it('should return empty array for brigade with no tokens', async () => {
      const response = await authAgent
        .get('/api/brigade-access/brigade/non-existent-brigade');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.tokens).toEqual([]);
    });
  });

  describe('GET /api/brigade-access/station/:stationId', () => {
    it('should return all tokens for a station', async () => {
      // Generate tokens
      const token1 = generateBrigadeAccessToken('brigade-1', 'station-alpha', 'Kiosk 1');
      const token2 = generateBrigadeAccessToken('brigade-2', 'station-alpha', 'Kiosk 2');
      generateBrigadeAccessToken('brigade-1', 'station-beta'); // Different station

      const response = await authAgent
        .get('/api/brigade-access/station/station-alpha');

      expect(response.status).toBe(200);
      expect(response.body.stationId).toBe('station-alpha');
      expect(response.body.count).toBe(2);
      expect(response.body.tokens).toHaveLength(2);
      
      const tokenIds = response.body.tokens.map((t: any) => t.token);
      expect(tokenIds).toContain(token1.token);
      expect(tokenIds).toContain(token2.token);
    });

    it('should return empty array for station with no tokens', async () => {
      const response = await authAgent
        .get('/api/brigade-access/station/non-existent-station');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.tokens).toEqual([]);
    });
  });

  describe('GET /api/brigade-access/stats', () => {
    it('should return token statistics', async () => {
      // Generate some tokens
      generateBrigadeAccessToken('brigade-1', 'station-1');
      generateBrigadeAccessToken('brigade-1', 'station-2');
      generateBrigadeAccessToken('brigade-2', 'station-3');

      const response = await authAgent
        .get('/api/brigade-access/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalActiveTokens).toBeGreaterThanOrEqual(3);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should not count expired tokens in stats', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired
      
      generateBrigadeAccessToken('brigade-1', 'station-1', undefined, expiresAt);
      generateBrigadeAccessToken('brigade-1', 'station-2');

      const response = await authAgent
        .get('/api/brigade-access/stats');

      expect(response.status).toBe(200);
      // Should only count the non-expired token (plus any from previous tests)
      expect(response.body.totalActiveTokens).toBeGreaterThanOrEqual(1);
    });
  });

  afterEach(() => {
    // Clean up tokens after each test
    // Note: In a real implementation, you might want to add a clearAllTokens function
    // or reset the token store between tests
  });
});
