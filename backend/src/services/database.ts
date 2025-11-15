import { Member, Activity, CheckIn, ActiveActivity, CheckInWithDetails, Event, EventParticipant, EventWithParticipants } from '../types';
import { v4 as uuidv4 } from 'uuid';

class DatabaseService {
  private members: Map<string, Member> = new Map();
  private activities: Map<string, Activity> = new Map();
  private checkIns: Map<string, CheckIn> = new Map();
  private activeActivity: ActiveActivity | null = null;
  
  // Event-based system data structures
  private events: Map<string, Event> = new Map();
  private eventParticipants: Map<string, EventParticipant> = new Map();

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

  // ============================================
  // Event Management Methods
  // ============================================

  /**
   * Create a new event from an activity type
   * This starts a discrete activity instance
   */
  createEvent(activityId: string, createdBy?: string): Event {
    const activity = this.activities.get(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const event: Event = {
      id: uuidv4(),
      activityId,
      activityName: activity.name,
      startTime: new Date(),
      endTime: undefined,
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.events.set(event.id, event);
    return event;
  }

  /**
   * Get all events with pagination support
   * Returns most recent events first
   * @param limit - Maximum number of events to return
   * @param offset - Number of events to skip
   */
  getEvents(limit: number = 50, offset: number = 0): Event[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Get only active events (not yet ended)
   */
  getActiveEvents(): Event[] {
    return Array.from(this.events.values())
      .filter(event => event.isActive)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get a specific event by ID
   */
  getEventById(eventId: string): Event | undefined {
    return this.events.get(eventId);
  }

  /**
   * End an event and all its active participants
   */
  endEvent(eventId: string): Event | null {
    const event = this.events.get(eventId);
    if (!event) {
      return null;
    }

    event.endTime = new Date();
    event.isActive = false;
    event.updatedAt = new Date();

    return event;
  }

  /**
   * Add a participant to an event (check-in)
   */
  addEventParticipant(
    eventId: string,
    memberId: string,
    method: 'kiosk' | 'mobile' | 'qr',
    location?: string,
    isOffsite: boolean = false
  ): EventParticipant {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const member = this.members.get(memberId);
    if (!member) {
      throw new Error('Member not found');
    }

    const participant: EventParticipant = {
      id: uuidv4(),
      eventId,
      memberId,
      memberName: member.name,
      checkInTime: new Date(),
      checkInMethod: method,
      location,
      isOffsite,
      createdAt: new Date(),
    };

    this.eventParticipants.set(participant.id, participant);
    event.updatedAt = new Date();
    
    return participant;
  }

  /**
   * Get all participants for a specific event
   */
  getEventParticipants(eventId: string): EventParticipant[] {
    return Array.from(this.eventParticipants.values())
      .filter(p => p.eventId === eventId)
      .sort((a, b) => a.checkInTime.getTime() - b.checkInTime.getTime());
  }

  /**
   * Get event with all participant details
   */
  getEventWithParticipants(eventId: string): EventWithParticipants | null {
    const event = this.events.get(eventId);
    if (!event) {
      return null;
    }

    const participants = this.getEventParticipants(eventId);
    
    return {
      ...event,
      participants,
      participantCount: participants.length,
    };
  }

  /**
   * Get multiple events with participants (for log view)
   */
  getEventsWithParticipants(limit: number = 50, offset: number = 0): EventWithParticipants[] {
    const events = this.getEvents(limit, offset);
    
    return events.map(event => {
      const participants = this.getEventParticipants(event.id);
      return {
        ...event,
        participants,
        participantCount: participants.length,
      };
    });
  }

  /**
   * Remove a participant from an event (undo check-in)
   */
  removeEventParticipant(participantId: string): boolean {
    const participant = this.eventParticipants.get(participantId);
    if (!participant) {
      return false;
    }

    this.eventParticipants.delete(participantId);
    
    // Update event's updatedAt timestamp
    const event = this.events.get(participant.eventId);
    if (event) {
      event.updatedAt = new Date();
    }
    
    return true;
  }

  /**
   * Check if a member is already checked in to a specific event
   */
  getMemberParticipantInEvent(eventId: string, memberId: string): EventParticipant | undefined {
    return Array.from(this.eventParticipants.values())
      .find(p => p.eventId === eventId && p.memberId === memberId);
  }

  /**
   * Get all active participants across all active events
   */
  getAllActiveParticipants(): EventParticipant[] {
    const activeEventIds = new Set(
      Array.from(this.events.values())
        .filter(e => e.isActive)
        .map(e => e.id)
    );

    return Array.from(this.eventParticipants.values())
      .filter(p => activeEventIds.has(p.eventId))
      .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
  }
}

export const db = new DatabaseService();
