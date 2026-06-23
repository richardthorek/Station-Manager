/**
 * Appliance Zone Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring vehicleTypeDbFactory.
 */

import { logger } from './logger';
import { getApplianceZoneDatabase, type IApplianceZoneDatabase } from './applianceZoneDatabase';
import { TableStorageApplianceZoneDatabase } from './tableStorageApplianceZoneDatabase';

let instance: IApplianceZoneDatabase | null = null;
let isInitialized = false;

export function ensureApplianceZoneDatabase(): IApplianceZoneDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for appliance zones');
    instance = new TableStorageApplianceZoneDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for appliance zones (data will be lost on restart)');
    instance = getApplianceZoneDatabase();
  }
  return instance;
}

export async function initializeApplianceZoneDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureApplianceZoneDatabase();
  if (db instanceof TableStorageApplianceZoneDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getApplianceZoneDb(): IApplianceZoneDatabase {
  if (!instance) {
    throw new Error('Appliance zone database not initialized. Call ensureApplianceZoneDatabase() first.');
  }
  return instance;
}
