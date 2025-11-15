import { Member, Activity, CheckIn, ActiveActivity, CheckInWithDetails } from '../types';
import { v4 as uuidv4 } from 'uuid';

class DatabaseService {
  private members: Map<string, Member> = new Map();
  private activities: Map<string, Activity> = new Map();
  private checkIns: Map<string, CheckIn> = new Map();
  private activeActivity: ActiveActivity | null = null;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Add default activities
    const defaultActivities = [
      { id: uuidv4(), name: 'Training', isCustom: false, createdAt: new Date() },
      { id: uuidv4(), name: 'Maintenance', isCustom: false, createdAt: new Date() },
      { id: uuidv4(), name: 'Meeting', isCustom: false, createdAt: new Date() },
    ];

    defaultActivities.forEach(activity => {
      this.activities.set(activity.id, activity);
    });

    // Set first activity as active
    if (defaultActivities.length > 0) {
      this.activeActivity = {
        id: uuidv4(),
        activityId: defaultActivities[0].id,
        setAt: new Date(),
      };
    }

    // Add sample members for testing
    const sampleMembers = [
      'John Smith',
      'Sarah Johnson',
      'Michael Brown',
      'Emily Davis',
      'David Wilson',
      'Lisa Anderson',
      'James Taylor',
      'Jennifer Martinez',
    ];

    sampleMembers.forEach(name => {
      const member: Member = {
        id: uuidv4(),
        name,
        qrCode: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.members.set(member.id, member);
    });
  }

  // Member methods
  getAllMembers(): Member[] {
    return Array.from(this.members.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  getMemberById(id: string): Member | undefined {
    return this.members.get(id);
  }

  getMemberByQRCode(qrCode: string): Member | undefined {
    return Array.from(this.members.values()).find(m => m.qrCode === qrCode);
  }

  createMember(name: string): Member {
    const member: Member = {
      id: uuidv4(),
      name,
      qrCode: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.members.set(member.id, member);
    return member;
  }

  updateMember(id: string, name: string): Member | undefined {
    const member = this.members.get(id);
    if (member) {
      member.name = name;
      member.updatedAt = new Date();
      return member;
    }
    return undefined;
  }

  // Activity methods
  getAllActivities(): Activity[] {
    return Array.from(this.activities.values()).sort((a, b) => {
      // Default activities first, then custom ones
      if (a.isCustom !== b.isCustom) {
        return a.isCustom ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  getActivityById(id: string): Activity | undefined {
    return this.activities.get(id);
  }

  createActivity(name: string, createdBy?: string): Activity {
    const activity: Activity = {
      id: uuidv4(),
      name,
      isCustom: true,
      createdBy,
      createdAt: new Date(),
    };
    this.activities.set(activity.id, activity);
    return activity;
  }

  // Active Activity methods
  getActiveActivity(): ActiveActivity | null {
    return this.activeActivity;
  }

  setActiveActivity(activityId: string, setBy?: string): ActiveActivity {
    this.activeActivity = {
      id: uuidv4(),
      activityId,
      setAt: new Date(),
      setBy,
    };
    return this.activeActivity;
  }

  // Check-in methods
  getAllCheckIns(): CheckIn[] {
    return Array.from(this.checkIns.values());
  }

  getCheckInsByMember(memberId: string): CheckIn[] {
    return Array.from(this.checkIns.values())
      .filter(checkIn => checkIn.memberId === memberId)
      .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
  }

  getActiveCheckIns(): CheckInWithDetails[] {
    const activeCheckIns = Array.from(this.checkIns.values())
      .filter(checkIn => checkIn.isActive)
      .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());

    return activeCheckIns.map(checkIn => {
      const member = this.members.get(checkIn.memberId);
      const activity = this.activities.get(checkIn.activityId);
      return {
        ...checkIn,
        memberName: member?.name || 'Unknown',
        activityName: activity?.name || 'Unknown',
      };
    });
  }

  getCheckInByMember(memberId: string): CheckIn | undefined {
    return Array.from(this.checkIns.values())
      .find(checkIn => checkIn.memberId === memberId && checkIn.isActive);
  }

  createCheckIn(
    memberId: string,
    activityId: string,
    method: 'kiosk' | 'mobile' | 'qr',
    location?: string,
    isOffsite: boolean = false
  ): CheckIn {
    const checkIn: CheckIn = {
      id: uuidv4(),
      memberId,
      activityId,
      checkInTime: new Date(),
      checkInMethod: method,
      location,
      isOffsite,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.checkIns.set(checkIn.id, checkIn);
    return checkIn;
  }

  deactivateCheckIn(checkInId: string): boolean {
    const checkIn = this.checkIns.get(checkInId);
    if (checkIn) {
      checkIn.isActive = false;
      checkIn.updatedAt = new Date();
      return true;
    }
    return false;
  }

  deactivateCheckInByMember(memberId: string): boolean {
    const checkIn = Array.from(this.checkIns.values())
      .find(checkIn => checkIn.memberId === memberId && checkIn.isActive);
    
    if (checkIn) {
      checkIn.isActive = false;
      checkIn.updatedAt = new Date();
      return true;
    }
    return false;
  }

  clearAllActiveCheckIns(): void {
    Array.from(this.checkIns.values())
      .filter(checkIn => checkIn.isActive)
      .forEach(checkIn => {
        checkIn.isActive = false;
        checkIn.updatedAt = new Date();
      });
  }
}

export const db = new DatabaseService();
