/**
 * Kiosk Mode Utility
 * 
 * Detects and manages kiosk mode for brigade-locked devices.
 * 
 * Kiosk mode is activated when:
 * - URL contains ?brigade=<token> query parameter
 * - Token is stored in sessionStorage
 * 
 * When in kiosk mode:
 * - Station selection is locked
 * - Users cannot switch stations
 * - Brigade token is included in all API requests
 */

const KIOSK_TOKEN_KEY = 'kioskBrigadeToken';
const KIOSK_STATION_KEY = 'kioskStationId';
const KIOSK_BRIGADE_KEY = 'kioskBrigadeId';

/**
 * Check if the current session is in kiosk mode
 * 
 * @returns True if in kiosk mode, false otherwise
 */
export function isKioskMode(): boolean {
  // Check URL first
  const urlToken = getBrigadeTokenFromUrl();
  if (urlToken) {
    return true;
  }
  
  // Check sessionStorage
  return !!sessionStorage.getItem(KIOSK_TOKEN_KEY);
}

/**
 * Get brigade token from URL query parameter
 * 
 * @returns The brigade token from URL, or null if not present
 */
export function getBrigadeTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('brigade');
}

/**
 * Get the active kiosk brigade token
 * 
 * @returns The brigade token, or null if not in kiosk mode
 */
export function getKioskToken(): string | null {
  // Try URL first
  const urlToken = getBrigadeTokenFromUrl();
  if (urlToken) {
    return urlToken;
  }
  
  // Fall back to sessionStorage
  return sessionStorage.getItem(KIOSK_TOKEN_KEY);
}

/**
 * Initialize kiosk mode from URL
 * Stores token and station info in sessionStorage
 * 
 * @param stationId - The station ID to lock to
 * @param brigadeId - The brigade ID
 */
export function initializeKioskMode(stationId: string, brigadeId: string): void {
  const token = getBrigadeTokenFromUrl();
  if (!token) {
    return;
  }
  
  sessionStorage.setItem(KIOSK_TOKEN_KEY, token);
  sessionStorage.setItem(KIOSK_STATION_KEY, stationId);
  sessionStorage.setItem(KIOSK_BRIGADE_KEY, brigadeId);
}

/**
 * Get the locked station ID in kiosk mode
 * 
 * @returns The station ID, or null if not in kiosk mode
 */
export function getKioskStationId(): string | null {
  return sessionStorage.getItem(KIOSK_STATION_KEY);
}

/**
 * Get the locked brigade ID in kiosk mode
 * 
 * @returns The brigade ID, or null if not in kiosk mode
 */
export function getKioskBrigadeId(): string | null {
  return sessionStorage.getItem(KIOSK_BRIGADE_KEY);
}

/**
 * Exit kiosk mode (clear stored token and station info)
 * Note: This should only be done by administrators
 */
export function exitKioskMode(): void {
  sessionStorage.removeItem(KIOSK_TOKEN_KEY);
  sessionStorage.removeItem(KIOSK_STATION_KEY);
  sessionStorage.removeItem(KIOSK_BRIGADE_KEY);
}

/**
 * Check if station switching is allowed
 * 
 * @returns True if station can be switched, false if locked in kiosk mode
 */
export function canSwitchStation(): boolean {
  return !isKioskMode();
}

/**
 * Get kiosk mode information
 * 
 * @returns Object with kiosk mode details
 */
export function getKioskModeInfo(): {
  isKioskMode: boolean;
  token: string | null;
  stationId: string | null;
  brigadeId: string | null;
} {
  return {
    isKioskMode: isKioskMode(),
    token: getKioskToken(),
    stationId: getKioskStationId(),
    brigadeId: getKioskBrigadeId(),
  };
}

/**
 * Validate the current kiosk token with the backend
 * 
 * @returns Promise resolving to validation result
 */
export async function validateKioskToken(): Promise<{
  valid: boolean;
  stationId?: string;
  brigadeId?: string;
  error?: string;
}> {
  const token = getKioskToken();
  
  if (!token) {
    return { valid: false, error: 'No kiosk token found' };
  }
  
  try {
    const response = await fetch(`/api/brigade-access/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      return { valid: false, error: 'Token validation failed' };
    }
    
    const data = await response.json();
    
    if (data.valid) {
      // Update sessionStorage with validated info
      if (data.stationId) {
        sessionStorage.setItem(KIOSK_STATION_KEY, data.stationId);
      }
      if (data.brigadeId) {
        sessionStorage.setItem(KIOSK_BRIGADE_KEY, data.brigadeId);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error validating kiosk token:', error);
    return { valid: false, error: 'Network error during validation' };
  }
}
