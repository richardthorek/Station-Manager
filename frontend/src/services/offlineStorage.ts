import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { getCurrentStationId } from './api';

// Define the database schema
interface StationManagerDB extends DBSchema {
  'offline-queue': {
    key: string;
    value: QueuedAction;
    indexes: { 'by-timestamp': number };
  };
  'cached-data': {
    key: string;
    value: CachedData;
    indexes: { 'by-timestamp': number };
  };
}

export interface QueuedAction {
  id: string;
  type: 'checkin' | 'checkout' | 'create-member' | 'create-event' | 'end-event' | 'update-activity' | 'other';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data: unknown;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
  stationId: string; // Station context for validation
}

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt?: number;
}

let db: IDBPDatabase<StationManagerDB> | null = null;

const DB_NAME = 'station-manager-db';
const DB_VERSION = 1;

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<StationManagerDB>> {
  if (db) {
    return db;
  }

  db = await openDB<StationManagerDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Create offline queue store
      if (!database.objectStoreNames.contains('offline-queue')) {
        const queueStore = database.createObjectStore('offline-queue', { keyPath: 'id' });
        queueStore.createIndex('by-timestamp', 'timestamp');
      }

      // Create cached data store
      if (!database.objectStoreNames.contains('cached-data')) {
        const cacheStore = database.createObjectStore('cached-data', { keyPath: 'key' });
        cacheStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return db;
}

/**
 * Add an action to the offline queue with station context
 */
export async function addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount' | 'status' | 'stationId'>): Promise<string> {
  const database = await initDB();
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const stationId = getCurrentStationId();
  
  if (!stationId) {
    throw new Error('[OfflineQueue] Cannot queue action without station context');
  }
  
  const queuedAction: QueuedAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
    stationId, // Preserve station context
  };

  await database.add('offline-queue', queuedAction);
  console.log('[OfflineQueue] Added to queue with station context:', { 
    id, 
    stationId, 
    type: queuedAction.type 
  });
  
  return id;
}

/**
 * Get all pending actions from the queue
 */
export async function getPendingActions(): Promise<QueuedAction[]> {
  const database = await initDB();
  const actions = await database.getAllFromIndex('offline-queue', 'by-timestamp');
  return actions.filter(action => action.status === 'pending');
}

/**
 * Get all actions from the queue
 */
export async function getAllQueuedActions(): Promise<QueuedAction[]> {
  const database = await initDB();
  return database.getAllFromIndex('offline-queue', 'by-timestamp');
}

/**
 * Update a queued action
 */
export async function updateQueuedAction(id: string, updates: Partial<QueuedAction>): Promise<void> {
  const database = await initDB();
  const action = await database.get('offline-queue', id);
  
  if (action) {
    await database.put('offline-queue', { ...action, ...updates });
  }
}

/**
 * Remove an action from the queue
 */
export async function removeFromQueue(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('offline-queue', id);
  console.log('[OfflineQueue] Removed from queue:', id);
}

/**
 * Clear all synced actions from the queue
 */
export async function clearSyncedActions(): Promise<void> {
  const database = await initDB();
  const actions = await database.getAll('offline-queue');
  
  for (const action of actions) {
    if (action.status === 'synced') {
      await database.delete('offline-queue', action.id);
    }
  }
}

/**
 * Cache data with station context
 * Cache keys are automatically scoped to the current station
 */
export async function cacheData(key: string, data: unknown, expiresInMs?: number): Promise<void> {
  const database = await initDB();
  const stationId = getCurrentStationId();
  
  // Prefix key with station context for isolation
  const scopedKey = stationId ? `station-${stationId}:${key}` : key;
  
  const cachedData: CachedData = {
    key: scopedKey,
    data,
    timestamp: Date.now(),
    expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
  };

  await database.put('cached-data', cachedData);
  console.log('[OfflineStorage] Cached data with station context:', { 
    originalKey: key,
    scopedKey, 
    stationId 
  });
}

/**
 * Get cached data for current station
 */
export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  const database = await initDB();
  const stationId = getCurrentStationId();
  
  // Use scoped key for lookup
  const scopedKey = stationId ? `station-${stationId}:${key}` : key;
  const cached = await database.get('cached-data', scopedKey);
  
  if (!cached) {
    console.log('[OfflineStorage] No cached data found:', { scopedKey, stationId });
    return null;
  }

  // Check if expired
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    await database.delete('cached-data', scopedKey);
    console.log('[OfflineStorage] Cached data expired:', { scopedKey });
    return null;
  }

  console.log('[OfflineStorage] Retrieved cached data:', { scopedKey, stationId });
  return cached.data as T;
}

/**
 * Clear all cached data for a specific station
 * Useful when switching stations or logging out
 */
export async function clearCacheForStation(stationId: string): Promise<void> {
  const database = await initDB();
  const allCached = await database.getAll('cached-data');
  
  const stationPrefix = `station-${stationId}:`;
  let clearedCount = 0;
  
  for (const item of allCached) {
    if (item.key.startsWith(stationPrefix)) {
      await database.delete('cached-data', item.key);
      clearedCount++;
    }
  }
  
  console.log('[OfflineStorage] Cleared cache for station:', { stationId, clearedCount });
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<void> {
  const database = await initDB();
  const allCached = await database.getAll('cached-data');
  const now = Date.now();
  
  for (const cached of allCached) {
    if (cached.expiresAt && cached.expiresAt < now) {
      await database.delete('cached-data', cached.key);
    }
  }
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  const database = await initDB();
  await database.clear('cached-data');
}

/**
 * Clear the entire database
 */
export async function clearDatabase(): Promise<void> {
  const database = await initDB();
  await database.clear('offline-queue');
  await database.clear('cached-data');
}
