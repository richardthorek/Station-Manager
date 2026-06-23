/**
 * Appliance Equipment Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring applianceZoneDbFactory.
 */

import { logger } from './logger';
import { getApplianceEquipmentDatabase, type IApplianceEquipmentDatabase } from './applianceEquipmentDatabase';
import { TableStorageApplianceEquipmentDatabase } from './tableStorageApplianceEquipmentDatabase';

let instance: IApplianceEquipmentDatabase | null = null;
let isInitialized = false;

export function ensureApplianceEquipmentDatabase(): IApplianceEquipmentDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for appliance equipment');
    instance = new TableStorageApplianceEquipmentDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for appliance equipment (data will be lost on restart)');
    instance = getApplianceEquipmentDatabase();
  }
  return instance;
}

export async function initializeApplianceEquipmentDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureApplianceEquipmentDatabase();
  if (db instanceof TableStorageApplianceEquipmentDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getApplianceEquipmentDb(): IApplianceEquipmentDatabase {
  if (!instance) {
    throw new Error('Appliance equipment database not initialized. Call ensureApplianceEquipmentDatabase() first.');
  }
  return instance;
}
