import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import {
  Member,
  Activity,
  CheckIn,
  ActiveActivity,
  CheckInWithDetails,
  Event,
  EventParticipant,
  EventWithParticipants
} from '../types';
// Note: we intentionally avoid importing IDatabase here to prevent circular type issues

// Build table names with optional prefix/suffix so dev/test can share prod storage without mixing tables
function buildTableName(baseName: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  
  // Auto-suffix based on environment if not explicitly set
  let defaultSuffix = '';
  if (process.env.NODE_ENV === 'test') {
    defaultSuffix = 'Test';
  } else if (process.env.NODE_ENV === 'development') {
    defaultSuffix = 'Dev';
  }
  
  const suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName; // Fallback to base if everything was stripped
}

type ActivityCategory = NonNullable<Activity['category']>;

// Activity helpers (shared defaults/category detection)
function inferCategoryFromName(name: string): 'training' | 'maintenance' | 'meeting' | 'other' {
  const n = name.toLowerCase();
  if (n.includes('train')) return 'training';
  if (n.includes('maint')) return 'maintenance';
  if (n.includes('meet')) return 'meeting';
  return 'other';
}

function colorForCategory(category: string): string {
  switch (category) {
    case 'training': return '#008550'; // green
    case 'maintenance': return '#fbb034'; // amber
    case 'meeting': return '#215e9e'; // blue
    default: return '#bcbec0'; // light grey
  }
}

const DEFAULT_ACTIVITIES: Array<{ name: string; category: ActivityCategory; tagColor: string }> = [
  { name: 'Training', category: 'training', tagColor: '#008550' },
  { name: 'Maintenance', category: 'maintenance', tagColor: '#fbb034' },
  { name: 'Meeting', category: 'meeting', tagColor: '#215e9e' },
  { name: 'Brigade Training', category: 'training', tagColor: '#cbdb2a' },
  { name: 'District Training', category: 'training', tagColor: '#008550' },
];

function getDefaultActivityByName(name: string) {
  const n = name.trim().toLowerCase();
  return DEFAULT_ACTIVITIES.find(a => a.name.toLowerCase() === n);
}

function isDefaultActivityName(name: string): boolean {
  return !!getDefaultActivityByName(name);
}

/**
 * Azure Table Storage Database Implementation
 * Uses the same storage account as blob storage
 * 
 * Partition Strategy:
 * - Members: PartitionKey = 'Member'
 * - Activities: PartitionKey = 'Activity'
 * - Events: PartitionKey = 'Event_YYYY-MM' (partitioned by month for efficient queries)
 * - EventParticipants: PartitionKey = eventId (co-located with their event)
 * - ActiveActivity: PartitionKey = 'ActiveActivity'
 * - CheckIns: PartitionKey = 'CheckIn' (legacy, not used with events)
 */
export class TableStorageDatabase {
  private connectionString: string;
  private membersTable!: TableClient;
  private activitiesTable!: TableClient;
  private eventsTable!: TableClient;
  private eventParticipantsTable!: TableClient;
  private checkInsTable!: TableClient;
  private activeActivityTable!: TableClient;
  private isConnected: boolean = false;

  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    
    // Initialize table clients only if connection string is available
    if (this.connectionString) {
      this.membersTable = TableClient.fromConnectionString(this.connectionString, buildTableName('Members'));
      this.activitiesTable = TableClient.fromConnectionString(this.connectionString, buildTableName('Activities'));
      this.eventsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('Events'));
      this.eventParticipantsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('EventParticipants'));
      this.checkInsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('CheckIns'));
      this.activeActivityTable = TableClient.fromConnectionString(this.connectionString, buildTableName('ActiveActivity'));
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    if (!this.connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for Table Storage. Cannot connect without credentials.');
    }

    try {
      // Create tables if they don't exist
      await Promise.all([
        this.membersTable.createTable().catch(() => {}), // Ignore if exists
        this.activitiesTable.createTable().catch(() => {}),
        this.eventsTable.createTable().catch(() => {}),
        this.eventParticipantsTable.createTable().catch(() => {}),
        this.checkInsTable.createTable().catch(() => {}),
        this.activeActivityTable.createTable().catch(() => {}),
      ]);

      // Initialize default activities if empty
      await this.initializeDefaultActivities();

      this.isConnected = true;
      console.log('✅ Connected to Azure Table Storage');
    } catch (error) {
      console.error('❌ Failed to connect to Table Storage:', error);
      throw error;
    }
  }

  private async initializeDefaultActivities(): Promise<void> {
    try {
      // Check if activities exist
      const activities = this.activitiesTable.listEntities({
        queryOptions: { filter: odata`PartitionKey eq 'Activity'` }
      });
      
      let count = 0;
      for await (const _ of activities) {
        count++;
        break; // Just check if any exist
      }

      if (count === 0) {
        for (const activity of DEFAULT_ACTIVITIES) {
          await this.createActivity(activity.name);
        }

        console.log('✅ Initialized default activities');
      }
    } catch (error) {
      console.error('Error initializing default activities:', error);
    }
  }

  

  // ===== MEMBER METHODS =====

  async getAllMembers(): Promise<Member[]> {
    const entities = this.membersTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'Member'` }
    });

    const members: Member[] = [];
    for await (const entity of entities) {
      members.push(this.entityToMember(entity));
    }

    // Sort by name
    members.sort((a, b) => a.name.localeCompare(b.name));
    
    return members;
  }

  async getMemberById(id: string): Promise<Member | null> {
    try {
      const entity = await this.membersTable.getEntity<TableEntity>('Member', id);
      return this.entityToMember(entity);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async getMemberByQRCode(qrCode: string): Promise<Member | null> {
    const entities = this.membersTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'Member' and qrCode eq ${qrCode}` }
    });

    for await (const entity of entities) {
      return this.entityToMember(entity);
    }
    
    return null;
  }

  async createMember(
    name: string,
    details?: { rank?: string | null; firstName?: string; lastName?: string; preferredName?: string; memberNumber?: string }
  ): Promise<Member> {
    const now = new Date();
    const member: Member = {
      id: uuidv4(),
      name,
      qrCode: uuidv4(),
      memberNumber: details?.memberNumber || undefined,
      rank: details?.rank || undefined,
      firstName: details?.firstName || undefined,
      lastName: details?.lastName || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const entity: TableEntity = {
      partitionKey: 'Member',
      rowKey: member.id,
      name: member.name,
      qrCode: member.qrCode,
      memberNumber: member.memberNumber || '',
      rank: member.rank || '',
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };

    await this.membersTable.createEntity(entity);
    return member;
  }

  async updateMember(id: string, name: string, rank?: string | null): Promise<Member | null> {
    try {
      const entity = await this.membersTable.getEntity<TableEntity>('Member', id);
      
      entity.name = name;
      entity.rank = rank || '';
      entity.updatedAt = new Date().toISOString();

      await this.membersTable.updateEntity(entity, 'Replace');
      
      return this.entityToMember(entity);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  private entityToMember(entity: TableEntity): Member {
    return {
      id: entity.rowKey as string,
      name: entity.name as string,
      qrCode: entity.qrCode as string,
      memberNumber: (entity.memberNumber as string) || undefined,
      rank: (entity.rank as string) || undefined,
      firstName: (entity.firstName as string) || undefined,
      lastName: (entity.lastName as string) || undefined,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== ACTIVITY METHODS =====

  async getAllActivities(): Promise<Activity[]> {
    const entities = this.activitiesTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'Activity'` }
    });

    const activities: Activity[] = [];
    for await (const entity of entities) {
      activities.push(this.entityToActivity(entity));
    }

    // Sort: default activities first, then custom
    activities.sort((a, b) => {
      if (a.isCustom !== b.isCustom) {
        return a.isCustom ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    return activities;
  }

  async getActivityById(id: string): Promise<Activity | null> {
    try {
      const entity = await this.activitiesTable.getEntity<TableEntity>('Activity', id);
      return this.entityToActivity(entity);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async createActivity(name: string, createdBy?: string): Promise<Activity> {
    const defaultActivity = getDefaultActivityByName(name);
    const isDefault = !!defaultActivity;
    const category: ActivityCategory = isDefault
      ? defaultActivity!.category
      : 'other';
    const tagColor = isDefault
      ? defaultActivity!.tagColor
      : colorForCategory(category);
    const activity: Activity = {
      id: uuidv4(),
      name,
      isCustom: !isDefault,
      category,
      tagColor,
      createdBy,
      createdAt: new Date(),
    };

    const entity: TableEntity = {
      partitionKey: 'Activity',
      rowKey: activity.id,
      name: activity.name,
      isCustom: activity.isCustom,
      category: activity.category || '',
      tagColor: activity.tagColor || '',
      createdBy: activity.createdBy || '',
      createdAt: activity.createdAt.toISOString(),
    };

    await this.activitiesTable.createEntity(entity);
    return activity;
  }

  private entityToActivity(entity: TableEntity): Activity {
    const name = entity.name as string;
    const storedIsCustom = typeof entity.isCustom === 'boolean' ? (entity.isCustom as boolean) : undefined;
    const defaultActivity = getDefaultActivityByName(name);
    const isDefault = !!defaultActivity;
    const isCustom = isDefault ? false : (storedIsCustom ?? true);
    const storedCategory = (entity.category as ActivityCategory | undefined) || undefined;
    const category: ActivityCategory = isDefault
      ? (defaultActivity?.category ?? storedCategory ?? 'training')
      : (storedCategory ?? 'other');
    const tagColor = (entity.tagColor as string)
      || defaultActivity?.tagColor
      || colorForCategory(category);

    return {
      id: entity.rowKey as string,
      name,
      isCustom,
      category,
      tagColor,
      createdBy: (entity.createdBy as string) || undefined,
      createdAt: new Date(entity.createdAt as string),
    };
  }

  // ===== ACTIVE ACTIVITY METHODS =====

  async getActiveActivity(): Promise<ActiveActivity | null> {
    const entities = this.activeActivityTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'ActiveActivity'` }
    });

    for await (const entity of entities) {
      return this.entityToActiveActivity(entity);
    }

    return null;
  }

  async setActiveActivity(activityId: string, setBy?: string): Promise<ActiveActivity> {
    const activeActivity: ActiveActivity = {
      id: uuidv4(),
      activityId,
      setAt: new Date(),
      setBy,
    };

    // Delete existing active activity
    const existing = await this.getActiveActivity();
    if (existing) {
      await this.activeActivityTable.deleteEntity('ActiveActivity', existing.id);
    }

    // Create new active activity
    const entity: TableEntity = {
      partitionKey: 'ActiveActivity',
      rowKey: activeActivity.id,
      activityId: activeActivity.activityId,
      setAt: activeActivity.setAt.toISOString(),
      setBy: activeActivity.setBy || '',
    };

    await this.activeActivityTable.createEntity(entity);
    return activeActivity;
  }

  private entityToActiveActivity(entity: TableEntity): ActiveActivity {
    return {
      id: entity.rowKey as string,
      activityId: entity.activityId as string,
      setAt: new Date(entity.setAt as string),
      setBy: (entity.setBy as string) || undefined,
    };
  }

  // ===== EVENT METHODS =====

  async createEvent(activityId: string, createdBy?: string): Promise<Event> {
    const activity = await this.getActivityById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const event: Event = {
      id: uuidv4(),
      activityId,
      activityName: activity.name,
      startTime: new Date(),
      isActive: true,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Partition by month for efficient queries
    const monthKey = event.startTime.toISOString().slice(0, 7); // YYYY-MM

    const entity: TableEntity = {
      partitionKey: `Event_${monthKey}`,
      rowKey: event.id,
      activityId: event.activityId,
      activityName: event.activityName,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime?.toISOString() || '',
      isActive: event.isActive,
      createdBy: event.createdBy || '',
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };

    await this.eventsTable.createEntity(entity);
    return event;
  }

  async getEvents(limit: number = 50, offset: number = 0): Promise<Event[]> {
    // Query recent months
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) { // Last 3 months
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      months.push(date.toISOString().slice(0, 7));
    }

    const allEvents: Event[] = [];
    
    for (const month of months) {
      const entities = this.eventsTable.listEntities<TableEntity>({
        queryOptions: { filter: odata`PartitionKey eq ${'Event_' + month}` }
      });

      for await (const entity of entities) {
        allEvents.push(this.entityToEvent(entity));
      }
    }

    // Sort by startTime descending
    allEvents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Apply pagination
    return allEvents.slice(offset, offset + limit);
  }

  async getActiveEvents(): Promise<Event[]> {
    const events = await this.getEvents(100, 0);
    return events.filter(e => e.isActive);
  }

  async getEventById(eventId: string): Promise<Event | null> {
    // Need to search across month partitions
    const now = new Date();
    for (let i = 0; i < 6; i++) { // Check last 6 months
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7);
      
      try {
        const entity = await this.eventsTable.getEntity<TableEntity>(`Event_${monthKey}`, eventId);
        return this.entityToEvent(entity);
      } catch (error: any) {
        if (error.statusCode !== 404) throw error;
        // Continue to next month
      }
    }
    
    return null;
  }

  async endEvent(eventId: string): Promise<Event | null> {
    const event = await this.getEventById(eventId);
    if (!event) return null;

    const monthKey = event.startTime.toISOString().slice(0, 7);
    
    try {
      const entity = await this.eventsTable.getEntity<TableEntity>(`Event_${monthKey}`, eventId);
      entity.endTime = new Date().toISOString();
      entity.isActive = false;
      entity.updatedAt = new Date().toISOString();

      await this.eventsTable.updateEntity(entity, 'Replace');
      
      return this.entityToEvent(entity);
    } catch (error) {
      return null;
    }
  }

  private entityToEvent(entity: TableEntity): Event {
    return {
      id: entity.rowKey as string,
      activityId: entity.activityId as string,
      activityName: entity.activityName as string,
      startTime: new Date(entity.startTime as string),
      endTime: entity.endTime ? new Date(entity.endTime as string) : undefined,
      isActive: entity.isActive as boolean,
      createdBy: (entity.createdBy as string) || undefined,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== EVENT PARTICIPANT METHODS =====

  async addEventParticipant(
    eventId: string,
    memberId: string,
    method: 'kiosk' | 'mobile' | 'qr',
    location?: string,
    isOffsite: boolean = false
  ): Promise<EventParticipant> {
    const event = await this.getEventById(eventId);
    if (!event) throw new Error('Event not found');

    const member = await this.getMemberById(memberId);
    if (!member) throw new Error('Member not found');

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

    // Co-locate participants with their event
    const entity: TableEntity = {
      partitionKey: eventId,
      rowKey: participant.id,
      memberId: participant.memberId,
      memberName: participant.memberName,
      memberRank: participant.memberRank || '',
      checkInTime: participant.checkInTime.toISOString(),
      checkInMethod: participant.checkInMethod,
      location: participant.location || '',
      isOffsite: participant.isOffsite,
      createdAt: participant.createdAt.toISOString(),
    };

    await this.eventParticipantsTable.createEntity(entity);
    return participant;
  }

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    // Efficient single-partition query
    const entities = this.eventParticipantsTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${eventId}` }
    });

    const participants: EventParticipant[] = [];
    for await (const entity of entities) {
      participants.push(this.entityToEventParticipant(entity, eventId));
    }

    // Sort by checkInTime
    participants.sort((a, b) => a.checkInTime.getTime() - b.checkInTime.getTime());

    return participants;
  }

  async getEventWithParticipants(eventId: string): Promise<EventWithParticipants | null> {
    const event = await this.getEventById(eventId);
    if (!event) return null;

    // fetch activity to include tag color
    const activity = await this.getActivityById(event.activityId);
    const participants = await this.getEventParticipants(eventId);

    return {
      ...event,
      participants: participants.map(p => ({ ...p, activityTagColor: activity?.tagColor })),
      participantCount: participants.length,
    };
  }

  async getEventsWithParticipants(limit: number = 50, offset: number = 0): Promise<EventWithParticipants[]> {
    const events = await this.getEvents(limit, offset);
    
    const eventsWithParticipants = await Promise.all(
      events.map(async (event) => {
        const participants = await this.getEventParticipants(event.id);
        const activity = await this.getActivityById(event.activityId);
        return {
          ...event,
          participants: participants.map(p => ({ ...p, activityTagColor: activity?.tagColor })),
          participantCount: participants.length,
        };
      })
    );

    return eventsWithParticipants;
  }

  async removeEventParticipant(participantId: string): Promise<boolean> {
    // Need to find which event this participant belongs to
    // This is inefficient - we'd need to search across all events
    // For now, return false - this feature may need rethinking
    console.warn('removeEventParticipant not efficiently supported in Table Storage');
    return false;
  }

  async getMemberParticipantInEvent(eventId: string, memberId: string): Promise<EventParticipant | undefined> {
    const entities = this.eventParticipantsTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${eventId} and memberId eq ${memberId}` }
    });

    for await (const entity of entities) {
      return this.entityToEventParticipant(entity, eventId);
    }

    return undefined;
  }

  async getAllActiveParticipants(): Promise<EventParticipant[]> {
    const activeEvents = await this.getActiveEvents();
    const allParticipants: EventParticipant[] = [];

    for (const event of activeEvents) {
      const participants = await this.getEventParticipants(event.id);
      const activity = await this.getActivityById(event.activityId);
      allParticipants.push(...participants.map(p => ({ ...p, activityTagColor: activity?.tagColor })) as any);
    }

    // Sort by checkInTime descending
    allParticipants.sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());

    return allParticipants;
  }

  private entityToEventParticipant(entity: TableEntity, eventId: string): EventParticipant {
    return {
      id: entity.rowKey as string,
      eventId,
      memberId: entity.memberId as string,
      memberName: entity.memberName as string,
      memberRank: (entity.memberRank as string) || null,
      checkInTime: new Date(entity.checkInTime as string),
      checkInMethod: entity.checkInMethod as 'kiosk' | 'mobile' | 'qr',
      location: (entity.location as string) || undefined,
      isOffsite: entity.isOffsite as boolean,
      createdAt: new Date(entity.createdAt as string),
    };
  }

  // ===== LEGACY CHECKIN METHODS (Stub implementations) =====

  async getAllCheckIns(): Promise<CheckIn[]> {
    return [];
  }

  async getActiveCheckIns(): Promise<CheckInWithDetails[]> {
    return [];
  }

  async getCheckInByMember(memberId: string): Promise<CheckIn | null> {
    return null;
  }

  async getCheckInsByMember(memberId: string): Promise<CheckIn[]> {
    return [];
  }

  async createCheckIn(
    memberId: string,
    activityId: string,
    method: 'kiosk' | 'mobile' | 'qr',
    location?: string,
    isOffsite: boolean = false
  ): Promise<CheckIn> {
    throw new Error('Legacy check-ins not supported in Table Storage. Use events instead.');
  }

  async deactivateCheckIn(checkInId: string): Promise<boolean> {
    return false;
  }

  async deactivateCheckInByMember(memberId: string): Promise<boolean> {
    return false;
  }

  async clearAllActiveCheckIns(): Promise<void> {
    return;
  }
}

// Export singleton instance
export const tableStorageDb = new TableStorageDatabase();
