/**
 * Truck Checks Database Factory
 * Determines which database service to use based on environment
 * Priority: Table Storage > MongoDB/Cosmos DB > In-Memory
 */

import { truckChecksDb as inMemoryTruckChecksDb } from './truckChecksDatabase';
import { truckChecksDb as mongoTruckChecksDb } from './mongoTruckChecksDatabase';
import { tableStorageTruckChecksDb } from './tableStorageTruckChecksDatabase';
import { 
  Appliance, 
  ChecklistTemplate, 
  ChecklistItem, 
  CheckRun, 
  CheckResult,
  CheckRunWithResults,
  CheckStatus
} from '../types';

// Interface that both database services must implement
export interface ITruckChecksDatabase {
  // Appliances
  getAllAppliances(): Promise<Appliance[]> | Appliance[];
  getApplianceById(id: string): Promise<Appliance | null | undefined> | Appliance | null | undefined;
  createAppliance(name: string, description?: string, photoUrl?: string): Promise<Appliance> | Appliance;
  updateAppliance(id: string, name: string, description?: string, photoUrl?: string): Promise<Appliance | null | undefined> | Appliance | null | undefined;
  deleteAppliance(id: string): Promise<boolean> | boolean;
  
  // Templates
  getTemplateByApplianceId(applianceId: string): Promise<ChecklistTemplate | null | undefined> | ChecklistTemplate | null | undefined;
  getTemplateById(id: string): Promise<ChecklistTemplate | null | undefined> | ChecklistTemplate | null | undefined;
  updateTemplate(applianceId: string, items: Omit<ChecklistItem, 'id'>[]): Promise<ChecklistTemplate> | ChecklistTemplate;
  
  // Check Runs
  createCheckRun(applianceId: string, completedBy: string, completedByName?: string): Promise<CheckRun> | CheckRun;
  getCheckRunById(id: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  getAllCheckRuns(): Promise<CheckRun[]> | CheckRun[];
  getCheckRunsByAppliance(applianceId: string): Promise<CheckRun[]> | CheckRun[];
  getCheckRunsByDateRange(startDate: Date, endDate: Date): Promise<CheckRun[]> | CheckRun[];
  completeCheckRun(id: string, additionalComments?: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  getActiveCheckRunForAppliance(applianceId: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  addContributorToCheckRun(runId: string, contributorName: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  
  // Check Results
  createCheckResult(runId: string, itemId: string, itemName: string, itemDescription: string, status: CheckStatus, comment?: string, photoUrl?: string, completedBy?: string): Promise<CheckResult> | CheckResult;
  getResultsByRunId(runId: string): Promise<CheckResult[]> | CheckResult[];
  getCheckRunWithResults(runId: string): Promise<CheckRunWithResults | null> | CheckRunWithResults | null;
  updateCheckResult(id: string, status: CheckStatus, comment?: string, photoUrl?: string): Promise<CheckResult | null | undefined> | CheckResult | null | undefined;
  deleteCheckResult(id: string): Promise<boolean> | boolean;
  
  // Query Methods
  getRunsWithIssues(): Promise<CheckRunWithResults[]> | CheckRunWithResults[];
  getAllRunsWithResults(): Promise<CheckRunWithResults[]> | CheckRunWithResults[];
}

/**
 * Initialize and return the appropriate truck checks database service
 * Priority order:
 * 1. Table Storage (if USE_TABLE_STORAGE=true and AZURE_STORAGE_CONNECTION_STRING set)
 * 2. MongoDB/Cosmos DB (if MONGODB_URI set)
 * 3. In-memory database (fallback for development)
 */
async function initializeTruckChecksDatabase(): Promise<ITruckChecksDatabase> {
  const mongoUri = process.env.MONGODB_URI;
  const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const useTableStorage = process.env.USE_TABLE_STORAGE === 'true';
  const nodeEnv = process.env.NODE_ENV;
  
  // Prefer Table Storage if explicitly enabled
  if (useTableStorage && storageConnectionString) {
    console.log('🔌 Connecting to Azure Table Storage for Truck Checks...');
    try {
      await tableStorageTruckChecksDb.connect();
      console.log('✅ Connected to Azure Table Storage for Truck Checks');
      return tableStorageTruckChecksDb as ITruckChecksDatabase;
    } catch (error) {
      console.error('❌ Failed to connect to Table Storage for Truck Checks:', error);
      console.log('⚠️  Falling back to alternative database');
    }
  }
  
  // Use MongoDB if connection string is provided
  if (mongoUri && mongoUri.trim() !== '') {
    console.log('🔌 Connecting to MongoDB/Cosmos DB for Truck Checks...');
    try {
      await mongoTruckChecksDb.connect();
      console.log('✅ Connected to MongoDB/Cosmos DB for Truck Checks');
      return mongoTruckChecksDb as ITruckChecksDatabase;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB for Truck Checks:', error);
      console.log('⚠️  Falling back to in-memory database for Truck Checks');
    }
  }
  
  // Fallback to in-memory database
  if (nodeEnv === 'production') {
    console.warn('⚠️  WARNING: Running Truck Checks in production with in-memory database!');
    console.warn('⚠️  Data will be lost on restart. Set MONGODB_URI or enable Table Storage.');
  } else {
    console.log('📦 Using in-memory database for Truck Checks (development)');
  }
  
  return inMemoryTruckChecksDb as ITruckChecksDatabase;
}

// Export a promise that resolves to the database instance
export const getTruckChecksDatabase = initializeTruckChecksDatabase();

// Export a synchronous wrapper for route handlers
let truckChecksDbInstance: ITruckChecksDatabase | null = null;

export async function ensureTruckChecksDatabase(): Promise<ITruckChecksDatabase> {
  if (!truckChecksDbInstance) {
    truckChecksDbInstance = await getTruckChecksDatabase;
  }
  return truckChecksDbInstance;
}

// Helper function for synchronous access (after initialization)
export function getTruckChecksDbSync(): ITruckChecksDatabase {
  if (!truckChecksDbInstance) {
    throw new Error('Truck Checks Database not initialized. Call ensureTruckChecksDatabase() first.');
  }
  return truckChecksDbInstance;
}
