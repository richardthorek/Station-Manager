// ============================================
// Multi-Station Support Types
// ============================================

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
  lastSignIn?: string | null;    // Last time member participated in an event (ISO string)
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  name: string;
  isCustom: boolean;
  createdBy?: string;
  createdAt: string;
  isDeleted?: boolean;
}

export interface CheckIn {
  id: string;
  memberId: string;
  activityId: string;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Template defining the checklist for an appliance
 */
export interface ChecklistTemplate {
  id: string;
  applianceId: string;
  applianceName: string;
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
