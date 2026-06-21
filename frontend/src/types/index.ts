// ============================================
// Domain types (frontend mirror of the backend contract)
// ============================================
//
// `backend/src/types/index.ts` is the **contract of record** for these domain
// shapes. This file mirrors it for the wire: dates are `string` here (JSON
// serialises Date → ISO string) where the backend uses `Date`. Keep the two in
// sync — when the backend adds/changes a domain field, mirror it here.
//
// This drift (Date-vs-string + missing fields) is tracked as roadmap item T1 in
// docs/MASTER_PLAN.md; increment 2 replaces these duplicate definitions with a
// shared, date-generic module (`@rfs/types`).

/**
 * Represents the hierarchical structure of RFS organization
 */
export interface StationHierarchy {
  jurisdiction: string;     // State level (e.g., "NSW")
  area: string;             // Area/Region level
  district: string;         // District level
  brigade: string;          // Brigade name (typically same as station name for 1:1 brigades)
  station: string;          // Station name (same as brigade for most stations)
}

/**
 * Represents an RFS station
 */
export interface Station {
  id: string;                   // Unique station ID
  name: string;                 // Station name (defaults to brigade name for 1:1 relationship)
  brigadeId: string;            // Brigade ID (for cross-station visibility within same brigade)
  brigadeName: string;          // Brigade name (typically same as station name)
  hierarchy: StationHierarchy;  // Full organizational hierarchy
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  isActive: boolean;            // Whether station is currently active
  kioskToken?: string;          // Secure token for kiosk mode access (optional)
  organizationId?: string;      // SaaS tenancy: owning Organization (optional for backward compat)
  createdAt: string;
  updatedAt: string;
}

/**
 * Station lookup result from national dataset
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

export interface Member {
  id: string;
  name: string;
  qrCode: string;
  memberNumber?: string;
  rank?: string | null;
  firstName?: string;
  lastName?: string;
  membershipStartDate?: string | null;  // When member joined the brigade (ISO string, can differ from createdAt)
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  lastSignIn?: string | null;    // Last time member participated in an event (ISO string)
  isActive?: boolean;            // Whether member is active/visible
  isDeleted?: boolean;           // Soft delete flag to retain history
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  name: string;
  isCustom: boolean;
  category?: 'training' | 'maintenance' | 'meeting' | 'other';
  tagColor?: string;             // CSS color or color name for UI tags
  createdBy?: string;
  stationId?: string;            // Multi-station support (optional, shared activities use 'default')
  createdAt: string;
  isDeleted?: boolean;
}

export interface CheckIn {
  id: string;
  memberId: string;
  activityId: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  checkInTime: string;
  checkInMethod: 'kiosk' | 'mobile' | 'qr';
  location?: string;
  isOffsite: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInWithDetails extends CheckIn {
  memberName: string;
  activityName: string;
  activityTagColor?: string;
  tagColor?: string; // Legacy field, same as activityTagColor
}

export interface ActiveActivity {
  id: string;
  activityId: string;
  stationId?: string;            // Multi-station support (optional, each station has its own active activity)
  setAt: string;
  setBy?: string;
  activity?: Activity;
}

export type CheckInMethod = 'kiosk' | 'mobile' | 'qr';

/**
 * Represents a discrete instance of an activity with its own lifecycle
 */
export interface Event {
  id: string;
  activityId: string;
  activityName: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  startTime: string;
  endTime?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
}

/**
 * Represents a participant's check-in to a specific event
 */
export interface EventParticipant {
  id: string;
  eventId: string;
  memberId: string;
  memberName: string;
  memberRank?: string | null;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  checkInTime: string;
  checkInMethod: 'kiosk' | 'mobile' | 'qr';
  location?: string;
  isOffsite: boolean;
  createdAt: string;
}

/**
 * Event with all participant details for UI display
 */
export interface EventWithParticipants extends Event {
  participants: EventParticipant[];
  participantCount: number;
}

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
  standardItems: ChecklistItem[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Complete check run with all results
 */
export interface CheckRunWithResults extends CheckRun {
  results: CheckResult[];
}
