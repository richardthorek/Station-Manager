/**
 * Platform administrator gate.
 *
 * The platform admin is the operator of the whole deployment (not an org
 * owner): they review facility claim conflicts and can reassign claims.
 * Identified by the PLATFORM_ADMIN_USERNAMES env var — a comma-separated,
 * case-insensitive list of usernames (mirrors Fire Santa Run's
 * SITE_ADMIN_USER_IDS approach). Empty/unset means nobody is a platform admin.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

export function isPlatformAdmin(username: string | undefined): boolean {
  if (!username) return false;
  const raw = process.env.PLATFORM_ADMIN_USERNAMES || '';
  const allowlist = raw
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter((u) => u.length > 0);
  return allowlist.includes(username.toLowerCase());
}

/** Requires authMiddleware before it. */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!isPlatformAdmin(req.user.username)) {
    logger.warn('Platform admin access denied', { userId: req.user.userId, username: req.user.username });
    res.status(403).json({ error: 'Platform administrator access required' });
    return;
  }
  next();
}
