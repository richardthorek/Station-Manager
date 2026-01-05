/**
 * In-Memory Database Service
 * 
 * Provides in-memory data storage for development and testing.
 * Uses JavaScript Maps for efficient key-value storage.
 * 
 * Features:
 * - Member, activity, and check-in management
 * - Event and participant tracking
 * - Auto-initialization with default activities
 * - Dev sample data for testing
 * - Fast, synchronous operations
 * - Automatic event expiry after configured hours (events remain visible, just inactive)
 * 
 * Note: Data is lost on server restart. Use Azure Table Storage for persistence.
 */

import { Member, Activity, CheckIn, ActiveActivity, CheckInWithDetails, Event, EventParticipant, EventWithParticipants } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { autoExpireEvents } from './rolloverService';

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

    const preferTableStorage = (process.env.USE_TABLE_STORAGE === 'true' || process.env.NODE_ENV === 'development')
      && !!process.env.AZURE_STORAGE_CONNECTION_STRING;
    // Only seed noisy dev data when we're actually using in-memory (not when dev is pointing at Table Storage)
    if (!preferTableStorage && process.env.NODE_ENV !== 'production') {
      this.initializeDevData();
    }
  }

  // Helpers for activity category and color
  private inferCategoryFromName(name: string): 'training' | 'maintenance' | 'meeting' | 'other' {
    const n = name.toLowerCase();
    if (n.includes('train')) return 'training';
    if (n.includes('maint')) return 'maintenance';
    if (n.includes('meet')) return 'meeting';
    return 'other';
  }

  private colorForCategory(category: string): string {
    switch (category) {
      case 'training': return '#008550';
      case 'maintenance': return '#fbb034';
      case 'meeting': return '#215e9e';
      default: return '#bcbec0';
    }
  }

  private isDefaultActivityName(name: string): boolean {
    const n = name.trim().toLowerCase();
    return [
      'training',
      'maintenance',
      'meeting',
      'brigade training',
      'district training'
    ].includes(n);
  }

  private initializeDefaultData() {
    // Add default activities
    const defaultActivities: Activity[] = [
      { id: uuidv4(), name: 'Training', isCustom: false, category: 'training', tagColor: '#008550', createdAt: new Date() },
      { id: uuidv4(), name: 'Maintenance', isCustom: false, category: 'maintenance', tagColor: '#fbb034', createdAt: new Date() },
      { id: uuidv4(), name: 'Meeting', isCustom: false, category: 'meeting', tagColor: '#215e9e', createdAt: new Date() },
      { id: uuidv4(), name: 'Brigade Training', isCustom: false, category: 'training', tagColor: '#cbdb2a', createdAt: new Date() },
      { id: uuidv4(), name: 'District Training', isCustom: false, category: 'training', tagColor: '#008550', createdAt: new Date() },
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
      'Robert Lee',
      'Mary Williams',
      'Christopher Thompson',
      'Patricia Garcia',
      'Daniel Rodriguez',
      'Linda Martinez',
      'Matthew Anderson',
      'Barbara Thomas',
      'Joseph Jackson',
      'Elizabeth White',
      'Charles Harris',
      'Susan Clark',
      'Thomas Lewis',
      'Jessica Robinson',
      'Christopher Walker',
      'Sarah Hall',
      'Joshua Allen',
      'Nancy Young',
      'Andrew King',
      'Margaret Wright',
      'Ryan Lopez',
      'Dorothy Hill',
      'Nicholas Scott',
      'Betty Green',
      'Jonathan Adams',
      'Helen Baker',
      'Brandon Nelson',
      'Sandra Carter',
      'Benjamin Mitchell',
      'Ashley Perez',
      'Samuel Roberts',
      'Kimberly Turner',
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

  private initializeDevData() {
    console.log('🔧 Initializing development data...');
    
    const members = Array.from(this.members.values());
    const activities = Array.from(this.activities.values());
    
    if (members.length === 0 || activities.length === 0) {
      console.warn('No members or activities available for dev data');
      return;
    }

    // Create events from the past week
    const now = new Date();
    const eventsToCreate = 15;
    
    for (let i = 0; i < eventsToCreate; i++) {
      // Create events at various times in the past
      const daysAgo = Math.floor(i / 3); // Group events by day
      const hoursAgo = (i % 3) * 4 + Math.random() * 2; // Spread throughout the day
      const eventTime = new Date(now.getTime() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);
      
      // Pick a random activity
      const activity = activities[i % activities.length];
      
      const event: Event = {
        id: uuidv4(),
        activityId: activity.id,
        activityName: activity.name,
        startTime: eventTime,
        endTime: i < 2 ? undefined : new Date(eventTime.getTime() + (2 + Math.random() * 3) * 60 * 60 * 1000), // Random 2-5 hour duration
        isActive: i < 2, // Keep 2 most recent events active
        createdAt: eventTime,
        updatedAt: eventTime,
      };
      
      this.events.set(event.id, event);
      
      // Add random participants to each event
      const participantCount = Math.floor(Math.random() * 6) + 3; // 3-8 participants
      const shuffledMembers = [...members].sort(() => Math.random() - 0.5);
      
      for (let j = 0; j < participantCount && j < shuffledMembers.length; j++) {
        const member = shuffledMembers[j];
        const checkInOffset = Math.random() * 30; // Check-in within first 30 minutes
        const checkInTime = new Date(eventTime.getTime() + checkInOffset * 60 * 1000);
        
        const methods: Array<'kiosk' | 'mobile' | 'qr'> = ['kiosk', 'mobile', 'qr'];
        const method = methods[Math.floor(Math.random() * methods.length)];
        
        const participant: EventParticipant = {
          id: uuidv4(),
          eventId: event.id,
          memberId: member.id,
          memberName: member.name,
          checkInTime,
          checkInMethod: method,
          isOffsite: Math.random() > 0.85, // 15% chance of offsite
          createdAt: checkInTime,
        };
        
        this.eventParticipants.set(participant.id, participant);
      }
    }
    
    console.log(`✅ Created ${eventsToCreate} dev events with participants`);
  }

  // Member methods
  getAllMembers(): Member[] {
    // Calculate date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Count check-ins per member in the last 6 months
    const checkInCounts = new Map<string, number>();
    
    Array.from(this.eventParticipants.values()).forEach(participant => {
      if (participant.checkInTime >= sixMonthsAgo) {
        const currentCount = checkInCounts.get(participant.memberId) || 0;
        checkInCounts.set(participant.memberId, currentCount + 1);
      }
    });
    
    // Sort members by check-in count (descending), then by name
    return Array.from(this.members.values()).sort((a, b) => {
      const countA = checkInCounts.get(a.id) || 0;
      const countB = checkInCounts.get(b.id) || 0;
      
      if (countB !== countA) {
        return countB - countA; // More check-ins first
      }
      return a.name.localeCompare(b.name); // Alphabetical for ties
    });
  }

  getMemberById(id: string): Member | undefined {
    return this.members.get(id);
  }

  getMemberByQRCode(qrCode: string): Member | undefined {
    return Array.from(this.members.values()).find(m => m.qrCode === qrCode);
  }

  createMember(name: string, details?: { rank?: string | null; firstName?: string; lastName?: string; preferredName?: string; memberNumber?: string }): Member {
    const member: Member = {
      id: uuidv4(),
      name,
      qrCode: uuidv4(),
      memberNumber: details?.memberNumber || undefined,
      rank: details?.rank || undefined,
      firstName: details?.firstName || undefined,
      lastName: details?.lastName || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.members.set(member.id, member);
    return member;
  }

  updateMember(id: string, name: string, rank?: string | null): Member | undefined {
    const member = this.members.get(id);
    if (member) {
      member.name = name;
      member.rank = rank === undefined ? null : rank;
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
    const isCustom = !this.isDefaultActivityName(name);
    const category: Activity['category'] = isCustom ? 'other' : this.inferCategoryFromName(name);
    const activity: Activity = {
      id: uuidv4(),
      name,
      isCustom,
      category,
      tagColor: this.colorForCategory(category),
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
        activityTagColor: activity?.tagColor || undefined,
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
   * Get only active events (not yet ended and not expired)
   * Note: This auto-expires events that have exceeded the time limit.
   * Expired events remain visible in getEvents(), they're just marked as inactive.
   */
  getActiveEvents(): Event[] {
    const activeEvents = Array.from(this.events.values())
      .filter(event => event.isActive)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    // Auto-expire events that have exceeded time limit
    // This is synchronous because in-memory DB operations are instant
    autoExpireEvents(activeEvents, this as any).then(() => {
      // Events have been marked inactive in the database
    }).catch(err => {
      console.error('Error auto-expiring events:', err);
    });
    
    // Return only currently active events (excluding ones we just expired)
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
   * Reactivate an ended event (clears end time and sets isActive to true)
   */
  reactivateEvent(eventId: string): Event | null {
    const event = this.events.get(eventId);
    if (!event) {
      return null;
    }

    event.endTime = undefined;
    event.isActive = true;
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
      memberRank: member.rank || null,
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

  // ============================================
  // Reporting Methods
  // ============================================

  /**
   * Get attendance summary - monthly participant counts
   */
  getAttendanceSummary(startDate: Date, endDate: Date): Array<{ month: string; count: number }> {
    const participants = Array.from(this.eventParticipants.values())
      .filter(p => p.checkInTime >= startDate && p.checkInTime <= endDate);

    // Group by month
    const monthCounts = new Map<string, number>();
    participants.forEach(p => {
      const monthKey = `${p.checkInTime.getFullYear()}-${String(p.checkInTime.getMonth() + 1).padStart(2, '0')}`;
      monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
    });

    return Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get member participation - top members by event participation
   */
  getMemberParticipation(startDate: Date, endDate: Date, limit: number = 10): Array<{
    memberId: string;
    memberName: string;
    participationCount: number;
    lastCheckIn: Date;
  }> {
    const participants = Array.from(this.eventParticipants.values())
      .filter(p => p.checkInTime >= startDate && p.checkInTime <= endDate);

    // Group by member
    const memberStats = new Map<string, { name: string; count: number; lastCheckIn: Date }>();
    participants.forEach(p => {
      const existing = memberStats.get(p.memberId);
      if (!existing) {
        memberStats.set(p.memberId, {
          name: p.memberName,
          count: 1,
          lastCheckIn: p.checkInTime,
        });
      } else {
        existing.count += 1;
        if (p.checkInTime > existing.lastCheckIn) {
          existing.lastCheckIn = p.checkInTime;
        }
      }
    });

    return Array.from(memberStats.entries())
      .map(([memberId, stats]) => ({
        memberId,
        memberName: stats.name,
        participationCount: stats.count,
        lastCheckIn: stats.lastCheckIn,
      }))
      .sort((a, b) => b.participationCount - a.participationCount)
      .slice(0, limit);
  }

  /**
   * Get activity breakdown - count by activity category
   */
  getActivityBreakdown(startDate: Date, endDate: Date): Array<{
    category: string;
    count: number;
    percentage: number;
  }> {
    const events = Array.from(this.events.values())
      .filter(e => e.startTime >= startDate && e.startTime <= endDate);

    const categoryCounts = new Map<string, number>();
    events.forEach(event => {
      const activity = this.activities.get(event.activityId);
      const category = activity?.category || 'other';
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    const total = events.length;
    return Array.from(categoryCounts.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get event statistics
   */
  getEventStatistics(startDate: Date, endDate: Date): {
    totalEvents: number;
    activeEvents: number;
    completedEvents: number;
    totalParticipants: number;
    averageParticipantsPerEvent: number;
    averageDuration: number; // in minutes
  } {
    const events = Array.from(this.events.values())
      .filter(e => e.startTime >= startDate && e.startTime <= endDate);

    const activeEvents = events.filter(e => e.isActive).length;
    const completedEvents = events.filter(e => !e.isActive && e.endTime).length;

    const participants = Array.from(this.eventParticipants.values())
      .filter(p => p.checkInTime >= startDate && p.checkInTime <= endDate);

    // Calculate average duration for completed events
    const durations = events
      .filter(e => e.endTime)
      .map(e => (e.endTime!.getTime() - e.startTime.getTime()) / (1000 * 60)); // minutes

    const averageDuration = durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;

    return {
      totalEvents: events.length,
      activeEvents,
      completedEvents,
      totalParticipants: participants.length,
      averageParticipantsPerEvent: events.length > 0
        ? Math.round((participants.length / events.length) * 10) / 10
        : 0,
      averageDuration,
    };
  }
}

export const db = new DatabaseService();
