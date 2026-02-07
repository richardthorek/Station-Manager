/**
 * Audit Utilities
 * Helper functions for extracting device and location information from HTTP requests
 */

import { Request } from 'express';
import { DeviceInfo, LocationInfo } from '../types';

/**
 * Extract device information from HTTP request
 * Captures device type, model, user agent, and IP address
 */
export function extractDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.get('user-agent') || '';
  const ip = req.ip || req.socket.remoteAddress || '';
  
  // Parse user agent to detect device type
  const deviceType = detectDeviceType(userAgent);
  
  // Check for kiosk token in headers (custom header from kiosk devices)
  const kioskToken = req.get('X-Kiosk-Token') || req.body?.kioskToken;
  const deviceId = kioskToken || undefined;
  
  return {
    type: deviceType,
    model: extractDeviceModel(userAgent),
    deviceId,
    userAgent,
    ip,
  };
}

/**
 * Extract location information from request body or headers
 * Location data can come from:
 * - Request body (coordinates sent by client)
 * - IP-based geolocation (future enhancement)
 */
export function extractLocationInfo(req: Request): LocationInfo | undefined {
  const { latitude, longitude, accuracy, address } = req.body || {};
  
  // If no location data provided, return undefined
  if (!latitude && !longitude && !address) {
    return undefined;
  }
  
  return {
    latitude: latitude ? parseFloat(latitude) : undefined,
    longitude: longitude ? parseFloat(longitude) : undefined,
    accuracy: accuracy ? parseFloat(accuracy) : undefined,
    address: address || undefined,
    // IP-based location could be added here in the future
    ipLocation: undefined,
  };
}

/**
 * Detect device type from user agent string
 */
function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  
  // Check for kiosk mode indicators
  if (ua.includes('kiosk') || ua.includes('station-manager-kiosk')) {
    return 'kiosk';
  }
  
  // Check for mobile devices
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipod')) {
    return 'mobile';
  }
  
  // Check for tablets
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  
  // Default to desktop
  return 'desktop';
}

/**
 * Extract device model from user agent string
 * This is a best-effort extraction and may not be accurate for all devices
 */
function extractDeviceModel(userAgent: string): string | undefined {
  // Try to extract iOS device model
  const iosMatch = userAgent.match(/\(([^)]+)\)/);
  if (iosMatch && iosMatch[1].includes('iPhone')) {
    return iosMatch[1].split(';')[0].trim();
  }
  if (iosMatch && iosMatch[1].includes('iPad')) {
    return iosMatch[1].split(';')[0].trim();
  }
  
  // Try to extract Android device model
  const androidMatch = userAgent.match(/\(([^)]+)\)/);
  if (androidMatch && androidMatch[1].includes('Android')) {
    const parts = androidMatch[1].split(';');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
  }
  
  return undefined;
}

/**
 * Sanitize notes/reason text to prevent injection attacks
 * Removes potentially dangerous characters while preserving useful information
 */
export function sanitizeNotes(notes: string | undefined): string | undefined {
  if (!notes) {
    return undefined;
  }
  
  // Remove control characters and limit length
  const sanitized = notes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .slice(0, 500); // Limit to 500 characters
  
  return sanitized || undefined;
}
