/**
 * Logger and Request ID Tests
 * 
 * Tests for structured logging functionality:
 * - Logger configuration and output
 * - Request ID middleware
 * - Request logging middleware
 * - Log levels and formatting
 */

import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../middleware/requestId';
import { logger, createChildLogger, logPerformance } from '../services/logger';

describe('Request ID Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  
  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should generate a request ID if not provided', () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockReq.id).toBeDefined();
    expect(typeof mockReq.id).toBe('string');
    if (mockReq.id) {
      expect(mockReq.id.length).toBeGreaterThan(0);
    }
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', mockReq.id);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use existing X-Request-ID header if provided', () => {
    const existingId = 'existing-request-id-123';
    mockReq.headers = { 'x-request-id': existingId };
    
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockReq.id).toBe(existingId);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should generate unique IDs for different requests', () => {
    const ids: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const req: Partial<Request> = { headers: {} };
      const res: Partial<Response> = { setHeader: jest.fn() };
      
      requestIdMiddleware(req as Request, res as Response, mockNext);
      ids.push(req.id!);
    }
    
    // All IDs should be unique
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
  });
});

describe('Logger Service', () => {
  it('should export logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create child logger with context', () => {
    const childLogger = createChildLogger({ userId: '123', component: 'test' });
    
    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
    // Child logger should be different instance from parent
    expect(childLogger).not.toBe(logger);
  });

  it('should log performance metrics', () => {
    // Just verify the function exists and doesn't throw
    expect(() => {
      logPerformance('test_operation', 42, { testParam: 'value' });
    }).not.toThrow();
  });
});

describe('Logger Log Levels', () => {
  it('should have correct log level based on environment', () => {
    // Logger is configured based on NODE_ENV
    // In test environment, level should be 'warn'
    expect(logger.level).toBeDefined();
    
    // In test mode, logger should be at warn level or higher
    if (process.env.NODE_ENV === 'test') {
      expect(['warn', 'error']).toContain(logger.level);
    }
  });
});

describe('Logger Configuration', () => {
  it('should have default metadata', () => {
    // Winston logger should have default metadata
    const defaultMeta = (logger as any).defaultMeta;
    expect(defaultMeta).toBeDefined();
    expect(defaultMeta.service).toBe('station-manager-backend');
    expect(defaultMeta.environment).toBeDefined();
  });

  it('should have transports configured', () => {
    const transports = (logger as any).transports;
    expect(transports).toBeDefined();
    expect(Array.isArray(transports)).toBe(true);
    expect(transports.length).toBeGreaterThan(0);
  });
});

describe('Structured Logging', () => {
  it('should support metadata in log calls', () => {
    // Verify that logger accepts metadata without throwing
    expect(() => {
      logger.info('Test message', { 
        testField: 'value',
        number: 123,
        boolean: true,
      });
    }).not.toThrow();
  });

  it('should support error objects in metadata', () => {
    const testError = new Error('Test error');
    
    expect(() => {
      logger.error('Error occurred', { 
        error: testError,
        context: 'test',
      });
    }).not.toThrow();
  });

  it('should support nested objects in metadata', () => {
    expect(() => {
      logger.info('Complex metadata', {
        user: {
          id: '123',
          name: 'Test User',
        },
        request: {
          method: 'GET',
          path: '/api/test',
        },
      });
    }).not.toThrow();
  });
});

describe('Request Logging Middleware', () => {
  // Note: requestLoggingMiddleware is more complex to test as it intercepts
  // res.json and res.send. These tests verify basic functionality.
  
  it('should be importable', () => {
    const { requestLoggingMiddleware } = require('../middleware/requestLogging');
    expect(requestLoggingMiddleware).toBeDefined();
    expect(typeof requestLoggingMiddleware).toBe('function');
  });
});
