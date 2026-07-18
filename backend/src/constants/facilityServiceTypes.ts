/**
 * Generic display labels per `FacilityServiceType`, mirroring the frontend's
 * `SERVICE_TYPE_LABELS` (`frontend/src/components/FacilitySearch.tsx`) so the
 * signup facility picker and the org-branding default agree. Deliberately
 * generic (not a specific legal agency name per state — "SES" not "NSW SES",
 * since the same serviceType covers every state/territory's own agency) —
 * an owner can always override with their exact real name from
 * Admin → Organization.
 */
import type { FacilityServiceType } from '../types';

export const FACILITY_SERVICE_TYPE_LABELS: Record<FacilityServiceType, string> = {
  'rural-fire': 'Rural / country fire',
  'metro-fire': 'Fire & Rescue',
  ses: 'SES',
  ambulance: 'Ambulance',
  police: 'Police',
  other: 'Other',
};
