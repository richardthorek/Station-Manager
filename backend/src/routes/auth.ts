/**
 * Authentication Routes
 * 
 * Handles JWT-based authentication for admin operations:
 * - POST /api/auth/login - Authenticate and get JWT token
 * - POST /api/auth/logout - Invalidate token (client-side)
 * - GET /api/auth/me - Get current user info
 * 
 * Features:
 * - JWT tokens with configurable expiration
 * - Password validation with bcrypt
 * - Optional authentication via REQUIRE_AUTH env var
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getAdminUserDatabase } from '../services/adminUserDatabase';
import { logger } from '../services/logger';

const router = Router();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const adminDb = getAdminUserDatabase();
    const user = await adminDb.verifyCredentials(username, password);

    if (!user) {
      logger.warn('Failed login attempt', { username, ip: req.ip });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    );

    logger.info('User logged in', { username: user.username, userId: user.id });

    // Return token and user info (without password hash)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    logger.error('Error during login', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side logout (token invalidation happens on client)
 */
router.post('/logout', (req: Request, res: Response) => {
  // With JWT, logout is primarily client-side (remove token from storage)
  // We can log the event for audit purposes
  logger.info('User logged out', { userId: req.user?.userId });
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Requires authentication middleware
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const adminDb = getAdminUserDatabase();
    const user = await adminDb.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user info (without password hash)
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    logger.error('Error fetching user info', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/config
 * Get authentication configuration (whether auth is required)
 */
router.get('/config', (req: Request, res: Response) => {
  const requireAuth = process.env.REQUIRE_AUTH === 'true';
  res.json({ requireAuth });
});

export default router;