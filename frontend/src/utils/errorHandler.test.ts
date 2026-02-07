import { describe, it, expect } from 'vitest';
import {
  parseError,
  formatErrorMessage,
  canRetryError,
  getErrorCode,
  logError,
} from './errorHandler';

describe('errorHandler', () => {
  describe('parseError', () => {
    it('parses network error', () => {
      const error = new TypeError('Failed to fetch');
      const result = parseError(error);
      
      expect(result.message).toBe("Can't connect to the server");
      expect(result.action).toContain('Check your internet connection');
      expect(result.canRetry).toBe(true);
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('parses HTTP 404 error', () => {
      const error = { status: 404 };
      const result = parseError(error);
      
      expect(result.message).toBe('Not found');
      expect(result.code).toBe('404');
    });

    it('parses HTTP 500 error', () => {
      const error = { status: 500 };
      const result = parseError(error);
      
      expect(result.message).toBe('Server error');
      expect(result.canRetry).toBe(true);
      expect(result.code).toBe('500');
    });

    it('parses timeout error from message', () => {
      const error = new Error('Request timeout');
      const result = parseError(error);
      
      expect(result.message).toBe('Request timed out');
      expect(result.canRetry).toBe(true);
    });

    it('parses offline error from message', () => {
      const error = new Error('You are offline');
      const result = parseError(error);
      
      expect(result.message).toBe("You're offline");
      expect(result.canRetry).toBe(false);
    });

    it('parses member-related error from message', () => {
      const error = new Error('Member not found in database');
      const result = parseError(error);
      
      expect(result.message).toBe("Member not found");
      expect(result.technical).toBe('Member not found in database');
    });

    it('parses generic Error object', () => {
      const error = new Error('Something unexpected happened');
      const result = parseError(error);
      
      expect(result.message).toBe('Something unexpected happened');
      expect(result.canRetry).toBe(true);
      expect(result.technical).toBe('Something unexpected happened');
    });

    it('parses string error', () => {
      const error = 'Simple error message';
      const result = parseError(error);
      
      expect(result.message).toBe('Simple error message');
      expect(result.canRetry).toBe(true);
    });

    it('returns unknown error for unexpected types', () => {
      const error = { weird: 'object' };
      const result = parseError(error);
      
      expect(result.message).toBe('Something went wrong');
      expect(result.code).toBe('UNKNOWN');
    });
  });

  describe('formatErrorMessage', () => {
    it('formats error with action', () => {
      const error = new TypeError('Failed to fetch');
      const message = formatErrorMessage(error);
      
      expect(message).toContain("Can't connect to the server");
      expect(message).toContain('Check your internet connection');
    });

    it('formats error without action', () => {
      const error = 'Simple error';
      const message = formatErrorMessage(error);
      
      expect(message).toBe('Simple error. Please try again.');
    });
  });

  describe('canRetryError', () => {
    it('returns true for retryable errors', () => {
      const error = new TypeError('Failed to fetch');
      expect(canRetryError(error)).toBe(true);
    });

    it('returns false for non-retryable errors', () => {
      const error = { status: 404 };
      expect(canRetryError(error)).toBe(false);
    });

    it('returns true for offline errors marked as non-retryable', () => {
      const error = new Error('You are offline');
      expect(canRetryError(error)).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('returns error code for known errors', () => {
      const error = new TypeError('Failed to fetch');
      expect(getErrorCode(error)).toBe('NETWORK_ERROR');
    });

    it('returns UNKNOWN for unknown errors', () => {
      const error = { weird: 'object' };
      expect(getErrorCode(error)).toBe('UNKNOWN');
    });
  });

  describe('logError', () => {
    it('logs error without throwing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('Test error');
      logError(error, 'Test context');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('specific error messages', () => {
    it('provides user-friendly message for 400 error', () => {
      const error = { status: 400 };
      const result = parseError(error);
      
      expect(result.message).toBe('Invalid request');
      expect(result.action).toContain('check your input');
    });

    it('provides user-friendly message for 401 error', () => {
      const error = { status: 401 };
      const result = parseError(error);
      
      expect(result.message).toBe('Access denied');
      expect(result.action).toContain('sign in');
    });

    it('provides user-friendly message for 403 error', () => {
      const error = { status: 403 };
      const result = parseError(error);
      
      expect(result.message).toBe('Access forbidden');
      expect(result.action).toContain('permission');
    });

    it('provides user-friendly message for 429 error', () => {
      const error = { status: 429 };
      const result = parseError(error);
      
      expect(result.message).toBe('Too many requests');
      expect(result.canRetry).toBe(true);
    });

    it('provides user-friendly message for 502 error', () => {
      const error = { status: 502 };
      const result = parseError(error);
      
      expect(result.message).toBe('Server unavailable');
      expect(result.canRetry).toBe(true);
    });
  });
});
