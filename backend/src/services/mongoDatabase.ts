import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { Member, Activity, CheckIn, ActiveActivity, CheckInWithDetails } from '../types';
import { v4 as uuidv4 } from 'uuid';

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;
  private membersCollection: Collection<Member> | null = null;
  private activitiesCollection: Collection<Activity> | null = null;
  private checkInsCollection: Collection<CheckIn> | null = null;
  private activeActivityCollection: Collection<ActiveActivity> | null = null;
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

    // Check if we need to add sample members
    const memberCount = await this.membersCollection?.countDocuments();
    
    if (memberCount === 0) {
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

      const members: Member[] = sampleMembers.map(name => ({
        id: uuidv4(),
        name,
        qrCode: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await this.membersCollection?.insertMany(members);
    }
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
    if (!this.membersCollection) throw new Error('Database not connected');
    const members = await this.membersCollection.find().sort({ name: 1 }).toArray();
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
}

// Create and export singleton instance
export const db = new MongoDBService();
