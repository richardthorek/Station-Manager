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

import { Member, Activity, CheckIn, ActiveActivity, CheckInWithDetails, Event, EventParticipant, EventWithParticipants, Station } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { autoExpireEvents } from './rolloverService';
import { DEFAULT_STATION_ID, DEMO_STATION_ID, DEMO_BRIGADE_ID, getEffectiveStationId } from '../constants/stations';
import { DEFAULT_MEMBERS, buildDisplayName } from './defaultMembers';
import { logger } from './logger';

class DatabaseService {
  private members: Map<string, Member> = new Map();
  private activities: Map<string, Activity> = new Map();
  private checkIns: Map<string, CheckIn> = new Map();
  private activeActivity: ActiveActivity | null = null;
  
  // Event-based system data structures
  private events: Map<string, Event> = new Map();
  private eventParticipants: Map<string, EventParticipant> = new Map();
  
  // Multi-station support
  private stations: Map<string, Station> = new Map();

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

    // Create default station
    const defaultStation: Station = {
      id: DEFAULT_STATION_ID,
      name: 'Default Station',
      brigadeId: 'default-brigade',
      brigadeName: 'Default Brigade',
      hierarchy: {
        jurisdiction: 'NSW',
        area: 'Default Area',
        district: 'Default District',
        brigade: 'Default Brigade',
        station: 'Default Station',
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stations.set(defaultStation.id, defaultStation);

    // Seed default station with a small sample of 10 members
    DEFAULT_MEMBERS.slice(0, 10).forEach(seedMember => {
      const member: Member = {
        id: uuidv4(),
        name: buildDisplayName(seedMember),
        qrCode: uuidv4(),
        firstName: seedMember.firstName,
        lastName: seedMember.lastName,
        rank: seedMember.rank,
        stationId: DEFAULT_STATION_ID, // Explicitly set to default station
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.members.set(member.id, member);
    });
  }

  private initializeDevData() {
    logger.info('Initializing development data');
    
    // Create demo station
    const demoStation: Station = {
      id: DEMO_STATION_ID,
      name: 'Demo Station',
      brigadeId: DEMO_BRIGADE_ID,
      brigadeName: 'Demo Brigade',
      hierarchy: {
        jurisdiction: 'NSW',
        area: 'Demo Area',
        district: 'Demo District',
        brigade: 'Demo Brigade',
        station: 'Demo Station',
      },
      location: {
        address: '123 Demo Street, Demo Town NSW 2000',
        latitude: -35.2809,
        longitude: 149.1300,
      },
      contactInfo: {
        phone: '1300 000 000',
        email: 'demo@example.com',
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stations.set(demoStation.id, demoStation);
    logger.info('Created demo station', { stationName: demoStation.name });
    
    const members = Array.from(this.members.values());
    const activities = Array.from(this.activities.values());
    
    if (members.length === 0 || activities.length === 0) {
      logger.warn('No members or activities available for dev data');
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
    
    logger.info('Created dev events with participants', { count: eventsToCreate });
  }

  // Member methods
  getAllMembers(stationId?: string, options?: { search?: string; filter?: string; sort?: string }): Member[] {
    // Calculate date 6 months ago for activity filtering
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Calculate 30 days ago for "active" filter
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Filter members by station if specified and exclude soft-deleted entries
    let members = Array.from(this.members.values())
      .filter(m => m.isDeleted !== true && m.isActive !== false);
    if (stationId) {
      members = members.filter(m => getEffectiveStationId(m.stationId) === stationId);
    }
    
    // Count check-ins per member in the last 6 months (for sorting and filtering)
    // Also track lastCheckIn across ALL time (not just 6 months)
    const checkInCounts = new Map<string, { count: number; lastCheckIn: Date | null }>();
    const allTimeLastCheckIn = new Map<string, Date>();
    
    Array.from(this.eventParticipants.values()).forEach(participant => {
      // Track all-time last check-in
      const currentAllTime = allTimeLastCheckIn.get(participant.memberId);
      if (!currentAllTime || participant.checkInTime > currentAllTime) {
        allTimeLastCheckIn.set(participant.memberId, participant.checkInTime);
      }
      
      // Track 6-month counts for filtering/sorting
      if (participant.checkInTime >= sixMonthsAgo) {
        const current = checkInCounts.get(participant.memberId) || { count: 0, lastCheckIn: null };
        current.count++;
        if (!current.lastCheckIn || participant.checkInTime > current.lastCheckIn) {
          current.lastCheckIn = participant.checkInTime;
        }
        checkInCounts.set(participant.memberId, current);
      }
    });
    
    // Get currently checked-in members
    const checkedInMemberIds = new Set<string>();
    Array.from(this.events.values())
      .filter(e => e.isActive)
      .forEach(event => {
        Array.from(this.eventParticipants.values())
          .filter(p => p.eventId === event.id)
          .forEach(p => checkedInMemberIds.add(p.memberId));
      });
    
    // Apply search filter
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      members = members.filter(m => {
        return (
          m.name.toLowerCase().includes(searchLower) ||
          (m.rank && m.rank.toLowerCase().includes(searchLower)) ||
          (m.memberNumber && m.memberNumber.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Apply activity filter
    if (options?.filter) {
      switch (options.filter) {
        case 'checked-in':
          members = members.filter(m => checkedInMemberIds.has(m.id));
          break;
        case 'active':
          // Active in last 30 days
          members = members.filter(m => {
            const stats = checkInCounts.get(m.id);
            return stats && stats.lastCheckIn && stats.lastCheckIn >= thirtyDaysAgo;
          });
          break;
        case 'inactive':
          // No activity in last 30 days or no activity at all
          members = members.filter(m => {
            const stats = checkInCounts.get(m.id);
            return !stats || !stats.lastCheckIn || stats.lastCheckIn < thirtyDaysAgo;
          });
          break;
        // 'all' or undefined - no filtering
      }
    }
    
    // Attach lastSignIn to each member
    const membersWithLastSignIn = members.map(m => ({
      ...m,
      lastSignIn: allTimeLastCheckIn.get(m.id) || null
    }));
    
    // Apply sorting
    if (options?.sort) {
      switch (options.sort) {
        case 'name-asc':
          membersWithLastSignIn.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'name-desc':
          membersWithLastSignIn.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case 'activity':
          // Most active first (by count)
          membersWithLastSignIn.sort((a, b) => {
            const countA = checkInCounts.get(a.id)?.count || 0;
            const countB = checkInCounts.get(b.id)?.count || 0;
            if (countB !== countA) return countB - countA;
            return a.name.localeCompare(b.name); // Alphabetical for ties
          });
          break;
        case 'recent':
          // Most recently active first
          membersWithLastSignIn.sort((a, b) => {
            const lastA = checkInCounts.get(a.id)?.lastCheckIn;
            const lastB = checkInCounts.get(b.id)?.lastCheckIn;
            if (!lastA && !lastB) return a.name.localeCompare(b.name);
            if (!lastA) return 1;
            if (!lastB) return -1;
            if (lastB.getTime() !== lastA.getTime()) {
              return lastB.getTime() - lastA.getTime();
            }
            return a.name.localeCompare(b.name);
          });
          break;
        default:
          // Default sort: by activity (count), then alphabetically
          membersWithLastSignIn.sort((a, b) => {
            const countA = checkInCounts.get(a.id)?.count || 0;
            const countB = checkInCounts.get(b.id)?.count || 0;
            if (countB !== countA) return countB - countA;
            return a.name.localeCompare(b.name);
          });
      }
    } else {
      // Default sort: by activity (count), then alphabetically
      membersWithLastSignIn.sort((a, b) => {
        const countA = checkInCounts.get(a.id)?.count || 0;
        const countB = checkInCounts.get(b.id)?.count || 0;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
      });
    }
    
    return membersWithLastSignIn;
  }

  getMemberById(id: string): Member | undefined {
    const member = this.members.get(id);
    if (member?.isDeleted || member?.isActive === false) return undefined;
    return member;
  }

  getMemberByQRCode(qrCode: string): Member | undefined {
    return Array.from(this.members.values())
      .find(m => m.qrCode === qrCode && m.isDeleted !== true && m.isActive !== false);
  }

  createMember(name: string, details?: { rank?: string | null; firstName?: string; lastName?: string; preferredName?: string; memberNumber?: string; membershipStartDate?: Date | null; stationId?: string }): Member {
    const member: Member = {
      id: uuidv4(),
      name,
      qrCode: uuidv4(),
      memberNumber: details?.memberNumber || undefined,
      rank: details?.rank || undefined,
      firstName: details?.firstName || undefined,
      lastName: details?.lastName || undefined,
      membershipStartDate: details?.membershipStartDate || null,
      stationId: getEffectiveStationId(details?.stationId),
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.members.set(member.id, member);
    return member;
  }

  updateMember(id: string, name: string, rank?: string | null, membershipStartDate?: Date | null): Member | undefined {
    const member = this.members.get(id);
    if (member) {
      member.name = name;
      member.rank = rank === undefined ? null : rank;
      if (membershipStartDate !== undefined) {
        member.membershipStartDate = membershipStartDate;
      }
      member.updatedAt = new Date();
      return member;
    }
    return undefined;
  }

  deleteMember(id: string): Member | null {
    const member = this.members.get(id);
    if (!member) return null;

    // Soft delete: retain history but hide from UI and deactivate any active check-ins
    member.isDeleted = true;
    member.isActive = false;
    member.updatedAt = new Date();
    this.deactivateCheckInByMember(id);
    this.members.set(id, member);
    return member;
  }

  // Activity methods
  getAllActivities(stationId?: string): Activity[] {
    let activities = Array.from(this.activities.values());
    
    // Filter out soft-deleted activities
    activities = activities.filter(a => !a.isDeleted);
    
    // Filter by station if specified
    if (stationId) {
      activities = activities.filter(a => {
        const activityStationId = getEffectiveStationId(a.stationId);
        // Include both station-specific activities and shared (default) activities
        return activityStationId === stationId || activityStationId === DEFAULT_STATION_ID;
      });
    }
    
    return activities.sort((a, b) => {
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

  createActivity(name: string, createdBy?: string, stationId?: string): Activity {
    const isCustom = !this.isDefaultActivityName(name);
    const category: Activity['category'] = isCustom ? 'other' : this.inferCategoryFromName(name);
    const activity: Activity = {
      id: uuidv4(),
      name,
      isCustom,
      category,
      tagColor: this.colorForCategory(category),
      createdBy,
      stationId: getEffectiveStationId(stationId),
      createdAt: new Date(),
    };
    this.activities.set(activity.id, activity);
    return activity;
  }

  // Active Activity methods
  getActiveActivity(stationId?: string): ActiveActivity | null {
    // For multi-station support, we need to track active activity per station
    // For now, returning the global active activity
    // TODO: Implement per-station active activity tracking
    const effectiveStationId = getEffectiveStationId(stationId);
    if (this.activeActivity && getEffectiveStationId(this.activeActivity.stationId) === effectiveStationId) {
      return this.activeActivity;
    }
    return this.activeActivity; // Fallback to global for backward compatibility
  }

  setActiveActivity(activityId: string, setBy?: string, stationId?: string): ActiveActivity {
    this.activeActivity = {
      id: uuidv4(),
      activityId,
      stationId: getEffectiveStationId(stationId),
      setAt: new Date(),
      setBy,
    };
    return this.activeActivity;
  }

  // Check-in methods
  getAllCheckIns(stationId?: string): CheckIn[] {
    let checkIns = Array.from(this.checkIns.values());
    if (stationId) {
      checkIns = checkIns.filter(c => getEffectiveStationId(c.stationId) === stationId);
    }
    return checkIns;
  }

  getCheckInsByMember(memberId: string): CheckIn[] {
    return Array.from(this.checkIns.values())
      .filter(checkIn => checkIn.memberId === memberId)
      .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
  }

  getActiveCheckIns(stationId?: string): CheckInWithDetails[] {
    let activeCheckIns = Array.from(this.checkIns.values())
      .filter(checkIn => checkIn.isActive);
    
    if (stationId) {
      activeCheckIns = activeCheckIns.filter(c => getEffectiveStationId(c.stationId) === stationId);
    }
    
    activeCheckIns = activeCheckIns.sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());

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
    isOffsite: boolean = false,
    stationId?: string
  ): CheckIn {
    const checkIn: CheckIn = {
      id: uuidv4(),
      memberId,
      activityId,
      stationId: getEffectiveStationId(stationId),
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

  clearAllActiveCheckIns(stationId?: string): void {
    Array.from(this.checkIns.values())
      .filter(checkIn => {
        if (!checkIn.isActive) return false;
        if (stationId && getEffectiveStationId(checkIn.stationId) !== stationId) return false;
        return true;
      })
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
  createEvent(activityId: string, createdBy?: string, stationId?: string): Event {
    const activity = this.activities.get(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const event: Event = {
      id: uuidv4(),
      activityId,
      activityName: activity.name,
      stationId: getEffectiveStationId(stationId),
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
   * @param stationId - Optional station ID to filter by
   */
  getEvents(limit: number = 50, offset: number = 0, stationId?: string): Event[] {
    let events = Array.from(this.events.values());
    // Filter out soft-deleted events
    events = events.filter(e => !(e as any).isDeleted);
    if (stationId) {
      events = events.filter(e => getEffectiveStationId(e.stationId) === stationId);
    }
    return events
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Get only active events (not yet ended and not expired)
   * Note: This auto-expires events that have exceeded the time limit.
   * Expired events remain visible in getEvents(), they're just marked as inactive.
   * @param stationId - Optional station ID to filter by
   */
  getActiveEvents(stationId?: string): Event[] {
    let activeEvents = Array.from(this.events.values())
      .filter(event => event.isActive);
    
    if (stationId) {
      activeEvents = activeEvents.filter(e => getEffectiveStationId(e.stationId) === stationId);
    }
    
    activeEvents = activeEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    // Auto-expire events that have exceeded time limit
    // This is synchronous because in-memory DB operations are instant
    autoExpireEvents(activeEvents, this as any).then(() => {
      // Events have been marked inactive in the database
    }).catch(err => {
      logger.error('Error auto-expiring events', { error: err });
    });
    
    // Return only currently active events (excluding ones we just expired)
    let result = Array.from(this.events.values())
      .filter(event => event.isActive);
    
    if (stationId) {
      result = result.filter(e => getEffectiveStationId(e.stationId) === stationId);
    }
    
    return result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
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
   * Soft delete an event (mark as deleted)
   */
  deleteEvent(eventId: string): Event | null {
    const event = this.events.get(eventId);
    if (!event) {
      return null;
    }
    // Soft delete: mark as deleted and inactive
    (event as any).isDeleted = true;
    event.isActive = false;
    event.updatedAt = new Date();
    this.events.set(eventId, event);
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
    isOffsite: boolean = false,
    stationId?: string
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
      stationId: getEffectiveStationId(stationId),
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
  getEventsWithParticipants(limit: number = 50, offset: number = 0, stationId?: string): EventWithParticipants[] {
    const events = this.getEvents(limit, offset, stationId);
    
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
  getAllActiveParticipants(stationId?: string): EventParticipant[] {
    let activeEvents = Array.from(this.events.values())
      .filter(e => e.isActive);
    
    if (stationId) {
      activeEvents = activeEvents.filter(e => getEffectiveStationId(e.stationId) === stationId);
    }
    
    const activeEventIds = new Set(activeEvents.map(e => e.id));

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
  getAttendanceSummary(startDate: Date, endDate: Date, stationId?: string): Array<{ month: string; count: number }> {
    let participants = Array.from(this.eventParticipants.values())
      .filter(p => p.checkInTime >= startDate && p.checkInTime <= endDate);
    
    if (stationId) {
      participants = participants.filter(p => getEffectiveStationId(p.stationId) === stationId);
    }

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
  getMemberParticipation(startDate: Date, endDate: Date, limit: number = 10, stationId?: string): Array<{
    memberId: string;
    memberName: string;
    participationCount: number;
    lastCheckIn: string;
  }> {
    let participants = Array.from(this.eventParticipants.values())
      .filter(p => p.checkInTime >= startDate && p.checkInTime <= endDate);
    
    if (stationId) {
      participants = participants.filter(p => getEffectiveStationId(p.stationId) === stationId);
    }

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
        lastCheckIn: stats.lastCheckIn.toISOString(),
      }))
      .sort((a, b) => b.participationCount - a.participationCount)
      .slice(0, limit);
  }

  /**
   * Get activity breakdown - count by activity category
   */
  getActivityBreakdown(startDate: Date, endDate: Date, stationId?: string): Array<{
    category: string;
    count: number;
    percentage: number;
  }> {
    let events = Array.from(this.events.values())
      .filter(e => e.startTime >= startDate && e.startTime <= endDate);
    
    if (stationId) {
      events = events.filter(e => getEffectiveStationId(e.stationId) === stationId);
    }

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
  getEventStatistics(startDate: Date, endDate: Date, stationId?: string): {
    totalEvents: number;
    activeEvents: number;
    completedEvents: number;
    totalParticipants: number;
    averageParticipantsPerEvent: number;
    averageDuration: number; // in minutes
  } {
    let events = Array.from(this.events.values())
      .filter(e => e.startTime >= startDate && e.startTime <= endDate);
    
    if (stationId) {
      events = events.filter(e => getEffectiveStationId(e.stationId) === stationId);
    }

    const activeEvents = events.filter(e => e.isActive).length;
    const completedEvents = events.filter(e => !e.isActive && e.endTime).length;

    let participants = Array.from(this.eventParticipants.values())
      .filter(p => p.checkInTime >= startDate && p.checkInTime <= endDate);
    
    if (stationId) {
      participants = participants.filter(p => getEffectiveStationId(p.stationId) === stationId);
    }

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

  // ============================================
  // Station Management Methods
  // ============================================

  /**
   * Get all stations
   */
  getAllStations(): Station[] {
    return Array.from(this.stations.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get a station by ID
   */
  getStationById(id: string): Station | undefined {
    return this.stations.get(id);
  }

  /**
   * Get all stations belonging to a brigade
   */
  getStationsByBrigade(brigadeId: string): Station[] {
    return Array.from(this.stations.values())
      .filter(station => station.brigadeId === brigadeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a new station
   */
  createStation(stationData: Omit<Station, 'id' | 'createdAt' | 'updatedAt'>): Station {
    const station: Station = {
      id: uuidv4(),
      ...stationData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stations.set(station.id, station);
    return station;
  }

  /**
   * Update an existing station
   */
  updateStation(id: string, updates: Partial<Omit<Station, 'id' | 'createdAt' | 'updatedAt'>>): Station | null {
    const station = this.stations.get(id);
    if (!station) {
      return null;
    }

    const updatedStation: Station = {
      ...station,
      ...updates,
      id: station.id, // Ensure ID doesn't change
      createdAt: station.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };
    
    this.stations.set(id, updatedStation);
    return updatedStation;
  }

  /**
   * Delete a station (soft delete - sets isActive=false)
   */
  deleteStation(id: string): boolean {
    const station = this.stations.get(id);
    if (!station) {
      return false;
    }
    
    // Soft delete: set isActive to false
    station.isActive = false;
    station.updatedAt = new Date();
    this.stations.set(id, station);
    return true;
  }
}

export const db = new DatabaseService();
