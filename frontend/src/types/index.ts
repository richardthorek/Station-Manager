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
