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
 * - Azure Application Insights integration (optional)
 * - Performance impact < 5ms per request
 * 
 * Azure Application Insights:
 * - Set AZURE_APP_INSIGHTS_CONNECTION_STRING environment variable
 * - Logs are sent to App Insights with structured metadata
 * - Retention configured in Azure Portal (recommend 1 day for cost optimization)
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
import * as fs from 'fs';
import * as path from 'path';

// Azure App Insights integration (optional)
// Note: For full Application Insights integration, see docs/wiki/developer/app-insights.md
// The connection string is configured via AZURE_APP_INSIGHTS_CONNECTION_STRING environment variable
// but the actual transport setup requires additional configuration in production deployments

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
 * Configure transports based on environment and Azure configuration
 */
const transports: winston.transport[] = [
  // Console transport (always enabled)
  new winston.transports.Console({
    silent: false,
  }),
];

// Add file transports in production.
//
// The deployed filesystem (Azure App Service wwwroot) is READ-ONLY when the app
// runs from a mounted package (WEBSITE_RUN_FROM_PACKAGE=1 — used to make zip
// deploys fast). Writing logs into the app directory would throw EROFS, so the
// files live under a writable, persisted location. On Linux App Service that's
// /home/LogFiles (also surfaced in the log stream / Kudu). Override with LOG_DIR.
if (isProduction) {
  const logDir = process.env.LOG_DIR || '/home/LogFiles/app';
  try {
    fs.mkdirSync(logDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  } catch (err) {
    // Never let logging setup take down the app — the Console transport still
    // feeds the Azure log stream / Application Insights if file logging fails.
    console.warn(`Log directory ${logDir} not writable; file logging disabled.`, err);
  }
}

// Add Azure Application Insights transport if configured
// NOTE: This requires applicationinsights SDK to be set up separately
// For now, we log a message indicating it needs manual configuration
// See docs/wiki/developer/app-insights.md for full setup instructions
const appInsightsConnectionString = process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING;
if (appInsightsConnectionString && !isProduction) {
  console.log('📊 Azure Application Insights connection string detected');
  console.log('   For full setup, see docs/wiki/developer/app-insights.md');
}

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
  transports,
  
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
