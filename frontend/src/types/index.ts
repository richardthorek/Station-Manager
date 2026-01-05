export interface Member {
  id: string;
  name: string;
  qrCode: string;
  memberNumber?: string;
  rank?: string | null;
  firstName?: string;
  lastName?: string;
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
