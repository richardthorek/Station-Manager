/**
 * Demo Mode Middleware
 * 
 * Detects demo mode from query parameters and makes the flag available
 * to route handlers via req.isDemoMode.
 * 
 * When ?demo=true is present in the URL:
 * - Sets req.isDemoMode = true
 * - Route handlers should use ensureDatabase(true) and ensureTruckChecksDatabase(true)
 * 
 * This allows per-device/per-request demo mode without server restart.
 */

import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include demo mode flag
declare global {
  namespace Express {
    interface Request {
      isDemoMode?: boolean;
    }
  }
}

/**
 * Middleware to detect demo mode from query parameters
 * 
 * Checks for ?demo=true in the URL and sets req.isDemoMode accordingly.
 * Route handlers can then use this flag to select the appropriate database instance.
 */
export function demoModeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if demo mode is enabled via environment variable
  const demoModeEnabled = process.env.DEMO_MODE_ENABLED !== 'false';
  
  if (!demoModeEnabled) {
    req.isDemoMode = false;
    next();
    return;
  }
  
  // Check query parameter
  const demoParam = req.query.demo;
  req.isDemoMode = demoParam === 'true' || demoParam === '1';
  
  // Log demo mode activation for debugging
  if (req.isDemoMode && req.method !== 'OPTIONS') {
    console.log(`🎭 Demo mode request: ${req.method} ${req.path}`);
  }
  
  next();
}
