/**
 * Agent Session Database Factory
 *
 * Chooses between in-memory and Azure Table Storage implementations,
 * following the same pattern as applianceZoneDbFactory.
 */

import { logger } from './logger';
import { AgentSessionDatabase, type IAgentSessionDatabase } from './agentSessionDatabase';
import { TableStorageAgentSessionDatabase } from './tableStorageAgentSessionDatabase';

let instance: IAgentSessionDatabase | null = null;
let isInitialized = false;

export function ensureAgentSessionDatabase(): IAgentSessionDatabase {
  if (instance) return instance;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = connectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for agent sessions');
    instance = new TableStorageAgentSessionDatabase(connectionString);
  } else {
    logger.info('Using in-memory database for agent sessions (data will be lost on restart)');
    instance = new AgentSessionDatabase();
  }
  return instance;
}

export async function initializeAgentSessionDatabase(): Promise<void> {
  if (isInitialized) return;
  const db = ensureAgentSessionDatabase();
  if (db instanceof TableStorageAgentSessionDatabase) {
    await db.connect();
  }
  isInitialized = true;
}

export function getAgentSessionDb(): IAgentSessionDatabase {
  if (!instance) {
    throw new Error('Agent session database not initialized. Call ensureAgentSessionDatabase() first.');
  }
  return instance;
}
