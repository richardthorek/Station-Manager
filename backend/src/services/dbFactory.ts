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
import { initializeDatabase } from './dbFactoryHelper';

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
  reactivateEvent(eventId: string): Promise<Event | null> | Event | null;
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
 * Uses shared initialization logic from dbFactoryHelper
 */
async function initializeDatabaseService(): Promise<IDatabase> {
  return initializeDatabase({
    name: 'Database',
    inMemoryDb: inMemoryDb as IDatabase,
    tableStorageDb: tableStorageDb as IDatabase & { connect: () => Promise<void> },
  });
}

// Export a promise that resolves to the database instance
export const getDatabase = initializeDatabaseService();

// Export a synchronous wrapper for route handlers
let dbInstance: IDatabase | null = null;

/**
 * Ensure database is initialized and return the instance
 * 
 * This is the primary function for accessing the database in route handlers.
 * It handles lazy initialization and caches the database instance.
 * 
 * @returns Promise that resolves to the initialized database instance
 * @example
 * const db = await ensureDatabase();
 * const members = await db.getAllMembers();
 */
export async function ensureDatabase(): Promise<IDatabase> {
  if (!dbInstance) {
    dbInstance = await getDatabase;
  }
  return dbInstance;
}

/**
 * Get database instance synchronously (after initialization)
 * 
 * Only use this if you're certain the database has been initialized.
 * Most code should use ensureDatabase() instead.
 * 
 * @throws Error if database is not initialized
 * @returns The database instance
 */
export function getDbSync(): IDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call ensureDatabase() first.');
  }
  return dbInstance;
}

/**
 * Reset the database instance (for testing only)
 * 
 * This function should only be used in test code to reset state between tests.
 * Do not use in production code.
 * 
 * @internal
 */
export function __resetDatabase(): void {
  dbInstance = null;
}

