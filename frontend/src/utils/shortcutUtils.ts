/**
 * Shortcut utilities for creating context-aware home screen shortcuts
 * with device token persistence
 */

import { generateKioskUrl, getKioskToken } from './kioskMode';

export interface ShortcutInfo {
  name: string;
  shortName: string;
  description: string;
  path: string;
}

/**
 * Map of paths to shortcut metadata
 * Supports prefix matching so /truckcheck/* routes map to truck check
 */
const SHORTCUT_MAP: Record<string, ShortcutInfo> = {
  '/signin': {
    name: 'Station Sign-In',
    shortName: 'Sign-In',
    description: 'Quick member check-in/out',
    path: '/signin',
  },
  '/truckcheck': {
    name: 'Vehicle Check',
    shortName: 'Vehicle Check',
    description: 'Vehicle and equipment maintenance tracking',
    path: '/truckcheck',
  },
};

/**
 * Get shortcut info for the current path
 * Returns the appropriate shortcut metadata or a generic one
 *
 * @param pathname - Current pathname (e.g., '/signin', '/truckcheck/admin')
 * @returns ShortcutInfo object
 */
export function getShortcutForPath(pathname: string): ShortcutInfo {
  // Check exact match first
  if (SHORTCUT_MAP[pathname]) {
    return SHORTCUT_MAP[pathname];
  }

  // Check prefix match for nested routes
  for (const [prefix, info] of Object.entries(SHORTCUT_MAP)) {
    if (pathname.startsWith(prefix)) {
      return info;
    }
  }

  // Default fallback
  return {
    name: 'Bushie Tools',
    shortName: 'Bushie Tools',
    description: 'Simple tools for volunteer emergency crews',
    path: '/',
  };
}

/**
 * Generate a URL for adding to home screen
 * Includes device token if in kiosk mode
 *
 * @param pathname - Current pathname
 * @returns URL with token included if available
 */
export function generateShortcutUrl(pathname: string): string {
  const shortcut = getShortcutForPath(pathname);
  return generateKioskUrl(shortcut.path);
}

/**
 * Create a shareable link that can be used for home screen shortcuts
 * Encodes the current context so the shortcut goes to the right place with the right token
 *
 * @param pathname - Current pathname
 * @returns Object with URL and metadata for the shortcut
 */
export function createShortcutLink(pathname: string) {
  const shortcut = getShortcutForPath(pathname);
  const url = generateShortcutUrl(pathname);
  const token = getKioskToken();

  return {
    ...shortcut,
    url,
    hasToken: !!token,
  };
}
