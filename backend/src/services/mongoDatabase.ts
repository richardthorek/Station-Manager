import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { Member, Activity, CheckIn, ActiveActivity, CheckInWithDetails, Event, EventParticipant, EventWithParticipants } from '../types';
import { v4 as uuidv4 } from 'uuid';

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private membersCollection: Collection<Member> | null = null;
  private activitiesCollection: Collection<Activity> | null = null;
  private checkInsCollection: Collection<CheckIn> | null = null;
  private activeActivityCollection: Collection<ActiveActivity> | null = null;
  private eventsCollection: Collection<Event> | null = null;
  private eventParticipantsCollection: Collection<EventParticipant> | null = null;
  private isConnected: boolean = false;

  constructor(connectionString?: string) {
    const uri = connectionString || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      this.db = this.client.db('StationManager');
      
      // Initialize collections
      this.membersCollection = this.db.collection<Member>('Members');
      this.activitiesCollection = this.db.collection<Activity>('Activities');
      this.checkInsCollection = this.db.collection<CheckIn>('CheckIns');
      this.activeActivityCollection = this.db.collection<ActiveActivity>('ActiveActivity');
      this.eventsCollection = this.db.collection<Event>('Events');
      this.eventParticipantsCollection = this.db.collection<EventParticipant>('EventParticipants');

      // Create indexes
      await this.createIndexes();

      // Initialize default data if collections are empty
      await this.initializeDefaultData();

      this.isConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    // Create indexes for efficient queries
    await this.membersCollection?.createIndex({ name: 1 });
    await this.membersCollection?.createIndex({ qrCode: 1 }, { unique: true });
    await this.checkInsCollection?.createIndex({ memberId: 1 });
    await this.checkInsCollection?.createIndex({ isActive: 1 });
    await this.checkInsCollection?.createIndex({ checkInTime: -1 });
    await this.eventsCollection?.createIndex({ startTime: -1 });
    await this.eventsCollection?.createIndex({ isActive: 1 });
    await this.eventParticipantsCollection?.createIndex({ eventId: 1 });
    await this.eventParticipantsCollection?.createIndex({ memberId: 1 });
  }

  private async initializeDefaultData(): Promise<void> {
    // Check if we need to initialize default activities
    const activityCount = await this.activitiesCollection?.countDocuments();
    
    if (activityCount === 0) {
      const defaultActivities = [
        { id: uuidv4(), name: 'Training', isCustom: false, createdAt: new Date() },
        { id: uuidv4(), name: 'Maintenance', isCustom: false, createdAt: new Date() },
        { id: uuidv4(), name: 'Meeting', isCustom: false, createdAt: new Date() },
      ];

      await this.activitiesCollection?.insertMany(defaultActivities);

      // Set first activity as active
      if (defaultActivities.length > 0) {
        await this.activeActivityCollection?.insertOne({
          id: uuidv4(),
          activityId: defaultActivities[0].id,
          setAt: new Date(),
        });
      }
    }

    // Don't add sample members in production - members should be imported via script or added through UI
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('Disconnected from MongoDB');
    }
  }

  // Member methods
  async getAllMembers(): Promise<Member[]> {
    if (!this.membersCollection || !this.eventParticipantsCollection) {
      throw new Error('Database not connected');
    }
    
    // Calculate date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Get all members
    const members = await this.membersCollection.find().toArray();
    
    // Get check-in counts for each member in the last 6 months
    const memberCheckInCounts = await this.eventParticipantsCollection.aggregate([
      {
        $match: {
          joinedAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: '$memberId',
          checkInCount: { $sum: 1 }
        }
      }
    ]).toArray();
    
    // Create a map of member ID to check-in count
    const checkInMap = new Map<string, number>();
    memberCheckInCounts.forEach((item: any) => {
      checkInMap.set(item._id, item.checkInCount);
    });
    
    // Sort members by check-in count (descending), then by name
    members.sort((a, b) => {
      const countA = checkInMap.get(a.id) || 0;
      const countB = checkInMap.get(b.id) || 0;
      
      if (countB !== countA) {
        return countB - countA; // More check-ins first
      }
      return a.name.localeCompare(b.name); // Alphabetical for ties
    });
    
    return members;
  }

  async getMemberById(id: string): Promise<Member | null> {
    if (!this.membersCollection) throw new Error('Database not connected');
    return await this.membersCollection.findOne({ id });
  }

  async getMemberByQRCode(qrCode: string): Promise<Member | null> {
    if (!this.membersCollection) throw new Error('Database not connected');
    return await this.membersCollection.findOne({ qrCode });
  }

  async createMember(name: string): Promise<Member> {
    if (!this.membersCollection) throw new Error('Database not connected');
    
    const member: Member = {
      id: uuidv4(),
      name,
      qrCode: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await this.membersCollection.insertOne(member);
    return member;
  }

  async updateMember(id: string, name: string): Promise<Member | null> {
    if (!this.membersCollection) throw new Error('Database not connected');
    
    const result = await this.membersCollection.findOneAndUpdate(
      { id },
      { 
        $set: { 
          name,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  // Activity methods
  async getAllActivities(): Promise<Activity[]> {
    if (!this.activitiesCollection) throw new Error('Database not connected');
    
    const activities = await this.activitiesCollection.find().toArray();
    
    // Sort: default activities first, then custom ones
    return activities.sort((a, b) => {
      if (a.isCustom !== b.isCustom) {
        return a.isCustom ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async getActivityById(id: string): Promise<Activity | null> {
    if (!this.activitiesCollection) throw new Error('Database not connected');
    return await this.activitiesCollection.findOne({ id });
  }

  async createActivity(name: string, createdBy?: string): Promise<Activity> {
    if (!this.activitiesCollection) throw new Error('Database not connected');
    
    const activity: Activity = {
      id: uuidv4(),
      name,
      isCustom: true,
      createdBy,
      createdAt: new Date(),
    };
    
    await this.activitiesCollection.insertOne(activity);
    return activity;
  }

  // Active Activity methods
  async getActiveActivity(): Promise<ActiveActivity | null> {
    if (!this.activeActivityCollection) throw new Error('Database not connected');
    return await this.activeActivityCollection.findOne();
  }

  async setActiveActivity(activityId: string, setBy?: string): Promise<ActiveActivity> {
    if (!this.activeActivityCollection) throw new Error('Database not connected');
    
    const activeActivity: ActiveActivity = {
      id: uuidv4(),
      activityId,
      setAt: new Date(),
      setBy,
    };
    
    // Replace the active activity (there should only be one)
    await this.activeActivityCollection.deleteMany({});
    await this.activeActivityCollection.insertOne(activeActivity);
    
    return activeActivity;
  }

  // Check-in methods
  async getAllCheckIns(): Promise<CheckIn[]> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    return await this.checkInsCollection.find().toArray();
  }

  async getCheckInsByMember(memberId: string): Promise<CheckIn[]> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    return await this.checkInsCollection
      .find({ memberId })
      .sort({ checkInTime: -1 })
      .toArray();
  }

  async getActiveCheckIns(): Promise<CheckInWithDetails[]> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    
    const activeCheckIns = await this.checkInsCollection
      .find({ isActive: true })
      .sort({ checkInTime: -1 })
      .toArray();

    // Fetch member and activity details
    const checkInsWithDetails: CheckInWithDetails[] = [];
    
    for (const checkIn of activeCheckIns) {
      const member = await this.getMemberById(checkIn.memberId);
      const activity = await this.getActivityById(checkIn.activityId);
      
      checkInsWithDetails.push({
        ...checkIn,
        memberName: member?.name || 'Unknown',
        activityName: activity?.name || 'Unknown',
      });
    }
    
    return checkInsWithDetails;
  }

  async getCheckInByMember(memberId: string): Promise<CheckIn | null> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    return await this.checkInsCollection.findOne({ memberId, isActive: true });
  }

  async createCheckIn(
    memberId: string,
    activityId: string,
    method: 'kiosk' | 'mobile' | 'qr',
    location?: string,
    isOffsite: boolean = false
  ): Promise<CheckIn> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    
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
    
    await this.checkInsCollection.insertOne(checkIn);
    return checkIn;
  }

  async deactivateCheckIn(checkInId: string): Promise<boolean> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    
    const result = await this.checkInsCollection.updateOne(
      { id: checkInId },
      { 
        $set: { 
          isActive: false, 
          updatedAt: new Date() 
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }

  async deactivateCheckInByMember(memberId: string): Promise<boolean> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    
    const result = await this.checkInsCollection.updateOne(
      { memberId, isActive: true },
      { 
        $set: { 
          isActive: false, 
          updatedAt: new Date() 
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }

  async clearAllActiveCheckIns(): Promise<void> {
    if (!this.checkInsCollection) throw new Error('Database not connected');
    
    await this.checkInsCollection.updateMany(
      { isActive: true },
      { 
        $set: { 
          isActive: false, 
          updatedAt: new Date() 
        } 
      }
    );
  }
  
  // ============================================
  // Event Management Methods
  // ============================================

  async createEvent(activityId: string, createdBy?: string): Promise<Event> {
    if (!this.eventsCollection || !this.activitiesCollection) {
      throw new Error('Database not connected');
    }
    
    const activity = await this.activitiesCollection.findOne({ id: activityId });
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
    
    await this.eventsCollection.insertOne(event);
    return event;
  }

  async getEvents(limit: number = 50, offset: number = 0): Promise<Event[]> {
    if (!this.eventsCollection) throw new Error('Database not connected');
    
    return await this.eventsCollection
      .find()
      .sort({ startTime: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getActiveEvents(): Promise<Event[]> {
    if (!this.eventsCollection) throw new Error('Database not connected');
    
    return await this.eventsCollection
      .find({ isActive: true })
      .sort({ startTime: -1 })
      .toArray();
  }

  async getEventById(eventId: string): Promise<Event | null> {
    if (!this.eventsCollection) throw new Error('Database not connected');
    return await this.eventsCollection.findOne({ id: eventId });
  }

  async endEvent(eventId: string): Promise<Event | null> {
    if (!this.eventsCollection) throw new Error('Database not connected');
    
    const result = await this.eventsCollection.findOneAndUpdate(
      { id: eventId },
      { 
        $set: { 
          endTime: new Date(),
          isActive: false,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  async addEventParticipant(
    eventId: string,
    memberId: string,
    method: 'kiosk' | 'mobile' | 'qr',
    location?: string,
    isOffsite: boolean = false
  ): Promise<EventParticipant> {
    if (!this.eventParticipantsCollection || !this.eventsCollection || !this.membersCollection) {
      throw new Error('Database not connected');
    }
    
    const event = await this.eventsCollection.findOne({ id: eventId });
    if (!event) {
      throw new Error('Event not found');
    }

    const member = await this.membersCollection.findOne({ id: { $eq: memberId } });
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

    await this.eventParticipantsCollection.insertOne(participant);
    await this.eventsCollection.updateOne(
      { id: eventId },
      { $set: { updatedAt: new Date() } }
    );
    
    return participant;
  }

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    if (!this.eventParticipantsCollection) throw new Error('Database not connected');
    
    return await this.eventParticipantsCollection
      .find({ eventId })
      .sort({ checkInTime: 1 })
      .toArray();
  }

  async getEventWithParticipants(eventId: string): Promise<EventWithParticipants | null> {
    if (!this.eventsCollection) throw new Error('Database not connected');
    
    const event = await this.eventsCollection.findOne({ id: eventId });
    if (!event) {
      return null;
    }

    const participants = await this.getEventParticipants(eventId);
    
    return {
      ...event,
      participants,
      participantCount: participants.length,
    };
  }

  async getEventsWithParticipants(limit: number = 50, offset: number = 0): Promise<EventWithParticipants[]> {
    const events = await this.getEvents(limit, offset);
    
    const eventsWithParticipants = await Promise.all(
      events.map(async (event) => {
        const participants = await this.getEventParticipants(event.id);
        return {
          ...event,
          participants,
          participantCount: participants.length,
        };
      })
    );
    
    return eventsWithParticipants;
  }

  async removeEventParticipant(participantId: string): Promise<boolean> {
    if (!this.eventParticipantsCollection || !this.eventsCollection) {
      throw new Error('Database not connected');
    }
    
    const participant = await this.eventParticipantsCollection.findOne({ id: participantId });
    if (!participant) {
      return false;
    }

    await this.eventParticipantsCollection.deleteOne({ id: participantId });
    
    // Update event's updatedAt timestamp
    await this.eventsCollection.updateOne(
      { id: participant.eventId },
      { $set: { updatedAt: new Date() } }
    );
    
    return true;
  }

  async getMemberParticipantInEvent(eventId: string, memberId: string): Promise<EventParticipant | null> {
    if (!this.eventParticipantsCollection) throw new Error('Database not connected');
    
    return await this.eventParticipantsCollection.findOne({ eventId, memberId });
  }

  async getAllActiveParticipants(): Promise<EventParticipant[]> {
    if (!this.eventParticipantsCollection || !this.eventsCollection) {
      throw new Error('Database not connected');
    }
    
    const activeEvents = await this.eventsCollection.find({ isActive: true }).toArray();
    const activeEventIds = activeEvents.map(e => e.id);

    return await this.eventParticipantsCollection
      .find({ eventId: { $in: activeEventIds } })
      .sort({ checkInTime: -1 })
      .toArray();
  }
}

// Create and export singleton instance
export const db = new MongoDBService();
