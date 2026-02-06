/**
 * Database Factory Helper
 * 
 * Shared initialization logic for database factories.
 * Reduces code duplication between dbFactory and truckChecksDbFactory.
 */

import { logger } from './logger';

/**
 * Configuration for database initialization
 */
interface DatabaseInitConfig<TDatabase> {
  /** Name of the database for logging (e.g., "Database", "Truck Checks Database") */
  name: string;
  /** In-memory database implementation */
  inMemoryDb: TDatabase;
  /** Table Storage database implementation with connect method */
  tableStorageDb: TDatabase & { connect: () => Promise<void> };
}

/**
 * Initialize a database with common logic for Table Storage vs In-Memory fallback
 * 
 * Priority order:
 * 1. Table Storage with 'Test' suffix (if NODE_ENV=test and TEST_USE_TABLE_STORAGE=true)
 * 2. Table Storage (if AZURE_STORAGE_CONNECTION_STRING is set - default for all environments)
 * 3. In-memory database (fallback when no Azure connection available or explicitly disabled)
 * 
 * @param config Database initialization configuration
 * @returns Initialized database instance
 */
export async function initializeDatabase<TDatabase>(
  config: DatabaseInitConfig<TDatabase>
): Promise<TDatabase> {
  const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const nodeEnv = process.env.NODE_ENV;
  
  // In tests, default to in-memory unless explicitly forced on
  if (nodeEnv === 'test' && process.env.TEST_USE_TABLE_STORAGE !== 'true') {
    logger.info(`Using in-memory ${config.name.toLowerCase()} for tests (Table Storage disabled by default)`);
    return config.inMemoryDb;
  }

  // Use Table Storage if:
  // 1. Connection string is available AND
  // 2. Either: not explicitly disabled (USE_TABLE_STORAGE !== 'false') OR explicitly enabled
  const explicitlyDisabled = process.env.USE_TABLE_STORAGE === 'false';
  const useTableStorage = storageConnectionString && !explicitlyDisabled;

  // Prefer Table Storage if connection string is available and not explicitly disabled
  if (useTableStorage) {
    logger.info(`Connecting to Azure Table Storage for ${config.name}...`);
    try {
      await config.tableStorageDb.connect();
      logger.info(`Connected to Azure Table Storage for ${config.name}`);
      return config.tableStorageDb;
    } catch (error) {
      logger.error(`Failed to connect to Table Storage for ${config.name}`, { error });
      logger.warn('Falling back to in-memory database');
    }
  }

  // Fallback to in-memory database
  if (nodeEnv === 'production') {
    logger.warn(`WARNING: Running ${config.name} in production with in-memory database!`);
    logger.warn('Data will be lost on restart. Set AZURE_STORAGE_CONNECTION_STRING to enable Table Storage.');
  } else {
    logger.info(`Using in-memory ${config.name.toLowerCase()} for development`);
  }

  return config.inMemoryDb;
}
