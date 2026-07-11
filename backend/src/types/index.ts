// ============================================
// Multi-Station Support Types
// ============================================
//
// The core sign-in domain shapes (Station, Member, Activity, CheckIn,
// ActiveActivity, Event, EventParticipant, …) are defined ONCE in the
// date-generic module `shared/domain-types.d.ts` and re-exported here
// specialised with `Date` (the persistence representation). The frontend
// re-exports the same module with the default `string` (the wire
// representation). See T1 increment 2 in docs/MASTER_PLAN.md.

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

export type StationHierarchy = SharedStationHierarchy;
export type Station = SharedStation<Date>;

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

/** AC-5 device type: what kind of hardware is enrolled. */
export type DeviceType = 'kiosk' | 'tablet' | 'phone' | 'wearable';

/** AC-5 device status: revocation is a status flip, not a delete. */
export type DeviceStatus = 'active' | 'revoked';

/**
 * AC-5 — a first-class device account, formalising the anonymous
 * `BrigadeAccessToken` UUID into a named, typed, revocable credential with a
 * last-seen audit trail. The token is validated the same way a
 * BrigadeAccessToken is (both back a `/signin?brigade=<token>` kiosk URL), so
 * existing kiosk URLs and this session's new AccessRoute gate are unaffected.
 * See docs/wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md §4.
 */
export interface Device {
  id: string;
  organizationId?: string;      // owning org; optional for back-compat (kiosk/demo without org context)
  stationId: string;            // station this device is locked to
  type: DeviceType;
  name: string;                 // e.g. "Main shed kiosk", "Captain's phone"
  token: string;                // unguessable credential (UUID), same model as BrigadeAccessToken
  status: DeviceStatus;
  description?: string;
  lastSeenAt?: Date;            // updated each time the token is validated
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
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
  /** Max members in the sign-in book (free tier is capped; paid is effectively unlimited). */
  maxMembers: number;
  /** Max vehicles/appliances for truck checks (free tier is capped). */
  maxVehicles: number;
  aiIncludedSessions: number;
  /** Per-app suite flags — controls which Bushie Tools apps are accessible. */
  aarStudioEnabled: boolean;
  santaRunEnabled: boolean;
  fireBreakEnabled: boolean;
}

export type EntitlementFeature =
  | 'signInEnabled'
  | 'truckCheckEnabled'
  | 'reportsEnabled'
  | 'aiEnabled'
  | 'aarStudioEnabled'
  | 'santaRunEnabled'
  | 'fireBreakEnabled';

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
  /**
   * Purchased AI top-up sessions that carry over month-to-month (they do not
   * reset). Consumed only after the monthly `aiIncludedSessions` allowance is
   * exhausted. See the C3 commercialisation track in docs/MASTER_PLAN.md.
   */
  aiBonusSessions?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI usage metering. One row per billable AI action routed through the
 * server-side AI gateway (`/api/ai/*`). A "session" — the unit the AI plan
 * allowance (`aiIncludedSessions`) is measured in — corresponds to a `speech`
 * record (one live-listen start). `chat`/`report` rows are recorded for cost
 * visibility but do not consume the session allowance.
 */
export type UsageType = 'chat' | 'report' | 'speech';

export interface UsageRecord {
  id: string;
  organizationId: string;
  sessionId?: string;            // optional correlation id (AAR review/session)
  type: UsageType;
  units: number;                 // sessions for 'speech'; provider calls for chat/report
  createdAt: Date;
  reportedToStripe?: boolean;    // set once batched metered usage is sent to Stripe
}

export type Member = SharedMember<Date>;

export type Activity = SharedActivity<Date>;

export type CheckIn = SharedCheckIn<Date>;

export type ActiveActivity = SharedActiveActivity<Date>;

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

export type Event = SharedEvent<Date>;

export type EventParticipant = SharedEventParticipant<Date>;

export type EventWithParticipants = SharedEventWithParticipants<Date>;

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

/**
 * A persisted AAR Studio review, scoped to the owning organization. The full
 * client-side session object (incident metadata, segments, findings, notes,
 * report, …) is stored verbatim as a JSON string in `payload` — AAR Studio is a
 * no-build vanilla app that owns its own session schema, so the backend treats
 * the body as an opaque blob and only indexes the fields it needs for listing
 * and access control. A few denormalised fields (title/incidentDate/stationId)
 * are lifted out for the roster listing without parsing every payload.
 */
export interface AARSession {
  id: string;
  organizationId: string;
  stationId?: string;            // optional brigade/station the review belongs to
  title: string;                 // denormalised incident title (or friendly fallback)
  incidentDate?: string;         // denormalised incident date (ISO yyyy-mm-dd)
  schemaVersion: number;         // AAR Studio session schema version
  payload: string;               // JSON of the full AAR Studio session object
  createdBy?: string;            // userId of the facilitator who saved it
  createdByName?: string;        // display name of the facilitator
  /**
   * The review's last-edit time on the device that saved it (the AAR session's
   * own `updatedAt`). Used for optimistic-concurrency conflict detection — a save
   * carrying an older `clientUpdatedAt` than the stored one is a stale overwrite
   * and is rejected. Distinct from `updatedAt`, which is when the *server* last
   * wrote the row.
   */
  clientUpdatedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Truck Checks Types
// ============================================

/**
 * A standard vehicle type (e.g. "NSW RFS Cat 1 Tanker"). Owns the canonical
 * **standard checklist** whose items are immutable for brigades — this locked
 * core is what makes outcomes comparable across brigades running the same type.
 * A brigade adopts a type for its vehicles and may add its own custom items and
 * reorder, but never edit/remove the standard items (see EffectiveChecklist).
 *
 * Scoping: org-scoped by default; `isStandard` marks a type published as a
 * shared standard that any org can adopt. (Curation is open to any owner for
 * now; tighter validation/roles are a later step — see MASTER_PLAN TC-D3.)
 */
export interface VehicleType {
  id: string;
  organizationId?: string;       // owning org; absent for a global/standard type
  isStandard: boolean;           // published as a shared standard for other orgs to adopt
  code: string;                  // canonical slug, e.g. 'cat1-tanker' (stable, used for grouping)
  name: string;                  // human label, e.g. 'Cat 1 Tanker'
  description?: string;
  category?: string;             // optional grouping, e.g. 'tanker' | 'pumper' | 'support'
  agency?: string;               // e.g. 'NSW RFS' | 'Fire and Rescue NSW' | 'NSW SES' | 'Marine Rescue NSW' | 'Generic'
  /** Locked canonical checklist. Each item carries a stable itemCode for comparison. */
  standardItems: ChecklistItem[];
  createdBy?: string;            // userId of the author
  seedVersion?: number;          // provenance marker for seeded templates; absent on org-authored types
  createdAt: Date;
  updatedAt: Date;
}

/** Physical side/face of a truck a zone sits on (drives the agent walk-around). */
export type ApplianceZoneSide = 'driver' | 'passenger' | 'front' | 'rear' | 'top' | 'interior' | 'na';

/**
 * A1 — per-truck spatial model. A named physical area on ONE appliance ("Pump
 * Panel", "Driver-side Locker 1", "Cab"), giving every truck its own ordered,
 * optionally hierarchical set of zones. Replaces the flat `ChecklistItem.section`
 * string with real, per-appliance areas the maintenance agent can walk in order
 * and prompt "same area" within. `zoneCode` is a canonical slug for
 * cross-brigade analytics (seeded from a per-vehicleType starter taxonomy, then
 * edited by the brigade). See docs/wiki/developer/history/archive/AI_MAINTENANCE_AGENT_DESIGN.md §4.1.
 */
export interface ApplianceZone {
  id: string;
  applianceId: string;           // belongs to exactly ONE truck → uniqueness
  stationId?: string;            // multi-station scoping (optional)
  name: string;                  // human label, e.g. 'Pump Panel'
  zoneCode?: string;             // canonical slug for analytics, e.g. 'pump-panel'
  parentZoneId?: string;         // optional hierarchy (Locker 1 under Driver-side lockers)
  side?: ApplianceZoneSide;      // which face of the truck
  order: number;                 // natural walk-around order (drives agent flow)
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A1 — per-truck inventory. A piece of equipment that lives on ONE appliance
 * ("Holmatro spreader", "BA set #2", "Akron branch"), optionally located in a
 * zone. Captures the equipment differences between trucks so the maintenance
 * agent knows what's actually on *this* vehicle (and where). `equipmentCode` is
 * a canonical slug for analytics. See docs/wiki/developer/history/archive/AI_MAINTENANCE_AGENT_DESIGN.md §4.2.
 */
export interface ApplianceEquipment {
  id: string;
  applianceId: string;           // belongs to exactly ONE truck
  stationId?: string;            // multi-station scoping (optional)
  name: string;                  // human label, e.g. 'Holmatro spreader'
  equipmentCode?: string;        // canonical slug for analytics
  zoneId?: string;               // where it lives on the truck (ApplianceZone)
  serialNumber?: string;
  notes?: string;
  active: boolean;               // false = retired/removed but kept for history
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents an appliance/vehicle that needs checking.
 *
 * Identity fields let a specific vehicle be tracked across brigades if it moves
 * (agency fleet number / registration / VIN) and capture the make/model/year
 * that vary within a single vehicle type (there have been many "Cat 1" builds
 * from different manufacturers). `vehicleTypeId` links to the VehicleType whose
 * standard checklist this vehicle inherits.
 */
export interface Appliance {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  /** Link to the VehicleType supplying the standard checklist (optional, back-compat). */
  vehicleTypeId?: string;
  /**
   * Legacy free-form vehicle-type slug (e.g. 'cat1-pumper'). Superseded by
   * `vehicleTypeId`; retained for back-compat and existing report grouping.
   */
  vehicleType?: string;
  // ─── Vehicle identity (all optional) ───
  agencyId?: string;             // agency fleet/asset number (e.g. NSW RFS fleet no.) — primary tracking id
  registration?: string;         // number plate
  vin?: string;                  // Vehicle Identification Number (optional standard unique id)
  make?: string;                 // manufacturer, e.g. 'Isuzu'
  model?: string;                // model, e.g. 'FTS 800'
  year?: number;                 // build/registration year
  // ─── A1 agent context (all optional) ───
  variant?: string;              // build/body variant, e.g. 'Isuzu FTS', 'BTM body'
  inServiceDate?: string;        // ISO date the appliance entered service (age nuance)
  quirksNotes?: string;          // free-text brigade knowledge fed to the agent,
                                 // e.g. 'hatch sticks in cold', 'secondary pump primes slowly'
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Per-appliance checklist.
 *
 * Two roles depending on whether the appliance is linked to a VehicleType:
 *  - **Legacy / no type:** `items` is the full editable checklist (original behaviour).
 *  - **Type-linked (customisation overlay):** `items` holds only the brigade's
 *    *custom* items; the standard items come live from the VehicleType (so type
 *    updates propagate). `itemOrder` is the brigade's preferred ordering as a
 *    list of keys — a standard item's `itemCode` or a custom item's `id` — used
 *    to interleave standard and custom items. The resolved, locked-and-merged
 *    view is an EffectiveChecklist.
 */
export interface ChecklistTemplate {
  id: string;
  applianceId: string;
  applianceName: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  items: ChecklistItem[];
  /** Brigade ordering keys (standard item `itemCode` or custom item `id`); type-linked only. */
  itemOrder?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The resolved checklist an inspector actually works through for one appliance:
 * the VehicleType's standard items (locked) merged with the brigade's custom
 * items, in the brigade's chosen order. Computed, not stored.
 */
export interface EffectiveChecklist {
  applianceId: string;
  applianceName: string;
  vehicleTypeId?: string;
  vehicleTypeName?: string;
  items: ChecklistItem[];        // each carries isStandard so the UI can lock standard rows
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
   * True when this item comes from a VehicleType's locked standard checklist
   * (content owned by the type, immutable for the brigade). Custom items added
   * by a brigade are false/absent. Set by the server when resolving an
   * EffectiveChecklist; persisted on a VehicleType's standardItems.
   */
  isStandard?: boolean;
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
  /**
   * A1 — link to an ApplianceZone (richer than the flat `section` string). When
   * present, the maintenance agent can group the check by physical area and walk
   * it in zone order. Optional / back-compatible.
   */
  zoneId?: string;
  /** A1 — this item checks a specific ApplianceEquipment piece (optional). */
  equipmentId?: string;
  /**
   * A1 — shape of the expected answer, so the agent knows how to ask/parse:
   * 'ok-issue' (default pass/fail), 'numeric' (a reading + `unit`), 'level'
   * (e.g. low/half/full), or free 'text'. Optional; absent = 'ok-issue'.
   */
  expectedResponseType?: 'ok-issue' | 'numeric' | 'level' | 'text';
  /** A1 — unit for a numeric response, e.g. 'psi', 'L', '%'. Optional. */
  unit?: string;
  /** A1 — optional phrasing nudge for the agent when prompting this item. */
  promptHint?: string;
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
  /** A3 — how this run was produced. Defaults to 'manual'. */
  source?: 'manual' | 'voice' | 'voice-vision';
  /** A3 — link to the AgentSession transcript when source !== 'manual'. */
  agentSessionId?: string;
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
  /**
   * Follow-up lifecycle for a result whose status is 'issue' (TC-4). Defaults to
   * 'open' when an issue is recorded; an equipment officer moves it to
   * 'acknowledged' then 'resolved'. Non-issue results leave these unset.
   */
  issueStatus?: 'open' | 'acknowledged' | 'resolved';
  issueNote?: string;       // follow-up / resolution note
  assignedTo?: string;      // optional owner (memberId or name)
  resolvedBy?: string;      // who resolved it
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Lifecycle fields an equipment officer can update on an issue result (TC-4). */
export interface IssueUpdate {
  issueStatus?: 'open' | 'acknowledged' | 'resolved';
  issueNote?: string;
  assignedTo?: string;
  resolvedBy?: string;
}

/**
 * Complete check run with all results
 */
export interface CheckRunWithResults extends CheckRun {
  results: CheckResult[];
}

// ============================================
// A3 — Voice Agent Session Types
// ============================================

/**
 * A3 — A live or completed voice (or voice-vision) agent session.
 * The formal CheckRun is the auditable compliance record; the AgentSession is
 * the full narrative transcript and provenance (which model, what confidence,
 * corrections, etc.).
 */
export interface AgentSession {
  id: string;
  runId?: string;               // linked CheckRun (formal output); set once run created
  applianceId: string;
  stationId?: string;
  /** Owning Organization (from the caller's JWT), when present. Scopes reads to the same tenant. */
  organizationId?: string;
  memberId?: string;            // roster member who initiated (when known)
  initiatedBy: string;          // free-text name (kiosk fallback)
  modality: 'voice' | 'voice-vision';
  status: 'active' | 'completed' | 'aborted';
  summary?: string;             // agent-generated summary written on complete_run
  /** Stable identifiers of models used (e.g. azure-openai/gpt-4o, azure-speech/stt). */
  models: string[];
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A3 — A single turn in an AgentSession transcript.
 */
export interface AgentTurn {
  id: string;
  sessionId: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  /** Transcript text (STT output for 'user', TTS source for 'agent'). */
  text?: string;
  /** JSON-serialised tool call / tool result (for role='tool'). */
  toolPayload?: string;
  /** Blob path for stored audio frame (optional, A4 onwards). */
  audioRef?: string;
  /** Vision frame blob path (A4). */
  imageRef?: string;
  /** Sequence order within the session (for ordered reads). */
  sequence: number;
  createdAt: Date;
}

// ============================================
// Station Types (RFS Facilities)
// ============================================

export * from './stations';
