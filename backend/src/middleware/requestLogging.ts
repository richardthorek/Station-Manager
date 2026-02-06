/**
 * Request Logging Middleware
 * 
 * Logs all HTTP requests and responses with timing information.
 * Works in conjunction with requestIdMiddleware for request correlation.
 * 
 * Features:
 * - Logs request method, path, and request ID
 * - Logs response status code and duration
 * - Automatic log level based on status code (error/warn/info)
 * - Performance tracking for each request
 * 
 * Usage:
 * ```typescript
 * import { requestLoggingMiddleware } from './middleware/requestLogging';
 * 
 * app.use(requestIdMiddleware);  // Must come before this middleware
 * app.use(requestLoggingMiddleware);
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { logRequest, logResponse } from '../services/logger';

/**
 * Middleware that logs HTTP requests and responses
 * 
 * @param req - Express request object (must have req.id set by requestIdMiddleware)
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // Log the incoming request
  logRequest(req.method, req.path, {
    requestId: req.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // Capture the original res.json to intercept the response
  const originalJson = res.json.bind(res);
  
  // Override res.json to log after response is sent
  res.json = function (body: unknown) {
    const durationMs = Date.now() - startTime;
    
    logResponse(req.method, req.path, res.statusCode, durationMs, {
      requestId: req.id,
    });
    
    return originalJson(body);
  };
  
  // Also capture res.send for non-JSON responses
  const originalSend = res.send.bind(res);
  
  res.send = function (body: unknown) {
    const durationMs = Date.now() - startTime;
    
    logResponse(req.method, req.path, res.statusCode, durationMs, {
      requestId: req.id,
    });
    
    return originalSend(body);
  };
  
  // Handle cases where response is sent without json() or send()
  res.on('finish', () => {
    // Only log if we haven't already (json/send would have logged)
    if (!res.headersSent) {
      const durationMs = Date.now() - startTime;
      logResponse(req.method, req.path, res.statusCode, durationMs, {
        requestId: req.id,
      });
    }
  });
  
  next();
}
