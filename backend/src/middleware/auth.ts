/**
 * JWT Authentication Middleware
 * 
 * Provides middleware functions for JWT token verification and authorization.
 * 
 * Features:
 * - Token verification from Authorization header
 * - User information extraction from token
 * - Role-based access control
 * - Optional authentication (respects REQUIRE_AUTH env var)
 * 
 * Usage:
 * ```
 * import { authMiddleware, optionalAuth } from './middleware/auth';
 * 
 * // Require authentication for this route
 * router.delete('/api/stations/:id', authMiddleware, handler);
 * 
 * // Optional authentication (only when REQUIRE_AUTH=true)
 * router.delete('/api/stations/:id', optionalAuth, handler);
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../services/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role: 'admin' | 'viewer';
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify JWT token and attach user to request
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      username: string;
      role: 'admin' | 'viewer';
    };

    // Attach user to request
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired token', { error });
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', { error });
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    logger.error('Authentication error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Optional authentication middleware
 * Only requires authentication if REQUIRE_AUTH=true
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const requireAuth = process.env.REQUIRE_AUTH === 'true';

  if (!requireAuth) {
    // Auth is disabled, skip authentication
    next();
    return;
  }

  // Auth is enabled, use standard auth middleware
  authMiddleware(req, res, next);
}

/**
 * Require admin role
 * Must be used after authMiddleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    logger.warn('Access denied - insufficient permissions', { 
      userId: req.user.userId,
      role: req.user.role,
    });
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }

  next();
}

/**
 * Optional admin middleware
 * Only requires admin role if REQUIRE_AUTH=true
 */
export function optionalAdmin(req: Request, res: Response, next: NextFunction): void {
  const requireAuth = process.env.REQUIRE_AUTH === 'true';

  if (!requireAuth) {
    // Auth is disabled, skip authorization
    next();
    return;
  }

  // Auth is enabled, require admin role
  if (!req.user) {
    authMiddleware(req, res, next);
    return;
  }

  requireAdmin(req, res, next);
}
