/**
 * Multi-Station Support Constants
 * 
 * Defines standard station identifiers and configuration for multi-tenant system.
 */

/**
 * Default station ID for backward compatibility and single-station deployments
 */
export const DEFAULT_STATION_ID = 'default-station';

/**
 * Demo station ID for demonstration and testing purposes
 * This station is isolated and can be reset without affecting real brigade data
 */
export const DEMO_STATION_ID = 'demo-station';

/**
 * Demo brigade ID for grouping demo stations
 */
export const DEMO_BRIGADE_ID = 'demo-brigade';

/**
 * Check if a station ID represents a demo station
 */
export function isDemoStation(stationId: string | undefined): boolean {
  return stationId === DEMO_STATION_ID;
}

/**
 * Get the effective station ID (returns default if undefined)
 */
export function getEffectiveStationId(stationId: string | undefined): string {
  return stationId || DEFAULT_STATION_ID;
}

/**
 * Check if a station ID represents the default station
 */
export function isDefaultStation(stationId: string | undefined): boolean {
  return !stationId || stationId === DEFAULT_STATION_ID;
}
