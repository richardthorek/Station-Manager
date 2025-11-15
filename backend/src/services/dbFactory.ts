/**
 * Database Factory
 * Determines which database service to use based on environment
 */

import { db as inMemoryDb } from './database';
import { db as mongoDb } from './mongoDatabase';

// Interface that both database services must implement
export interface IDatabase {
  // Members
  getAllMembers(): Promise<any[]> | any[];
  getMemberById(id: string): Promise<any | null | undefined> | any | null | undefined;
  getMemberByQRCode(qrCode: string): Promise<any | null | undefined> | any | null | undefined;
  createMember(name: string): Promise<any> | any;
  updateMember(id: string, name: string): Promise<any | null | undefined> | any | null | undefined;
  
  // Activities
  getAllActivities(): Promise<any[]> | any[];
  getActivityById(id: string): Promise<any | null | undefined> | any | null | undefined;
  createActivity(name: string, createdBy?: string): Promise<any> | any;
  
  // Active Activity
  getActiveActivity(): Promise<any | null> | any | null;
  setActiveActivity(activityId: string, setBy?: string): Promise<any> | any;
  
  // Check-ins
  getAllCheckIns(): Promise<any[]> | any[];
  getActiveCheckIns(): Promise<any[]> | any[];
  getCheckInByMember(memberId: string): Promise<any | null | undefined> | any | null | undefined;
  getCheckInsByMember(memberId: string): Promise<any[]> | any[];
  createCheckIn(memberId: string, activityId: string, method: 'kiosk' | 'mobile' | 'qr', location?: string, isOffsite?: boolean): Promise<any> | any;
  deactivateCheckIn(checkInId: string): Promise<boolean> | boolean;
  deactivateCheckInByMember(memberId: string): Promise<boolean> | boolean;
  clearAllActiveCheckIns(): Promise<void> | void;
  
  // Events
  createEvent(activityId: string, createdBy?: string): Promise<any> | any;
  getEvents(limit?: number, offset?: number): Promise<any[]> | any[];
  getActiveEvents(): Promise<any[]> | any[];
  getEventById(eventId: string): Promise<any | null | undefined> | any | null | undefined;
  endEvent(eventId: string): Promise<any | null> | any | null;
  addEventParticipant(eventId: string, memberId: string, method: 'kiosk' | 'mobile' | 'qr', location?: string, isOffsite?: boolean): Promise<any> | any;
  getEventParticipants(eventId: string): Promise<any[]> | any[];
  getEventWithParticipants(eventId: string): Promise<any | null> | any | null;
  getEventsWithParticipants(limit?: number, offset?: number): Promise<any[]> | any[];
  removeEventParticipant(participantId: string): Promise<boolean> | boolean;
  getMemberParticipantInEvent(eventId: string, memberId: string): Promise<any | undefined> | any | undefined;
  getAllActiveParticipants(): Promise<any[]> | any[];
}

/**
 * Initialize and return the appropriate database service
 */
async function initializeDatabase(): Promise<IDatabase> {
  const mongoUri = process.env.MONGODB_URI;
  const nodeEnv = process.env.NODE_ENV;
  
  // Use MongoDB if connection string is provided
  if (mongoUri && mongoUri.trim() !== '') {
    console.log('🔌 Connecting to MongoDB/Cosmos DB...');
    try {
      await mongoDb.connect();
      console.log('✅ Connected to MongoDB/Cosmos DB');
      return mongoDb as IDatabase;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      console.log('⚠️  Falling back to in-memory database');
      return inMemoryDb as IDatabase;
    }
  }
  
  // Fallback to in-memory database
  if (nodeEnv === 'production') {
    console.warn('⚠️  WARNING: Running in production with in-memory database!');
    console.warn('⚠️  Data will be lost on restart. Set MONGODB_URI to use persistent storage.');
  } else {
    console.log('📦 Using in-memory database for development');
  }
  
  return inMemoryDb as IDatabase;
}

// Export a promise that resolves to the database instance
export const getDatabase = initializeDatabase();

// Export a synchronous wrapper for route handlers
let dbInstance: IDatabase | null = null;

export async function ensureDatabase(): Promise<IDatabase> {
  if (!dbInstance) {
    dbInstance = await getDatabase;
  }
  return dbInstance;
}

// Helper function for synchronous access (after initialization)
export function getDbSync(): IDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call ensureDatabase() first.');
  }
  return dbInstance;
}
