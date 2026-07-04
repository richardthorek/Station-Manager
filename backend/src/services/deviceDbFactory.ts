/**
 * Device Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring vehicleTypeDbFactory.ts.
 */

import { logger } from './logger';
import { getDeviceDatabase, type IDeviceDatabase } from './deviceDatabase';
import { TableStorageDeviceDatabase } from './tableStorageDeviceDatabase';

let instance: IDeviceDatabase | null = null;
let isInitialized = false;

export function ensureDeviceDatabase(): IDeviceDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for devices');
    instance = new TableStorageDeviceDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for devices (data will be lost on restart)');
    instance = getDeviceDatabase();
  }
  return instance;
}

export async function initializeDeviceDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureDeviceDatabase();
  if (db instanceof TableStorageDeviceDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getDeviceDb(): IDeviceDatabase {
  if (!instance) {
    throw new Error('Device database not initialized. Call ensureDeviceDatabase() first.');
  }
  return instance;
}
