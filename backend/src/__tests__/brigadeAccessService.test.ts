/**
 * Brigade Access Service Tests
 * 
 * Tests for brigade access token management including:
 * - Token generation
 * - Token validation
 * - Token revocation
 * - Token expiration
 * - Brigade and station token queries
 */

import {
  generateBrigadeAccessToken,
  validateBrigadeAccessToken,
  revokeBrigadeAccessToken,
  getBrigadeAccessTokens,
  getStationAccessTokens,
  clearExpiredTokens,
  getActiveTokenCount,
  clearAllTokens,
} from '../services/brigadeAccessService';

describe('Brigade Access Service', () => {
  beforeEach(() => {
    // Clear all tokens before each test
    clearAllTokens();
  });

  describe('generateBrigadeAccessToken', () => {
    it('should generate a valid token with required fields', () => {
      const token = generateBrigadeAccessToken('brigade-1', 'station-1');
      
      expect(token).toBeDefined();
      expect(token.token).toBeDefined();
      expect(token.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i); // UUID v4 format
      expect(token.brigadeId).toBe('brigade-1');
      expect(token.stationId).toBe('station-1');
      expect(token.createdAt).toBeInstanceOf(Date);
    });

    it('should generate tokens with optional description', () => {
      const token = generateBrigadeAccessToken(
        'brigade-1',
        'station-1',
        'Main Kiosk'
      );
      
      expect(token.description).toBe('Main Kiosk');
    });

    it('should generate tokens with optional expiration', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const token = generateBrigadeAccessToken(
        'brigade-1',
        'station-1',
        undefined,
        expiresAt
      );
      
      expect(token.expiresAt).toEqual(expiresAt);
    });

    it('should generate unique tokens for each call', () => {
      const token1 = generateBrigadeAccessToken('brigade-1', 'station-1');
      const token2 = generateBrigadeAccessToken('brigade-1', 'station-1');
      
      expect(token1.token).not.toBe(token2.token);
    });
  });

  describe('validateBrigadeAccessToken', () => {
    it('should validate a valid token', () => {
      const generatedToken = generateBrigadeAccessToken('brigade-1', 'station-1');
      const validated = validateBrigadeAccessToken(generatedToken.token);
      
      expect(validated).toBeDefined();
      expect(validated?.token).toBe(generatedToken.token);
      expect(validated?.brigadeId).toBe('brigade-1');
      expect(validated?.stationId).toBe('station-1');
    });

    it('should return null for invalid token', () => {
      const validated = validateBrigadeAccessToken('invalid-token-123');
      
      expect(validated).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired yesterday
      
      const token = generateBrigadeAccessToken(
        'brigade-1',
        'station-1',
        undefined,
        expiresAt
      );
      
      const validated = validateBrigadeAccessToken(token.token);
      
      expect(validated).toBeNull();
    });

    it('should validate non-expired token', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Expires in 30 days
      
      const token = generateBrigadeAccessToken(
        'brigade-1',
        'station-1',
        undefined,
        expiresAt
      );
      
      const validated = validateBrigadeAccessToken(token.token);
      
      expect(validated).toBeDefined();
      expect(validated?.token).toBe(token.token);
    });
  });

  describe('revokeBrigadeAccessToken', () => {
    it('should revoke an existing token', () => {
      const token = generateBrigadeAccessToken('brigade-1', 'station-1');
      
      const revoked = revokeBrigadeAccessToken(token.token);
      
      expect(revoked).toBe(true);
      
      // Token should no longer be valid
      const validated = validateBrigadeAccessToken(token.token);
      expect(validated).toBeNull();
    });

    it('should return false for non-existent token', () => {
      const revoked = revokeBrigadeAccessToken('non-existent-token');
      
      expect(revoked).toBe(false);
    });
  });

  describe('getBrigadeAccessTokens', () => {
    it('should return all tokens for a brigade', () => {
      const token1 = generateBrigadeAccessToken('brigade-1', 'station-1');
      const token2 = generateBrigadeAccessToken('brigade-1', 'station-2');
      generateBrigadeAccessToken('brigade-2', 'station-3'); // Different brigade
      
      const brigadeTokens = getBrigadeAccessTokens('brigade-1');
      
      expect(brigadeTokens).toHaveLength(2);
      expect(brigadeTokens.map(t => t.token)).toContain(token1.token);
      expect(brigadeTokens.map(t => t.token)).toContain(token2.token);
    });

    it('should not return expired tokens for brigade', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired
      
      generateBrigadeAccessToken('brigade-1', 'station-1', undefined, expiresAt);
      const validToken = generateBrigadeAccessToken('brigade-1', 'station-2');
      
      const brigadeTokens = getBrigadeAccessTokens('brigade-1');
      
      expect(brigadeTokens).toHaveLength(1);
      expect(brigadeTokens[0].token).toBe(validToken.token);
    });

    it('should return empty array for brigade with no tokens', () => {
      const brigadeTokens = getBrigadeAccessTokens('non-existent-brigade');
      
      expect(brigadeTokens).toEqual([]);
    });
  });

  describe('getStationAccessTokens', () => {
    it('should return all tokens for a station', () => {
      const token1 = generateBrigadeAccessToken('brigade-1', 'station-1');
      const token2 = generateBrigadeAccessToken('brigade-2', 'station-1'); // Same station, different brigade
      generateBrigadeAccessToken('brigade-1', 'station-2'); // Different station
      
      const stationTokens = getStationAccessTokens('station-1');
      
      expect(stationTokens).toHaveLength(2);
      expect(stationTokens.map(t => t.token)).toContain(token1.token);
      expect(stationTokens.map(t => t.token)).toContain(token2.token);
    });

    it('should not return expired tokens for station', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired
      
      generateBrigadeAccessToken('brigade-1', 'station-1', undefined, expiresAt);
      const validToken = generateBrigadeAccessToken('brigade-2', 'station-1');
      
      const stationTokens = getStationAccessTokens('station-1');
      
      expect(stationTokens).toHaveLength(1);
      expect(stationTokens[0].token).toBe(validToken.token);
    });

    it('should return empty array for station with no tokens', () => {
      const stationTokens = getStationAccessTokens('non-existent-station');
      
      expect(stationTokens).toEqual([]);
    });
  });

  describe('clearExpiredTokens', () => {
    it('should remove all expired tokens', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired
      
      generateBrigadeAccessToken('brigade-1', 'station-1', undefined, expiresAt);
      generateBrigadeAccessToken('brigade-1', 'station-2', undefined, expiresAt);
      generateBrigadeAccessToken('brigade-2', 'station-3'); // Valid token
      
      const removedCount = clearExpiredTokens();
      
      expect(removedCount).toBe(2);
      expect(getActiveTokenCount()).toBe(1);
    });

    it('should return 0 when no expired tokens', () => {
      generateBrigadeAccessToken('brigade-1', 'station-1');
      generateBrigadeAccessToken('brigade-2', 'station-2');
      
      const removedCount = clearExpiredTokens();
      
      expect(removedCount).toBe(0);
      expect(getActiveTokenCount()).toBe(2);
    });
  });

  describe('getActiveTokenCount', () => {
    it('should return correct count of active tokens', () => {
      expect(getActiveTokenCount()).toBe(0);
      
      generateBrigadeAccessToken('brigade-1', 'station-1');
      expect(getActiveTokenCount()).toBe(1);
      
      generateBrigadeAccessToken('brigade-1', 'station-2');
      expect(getActiveTokenCount()).toBe(2);
    });

    it('should not count expired tokens', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired
      
      generateBrigadeAccessToken('brigade-1', 'station-1', undefined, expiresAt);
      generateBrigadeAccessToken('brigade-2', 'station-2');
      
      expect(getActiveTokenCount()).toBe(1);
    });
  });
});
