/**
 * Flexible Authorization Middleware
 * 
 * Provides data endpoint protection with support for multiple credential types:
 * 1. Admin JWT (full access across all stations/brigades)
 * 2. Brigade Access Token (brigade-scoped access)
 * 3. Station API Key (station-scoped access) - future enhancement
 * 
 * Features:
 * - Graceful degradation with warnings for unauthenticated requests
 * - Scoped access validation (brigade/station level)
 * - Logging of unauthorized access attempts
 * - Backward compatible mode
 * 
 * Usage:
 * ```
 * router.get('/', flexibleAuth({ scope: 'station' }), handler);
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { resolveKioskAccess } from '../services/kioskAccessResolver';
import { logger } from '../services/logger';
import { DEMO_STATION_ID } from '../constants/stations';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ENABLE_DATA_PROTECTION = process.env.ENABLE_DATA_PROTECTION === 'true';

/**
 * Authorization result with credential type and access scope
 */
interface AuthResult {
  authenticated: boolean;
  credentialType: 'jwt' | 'brigade-token' | 'member-session' | 'none';
  userId?: string;
  username?: string;
  role?: 'admin' | 'viewer';
  brigadeId?: string;
  stationId?: string;
}

/** Claims minted into a member-session token — see routes/checkins.ts's /url-checkin. */
interface MemberSessionClaims {
  memberId: string;
  brigadeId?: string;
  stationId: string;
  credentialType: 'member-session';
}

/**
 * Authorization options
 */
interface FlexibleAuthOptions {
  scope?: 'global' | 'brigade' | 'station';  // Access scope required
  requireAuth?: boolean;  // Force authentication (override env var)
  logUnauthorized?: boolean;  // Log unauthorized attempts
}

/**
 * Extract and validate JWT token from Authorization header
 */
function validateJWT(req: Request): AuthResult | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      username: string;
      role: 'admin' | 'viewer';
    };

    return {
      authenticated: true,
      credentialType: 'jwt',
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
  } catch (error) {
    // Token validation failed
    return null;
  }
}

/**
 * Extract and validate Brigade Access Token from headers or query
 */
async function validateBrigadeToken(req: Request): Promise<AuthResult | null> {
  try {
    // Check X-Brigade-Token header first, then query param
    const token = req.headers['x-brigade-token'] as string || req.query.brigadeToken as string;
    
    if (!token) {
      return null;
    }

    const resolved = await resolveKioskAccess(token);

    if (!resolved) {
      return null;
    }

    return {
      authenticated: true,
      credentialType: 'brigade-token',
      brigadeId: resolved.brigadeId,
      stationId: resolved.stationId,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Extract and validate a member-session token (AC-1) from the X-Member-Session
 * header. Minted by POST /api/checkins/url-checkin when a member checks in via
 * their personal link, so the same visitor can then read that station's live
 * book (grid, active event) without a full admin/kiosk credential. Station-wide
 * read scope, same as a brigade/kiosk token — never elevates beyond that.
 */
function validateMemberSession(req: Request): AuthResult | null {
  try {
    const token = req.headers['x-member-session'] as string | undefined;
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as MemberSessionClaims;
    if (decoded.credentialType !== 'member-session' || !decoded.stationId) {
      return null;
    }

    return {
      authenticated: true,
      credentialType: 'member-session',
      userId: decoded.memberId,
      brigadeId: decoded.brigadeId,
      stationId: decoded.stationId,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Validate that the request has access to the requested resource
 * based on the authentication scope
 */
function resolveRequestedStationId(req: Request): string | undefined {
  return (req.stationId as string | undefined)
    || (req.headers['x-station-id'] as string | undefined)
    || (req.query.stationId as string | undefined);
}

function validateScope(authResult: AuthResult, req: Request, scope: string): boolean {
  // JWT with admin role has full access
  if (authResult.credentialType === 'jwt' && authResult.role === 'admin') {
    return true;
  }

  // Brigade token and member-session both grant station-wide read access
  // (member-session never elevates beyond that — see validateMemberSession).
  if (authResult.credentialType === 'brigade-token' || authResult.credentialType === 'member-session') {
    // Check if requested resource matches token's brigade/station
    const requestedStationId = resolveRequestedStationId(req);
    const requestedBrigadeId = req.query.brigadeId as string;

    if (scope === 'brigade' && requestedBrigadeId) {
      return authResult.brigadeId === requestedBrigadeId;
    }

    if (scope === 'station' && requestedStationId) {
      return authResult.stationId === requestedStationId;
    }

    // If no specific station requested, do not allow station-scoped access
    if (scope === 'station') {
      return false;
    }

    // If no specific resource requested for brigade scope, allow access
    return true;
  }

  return false;
}

/**
 * Flexible authorization middleware
 * 
 * Supports multiple credential types with graceful degradation
 */
export function flexibleAuth(options: FlexibleAuthOptions = {}) {
  const {
    scope = 'station',
    requireAuth = ENABLE_DATA_PROTECTION,
    logUnauthorized = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // If protection is disabled and not explicitly required, allow access
    if (!requireAuth) {
      next();
      return;
    }

    // Demo station is always publicly accessible (for demo/testing purposes)
    const requestedStationId = resolveRequestedStationId(req);
    if (requestedStationId === DEMO_STATION_ID) {
      logger.debug('Demo station access - bypassing authentication', {
        path: req.path,
        method: req.method,
      });
      next();
      return;
    }

    // Try JWT authentication first
    let authResult = validateJWT(req);

    // If JWT failed, try brigade token
    if (!authResult) {
      authResult = await validateBrigadeToken(req);
    }

    // If brigade token failed too, try a member-session token (AC-1)
    if (!authResult) {
      authResult = validateMemberSession(req);
    }

    // No valid credentials found
    if (!authResult) {
      if (logUnauthorized) {
        logger.warn('Unauthorized API access attempt', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires authentication. Please provide a valid JWT token or Brigade Access Token.',
      });
      return;
    }

    // If brigade token/member-session provides stationId and none is provided, lock request to that station
    if ((authResult.credentialType === 'brigade-token' || authResult.credentialType === 'member-session') && authResult.stationId) {
      if (!resolveRequestedStationId(req)) {
        req.stationId = authResult.stationId;
        req.isDemoMode = false;
      }
    }

    // Validate scope access
    if (!validateScope(authResult, req, scope)) {
      logger.warn('Insufficient scope for API access', {
        path: req.path,
        credentialType: authResult.credentialType,
        requestedScope: scope,
        brigadeId: authResult.brigadeId,
        stationId: authResult.stationId,
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Access to this resource requires ${scope} scope.`,
      });
      return;
    }

    // Store auth result in request for downstream use
    req.auth = authResult;

    next();
  };
}

/**
 * Require an authenticated session to READ data — always on (not gated by
 * ENABLE_DATA_PROTECTION, unlike flexibleAuth above).
 *
 * Closes the anonymous data-exposure hole found in UAT (2026-06-22): the
 * reports, members and truck-check appliance read endpoints returned real
 * organisational data and member PII to fully credential-less requests.
 *
 * A request is allowed through when ANY of these holds:
 *   1. It targets the public demo station (kept intentionally open — see
 *      CLAUDE.md "demo station auth is intentionally bypassed").
 *   2. It carries a valid admin JWT — ANY role (owner/admin/viewer). The old
 *      flexibleAuth scope check only accepted role==='admin', which would have
 *      403'd owners; reads only need a valid session, not a specific role.
 *   3. It carries a valid brigade/kiosk access token (station-scoped). Kiosks
 *      forward this as the X-Brigade-Token header (see frontend api.ts).
 *   4. It carries a valid member-session token (AC-1, station-scoped) — minted
 *      by POST /api/checkins/url-checkin when a member checks in via their
 *      personal link, forwarded as X-Member-Session (see frontend api.ts).
 *
 * Otherwise it is rejected with 401. Mounted in index.ts on the read routers;
 * write-path kiosk actions (check-ins, truck-check results) are deliberately
 * left on their existing pass-through behaviour.
 */
export function requireSession(options: { readsOnly?: boolean } = {}) {
  const { readsOnly = false } = options;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // When readsOnly, only gate safe (read) methods — write-path kiosk actions
    // (e.g. truck-check results, member self-add) keep their pass-through.
    if (readsOnly && req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    // 1. Public demo station stays open.
    if (resolveRequestedStationId(req) === DEMO_STATION_ID) {
      next();
      return;
    }

    // 2. Valid admin JWT (any role).
    const jwtResult = validateJWT(req);
    if (jwtResult) {
      req.auth = jwtResult;
      next();
      return;
    }

    // 3. Valid brigade/kiosk token (station-scoped).
    const brigadeResult = await validateBrigadeToken(req);
    if (brigadeResult) {
      // Lock the request to the token's station when none was explicitly asked for.
      if (brigadeResult.stationId && !resolveRequestedStationId(req)) {
        req.stationId = brigadeResult.stationId;
        req.isDemoMode = false;
      }
      req.auth = brigadeResult;
      next();
      return;
    }

    // 4. Valid member-session token (AC-1 — station-scoped, minted on personal-link check-in).
    const memberSessionResult = validateMemberSession(req);
    if (memberSessionResult) {
      if (memberSessionResult.stationId && !resolveRequestedStationId(req)) {
        req.stationId = memberSessionResult.stationId;
        req.isDemoMode = false;
      }
      req.auth = memberSessionResult;
      next();
      return;
    }

    logger.warn('Anonymous read blocked — authentication required', {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      error: 'Authentication required',
      message: 'This data requires a signed-in session or a valid kiosk access token.',
    });
  };
}

/**
 * Extend Express Request to include auth result
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthResult;
    }
  }
}
