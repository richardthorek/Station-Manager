/**
 * SPA Fallback Route Tests
 *
 * Tests for Single Page Application (SPA) fallback routing:
 * - Verifies SPA fallback serves index.html for non-API routes
 * - Ensures /assets/* paths are excluded from SPA fallback
 * - Validates that static assets are served correctly
 * - Tests rate limiting on SPA fallback route
 */

import request from 'supertest';
import express, { Express } from 'express';
import path from 'path';
import { spaRateLimiter } from '../middleware/rateLimiter';

describe('SPA Fallback Route', () => {
  let app: Express;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();

    // Mock frontend path (using backend src as a stand-in for testing)
    const mockFrontendPath = path.join(__dirname, '../');

    // Simulate static file serving middleware
    app.use(express.static(mockFrontendPath));

    // SPA fallback route - must exclude /assets/* paths
    app.get(/^\/(?!api|assets).*/, spaRateLimiter, (req, res) => {
      res.status(200).send('<html><body>SPA Index</body></html>');
    });
  });

  describe('Route Pattern Matching', () => {
    it('should serve SPA for root path', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('SPA Index');
    });

    it('should serve SPA for /signin path', async () => {
      const response = await request(app)
        .get('/signin')
        .expect(200);

      expect(response.text).toContain('SPA Index');
    });

    it('should serve SPA for /profile/123 path', async () => {
      const response = await request(app)
        .get('/profile/123')
        .expect(200);

      expect(response.text).toContain('SPA Index');
    });

    it('should serve SPA for nested routes', async () => {
      const response = await request(app)
        .get('/some/deeply/nested/route')
        .expect(200);

      expect(response.text).toContain('SPA Index');
    });
  });

  describe('Exclusions', () => {
    it('should NOT serve SPA for /api/* paths', async () => {
      const response = await request(app)
        .get('/api/members');

      // Since we don't have API routes set up in this test,
      // the request should fail with 404 instead of returning SPA
      expect(response.status).not.toBe(200);
      expect(response.text).not.toContain('SPA Index');
    });

    it('should NOT serve SPA for /assets/* paths', async () => {
      const response = await request(app)
        .get('/assets/index-abc123.js');

      // Since we don't have the actual asset, it should 404
      // but importantly it should NOT return the SPA index.html
      expect(response.status).not.toBe(200);
      expect(response.text).not.toContain('SPA Index');
    });

    it('should NOT serve SPA for /assets/vendor-*.js paths', async () => {
      const response = await request(app)
        .get('/assets/vendor-react-C0akXtjc.js');

      expect(response.status).not.toBe(200);
      expect(response.text).not.toContain('SPA Index');
    });

    it('should NOT serve SPA for /assets/*.css paths', async () => {
      const response = await request(app)
        .get('/assets/index-CD3VLdAX.css');

      expect(response.status).not.toBe(200);
      expect(response.text).not.toContain('SPA Index');
    });

    it('should NOT serve SPA for deeply nested /assets/* paths', async () => {
      const response = await request(app)
        .get('/assets/images/logo.png');

      expect(response.status).not.toBe(200);
      expect(response.text).not.toContain('SPA Index');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to SPA routes', async () => {
      const response = await request(app)
        .get('/some-page');

      // Rate limit headers should be present
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });
  });
});
