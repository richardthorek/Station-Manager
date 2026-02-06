/**
 * Security Headers Tests
 * 
 * Tests for helmet security middleware:
 * - Verifies all security headers are present
 * - Validates Content-Security-Policy (CSP) configuration
 * - Checks X-Frame-Options for clickjacking protection
 * - Validates X-Content-Type-Options
 * - Checks Referrer-Policy
 * - Validates Permissions-Policy
 * - Ensures headers work with Socket.io and static content
 */

import request from 'supertest';
import express, { Express } from 'express';
import helmet from 'helmet';

let app: Express;

beforeAll(() => {
  // Set up Express app with helmet middleware (matching production config)
  app = express();
  
  // Apply helmet with same configuration as in index.ts
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow self-hosted scripts only (Clarity moved to external file)
        scriptSrc: ["'self'"],
        // Allow inline styles for React and Google Fonts stylesheet
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for React inline styles
          "https://fonts.googleapis.com", // Google Fonts CSS
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "ws:", "wss:", // WebSocket connections for Socket.io
          "https://www.clarity.ms", // Microsoft Clarity analytics endpoint
        ],
        // Allow self-hosted fonts, data URIs, and Google Fonts
        fontSrc: [
          "'self'",
          "data:",
          "https://fonts.gstatic.com", // Google Fonts files
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    xFrameOptions: {
      action: 'deny'
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
  }));

  // Add Permissions-Policy header manually
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    next();
  });

  app.use(express.json());

  // Test routes
  app.get('/api/test', (req, res) => {
    res.json({ message: 'OK' });
  });

  app.get('/test.html', (req, res) => {
    res.type('html').send('<html><body>Test</body></html>');
  });
});

describe('Security Headers - Helmet Middleware', () => {
  describe('Content-Security-Policy (CSP)', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should restrict default-src to self', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
    });

    it('should restrict script-src to self', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self'");
    });

    it('should allow inline styles for React', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
    });

    it('should allow Google Fonts stylesheet', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    });

    it('should allow Google Fonts files', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
    });

    it('should allow WebSocket connections for Socket.io', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/connect-src[^;]*(ws:|wss:)/);
    });

    it('should allow Microsoft Clarity analytics endpoint', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/connect-src[^;]*https:\/\/www\.clarity\.ms/);
    });

    it('should allow data URIs and external images', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/img-src[^;]*data:/);
      expect(csp).toMatch(/img-src[^;]*blob:/);
      expect(csp).toMatch(/img-src[^;]*https:/);
    });

    it('should block object embeds', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("object-src 'none'");
    });

    it('should block iframe embedding', async () => {
      const response = await request(app)
        .get('/api/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("frame-src 'none'");
    });
  });

  describe('X-Frame-Options', () => {
    it('should include X-Frame-Options header', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should set X-Frame-Options to DENY to prevent clickjacking', async () => {
      const response = await request(app)
        .get('/api/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should apply X-Frame-Options to HTML pages', async () => {
      const response = await request(app)
        .get('/test.html');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app)
        .get('/api/test');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should apply to all content types', async () => {
      const jsonResponse = await request(app).get('/api/test');
      const htmlResponse = await request(app).get('/test.html');

      expect(jsonResponse.headers['x-content-type-options']).toBe('nosniff');
      expect(htmlResponse.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Referrer-Policy', () => {
    it('should include Referrer-Policy header', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', async () => {
      const response = await request(app)
        .get('/api/test');

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Permissions-Policy', () => {
    it('should include Permissions-Policy header', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['permissions-policy']).toBeDefined();
    });

    it('should restrict camera access', async () => {
      const response = await request(app)
        .get('/api/test');

      const policy = response.headers['permissions-policy'];
      expect(policy).toContain('camera=()');
    });

    it('should restrict microphone access', async () => {
      const response = await request(app)
        .get('/api/test');

      const policy = response.headers['permissions-policy'];
      expect(policy).toContain('microphone=()');
    });

    it('should restrict geolocation access', async () => {
      const response = await request(app)
        .get('/api/test');

      const policy = response.headers['permissions-policy'];
      expect(policy).toContain('geolocation=()');
    });

    it('should restrict payment access', async () => {
      const response = await request(app)
        .get('/api/test');

      const policy = response.headers['permissions-policy'];
      expect(policy).toContain('payment=()');
    });
  });

  describe('Security Headers Coverage', () => {
    it('should apply all security headers to API endpoints', async () => {
      const response = await request(app)
        .get('/api/test');

      // Verify all critical security headers are present
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
    });

    it('should apply all security headers to static HTML pages', async () => {
      const response = await request(app)
        .get('/test.html');

      // Verify all critical security headers are present
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
    });
  });

  describe('Response Functionality', () => {
    it('should not break JSON responses', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toEqual({ message: 'OK' });
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should not break HTML responses', async () => {
      const response = await request(app)
        .get('/test.html')
        .expect(200);

      expect(response.text).toContain('<html>');
      expect(response.text).toContain('Test');
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose X-Powered-By header', async () => {
      const response = await request(app)
        .get('/api/test');

      // Helmet should hide the X-Powered-By header by default
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should set multiple security headers in a single response', async () => {
      const response = await request(app)
        .get('/api/test');

      // Count critical security headers
      const securityHeaders = [
        response.headers['content-security-policy'],
        response.headers['x-frame-options'],
        response.headers['x-content-type-options'],
        response.headers['referrer-policy'],
        response.headers['permissions-policy'],
      ].filter(header => header !== undefined);

      // All 5 critical headers should be present
      expect(securityHeaders.length).toBe(5);
    });
  });
});
