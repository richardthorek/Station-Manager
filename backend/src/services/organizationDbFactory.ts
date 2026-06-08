/**
 * Organization Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring adminUserDbFactory.
 */

import { logger } from './logger';
import {
  getOrganizationDatabase,
  type IOrganizationDatabase,
} from './organizationDatabase';
import { TableStorageOrganizationDatabase } from './tableStorageOrganizationDatabase';

let instance: IOrganizationDatabase | null = null;
let isInitialized = false;

export function ensureOrganizationDatabase(): IOrganizationDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for Organizations');
    instance = new TableStorageOrganizationDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for Organizations (data will be lost on restart)');
    instance = getOrganizationDatabase();
  }
  return instance;
}

export async function initializeOrganizationDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureOrganizationDatabase();
  if (db instanceof TableStorageOrganizationDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getOrganizationDb(): IOrganizationDatabase {
  if (!instance) {
    throw new Error('Organization database not initialized. Call ensureOrganizationDatabase() first.');
  }
  return instance;
}
