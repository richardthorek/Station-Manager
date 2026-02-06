/**
 * Centralized Logging Service
 * 
 * Provides structured logging using Winston for better debugging and monitoring.
 * 
 * Features:
 * - Log levels: error, warn, info, debug
 * - JSON format for production (machine-readable)
 * - Colored console format for development (human-readable)
 * - Request ID correlation
 * - Contextual metadata support
 * - Performance impact < 5ms per request
 * 
 * Usage:
 * ```typescript
 * import { logger } from './services/logger';
 * 
 * // Basic logging
 * logger.info('Member created', { memberId: '123', name: 'John Doe' });
 * logger.error('Failed to save member', { error: err.message });
 * 
 * // With request context
 * logger.info('Request received', { 
 *   requestId: req.id, 
 *   method: req.method, 
 *   path: req.path 
 * });
 * ```
 */

import winston from 'winston';

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Log level configuration
// Production: info and above (info, warn, error)
// Development: debug and above (debug, info, warn, error)
// Test: warn and above (warn, error) to reduce test noise
const logLevel = isTest ? 'warn' : isDevelopment ? 'debug' : 'info';

/**
 * Custom format for development console output
 * Provides colorized, human-readable logs with timestamps
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present (excluding empty objects)
    const metaKeys = Object.keys(metadata);
    if (metaKeys.length > 0) {
      // Filter out Winston's internal properties
      const filteredMeta = Object.keys(metadata)
        .filter(key => !['timestamp', 'level', 'message'].includes(key))
        .reduce((obj, key) => {
          obj[key] = metadata[key];
          return obj;
        }, {} as Record<string, unknown>);
      
      if (Object.keys(filteredMeta).length > 0) {
        msg += ` ${JSON.stringify(filteredMeta)}`;
      }
    }
    
    return msg;
  })
);

/**
 * Production format - structured JSON for log aggregation systems
 * Compatible with Azure Log Analytics, CloudWatch, etc.
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: logLevel,
  format: isProduction ? productionFormat : developmentFormat,
  defaultMeta: {
    service: 'station-manager-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      // In test mode, only log warnings and errors
      silent: false,
    }),
    
    // File transport for errors (production only)
    ...(isProduction ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ] : []),
  ],
  
  // Don't exit on uncaught exceptions (let process manager handle it)
  exitOnError: false,
});

/**
 * Helper to create a child logger with additional context
 * Useful for adding request-specific or module-specific metadata
 * 
 * @param context - Additional metadata to include in all logs
 * @returns Child logger instance
 * 
 * @example
 * const requestLogger = createChildLogger({ requestId: '123', userId: '456' });
 * requestLogger.info('Processing request');
 */
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

/**
 * Log performance metrics
 * Useful for tracking operation duration and identifying bottlenecks
 * 
 * @param operation - Name of the operation
 * @param durationMs - Duration in milliseconds
 * @param metadata - Additional context
 * 
 * @example
 * const start = Date.now();
 * await db.getAllMembers();
 * logPerformance('db.getAllMembers', Date.now() - start, { stationId: '123' });
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  logger.info('Performance metric', {
    operation,
    durationMs,
    ...metadata,
  });
}

/**
 * Log HTTP request
 * Standard format for incoming HTTP requests
 * 
 * @param req - Express request object
 * @param metadata - Additional context
 */
export function logRequest(
  method: string,
  path: string,
  metadata?: Record<string, unknown>
): void {
  logger.info('HTTP Request', {
    method,
    path,
    ...metadata,
  });
}

/**
 * Log HTTP response
 * Standard format for HTTP responses
 * 
 * @param method - HTTP method
 * @param path - Request path
 * @param statusCode - Response status code
 * @param durationMs - Request duration in milliseconds
 * @param metadata - Additional context
 */
export function logResponse(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level]('HTTP Response', {
    method,
    path,
    statusCode,
    durationMs,
    ...metadata,
  });
}

/**
 * Log database operation
 * Standard format for database operations
 * 
 * @param operation - Database operation name
 * @param metadata - Additional context
 */
export function logDatabaseOperation(
  operation: string,
  metadata?: Record<string, unknown>
): void {
  logger.debug('Database operation', {
    operation,
    ...metadata,
  });
}

// Export the main logger instance
export { logger };
export default logger;
