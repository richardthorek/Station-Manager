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
// Persistent storage for device tokens (survives app closure)
const KIOSK_TOKEN_PERSISTENT_KEY = 'kioskBrigadeToken_persistent';

/**
 * Restore kiosk mode from persistent storage (localStorage)
 * Call this on app initialization to restore the session after app restart
 */
export function restoreKioskModeFromPersistent(): void {
  // If there's a token in the URL, it takes precedence
  if (getBrigadeTokenFromUrl()) {
    return;
  }

  // Restore from localStorage if available and not already in sessionStorage
  const persistentToken = localStorage.getItem(KIOSK_TOKEN_PERSISTENT_KEY);
  if (persistentToken && !sessionStorage.getItem(KIOSK_TOKEN_KEY)) {
    sessionStorage.setItem(KIOSK_TOKEN_KEY, persistentToken);
  }
}

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
  if (sessionStorage.getItem(KIOSK_TOKEN_KEY)) {
    return true;
  }

  // Check localStorage (persistent)
  return !!localStorage.getItem(KIOSK_TOKEN_PERSISTENT_KEY);
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
 * Checks URL, sessionStorage, and localStorage (persistent) in order
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
  const sessionToken = sessionStorage.getItem(KIOSK_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  // Fall back to localStorage (for app shortcuts / persistence)
  return localStorage.getItem(KIOSK_TOKEN_PERSISTENT_KEY);
}

/**
 * Initialize kiosk mode from URL or localStorage
 * Stores token and station info in sessionStorage and localStorage for persistence
 *
 * @param stationId - The station ID to lock to
 * @param brigadeId - The brigade ID
 */
export function initializeKioskMode(stationId: string, brigadeId: string): void {
  const token = getBrigadeTokenFromUrl();
  if (!token) {
    return;
  }

  // Store in both sessionStorage (current session) and localStorage (persistence)
  sessionStorage.setItem(KIOSK_TOKEN_KEY, token);
  localStorage.setItem(KIOSK_TOKEN_PERSISTENT_KEY, token);
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
  localStorage.removeItem(KIOSK_TOKEN_PERSISTENT_KEY);
}

/**
 * Generate a shareable URL that includes the device token
 * Used for creating home screen shortcuts that retain kiosk access
 *
 * @param path - The path to link to (e.g., '/signin', '/truckcheck')
 * @returns Full URL with token as query parameter, or just the path if no token
 */
export function generateKioskUrl(path: string = '/'): string {
  const token = getKioskToken();
  if (!token) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}brigade=${encodeURIComponent(token)}`;
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
