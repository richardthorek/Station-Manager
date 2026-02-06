import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';

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
 * Add an action to the offline queue
 */
export async function addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
  const database = await initDB();
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  const queuedAction: QueuedAction = {
    ...action,
    id,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  await database.add('offline-queue', queuedAction);
  console.log('[OfflineQueue] Added to queue:', queuedAction);
  
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
 * Cache data for offline access
 */
export async function cacheData(key: string, data: unknown, expiresInMs?: number): Promise<void> {
  const database = await initDB();
  
  const cachedData: CachedData = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
  };

  await database.put('cached-data', cachedData);
}

/**
 * Get cached data
 */
export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  const database = await initDB();
  const cached = await database.get('cached-data', key);
  
  if (!cached) {
    return null;
  }

  // Check if expired
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    await database.delete('cached-data', key);
    return null;
  }

  return cached.data as T;
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
