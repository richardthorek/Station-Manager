// ============================================
// Multi-Station Support Types
// ============================================

/**
 * Represents the hierarchical structure of RFS organization
 * 
 * Note: Most brigades have 1 station (brigade name = station name).
 * Only a few brigades have multiple stations (e.g., "Bungendore North" and "Bungendore South").
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
 * 
 * Design: Brigade-to-station is typically 1:1, so station name usually matches brigade name.
 * For brigades with multiple stations, brigade name is shared (e.g., brigade: "Bungendore",
 * stations: "Bungendore North", "Bungendore South").
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
  kioskToken?: string;          // Secure, unguessable token for kiosk mode access (optional)
  organizationId?: string;      // SaaS tenancy: owning Organization (optional for backward compat)
  createdAt: Date;
  updatedAt: Date;
}

export type StationCreationPayload = Omit<Station, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/**
 * Brigade Access Token
 * Used to lock kiosk devices to a specific brigade
 */
export interface BrigadeAccessToken {
  token: string;                // Unique, unguessable token (UUID)
  brigadeId: string;            // Brigade ID this token grants access to
  stationId: string;            // Specific station within the brigade
  createdAt: Date;
  expiresAt?: Date;             // Optional expiration date
  description?: string;         // Optional description (e.g., "Main Kiosk")
}

/**
 * Admin User - for authentication
 * Used to protect administrative operations
 */
export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  role: 'owner' | 'admin' | 'viewer';
  organizationId?: string;       // SaaS tenancy: which Organization this user belongs to
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

/**
 * SaaS plan codes. Plans map to a default set of Entitlements
 * (see backend/src/constants/plans.ts).
 */
export type PlanCode = 'community' | 'basic' | 'ai';

export type OrganizationStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

/**
 * Feature entitlements for an organization. Derived from the plan, but the
 * module toggles (signInEnabled / truckCheckEnabled / reportsEnabled) can be
 * narrowed by the owner — e.g. a maintenance-only brigade can hide the
 * sign-in book, and a sign-in-only brigade can hide truck checks.
 * `aiEnabled` can never exceed what the plan allows.
 */
export interface Entitlements {
  signInEnabled: boolean;
  truckCheckEnabled: boolean;
  reportsEnabled: boolean;
  aiEnabled: boolean;
  maxStations: number;
  maxDevices: number;
  aiIncludedSessions: number;
}

export type EntitlementFeature = 'signInEnabled' | 'truckCheckEnabled' | 'reportsEnabled' | 'aiEnabled';

/**
 * Organization — the top-level SaaS billing tenant. Owns one or more
 * stations/brigades, holds the (future) Stripe subscription, and carries the
 * resolved feature entitlements used for gating.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;                  // url-safe unique handle
  billingEmail: string;
  planCode: PlanCode;
  status: OrganizationStatus;
  entitlements: Entitlements;
  stripeCustomerId?: string;     // reserved for Stripe Billing (not yet wired)
  stripeSubscriptionId?: string;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  id: string;
  name: string;
  qrCode: string;
  memberNumber?: string;
  rank?: string | null;
  firstName?: string;
  lastName?: string;
  membershipStartDate?: Date | null;  // When member joined the brigade (can differ from createdAt)
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  lastSignIn?: Date | null;      // Last time member participated in an event
  isActive?: boolean;            // Whether member is active/visible in UI
  isDeleted?: boolean;           // Soft-delete flag to retain history
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: string;
  name: string;
  isCustom: boolean;
  category?: 'training' | 'maintenance' | 'meeting' | 'other';
  tagColor?: string; // CSS color or color name for UI tags
  createdBy?: string;
  stationId?: string;            // Multi-station support (optional, shared activities use 'default')
  createdAt: Date;
  isDeleted?: boolean; // Soft delete flag - hides from UI but retains in backend
}

export interface CheckIn {
  id: string;
  memberId: string;
  activityId: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  checkInTime: Date;
  checkInMethod: 'kiosk' | 'mobile' | 'qr';
  location?: string;
  isOffsite: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveActivity {
  id: string;
  activityId: string;
  stationId?: string;            // Multi-station support (optional, each station has its own active activity)
  setAt: Date;
  setBy?: string;
}

export interface CheckInWithDetails extends CheckIn {
  memberName: string;
  activityName: string;
  activityTagColor?: string;
}

export enum CheckInMethod {
  KIOSK = 'kiosk',
  MOBILE = 'mobile',
  QR = 'qr'
}

/**
 * Represents a discrete instance of an activity with its own lifecycle
 * An event is created from an activity type and can have multiple participants
 */
export interface Event {
  id: string;
  activityId: string;
  activityName: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean; // Soft delete flag - hides from UI but retains in backend
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
  checkInTime: Date;
  checkInMethod: 'kiosk' | 'mobile' | 'qr';
  location?: string;
  isOffsite: boolean;
  createdAt: Date;
}

/**
 * Event with all participant details for UI display
 */
export interface EventWithParticipants extends Event {
  participants: EventParticipant[];
  participantCount: number;
}

/**
 * Device information for audit logging
 */
export interface DeviceInfo {
  type?: string;           // Device type (e.g., 'mobile', 'tablet', 'desktop', 'kiosk')
  model?: string;          // Device model/name if available
  deviceId?: string;       // Unique device identifier if available (e.g., kiosk token)
  userAgent?: string;      // Browser user agent string
  ip?: string;             // IP address of the request
}

/**
 * Location information for audit logging
 */
export interface LocationInfo {
  latitude?: number;       // Geographic latitude
  longitude?: number;      // Geographic longitude
  accuracy?: number;       // Location accuracy in meters
  address?: string;        // Human-readable address or location name
  ipLocation?: string;     // IP-based location (city, state, country)
}

/**
 * Audit log entry for event membership changes
 * Provides complete traceability of who added/removed whom, when, where, and from what device
 */
export interface EventAuditLog {
  id: string;
  eventId: string;
  action: 'participant-added' | 'participant-removed';
  timestamp: Date;
  
  // Who performed the action
  performedBy?: string;    // User/member who performed the action (if known)
  
  // Who was affected
  memberId: string;
  memberName: string;
  memberRank?: string | null;
  
  // Participant details at time of action
  participantId: string;   // ID of the EventParticipant record
  checkInMethod?: 'kiosk' | 'mobile' | 'qr' | 'manual';
  
  // Device and location traceability
  deviceInfo?: DeviceInfo;
  locationInfo?: LocationInfo;
  
  // Additional context
  stationId?: string;      // Station where action occurred
  requestId?: string;      // Correlation ID for request tracing
  notes?: string;          // Optional notes or reason for action
  
  createdAt: Date;
}

/**
 * Audit record for a Stripe webhook event. Written for every event received,
 * including errors, to provide an idempotency / troubleshooting trail.
 */
export interface BillingEvent {
  id: string;
  organizationId?: string;
  stripeEventId: string;
  eventType: string;
  payload: string;       // JSON of event.data.object
  processedAt: Date;
  error?: string;        // set if processing threw
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
  /**
   * Canonical vehicle-type slug (e.g. 'cat1-pumper', 'cat7-tanker', 'bulk-water',
   * 'command'). Optional and free-form, but a shared vocabulary lets reports group
   * appliances of the same type across brigades for cross-brigade trend analysis.
   */
  vehicleType?: string;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
  /**
   * Canonical item-code slug (e.g. 'tyre-condition', 'fluid-levels',
   * 'pump-operation'). Stable across brigades and template edits, so the same
   * logical check can be aggregated even when brigades word the item differently.
   * Optional for backward compatibility with existing templates.
   */
  itemCode?: string;
  /**
   * Grouping label for the item (e.g. 'Engine Bay', 'Cabin', 'Pump & Tank').
   * Used to render the checklist in sections. Optional.
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
  startTime: Date;
  endTime?: Date;
  completedBy: string;
  completedByName?: string;
  contributors: string[]; // Array of contributor names
  additionalComments?: string;
  status: 'in-progress' | 'completed';
  hasIssues: boolean;
  createdAt: Date;
  updatedAt: Date;
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
   * Denormalised here (like itemName/itemDescription) so historical results remain
   * comparable across brigades for trend analysis even if the template changes later.
   */
  itemCode?: string;
  /** Grouping label copied from the checklist item at the time of the check. */
  section?: string;
  status: CheckStatus;
  comment?: string;
  photoUrl?: string;
  completedBy?: string; // Who completed this specific item
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete check run with all results
 */
export interface CheckRunWithResults extends CheckRun {
  results: CheckResult[];
}

// ============================================
// Station Types (RFS Facilities)
// ============================================

export * from './stations';
