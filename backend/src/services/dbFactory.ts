/**
 * Database Factory
 * Determines which database service to use based on environment
 * Priority: Table Storage > In-Memory
 */

import type { Member } from '../types';
import { db as inMemoryDb } from './database';
import { tableStorageDb } from './tableStorageDatabase';

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
  updateMember(id: string, name: string, rank?: string | null): Promise<Member | null | undefined> | Member | null | undefined;
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
 * Priority order:
 * 1. Table Storage (if USE_TABLE_STORAGE=true and AZURE_STORAGE_CONNECTION_STRING set)
 * 2. In-memory database (fallback for development)
 */
async function initializeDatabase(): Promise<IDatabase> {
  const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const useTableStorage = process.env.USE_TABLE_STORAGE === 'true' || process.env.NODE_ENV === 'development';
  const nodeEnv = process.env.NODE_ENV;
  
  // Prefer Table Storage if explicitly enabled
  if (useTableStorage && storageConnectionString) {
    console.log('🔌 Connecting to Azure Table Storage...');
    try {
      // tableStorageDb is implemented in a module that would otherwise create a circular type import
      // so call connect and return via `any`/`unknown` casts to satisfy the compiler.
      await (tableStorageDb as any).connect();
      console.log('✅ Connected to Azure Table Storage');
      return tableStorageDb as unknown as IDatabase;
    } catch (error) {
      console.error('❌ Failed to connect to Table Storage:', error);
      console.log('⚠️  Falling back to alternative database');
    }
  } else if (useTableStorage && !storageConnectionString) {
    console.warn('⚠️  USE_TABLE_STORAGE requested but AZURE_STORAGE_CONNECTION_STRING is missing; skipping Table Storage');
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
