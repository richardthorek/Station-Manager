/**
 * Billing Event Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations based on
 * environment configuration, mirroring usageDbFactory / organizationDbFactory.
 */

import { logger } from './logger';
import { getBillingEventDatabase, type IBillingEventDatabase } from './billingEventDatabase';
import { TableStorageBillingEventDatabase } from './tableStorageBillingEventDatabase';

let instance: IBillingEventDatabase | null = null;
let isInitialized = false;

export function ensureBillingEventDatabase(): IBillingEventDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for billing events');
    instance = new TableStorageBillingEventDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for billing events (data will be lost on restart)');
    instance = getBillingEventDatabase();
  }
  return instance;
}

export async function initializeBillingEventDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureBillingEventDatabase();
  if (db instanceof TableStorageBillingEventDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getBillingEventDb(): IBillingEventDatabase {
  if (!instance) {
    throw new Error('Billing event database not initialized. Call ensureBillingEventDatabase() first.');
  }
  return instance;
}
