export interface Member {
  id: string;
  name: string;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  name: string;
  isCustom: boolean;
  createdBy?: string;
  createdAt: string;
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
}

/**
 * Represents a participant's check-in to a specific event
 */
export interface EventParticipant {
  id: string;
  eventId: string;
  memberId: string;
  memberName: string;
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
