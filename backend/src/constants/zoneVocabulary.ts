/**
 * A1 — Per-vehicleType starter zone vocabulary.
 *
 * A code-level taxonomy of canonical zone specs keyed by VehicleType.code.
 * Seeded onto a new appliance when it is first assigned a vehicleTypeId;
 * brigades then edit, add, or remove zones to match the actual vehicle.
 *
 * Zone order increments by 10 to leave room for brigade insertions.
 * ZoneCodes are stable slugs used for cross-brigade analytics — don't rename.
 *
 * Modelled on NSW RFS standard appliance layouts.  Where two type codes share
 * a layout they point at the same spec array (same reference, no duplication).
 */

import type { ApplianceZoneSide } from '../types';

export interface ZoneSpec {
  name: string;
  zoneCode: string;
  side?: ApplianceZoneSide;
  description?: string;
  order: number;
}

// ── Layout definitions ────────────────────────────────────────────────────────

const cat1Tanker: ZoneSpec[] = [
  { order: 0,  name: 'Cab',                   zoneCode: 'cab',               side: 'interior',  description: 'Driver and passenger cab compartment' },
  { order: 10, name: 'Pump Panel',             zoneCode: 'pump-panel',        side: 'driver',    description: 'Main pump controls and gauges' },
  { order: 20, name: 'Driver-side Lockers',    zoneCode: 'lockers-driver',    side: 'driver',    description: 'Storage lockers on the driver side' },
  { order: 30, name: 'Rear',                   zoneCode: 'rear',              side: 'rear',      description: 'Rear of the vehicle — hose reel, tow hitch, rear lights' },
  { order: 40, name: 'Passenger-side Lockers', zoneCode: 'lockers-passenger', side: 'passenger', description: 'Storage lockers on the passenger side' },
  { order: 50, name: 'Roof',                   zoneCode: 'roof',              side: 'top',       description: 'Roof-mounted equipment and ladder' },
  { order: 60, name: 'Underbody',              zoneCode: 'underbody',         side: 'na',        description: 'Ground-level checks — tyres, prop shafts, low-mounted fittings' },
];

const heavyTanker: ZoneSpec[] = [
  { order: 0,  name: 'Cab',                   zoneCode: 'cab',               side: 'interior',  description: 'Driver and crew cab' },
  { order: 10, name: 'Pump Panel',             zoneCode: 'pump-panel',        side: 'driver',    description: 'High-capacity pump controls and gauges' },
  { order: 20, name: 'Driver-side Lockers',    zoneCode: 'lockers-driver',    side: 'driver',    description: 'Large driver-side storage lockers' },
  { order: 30, name: 'Rear',                   zoneCode: 'rear',              side: 'rear',      description: 'Rear hose loads, monitor, tow hitch' },
  { order: 40, name: 'Passenger-side Lockers', zoneCode: 'lockers-passenger', side: 'passenger', description: 'Large passenger-side storage lockers' },
  { order: 50, name: 'Roof',                   zoneCode: 'roof',              side: 'top',       description: 'Roof-mounted hose, ladders, water monitor' },
  { order: 60, name: 'Underbody',              zoneCode: 'underbody',         side: 'na',        description: 'Tyres, prop shafts, low-mounted fittings' },
];

const pumper: ZoneSpec[] = [
  { order: 0,  name: 'Cab',                              zoneCode: 'cab',                     side: 'interior',  description: 'Driver and crew cab compartment' },
  { order: 10, name: 'Driver-side Front Compartments',   zoneCode: 'compt-driver-front',      side: 'driver',    description: 'Forward driver-side lockers (D1 area)' },
  { order: 20, name: 'Driver-side Rear Compartments',    zoneCode: 'compt-driver-rear',       side: 'driver',    description: 'Rearward driver-side lockers (D2 area)' },
  { order: 30, name: 'Pump Panel',                       zoneCode: 'pump-panel',              side: 'driver',    description: 'Main pump controls and gauges' },
  { order: 40, name: 'Rear',                             zoneCode: 'rear',                    side: 'rear',      description: 'Rear hose loads, lighting, tow hitch' },
  { order: 50, name: 'Passenger-side Rear Compartments', zoneCode: 'compt-passenger-rear',    side: 'passenger', description: 'Rearward passenger-side lockers (P2 area)' },
  { order: 60, name: 'Passenger-side Front Compartments', zoneCode: 'compt-passenger-front', side: 'passenger', description: 'Forward passenger-side lockers (P1 area)' },
  { order: 70, name: 'Roof / Aerial',                    zoneCode: 'roof',                    side: 'top',       description: 'Roof-mounted equipment, ladders, or aerial' },
  { order: 80, name: 'Underbody',                        zoneCode: 'underbody',               side: 'na',        description: 'Ground-level checks — tyres, stabilisers, low fittings' },
];

const bulkWaterTender: ZoneSpec[] = [
  { order: 0,  name: 'Cab',              zoneCode: 'cab',            side: 'interior',  description: 'Driver cab compartment' },
  { order: 10, name: 'Driver-side',      zoneCode: 'side-driver',    side: 'driver',    description: 'Driver-side access points and fittings' },
  { order: 20, name: 'Rear',             zoneCode: 'rear',           side: 'rear',      description: 'Rear discharge points, hose connections, tow hitch' },
  { order: 30, name: 'Passenger-side',   zoneCode: 'side-passenger', side: 'passenger', description: 'Passenger-side access points and fittings' },
  { order: 40, name: 'Tank Top',         zoneCode: 'tank-top',       side: 'top',       description: 'Tank hatches, fill points, and roof-level fittings' },
  { order: 50, name: 'Underbody',        zoneCode: 'underbody',      side: 'na',        description: 'Tyres, chassis, stabilisers' },
];

const rescueTender: ZoneSpec[] = [
  { order: 0,  name: 'Cab',                          zoneCode: 'cab',             side: 'interior',  description: 'Driver and crew cab' },
  { order: 10, name: 'Driver-side Compartments',     zoneCode: 'compt-driver',    side: 'driver',    description: 'Driver-side rescue equipment compartments' },
  { order: 20, name: 'Rear',                         zoneCode: 'rear',            side: 'rear',      description: 'Rear load area, lighting bar, hitch' },
  { order: 30, name: 'Passenger-side Compartments',  zoneCode: 'compt-passenger', side: 'passenger', description: 'Passenger-side rescue equipment compartments' },
  { order: 40, name: 'Roof',                         zoneCode: 'roof',            side: 'top',       description: 'Roof-mounted light bars and equipment' },
  { order: 50, name: 'Underbody',                    zoneCode: 'underbody',       side: 'na',        description: 'Tyres, prop shafts, low-mounted hydraulics' },
];

const commandSupport: ZoneSpec[] = [
  { order: 0,  name: 'Cab',        zoneCode: 'cab',  side: 'interior', description: 'Vehicle cab and rear passenger area' },
  { order: 10, name: 'Boot / Rear', zoneCode: 'rear', side: 'rear',     description: 'Boot space, command equipment, cabling' },
];

// ── Vocabulary registry ───────────────────────────────────────────────────────

/**
 * Starter zone taxonomy keyed by `VehicleType.code`.  Multiple codes may share
 * the same layout (aliases point at the same array).
 */
export const ZONE_VOCABULARY: Record<string, ZoneSpec[]> = {
  // Category tankers
  'cat1-tanker': cat1Tanker,
  'cat1':        cat1Tanker,
  // Cat 2 shares the heavy-tanker layout
  'cat2-tanker': heavyTanker,
  'cat2':        heavyTanker,
  // Cat 3 / heavy tanker
  'cat3-tanker': heavyTanker,
  'cat3':        heavyTanker,
  'heavy-tanker': heavyTanker,
  // Urban pumper / pumping tender
  'pumper':         pumper,
  'pumping-tender': pumper,
  'urban-pumper':   pumper,
  // Bulk water tender
  'bulk-water-tender': bulkWaterTender,
  'bwt':               bulkWaterTender,
  // Rescue tender
  'rescue-tender': rescueTender,
  'rescue':        rescueTender,
  // Command / support / liaison
  'command-support': commandSupport,
  'command':         commandSupport,
  'support':         commandSupport,
  'liaison':         commandSupport,
};

/**
 * Returns the starter zone specs for a vehicle type code, or an empty array
 * when no vocabulary entry exists for that code.
 */
export function getStarterZones(vehicleTypeCode: string): ZoneSpec[] {
  return ZONE_VOCABULARY[vehicleTypeCode] ?? [];
}
