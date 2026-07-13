/**
 * Emergency-services facility lookup types.
 *
 * Backed by a bundled snapshot of the Digital Atlas of Australia / Geoscience
 * Australia "Emergency Management Facilities" dataset (all service layers:
 * rural/country fire, metropolitan fire, SES, ambulance, police, other).
 * See services/facilitiesParser.ts and scripts/fetchEmergencyFacilitiesSnapshot.ts.
 */

import type { FacilityServiceType } from './index';

export const FACILITY_SERVICE_TYPES: FacilityServiceType[] = [
  'rural-fire',
  'metro-fire',
  'ses',
  'ambulance',
  'police',
  'other',
];

export function isFacilityServiceType(value: unknown): value is FacilityServiceType {
  return typeof value === 'string' && (FACILITY_SERVICE_TYPES as string[]).includes(value);
}

/** One facility row from the combined emergency-facilities snapshot. */
export interface Facility {
  /** Canonical key `"<serviceType>:<objectid>"` — objectid is only unique per source layer. */
  facilityKey: string;
  objectid: string;
  serviceType: FacilityServiceType;
  name: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number;
  longitude: number;
  operationalStatus: string;
}

/** A facility enriched for the public signup lookup. */
export interface FacilitySearchResult extends Facility {
  /** True when an Organization already holds this facilityKey. */
  claimed: boolean;
  /** Kilometres from the caller's lat/lon, when provided. */
  distance?: number;
  relevanceScore?: number;
}
