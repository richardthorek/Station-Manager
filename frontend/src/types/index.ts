// ============================================
// Domain types (frontend view of the shared contract)
// ============================================
//
// The core sign-in domain shapes are defined ONCE in the date-generic module
// `shared/domain-types.d.ts` and re-exported here specialised with `string`
// (the JSON-over-the-wire representation — the backend serialises Date → ISO
// string). The backend re-exports the same module specialised with `Date`.
// Add or change a shared field there ONCE and both apps see it. See T1
// increment 2 in docs/MASTER_PLAN.md.
//
// App-specific composites (StationLookupResult, the truck-check types below)
// and the frontend-only extensions on CheckInWithDetails / ActiveActivity stay
// in this file.

import type {
  StationHierarchy as SharedStationHierarchy,
  Station as SharedStation,
  Member as SharedMember,
  Activity as SharedActivity,
  CheckIn as SharedCheckIn,
  ActiveActivity as SharedActiveActivity,
  Event as SharedEvent,
  EventParticipant as SharedEventParticipant,
  EventWithParticipants as SharedEventWithParticipants,
} from '../../../shared/domain-types';

export type { CheckInMethod } from '../../../shared/domain-types';

export type StationHierarchy = SharedStationHierarchy;
export type Station = SharedStation<string>;
export type Member = SharedMember<string>;
export type Activity = SharedActivity<string>;
export type CheckIn = SharedCheckIn<string>;
export type Event = SharedEvent<string>;
export type EventParticipant = SharedEventParticipant<string>;
export type EventWithParticipants = SharedEventWithParticipants<string>;

/**
 * Station lookup result from national dataset (frontend-only)
 */
export interface StationLookupResult {
  id: string;
  name: string;
  brigade?: string;
  district?: string;
  area?: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number;
  longitude: number;
  distance?: number; // Distance in kilometers from user location
  existsInSystem?: boolean; // True if this brigade already exists in the system
}

/** CheckIn enriched with member/activity display fields (frontend view). */
export interface CheckInWithDetails extends CheckIn {
  memberName: string;
  activityName: string;
  activityTagColor?: string;
  tagColor?: string; // Legacy field, same as activityTagColor
}

/** Active activity with the resolved Activity attached (frontend view). */
export type ActiveActivity = SharedActiveActivity<string> & {
  activity?: Activity;
};

// ============================================
// Truck Checks Types
// ============================================

/**
 * Represents an appliance/vehicle that needs checking
 */
export interface Appliance {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  /** Link to the VehicleType supplying the standard checklist (optional). */
  vehicleTypeId?: string;
  /** Legacy free-form vehicle-type slug (superseded by vehicleTypeId). */
  vehicleType?: string;
  // Vehicle identity (all optional)
  agencyId?: string;             // agency fleet/asset number (primary tracking id)
  registration?: string;         // number plate
  vin?: string;                  // Vehicle Identification Number
  make?: string;
  model?: string;
  year?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A standard vehicle type owning a locked standard checklist. Brigades adopt a
 * type for their vehicles and add/reorder custom items, but never edit the
 * standard items (that locked core is what enables cross-brigade comparison).
 */
export interface VehicleType {
  id: string;
  organizationId?: string;
  isStandard: boolean;
  code: string;
  name: string;
  description?: string;
  category?: string;
  agency?: string;
  standardItems: ChecklistItem[];
  createdBy?: string;
  seedVersion?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A first-class device account (AC-5) — a named, typed, revocable credential
 * for a brigade-locked kiosk/tablet/phone/wearable. Formalises the anonymous
 * BrigadeAccessToken UUID; the token backs the same `/signin?brigade=<token>`
 * kiosk URL.
 */
export interface Device {
  id: string;
  organizationId?: string;
  stationId: string;
  type: 'kiosk' | 'tablet' | 'phone' | 'wearable';
  name: string;
  token: string;
  status: 'active' | 'revoked';
  description?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

/**
 * The resolved checklist for an appliance: locked standard items merged with the
 * brigade's custom items, in saved order. Computed server-side.
 */
export interface EffectiveChecklist {
  applianceId: string;
  applianceName: string;
  vehicleTypeId?: string;
  vehicleTypeName?: string;
  items: ChecklistItem[];
}

/**
 * Template defining the checklist for an appliance
 */
export interface ChecklistTemplate {
  id: string;
  applianceId: string;
  applianceName: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  items: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Individual item in a checklist template
 */
export interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  referencePhotoUrl?: string;
  order: number;
  /** True when this item comes from a VehicleType's locked standard checklist. */
  isStandard?: boolean;
  /**
   * Canonical item-code slug (e.g. 'tyre-condition', 'fluid-levels'). Stable across
   * brigades and template edits so the same logical check can be aggregated even when
   * brigades word the item differently. Optional for backward compatibility.
   */
  itemCode?: string;
  /**
   * Grouping label for the item (e.g. 'Engine Bay', 'Cabin', 'Pump & Tank'). Used to
   * render the checklist in sections. Optional.
   */
  section?: string;
}

/** Physical side/face of a truck a zone sits on. */
export type ApplianceZoneSide = 'driver' | 'passenger' | 'front' | 'rear' | 'top' | 'interior' | 'na';

/**
 * A1 — named physical area on ONE appliance, giving the agent a spatial
 * walk-around model. Authored by admin; brigades edit freely after seeding.
 */
export interface ApplianceZone {
  id: string;
  applianceId: string;
  stationId?: string;
  name: string;
  zoneCode?: string;
  parentZoneId?: string;
  side?: ApplianceZoneSide;
  order: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A1 — piece of equipment that lives on ONE appliance. active:false retires
 * it without losing history.
 */
export interface ApplianceEquipment {
  id: string;
  applianceId: string;
  stationId?: string;
  name: string;
  equipmentCode?: string;
  zoneId?: string;
  serialNumber?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Status of a check result
 */
export type CheckStatus = 'done' | 'issue' | 'skipped';

/**
 * A check run session for one appliance
 * Multiple people can collaborate on a single check run
 */
export interface CheckRun {
  id: string;
  applianceId: string;
  applianceName: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  startTime: string;
  endTime?: string;
  completedBy: string;
  completedByName?: string;
  contributors: string[]; // Array of contributor names
  additionalComments?: string;
  status: 'in-progress' | 'completed';
  hasIssues: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result for a specific item in a check run
 */
export interface CheckResult {
  id: string;
  runId: string;
  itemId: string;
  itemName: string;
  itemDescription: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  /**
   * Canonical item-code copied from the checklist item at the time of the check.
   * Denormalised here so historical results stay comparable across brigades for trend
   * analysis even if the template changes later.
   */
  itemCode?: string;
  /** Grouping label copied from the checklist item at the time of the check. */
  section?: string;
  status: CheckStatus;
  comment?: string;
  photoUrl?: string;
  completedBy?: string; // Who completed this specific item
  // Issue follow-up lifecycle (TC-4) — set when status === 'issue'.
  issueStatus?: 'open' | 'acknowledged' | 'resolved';
  issueNote?: string;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Complete check run with all results
 */
export interface CheckRunWithResults extends CheckRun {
  results: CheckResult[];
}

/**
 * An issue result enriched with appliance/run context for the equipment-officer
 * follow-up feed (GET /api/truck-checks/issues).
 */
export interface IssueResult extends CheckResult {
  applianceId: string;
  applianceName: string;
  runStartTime: string;
}
