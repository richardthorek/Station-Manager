/**
 * Navigation Utilities
 * 
 * Helper functions for preserving query parameters (especially ?demo=true)
 * across navigation in the application.
 */

/**
 * Preserve current query parameters when navigating to a new path
 * 
 * @param to - Target path to navigate to
 * @param preserveParams - Array of param names to preserve (default: ['demo'])
 * @returns Path with preserved query parameters
 */
export function preserveQueryParams(to: string, preserveParams: string[] = ['demo']): string {
  const currentParams = new URLSearchParams(window.location.search);
  const targetUrl = new URL(to, window.location.origin);
  
  // Preserve specified parameters from current URL
  preserveParams.forEach(param => {
    const value = currentParams.get(param);
    if (value && !targetUrl.searchParams.has(param)) {
      targetUrl.searchParams.set(param, value);
    }
  });
  
  // Return the pathname with query string (without origin)
  return targetUrl.pathname + targetUrl.search;
}

/**
 * Get current demo mode state from URL
 */
export function isDemoMode(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  const demoParam = urlParams.get('demo');
  return demoParam === 'true' || demoParam === '1';
}

/**
 * Build a complete URL with demo parameter if currently in demo mode
 */
export function buildUrl(path: string): string {
  if (isDemoMode()) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}demo=true`;
  }
  return path;
}
