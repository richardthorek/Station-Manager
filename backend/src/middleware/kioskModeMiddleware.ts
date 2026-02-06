/**
 * Kiosk Mode Middleware
 * 
 * Detects and enforces kiosk mode for brigade-locked devices.
 * 
 * Kiosk mode is activated when:
 * - URL contains ?brigade=<token> query parameter
 * - Token is valid and maps to a brigade/station
 * 
 * When in kiosk mode:
 * - Station selection is locked to the token's station
 * - Users cannot switch stations
 * - Station is automatically set from token
 * 
 * Usage:
 * - Apply before stationMiddleware in route stack
 * - Sets req.kioskMode and req.stationId
 */

import { Request, Response, NextFunction } from 'express';
import { validateBrigadeAccessToken } from '../services/brigadeAccessService';

// Extend Express Request type to include kiosk mode flag
declare global {
  namespace Express {
    interface Request {
      kioskMode?: boolean;
      kioskToken?: string;
      kioskBrigadeId?: string;
    }
  }
}

/**
 * Middleware to detect and validate kiosk mode
 * 
 * Checks for 'brigade' query parameter and validates the token.
 * If valid, sets kiosk mode flags and locks station selection.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function kioskModeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check for brigade token in query parameters
  const brigadeToken = req.query.brigade as string | undefined;
  
  if (!brigadeToken) {
    // Not in kiosk mode
    req.kioskMode = false;
    next();
    return;
  }
  
  // Validate the brigade access token
  const accessToken = validateBrigadeAccessToken(brigadeToken);
  
  if (!accessToken) {
    // Invalid or expired token
    res.status(403).json({
      error: 'Invalid or expired brigade access token',
      message: 'The kiosk access token is not valid. Please contact your administrator.',
    });
    return;
  }
  
  // Token is valid - activate kiosk mode
  req.kioskMode = true;
  req.kioskToken = brigadeToken;
  req.kioskBrigadeId = accessToken.brigadeId;
  
  // Lock station to the token's station
  req.stationId = accessToken.stationId;
  
  next();
}

/**
 * Middleware to enforce kiosk mode restrictions
 * 
 * Prevents station switching when in kiosk mode.
 * Apply this to station management endpoints.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function enforceKioskRestrictions(req: Request, res: Response, next: NextFunction): void {
  if (req.kioskMode) {
    // In kiosk mode - prevent certain operations
    
    // Prevent station selection changes
    if (req.method === 'PUT' || req.method === 'POST') {
      res.status(403).json({
        error: 'Operation not allowed in kiosk mode',
        message: 'This device is locked to a specific brigade. Station changes are not permitted.',
      });
      return;
    }
  }
  
  next();
}

/**
 * Get kiosk mode info from request
 * 
 * Helper function to safely get kiosk mode information.
 * 
 * @param req - Express request object
 * @returns Object with kiosk mode information
 */
export function getKioskModeInfo(req: Request): {
  isKioskMode: boolean;
  token?: string;
  brigadeId?: string;
  stationId?: string;
} {
  return {
    isKioskMode: req.kioskMode || false,
    token: req.kioskToken,
    brigadeId: req.kioskBrigadeId,
    stationId: req.stationId,
  };
}
