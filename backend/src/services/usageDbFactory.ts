/**
 * AI Usage Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring organizationDbFactory.
 */

import { logger } from './logger';
import { getUsageDatabase, type IUsageDatabase } from './usageDatabase';
import { TableStorageUsageDatabase } from './tableStorageUsageDatabase';

let instance: IUsageDatabase | null = null;
let isInitialized = false;

export function ensureUsageDatabase(): IUsageDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for AI usage');
    instance = new TableStorageUsageDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for AI usage (data will be lost on restart)');
    instance = getUsageDatabase();
  }
  return instance;
}

export async function initializeUsageDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureUsageDatabase();
  if (db instanceof TableStorageUsageDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getUsageDb(): IUsageDatabase {
  if (!instance) {
    throw new Error('Usage database not initialized. Call ensureUsageDatabase() first.');
  }
  return instance;
}
