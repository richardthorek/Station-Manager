/**
 * Admin User Database Factory
 * 
 * Chooses between in-memory and Azure Table Storage implementations
 * based on environment configuration.
 */

import { logger } from './logger';
import { getAdminUserDatabase } from './adminUserDatabase';
import { TableStorageAdminUserDatabase } from './tableStorageAdminUserDatabase';

// Singleton instances
let adminUserDbInstance: ReturnType<typeof getAdminUserDatabase> | TableStorageAdminUserDatabase | null = null;
let isInitialized = false;

/**
 * Get admin user database instance (singleton)
 * Automatically chooses between in-memory and Table Storage based on configuration
 */
export function ensureAdminUserDatabase() {
  if (adminUserDbInstance) {
    return adminUserDbInstance;
  }

  const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = storageConnectionString && !explicitlyDisabled;

  if (useTableStorage) {
    logger.info('Using Azure Table Storage for Admin Users');
    adminUserDbInstance = new TableStorageAdminUserDatabase(storageConnectionString);
  } else {
    logger.info('Using in-memory database for Admin Users (data will be lost on restart)');
    adminUserDbInstance = getAdminUserDatabase();
  }

  return adminUserDbInstance;
}

/**
 * Initialize admin user database with default credentials
 */
export async function initializeAdminUserDatabase(
  defaultUsername?: string,
  defaultPassword?: string
): Promise<void> {
  if (isInitialized) {
    return;
  }

  const adminDb = ensureAdminUserDatabase();
  
  // For Table Storage, connect first
  if (adminDb instanceof TableStorageAdminUserDatabase) {
    await adminDb.connect();
  }

  // Initialize with default credentials
  await adminDb.initialize(defaultUsername, defaultPassword);
  
  isInitialized = true;
}

/**
 * Get the current admin user database instance
 * Throws an error if not initialized
 */
export function getAdminDb() {
  if (!adminUserDbInstance) {
    throw new Error('Admin user database not initialized. Call ensureAdminUserDatabase() first.');
  }
  return adminUserDbInstance;
}
