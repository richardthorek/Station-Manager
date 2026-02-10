/**
 * Authentication Routes Tests
 * 
 * Tests the authentication system including:
 * - Login with valid credentials
 * - Login failures
 * - Admin account initialization
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';
import { getAdminUserDatabase } from '../services/adminUserDatabase';

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
      process.env.NODE_ENV = originalEnv;
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
});
