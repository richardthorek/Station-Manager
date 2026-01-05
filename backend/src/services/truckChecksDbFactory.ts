/**
 * Truck Checks Database Factory
 * Determines which database service to use based on environment and demo mode
 * Priority: Table Storage > In-Memory
 * 
 * Supports dual-instance mode for per-device demo functionality:
 * - Production instance: Uses TABLE_STORAGE_TABLE_SUFFIX from env
 * - Test instance: Always uses 'Test' suffix for demo mode
 */

import { truckChecksDb as inMemoryTruckChecksDb } from './truckChecksDatabase';
import { tableStorageTruckChecksDb, tableStorageTruckChecksTestDb } from './tableStorageTruckChecksDatabase';
import { initializeDatabase } from './dbFactoryHelper';
import {
  Appliance,
  ChecklistTemplate,
  ChecklistItem,
  CheckRun,
  CheckResult,
  CheckRunWithResults,
  CheckStatus,
} from '../types';

// Interface shared by truck checks database implementations
export interface ITruckChecksDatabase {
  // Appliances
  getAllAppliances(stationId?: string): Promise<Appliance[]> | Appliance[];
  getApplianceById(id: string): Promise<Appliance | null | undefined> | Appliance | null | undefined;
  createAppliance(name: string, description?: string, photoUrl?: string, stationId?: string): Promise<Appliance> | Appliance;
  updateAppliance(id: string, name: string, description?: string, photoUrl?: string): Promise<Appliance | null | undefined> | Appliance | null | undefined;
  deleteAppliance(id: string): Promise<boolean> | boolean;

  // Templates
  getTemplateByApplianceId(applianceId: string): Promise<ChecklistTemplate | null | undefined> | ChecklistTemplate | null | undefined;
  getTemplateById(id: string): Promise<ChecklistTemplate | null | undefined> | ChecklistTemplate | null | undefined;
  updateTemplate(applianceId: string, items: Omit<ChecklistItem, 'id'>[], stationId?: string): Promise<ChecklistTemplate> | ChecklistTemplate;

  // Check Runs
  createCheckRun(applianceId: string, completedBy: string, completedByName?: string, stationId?: string): Promise<CheckRun> | CheckRun;
  getCheckRunById(id: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  getAllCheckRuns(stationId?: string): Promise<CheckRun[]> | CheckRun[];
  getCheckRunsByAppliance(applianceId: string): Promise<CheckRun[]> | CheckRun[];
  getCheckRunsByDateRange(startDate: Date, endDate: Date, stationId?: string): Promise<CheckRun[]> | CheckRun[];
  completeCheckRun(id: string, additionalComments?: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  getActiveCheckRunForAppliance(applianceId: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;
  addContributorToCheckRun(runId: string, contributorName: string): Promise<CheckRun | null | undefined> | CheckRun | null | undefined;

  // Check Results
  createCheckResult(
    runId: string,
    itemId: string,
    itemName: string,
    itemDescription: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string,
    completedBy?: string,
    stationId?: string
  ): Promise<CheckResult> | CheckResult;
  getResultsByRunId(runId: string): Promise<CheckResult[]> | CheckResult[];
  getCheckRunWithResults(runId: string): Promise<CheckRunWithResults | null> | CheckRunWithResults | null;
  updateCheckResult(id: string, status: CheckStatus, comment?: string, photoUrl?: string): Promise<CheckResult | null | undefined> | CheckResult | null | undefined;
  deleteCheckResult(id: string): Promise<boolean> | boolean;

  // Query Methods
  getRunsWithIssues(stationId?: string): Promise<CheckRunWithResults[]> | CheckRunWithResults[];
  getAllRunsWithResults(stationId?: string): Promise<CheckRunWithResults[]> | CheckRunWithResults[];
  
  // Reports
  getTruckCheckCompliance(startDate: Date, endDate: Date, stationId?: string): Promise<{ totalChecks: number; completedChecks: number; inProgressChecks: number; checksWithIssues: number; complianceRate: number; applianceStats: Array<{ applianceId: string; applianceName: string; checkCount: number; lastCheckDate: string | null }> }> | { totalChecks: number; completedChecks: number; inProgressChecks: number; checksWithIssues: number; complianceRate: number; applianceStats: Array<{ applianceId: string; applianceName: string; checkCount: number; lastCheckDate: string | null }> };
}

/**
 * Initialize and return the appropriate truck checks database service
 * Uses shared initialization logic from dbFactoryHelper
 */
async function initializeTruckChecksDatabaseService(): Promise<ITruckChecksDatabase> {
  return initializeDatabase({
    name: 'Truck Checks',
    inMemoryDb: inMemoryTruckChecksDb as ITruckChecksDatabase,
    tableStorageDb: tableStorageTruckChecksDb as ITruckChecksDatabase & { connect: () => Promise<void> },
  });
}

/**
 * Initialize test/demo truck checks database instance
 */
async function initializeTestTruckChecksDatabaseService(): Promise<ITruckChecksDatabase> {
  return initializeDatabase({
    name: 'Test Truck Checks',
    inMemoryDb: inMemoryTruckChecksDb as ITruckChecksDatabase,
    tableStorageDb: tableStorageTruckChecksTestDb as ITruckChecksDatabase & { connect: () => Promise<void> },
  });
}

// Export promises that resolve to the database instances
export const getTruckChecksDatabase = initializeTruckChecksDatabaseService();
export const getTestTruckChecksDatabase = initializeTestTruckChecksDatabaseService();

// Cache for both database instances
let truckChecksDbInstance: ITruckChecksDatabase | null = null;
let testTruckChecksDbInstance: ITruckChecksDatabase | null = null;

/**
 * Ensure truck checks database is initialized and return the instance
 * 
 * This is the primary function for accessing the truck checks database in route handlers.
 * It handles lazy initialization and caches the database instance.
 * 
 * @param useTestData - If true, returns the test database instance (for demo mode)
 * @returns Promise that resolves to the initialized truck checks database instance
 * @example
 * const db = await ensureTruckChecksDatabase();
 * const appliances = await db.getAllAppliances();
 * 
 * // Demo mode:
 * const db = await ensureTruckChecksDatabase(true);
 * const testAppliances = await db.getAllAppliances();
 */
export async function ensureTruckChecksDatabase(useTestData = false): Promise<ITruckChecksDatabase> {
  if (useTestData) {
    if (!testTruckChecksDbInstance) {
      testTruckChecksDbInstance = await getTestTruckChecksDatabase;
    }
    return testTruckChecksDbInstance;
  }
  
  if (!truckChecksDbInstance) {
    truckChecksDbInstance = await getTruckChecksDatabase;
  }
  return truckChecksDbInstance;
}

/**
 * Get truck checks database instance synchronously (after initialization)
 * 
 * Only use this if you're certain the database has been initialized.
 * Most code should use ensureTruckChecksDatabase() instead.
 * 
 * @param useTestData - If true, returns the test database instance
 * @throws Error if database is not initialized
 * @returns The truck checks database instance
 */
export function getTruckChecksDbSync(useTestData = false): ITruckChecksDatabase {
  const instance = useTestData ? testTruckChecksDbInstance : truckChecksDbInstance;
  if (!instance) {
    throw new Error('Truck Checks Database not initialized. Call ensureTruckChecksDatabase() first.');
  }
  return instance;
}

/**
 * Reset the truck checks database instance (for testing only)
 * 
 * This function should only be used in test code to reset state between tests.
 * Do not use in production code.
 * 
 * @internal
 */
export function __resetTruckChecksDatabase(): void {
  truckChecksDbInstance = null;
  testTruckChecksDbInstance = null;
}

