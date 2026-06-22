/**
 * AAR Session Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring usageDbFactory / billingEventDbFactory.
 */

import { logger } from './logger';
import { getAarSessionDatabase, type IAarSessionDatabase } from './aarSessionDatabase';
import { TableStorageAarSessionDatabase } from './tableStorageAarSessionDatabase';

let instance: IAarSessionDatabase | null = null;
let isInitialized = false;

export function ensureAarSessionDatabase(): IAarSessionDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for AAR sessions');
    instance = new TableStorageAarSessionDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for AAR sessions (data will be lost on restart)');
    instance = getAarSessionDatabase();
  }
  return instance;
}

export async function initializeAarSessionDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureAarSessionDatabase();
  if (db instanceof TableStorageAarSessionDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getAarSessionDb(): IAarSessionDatabase {
  if (!instance) {
    throw new Error('AAR session database not initialized. Call ensureAarSessionDatabase() first.');
  }
  return instance;
}
