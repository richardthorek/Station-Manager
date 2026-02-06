/**
 * Error Handling Utilities
 * 
 * Provides consistent error handling patterns across all API routes.
 * Standardizes error response format and logging.
 */

import type { Response } from 'express';
import { logger } from './logger';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  timestamp?: string;
  details?: unknown;
}

/**
 * Send a standardized error response
 * 
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param message User-friendly error message
 * @param error Optional error object for logging
 * @param includeDetails Whether to include error details in response (dev only)
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  error?: unknown,
  includeDetails = false
): void {
  // Log error details
  if (error) {
    logger.error(`Error [${statusCode}]: ${message}`, { error, statusCode });
  } else {
    logger.error(`Error [${statusCode}]: ${message}`, { statusCode });
  }

  // Build response
  const response: ErrorResponse = {
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Include error details only in development
  if (includeDetails && process.env.NODE_ENV === 'development' && error) {
    response.details = error instanceof Error ? error.message : error;
  }

  res.status(statusCode).json(response);
}

/**
 * Common error response helpers
 */
export const ErrorResponses = {
  /**
   * 400 Bad Request - Invalid input
   */
  badRequest: (res: Response, message = 'Invalid request', error?: unknown) => {
    sendErrorResponse(res, 400, message, error);
  },

  /**
   * 404 Not Found - Resource not found
   */
  notFound: (res: Response, resource = 'Resource', error?: unknown) => {
    sendErrorResponse(res, 404, `${resource} not found`, error);
  },

  /**
   * 500 Internal Server Error - Unexpected error
   */
  internalError: (res: Response, message = 'Internal server error', error?: unknown) => {
    sendErrorResponse(res, 500, message, error, true);
  },

  /**
   * 409 Conflict - Resource conflict
   */
  conflict: (res: Response, message = 'Resource conflict', error?: unknown) => {
    sendErrorResponse(res, 409, message, error);
  },
};

/**
 * Async error handler wrapper for route handlers
 * Catches errors and sends standardized error responses
 * 
 * @example
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
export function asyncHandler<T>(
  handler: (req: unknown, res: Response) => Promise<T>
) {
  return async (req: unknown, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (!res.headersSent) {
        ErrorResponses.internalError(res, 'An unexpected error occurred', error);
      }
    }
  };
}
