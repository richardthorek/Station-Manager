/**
 * Demo Mode Utilities
 * 
 * Utilities for detecting and handling demo mode.
 * Demo mode allows users to interact with test data from Table Storage
 * without affecting production data.
 * 
 * When demo mode is active:
 * - All database operations use Test-suffixed tables (e.g., MembersTest)
 * - Frontend shows a visual "DEMO MODE" indicator
 * - Test data is pre-seeded with sample members, activities, and appliances
 */

/**
 * Check if a request is in demo mode based on query parameter
 */
export function isDemoModeRequest(query: any): boolean {
  return query && (query.demo === 'true' || query.demo === '1');
}

/**
 * Get the table suffix to use based on demo mode
 */
export function getTableSuffixForRequest(query: any): string {
  return isDemoModeRequest(query) ? 'Test' : (process.env.TABLE_STORAGE_TABLE_SUFFIX || '');
}

/**
 * Check if demo mode is enabled in configuration
 * Demo mode can be disabled in production via DEMO_MODE_ENABLED=false
 */
export function isDemoModeAvailable(): boolean {
  const envValue = process.env.DEMO_MODE_ENABLED;
  
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  
  // Default: enabled in non-production, disabled in production for safety
  return process.env.NODE_ENV !== 'production';
}
