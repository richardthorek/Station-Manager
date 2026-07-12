/**
 * Authentication Routes Tests
 *
 * Tests the authentication system including:
 * - Login with valid credentials
 * - Login failures
 * - Admin account initialization
 * - GET /api/auth/entitlements (suite app probe)
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import authRouter from '../routes/auth';
import { getAdminUserDatabase } from '../services/adminUserDatabase';
import { getOrganizationDatabase } from '../services/organizationDatabase';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Mock the factory to use in-memory database for tests
jest.mock('../services/adminUserDbFactory', () => {
  const { getAdminUserDatabase } = require('../services/adminUserDatabase');
  return {
    getAdminDb: () => getAdminUserDatabase(),
    ensureAdminUserDatabase: () => getAdminUserDatabase(),
    initializeAdminUserDatabase: async (username?: string, password?: string) => {
      const db = getAdminUserDatabase();
      await db.initialize(username, password);
    },
  };
});

jest.mock('../services/organizationDbFactory', () => {
  const { getOrganizationDatabase } = require('../services/organizationDatabase');
  return {
    ensureOrganizationDatabase: () => getOrganizationDatabase(),
  };
});

describe('Authentication Routes', () => {
  let app: express.Application;
  let adminDb: ReturnType<typeof getAdminUserDatabase>;

  beforeEach(async () => {
    // Set up Express app with auth routes
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Get admin database instance
    adminDb = getAdminUserDatabase();
    
    // Clear any existing users
    await adminDb.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await adminDb.clear();
  });

  describe('POST /api/auth/login', () => {
    it('should return 401 when no admin accounts exist', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test123' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid username or password');
    });

    it('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'test123' })
        .expect(400);

      expect(response.body.error).toBe('Username and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' })
        .expect(400);

      expect(response.body.error).toBe('Username and password are required');
    });

    it('should return 401 for invalid credentials', async () => {
      // Create an admin user
      await adminDb.createAdminUser('admin', 'correctPassword', 'admin');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongPassword' })
        .expect(401);

      expect(response.body.error).toBe('Invalid username or password');
    });

    it('should return token and user info for valid credentials', async () => {
      // Create an admin user
      await adminDb.createAdminUser('admin', 'testPassword123', 'admin');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'testPassword123' })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('username', 'admin');
      expect(response.body.user).toHaveProperty('role', 'admin');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should include hint in development mode when no accounts exist', async () => {
      // Set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test123' })
        .expect(401);

      expect(response.body).toHaveProperty('hint');
      expect(response.body.hint).toContain('DEFAULT_ADMIN_PASSWORD');

      // Restore original NODE_ENV
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });
  });

  describe('GET /api/auth/config', () => {
    it('should return authentication configuration', async () => {
      const response = await request(app)
        .get('/api/auth/config')
        .expect(200);

      expect(response.body).toHaveProperty('requireAuth');
      expect(typeof response.body.requireAuth).toBe('boolean');
    });

    it('should reflect REQUIRE_AUTH environment variable', async () => {
      const originalValue = process.env.REQUIRE_AUTH;
      
      // Test with REQUIRE_AUTH=true
      process.env.REQUIRE_AUTH = 'true';
      let response = await request(app)
        .get('/api/auth/config')
        .expect(200);
      expect(response.body.requireAuth).toBe(true);

      // Test with REQUIRE_AUTH=false
      process.env.REQUIRE_AUTH = 'false';
      response = await request(app)
        .get('/api/auth/config')
        .expect(200);
      expect(response.body.requireAuth).toBe(false);

      // Restore original value
      if (originalValue !== undefined) {
        process.env.REQUIRE_AUTH = originalValue;
      } else {
        delete process.env.REQUIRE_AUTH;
      }
    });
  });

  describe('Admin Database Initialization', () => {
    it('should initialize with default credentials', async () => {
      await adminDb.initialize('admin', 'testPassword123');

      const users = await adminDb.getAllUsers();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe('admin');
      expect(users[0].role).toBe('admin');
    });

    it('should not initialize when credentials are missing', async () => {
      await adminDb.initialize();

      const users = await adminDb.getAllUsers();
      expect(users).toHaveLength(0);
    });

    it('should not create duplicate users on multiple initializations', async () => {
      await adminDb.initialize('admin', 'testPassword123');
      await adminDb.initialize('admin', 'testPassword123');

      const users = await adminDb.getAllUsers();
      expect(users).toHaveLength(1);
    });
  });

  describe('GET /api/auth/entitlements', () => {
    const orgDb = getOrganizationDatabase();

    beforeEach(async () => {
      await orgDb.clear();
    });

    afterEach(async () => {
      await orgDb.clear();
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/auth/entitlements');
      expect(res.status).toBe(401);
    });

    it('returns null entitlements for a user with no org', async () => {
      const token = jwt.sign({ userId: 'u1', username: 'u1', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/auth/entitlements')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.entitlements).toBeNull();
      expect(res.body.planCode).toBeNull();
    });

    it('returns entitlements for a community-plan org', async () => {
      const org = await orgDb.createOrganization({ name: 'Test Org', billingEmail: 'x@x.com', planCode: 'community' });
      const token = jwt.sign({ userId: 'u2', username: 'u2', role: 'owner', organizationId: org.id }, JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/auth/entitlements')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.planCode).toBe('community');
      expect(res.body.entitlements.signInEnabled).toBe(true);
      expect(res.body.entitlements.aarStudioEnabled).toBe(false);
      expect(res.body.entitlements.fireBreakEnabled).toBe(false);
    });

    it('returns fireBreakEnabled=true for Basic-plan org', async () => {
      const org = await orgDb.createOrganization({ name: 'Basic Org', billingEmail: 'b@x.com', planCode: 'basic' });
      const token = jwt.sign({ userId: 'u4', username: 'u4', role: 'owner', organizationId: org.id }, JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/auth/entitlements')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.planCode).toBe('basic');
      expect(res.body.entitlements.fireBreakEnabled).toBe(true);
    });

    it('returns aarStudioEnabled=true for AI-plan org', async () => {
      const org = await orgDb.createOrganization({ name: 'AI Org', billingEmail: 'ai@x.com', planCode: 'ai' });
      const token = jwt.sign({ userId: 'u3', username: 'u3', role: 'owner', organizationId: org.id }, JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/auth/entitlements')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.planCode).toBe('ai');
      expect(res.body.entitlements.aarStudioEnabled).toBe(true);
      expect(res.body.entitlements.aiEnabled).toBe(true);
      expect(res.body.entitlements.fireBreakEnabled).toBe(true);
      expect(res.body.status).toBeDefined();
    });
  });
});
