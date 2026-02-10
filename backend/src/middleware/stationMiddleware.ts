/**
 * Station Middleware
 * 
 * Extracts stationId from HTTP headers or query parameters and attaches it to the request.
 * This middleware enables multi-station filtering across all API routes.
 * 
 * Station ID Resolution Priority:
 * 1. X-Station-Id header (primary method)
 * 2. stationId query parameter (fallback for GET requests)
 * 3. DEFAULT_STATION_ID constant (backward compatibility)
 * 
 * Usage:
 * - Apply to routes that need station filtering
 * - Access via req.stationId in route handlers
 * - Use with database methods that accept stationId parameter
 */

import { Request, Response, NextFunction } from 'express';
import { getEffectiveStationId } from '../constants/stations';

// Extend Express Request type to include stationId and demo flag
declare global {
  namespace Express {
    interface Request {
      stationId?: string;
      isDemoMode?: boolean;
    }
  }
}

/**
 * Middleware to extract and attach stationId to request
 * 
 * Checks for stationId in the following order:
 * 1. X-Station-Id HTTP header
 * 2. stationId query parameter
 * 3. Falls back to DEFAULT_STATION_ID if neither is present
 * 
 * The extracted stationId is attached to req.stationId for use in route handlers.
 * 
 * @param req - Express request object
 * @param res - Express response object (unused)
 * @param next - Express next function
 * 
 * @example
 * // In route file:
 * router.get('/', stationMiddleware, async (req, res) => {
 *   const db = await ensureDatabase();
 *   const members = await db.getAllMembers(req.stationId);
 *   res.json(members);
 * });
 */
export function stationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check X-Station-Id header first (primary method)
  const headerStationId = req.headers['x-station-id'] as string | undefined;
  
  // Check stationId query parameter as fallback (useful for GET requests)
  const queryStationId = req.query.stationId as string | undefined;
  
  // Priority: header > query
  const rawStationId = headerStationId || queryStationId;
  
  req.stationId = rawStationId;
  req.isDemoMode = !rawStationId;
  
  next();
}

/**
 * Get station ID from request (helper function for routes)
 * 
 * This is a convenience function that can be used in route handlers
 * to safely get the stationId, even if the middleware wasn't applied.
 * 
 * @param req - Express request object
 * @returns The station ID from the request, or DEFAULT_STATION_ID if not set
 * 
 * @example
 * const stationId = getStationIdFromRequest(req);
 * const members = await db.getAllMembers(stationId);
 */
export function getStationIdFromRequest(req: Request): string {
  return getEffectiveStationId(req.stationId);
}
