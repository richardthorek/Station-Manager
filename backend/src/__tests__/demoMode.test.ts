/**
 * Demo Mode Tests
 * 
 * Tests for demo mode functionality:
 * - Demo mode middleware detection
 * - Demo mode API endpoints
 * - Per-device database selection
 */

import request from 'supertest';
import express, { Express } from 'express';
import demoRouter from '../routes/demo';
import membersRouter from '../routes/members';
import { demoModeMiddleware } from '../middleware/demoModeMiddleware';

let app: Express;

beforeAll(() => {
  // Set up Express app with demo mode middleware
  app = express();
  app.use(express.json());
  app.use(demoModeMiddleware);
  
  // Set up routes
  app.use('/api/demo', demoRouter);
  app.use('/api/members', membersRouter);
});

describe('Demo Mode API', () => {
  describe('GET /api/demo/status', () => {
    it('should return demo mode status without query parameter', async () => {
      const response = await request(app)
        .get('/api/demo/status')
        .expect(200);

      expect(response.body).toHaveProperty('isDemo', false);
      expect(response.body).toHaveProperty('demoAvailable');
      expect(response.body).toHaveProperty('perDeviceMode', true);
      expect(response.body).toHaveProperty('instructions');
    });

    it('should return demo mode active when query parameter is present', async () => {
      const response = await request(app)
        .get('/api/demo/status?demo=true')
        .expect(200);

      expect(response.body).toHaveProperty('isDemo', true);
      expect(response.body).toHaveProperty('perDeviceMode', true);
      expect(response.body.instructions).toContain('active');
    });

    it('should handle demo=1 as valid activation', async () => {
      const response = await request(app)
        .get('/api/demo/status?demo=1')
        .expect(200);

      expect(response.body.isDemo).toBe(true);
    });

    it('should not activate demo mode with invalid values', async () => {
      const response = await request(app)
        .get('/api/demo/status?demo=false')
        .expect(200);

      expect(response.body.isDemo).toBe(false);
    });
  });

  describe('GET /api/demo/info', () => {
    it('should return demo mode information', async () => {
      const response = await request(app)
        .get('/api/demo/info')
        .expect(200);

      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('features');
      expect(response.body).toHaveProperty('testData');
      expect(response.body).toHaveProperty('usage');
      
      // Verify test data info
      expect(response.body.testData.members).toBe(20);
      expect(response.body.testData.activities).toBe(5);
      expect(response.body.testData.appliances).toBe(3);
      
      // Verify features list
      expect(Array.isArray(response.body.features)).toBe(true);
      expect(response.body.features.length).toBeGreaterThan(0);
      
      // Verify usage instructions
      expect(response.body.usage).toHaveProperty('activate');
      expect(response.body.usage).toHaveProperty('deactivate');
      expect(response.body.usage.activate).toContain('?demo=true');
    });
  });
});

describe('Demo Mode Middleware', () => {
  it('should set isDemoMode flag when query parameter is present', async () => {
    const response = await request(app)
      .get('/api/members?demo=true')
      .expect(200);

    // Members should be returned (verifies middleware doesn't break requests)
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should not set isDemoMode flag without query parameter', async () => {
    const response = await request(app)
      .get('/api/members')
      .expect(200);

    // Members should be returned normally
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should handle demo mode parameter in POST requests', async () => {
    const response = await request(app)
      .post('/api/members?demo=true')
      .send({ name: 'Demo Test Member' })
      .expect(201);

    // Member should be created
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name', 'Demo Test Member');
  });
});

describe('Demo Mode Configuration', () => {
  it('should respect DEMO_MODE_ENABLED environment variable', async () => {
    // Save original value
    const originalValue = process.env.DEMO_MODE_ENABLED;
    
    // Test with demo mode enabled (default)
    delete process.env.DEMO_MODE_ENABLED;
    let response = await request(app)
      .get('/api/demo/status')
      .expect(200);
    expect(response.body.demoAvailable).toBe(true);
    
    // Test with demo mode explicitly disabled
    process.env.DEMO_MODE_ENABLED = 'false';
    response = await request(app)
      .get('/api/demo/status')
      .expect(200);
    expect(response.body.demoAvailable).toBe(false);
    
    // Restore original value
    if (originalValue !== undefined) {
      process.env.DEMO_MODE_ENABLED = originalValue;
    } else {
      delete process.env.DEMO_MODE_ENABLED;
    }
  });
});
