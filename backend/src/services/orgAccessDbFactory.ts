/**
 * Org Access Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations for the
 * org-onboarding tables (memberships, invites, claim conflicts), mirroring
 * organizationDbFactory.
 */

import { logger } from './logger';
import { getOrgAccessDatabase, type IOrgAccessDatabase } from './orgAccessDatabase';
import { TableStorageOrgAccessDatabase } from './tableStorageOrgAccessDatabase';

let instance: IOrgAccessDatabase | null = null;
let isInitialized = false;

export function ensureOrgAccessDatabase(): IOrgAccessDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for Org Access (memberships/invites/claim conflicts)');
    instance = new TableStorageOrgAccessDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for Org Access (data will be lost on restart)');
    instance = getOrgAccessDatabase();
  }
  return instance;
}

export async function initializeOrgAccessDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureOrgAccessDatabase();
  if (db instanceof TableStorageOrgAccessDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getOrgAccessDb(): IOrgAccessDatabase {
  if (!instance) {
    throw new Error('Org access database not initialized. Call ensureOrgAccessDatabase() first.');
  }
  return instance;
}
