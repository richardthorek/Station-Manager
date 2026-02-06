/**
 * Request ID Middleware
 * 
 * Generates a unique request ID for each incoming HTTP request.
 * Enables request tracing across logs and makes debugging much easier.
 * 
 * Features:
 * - Generates UUID v4 for each request
 * - Adds requestId to request object
 * - Adds X-Request-ID to response headers
 * - Enables correlation of logs for a single request
 * 
 * Usage:
 * ```typescript
 * import { requestIdMiddleware } from './middleware/requestId';
 * 
 * app.use(requestIdMiddleware);
 * 
 * // In route handlers:
 * logger.info('Processing request', { requestId: req.id });
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type to include id property
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Middleware that adds a unique request ID to each request
 * 
 * The request ID is:
 * 1. Taken from X-Request-ID header if present (for request chaining)
 * 2. Generated as a new UUID v4 if not present
 * 3. Added to the request object as req.id
 * 4. Added to response headers as X-Request-ID
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use existing request ID from header, or generate a new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  
  // Add request ID to request object
  req.id = requestId;
  
  // Add request ID to response headers for client-side correlation
  res.setHeader('X-Request-ID', requestId);
  
  next();
}
