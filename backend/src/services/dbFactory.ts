/**
 * Database Factory
 * Determines which database service to use based on environment
 * Priority: Table Storage > In-Memory
 */

import type { 
  Member, 
  Activity, 
  ActiveActivity, 
  CheckIn, 
  Event, 
  EventParticipant, 
  EventWithParticipants 
} from '../types';
import { db as inMemoryDb } from './database';
import { tableStorageDb } from './tableStorageDatabase';

// Interface that both database services must implement
export interface IDatabase {
  // Members
  getAllMembers(): Promise<Member[]> | Member[];
  getMemberById(id: string): Promise<Member | null | undefined> | Member | null | undefined;
  getMemberByQRCode(qrCode: string): Promise<Member | null | undefined> | Member | null | undefined;
  createMember(name: string, details?: { rank?: string | null; firstName?: string; lastName?: string; preferredName?: string; memberNumber?: string }): Promise<Member> | Member;
  updateMember(id: string, name: string, rank?: string | null): Promise<Member | null | undefined> | Member | null | undefined;
  
  // Activities
  getAllActivities(): Promise<Activity[]> | Activity[];
  getActivityById(id: string): Promise<Activity | null | undefined> | Activity | null | undefined;
  createActivity(name: string, createdBy?: string): Promise<Activity> | Activity;
  
  // Active Activity
  getActiveActivity(): Promise<ActiveActivity | null> | ActiveActivity | null;
  setActiveActivity(activityId: string, setBy?: string): Promise<ActiveActivity> | ActiveActivity;
  
  // Check-ins
  getAllCheckIns(): Promise<CheckIn[]> | CheckIn[];
  getActiveCheckIns(): Promise<CheckIn[]> | CheckIn[];
  getCheckInByMember(memberId: string): Promise<CheckIn | null | undefined> | CheckIn | null | undefined;
  getCheckInsByMember(memberId: string): Promise<CheckIn[]> | CheckIn[];
  createCheckIn(memberId: string, activityId: string, method: 'kiosk' | 'mobile' | 'qr', location?: string, isOffsite?: boolean): Promise<CheckIn> | CheckIn;
  deactivateCheckIn(checkInId: string): Promise<boolean> | boolean;
  deactivateCheckInByMember(memberId: string): Promise<boolean> | boolean;
  clearAllActiveCheckIns(): Promise<void> | void;
  
  // Events
  createEvent(activityId: string, createdBy?: string): Promise<Event> | Event;
  getEvents(limit?: number, offset?: number): Promise<Event[]> | Event[];
  getActiveEvents(): Promise<Event[]> | Event[];
  getEventById(eventId: string): Promise<Event | null | undefined> | Event | null | undefined;
  endEvent(eventId: string): Promise<Event | null> | Event | null;
  addEventParticipant(eventId: string, memberId: string, method: 'kiosk' | 'mobile' | 'qr', location?: string, isOffsite?: boolean): Promise<EventParticipant> | EventParticipant;
  getEventParticipants(eventId: string): Promise<EventParticipant[]> | EventParticipant[];
  getEventWithParticipants(eventId: string): Promise<EventWithParticipants | null> | EventWithParticipants | null;
  getEventsWithParticipants(limit?: number, offset?: number): Promise<EventWithParticipants[]> | EventWithParticipants[];
  removeEventParticipant(participantId: string): Promise<boolean> | boolean;
  getMemberParticipantInEvent(eventId: string, memberId: string): Promise<EventParticipant | undefined> | EventParticipant | undefined;
  getAllActiveParticipants(): Promise<EventParticipant[]> | EventParticipant[];
}

/**
 * Initialize and return the appropriate database service
 * Priority order:
 * 1. Table Storage with 'Test' suffix (if NODE_ENV=test and AZURE_STORAGE_CONNECTION_STRING set)
 * 2. Table Storage (if AZURE_STORAGE_CONNECTION_STRING is set - default for all environments)
 * 3. Table Storage (if USE_TABLE_STORAGE=true and AZURE_STORAGE_CONNECTION_STRING set)
 * 4. In-memory database (fallback when no Azure connection available)
 * 
 * Note: Production environments automatically use Table Storage when connection string is available.
 * Set USE_TABLE_STORAGE=false to explicitly disable Table Storage.
 */
async function initializeDatabase(): Promise<IDatabase> {
  const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const nodeEnv = process.env.NODE_ENV;
  
  // In tests, default to in-memory unless explicitly forced on
  if (nodeEnv === 'test' && process.env.TEST_USE_TABLE_STORAGE !== 'true') {
    console.log('🧪 Using in-memory database for tests (Table Storage disabled by default)');
    return inMemoryDb as IDatabase;
  }

  // Use Table Storage if:
  // 1. Connection string is available AND
  // 2. Either: not explicitly disabled (USE_TABLE_STORAGE !== 'false') OR explicitly enabled
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = storageConnectionString && !explicitlyDisabled;
  
  // Prefer Table Storage if connection string is available and not explicitly disabled
  if (useTableStorage) {
    console.log('🔌 Connecting to Azure Table Storage...');
    try {
      // Call connect on tableStorageDb (type-safe via unknown cast)
      await (tableStorageDb as unknown as { connect: () => Promise<void> }).connect();
      console.log('✅ Connected to Azure Table Storage');
      return tableStorageDb as IDatabase;
    } catch (error) {
      console.error('❌ Failed to connect to Table Storage:', error);
      console.log('⚠️  Falling back to in-memory database');
    }
  }
  
  // Fallback to in-memory database
  if (nodeEnv === 'production') {
    console.warn('⚠️  WARNING: Running in production with in-memory database!');
    console.warn('⚠️  Data will be lost on restart. Set AZURE_STORAGE_CONNECTION_STRING to enable Table Storage.');
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

// Helper function for testing: reset the database instance
export function __resetDatabase(): void {
  dbInstance = null;
}

