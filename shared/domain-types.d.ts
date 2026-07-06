// ============================================
// Shared domain types (single definition of record)
// ============================================
//
// T1 increment 2 (docs/MASTER_PLAN.md). These date-generic interfaces are the
// ONE definition of the core sign-in domain shapes, consumed by both apps:
//
//   - backend/src/types/index.ts re-exports them specialised with `Date`
//     (`Member<Date>` etc. — the in-memory/Table-Storage representation).
//   - frontend/src/types/index.ts re-exports them with the default `string`
//     (the JSON-over-the-wire representation — Date serialises to ISO string).
//
// MECHANISM: this is a declaration-only `.d.ts`. It contains interfaces and type
// aliases only (no enums / no runtime values), so TypeScript never emits it and
// it never participates in either app's `rootDir`/bundle output. Both apps pull
// it in through the import graph via a plain relative `import type`, so neither
// `package.json`, `node_modules`, nor the CI deploy packaging is touched. Add a
// shared field here ONCE and both apps see it — no more hand-mirroring.
//
// Keep enums and app-specific composites in each app's own `types/index.ts`.

/** Generic check-in method, shared across sign-in flows. */
export type CheckInMethod = 'kiosk' | 'mobile' | 'qr';

/**
 * Represents the hierarchical structure of RFS organization.
 * (No date fields — identical in both apps.)
 */
export interface StationHierarchy {
  jurisdiction: string;     // State level (e.g., "NSW")
  area: string;             // Area/Region level
  district: string;         // District level
  brigade: string;          // Brigade name (typically same as station name for 1:1 brigades)
  station: string;          // Station name (same as brigade for most stations)
}

/**
 * Represents an RFS station.
 *
 * Design: Brigade-to-station is typically 1:1, so station name usually matches
 * brigade name. For brigades with multiple stations, brigade name is shared.
 */
export interface Station<TDate = string> {
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
  createdAt: TDate;
  updatedAt: TDate;
}

export interface Member<TDate = string> {
  id: string;
  name: string;
  qrCode: string;
  memberNumber?: string;
  rank?: string | null;
  firstName?: string;
  lastName?: string;
  membershipStartDate?: TDate | null;  // When member joined the brigade (can differ from createdAt)
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  lastSignIn?: TDate | null;     // Last time member participated in an event
  isActive?: boolean;            // Whether member is active/visible in UI
  isDeleted?: boolean;           // Soft-delete flag to retain history
  /**
   * C4 member activation. 'invited' = invite token set; 'active' = member has
   * set a password and has a linked AdminUser account.
   */
  authStatus?: 'invited' | 'active';
  /** One-time activation token (cleared after use). */
  inviteToken?: string;
  /** Email address the invite was sent to. */
  inviteEmail?: string;
  createdAt: TDate;
  updatedAt: TDate;
}

export interface Activity<TDate = string> {
  id: string;
  name: string;
  isCustom: boolean;
  category?: 'training' | 'maintenance' | 'meeting' | 'other';
  tagColor?: string;             // CSS color or color name for UI tags
  createdBy?: string;
  stationId?: string;            // Multi-station support (optional, shared activities use 'default')
  createdAt: TDate;
  isDeleted?: boolean;           // Soft delete flag - hides from UI but retains in backend
}

export interface CheckIn<TDate = string> {
  id: string;
  memberId: string;
  activityId: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  checkInTime: TDate;
  checkInMethod: CheckInMethod;
  location?: string;
  isOffsite: boolean;
  isActive: boolean;
  createdAt: TDate;
  updatedAt: TDate;
}

export interface ActiveActivity<TDate = string> {
  id: string;
  activityId: string;
  stationId?: string;            // Multi-station support (optional, each station has its own active activity)
  setAt: TDate;
  setBy?: string;
}

/**
 * Represents a discrete instance of an activity with its own lifecycle.
 * An event is created from an activity type and can have multiple participants.
 */
export interface Event<TDate = string> {
  id: string;
  activityId: string;
  activityName: string;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  startTime: TDate;
  endTime?: TDate;
  isActive: boolean;
  createdBy?: string;
  createdAt: TDate;
  updatedAt: TDate;
  isDeleted?: boolean;           // Soft delete flag - hides from UI but retains in backend
}

/**
 * Represents a participant's check-in to a specific event.
 */
export interface EventParticipant<TDate = string> {
  id: string;
  eventId: string;
  memberId: string;              // For visitors (AC-2): a synthetic `visitor-<uuid>` id, not a real Member
  memberName: string;
  memberRank?: string | null;
  stationId?: string;            // Multi-station support (optional, defaults to 'default-station')
  checkInTime: TDate;
  checkInMethod: CheckInMethod;
  location?: string;
  isOffsite: boolean;
  /**
   * AC-2 — ephemeral visitor sign-in. True when this participant is a walk-up
   * guest who typed their name, NOT a persisted Member: no history, never
   * counts toward the org's member cap, and no tap-to-repeat tile in the grid.
   */
  isVisitor?: boolean;
  createdAt: TDate;
}

/**
 * Event with all participant details for UI display.
 */
export interface EventWithParticipants<TDate = string> extends Event<TDate> {
  participants: EventParticipant<TDate>[];
  participantCount: number;
}
