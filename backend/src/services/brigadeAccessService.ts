/**
 * Brigade Access Service
 * 
 * Manages secure access tokens for brigade/station locking in kiosk mode.
 * Provides functionality to:
 * - Generate unique, unguessable brigade access tokens
 * - Validate tokens and resolve to station IDs
 * - Store and retrieve token mappings
 * 
 * Security considerations:
 * - Tokens are UUIDs (128-bit random) for security
 * - Tokens are stored with station/brigade associations
 * - Optional expiration dates for token rotation
 */

import { randomUUID } from 'crypto';
import type { BrigadeAccessToken } from '../types';

/**
 * In-memory storage for brigade access tokens
 * In production, this should be persisted to database
 */
const tokenStore = new Map<string, BrigadeAccessToken>();

/**
 * Generate a new brigade access token
 * 
 * @param brigadeId - The brigade ID to associate with the token
 * @param stationId - The station ID to lock to
 * @param description - Optional description for the token (e.g., "Main Kiosk")
 * @param expiresAt - Optional expiration date
 * @returns The generated brigade access token
 */
export function generateBrigadeAccessToken(
  brigadeId: string,
  stationId: string,
  description?: string,
  expiresAt?: Date
): BrigadeAccessToken {
  const token = randomUUID();
  
  const accessToken: BrigadeAccessToken = {
    token,
    brigadeId,
    stationId,
    createdAt: new Date(),
    expiresAt,
    description,
  };
  
  tokenStore.set(token, accessToken);
  
  return accessToken;
}

/**
 * Validate a brigade access token and return associated station info
 * 
 * @param token - The token to validate
 * @returns The brigade access token if valid, null otherwise
 */
export function validateBrigadeAccessToken(token: string): BrigadeAccessToken | null {
  const accessToken = tokenStore.get(token);
  
  if (!accessToken) {
    return null;
  }
  
  // Check if token has expired
  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    tokenStore.delete(token);
    return null;
  }
  
  return accessToken;
}

/**
 * Revoke a brigade access token
 * 
 * @param token - The token to revoke
 * @returns True if token was revoked, false if not found
 */
export function revokeBrigadeAccessToken(token: string): boolean {
  return tokenStore.delete(token);
}

/**
 * Get all active tokens for a brigade
 * 
 * @param brigadeId - The brigade ID to search for
 * @returns Array of active brigade access tokens
 */
export function getBrigadeAccessTokens(brigadeId: string): BrigadeAccessToken[] {
  const tokens: BrigadeAccessToken[] = [];
  
  for (const accessToken of tokenStore.values()) {
    if (accessToken.brigadeId === brigadeId) {
      // Check if token is still valid
      if (!accessToken.expiresAt || accessToken.expiresAt >= new Date()) {
        tokens.push(accessToken);
      } else {
        // Clean up expired token
        tokenStore.delete(accessToken.token);
      }
    }
  }
  
  return tokens;
}

/**
 * Get all active tokens for a station
 * 
 * @param stationId - The station ID to search for
 * @returns Array of active brigade access tokens
 */
export function getStationAccessTokens(stationId: string): BrigadeAccessToken[] {
  const tokens: BrigadeAccessToken[] = [];
  
  for (const accessToken of tokenStore.values()) {
    if (accessToken.stationId === stationId) {
      // Check if token is still valid
      if (!accessToken.expiresAt || accessToken.expiresAt >= new Date()) {
        tokens.push(accessToken);
      } else {
        // Clean up expired token
        tokenStore.delete(accessToken.token);
      }
    }
  }
  
  return tokens;
}

/**
 * Clear all expired tokens (maintenance function)
 * 
 * @returns Number of tokens removed
 */
export function clearExpiredTokens(): number {
  let removedCount = 0;
  const now = new Date();
  
  for (const [token, accessToken] of tokenStore.entries()) {
    if (accessToken.expiresAt && accessToken.expiresAt < now) {
      tokenStore.delete(token);
      removedCount++;
    }
  }
  
  return removedCount;
}

/**
 * Get total number of active tokens
 * 
 * @returns Number of active tokens
 */
export function getActiveTokenCount(): number {
  clearExpiredTokens(); // Clean up first
  return tokenStore.size;
}

/**
 * Get all active brigade access tokens (for admin utility)
 * 
 * @returns Array of all active brigade access tokens
 */
export function getAllBrigadeAccessTokens(): BrigadeAccessToken[] {
  clearExpiredTokens(); // Clean up expired tokens first
  return Array.from(tokenStore.values());
}

/**
 * Clear all tokens (for testing purposes)
 * 
 * @returns Number of tokens removed
 */
export function clearAllTokens(): number {
  const count = tokenStore.size;
  tokenStore.clear();
  return count;
}
