/**
 * Rate Limiting Middleware
 * 
 * Configures rate limiters for different route groups to protect against abuse and DDoS attacks.
 * Uses express-rate-limit with configurable limits via environment variables.
 * 
 * Rate Limits:
 * - API Routes: 100 requests per 15 minutes per IP (configurable via RATE_LIMIT_API_MAX)
 * - Auth Routes: 5 requests per 15 minutes per IP (configurable via RATE_LIMIT_AUTH_MAX)
 * - Window: 15 minutes (configurable via RATE_LIMIT_WINDOW_MS)
 * 
 * Features:
 * - Returns standard rate limit headers (RateLimit-*)
 * - Custom error messages with remaining time
 * - Logs rate limit hits for monitoring
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Parse environment variables with defaults
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const RATE_LIMIT_API_MAX = parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10);
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10);

/**
 * Custom key generator that extracts clean IP address from request
 * Handles cases where X-Forwarded-For includes port (e.g., "104.209.11.16:50178")
 * This prevents ValidationError from express-rate-limit
 */
function getClientIp(req: Request): string {
  const ip = req.ip || 'unknown';
  // Strip port if present (Azure proxies sometimes include it)
  // IPv4 format: "xxx.xxx.xxx.xxx:port" -> "xxx.xxx.xxx.xxx"
  // IPv6 format: Keep as-is (Express already handles IPv6 properly)
  if (ip.includes(':') && !ip.includes('[')) {
    // IPv4 with port - take only the IP part
    const parts = ip.split(':');
    // Check if last part is a port number
    if (parts.length === 2 && /^\d+$/.test(parts[1])) {
      return parts[0];
    }
  }
  return ip;
}

/**
 * Rate limiter for general API routes
 * Default: 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_API_MAX,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers (deprecated)
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: getClientIp, // Use custom IP extractor to handle ports
  handler: (req, res) => {
    const retryAfter = res.getHeader('RateLimit-Reset');
    const clientIp = getClientIp(req);
    console.warn(`Rate limit exceeded for IP ${clientIp} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: retryAfter,
    });
  },
});

/**
 * Rate limiter for authentication routes (for future use)
 * More restrictive: 5 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
  keyGenerator: getClientIp, // Use custom IP extractor to handle ports
  handler: (req, res) => {
    const retryAfter = res.getHeader('RateLimit-Reset');
    const clientIp = getClientIp(req);
    console.warn(`Auth rate limit exceeded for IP ${clientIp} on ${req.path}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'You have exceeded the authentication rate limit. Please try again later.',
      retryAfter: retryAfter,
    });
  },
});

/**
 * Rate limiter for SPA fallback route (serving index.html)
 * Same as API rate limiter but separate instance to avoid conflicts
 */
export const spaRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: getClientIp, // Use custom IP extractor to handle ports
});
