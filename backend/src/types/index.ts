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
