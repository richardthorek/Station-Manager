export interface Member {
  id: string;
  name: string;
  qrCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: string;
  name: string;
  isCustom: boolean;
  createdBy?: string;
  createdAt: Date;
}

export interface CheckIn {
  id: string;
  memberId: string;
  activityId: string;
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
  setAt: Date;
  setBy?: string;
}

export interface CheckInWithDetails extends CheckIn {
  memberName: string;
  activityName: string;
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
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a participant's check-in to a specific event
 */
export interface EventParticipant {
  id: string;
  eventId: string;
  memberId: string;
  memberName: string;
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
