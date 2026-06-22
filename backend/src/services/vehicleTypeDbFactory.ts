/**
 * Vehicle Type Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring usageDbFactory / aarSessionDbFactory.
 */

import { logger } from './logger';
import { getVehicleTypeDatabase, type IVehicleTypeDatabase } from './vehicleTypeDatabase';
import { TableStorageVehicleTypeDatabase } from './tableStorageVehicleTypeDatabase';

let instance: IVehicleTypeDatabase | null = null;
let isInitialized = false;

export function ensureVehicleTypeDatabase(): IVehicleTypeDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for vehicle types');
    instance = new TableStorageVehicleTypeDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for vehicle types (data will be lost on restart)');
    instance = getVehicleTypeDatabase();
  }
  return instance;
}

export async function initializeVehicleTypeDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureVehicleTypeDatabase();
  if (db instanceof TableStorageVehicleTypeDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getVehicleTypeDb(): IVehicleTypeDatabase {
  if (!instance) {
    throw new Error('Vehicle type database not initialized. Call ensureVehicleTypeDatabase() first.');
  }
  return instance;
}
