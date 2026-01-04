/**
 * Truck Checks Database Factory
 * Determines which database service to use based on environment
 * Priority: Table Storage > In-Memory
 */

import { truckChecksDb as inMemoryTruckChecksDb } from './truckChecksDatabase';
import { tableStorageTruckChecksDb } from './tableStorageTruckChecksDatabase';
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
  createCheckResult(
    runId: string,
    itemId: string,
    itemName: string,
    itemDescription: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string,
    completedBy?: string
  ): Promise<CheckResult> | CheckResult;
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
 * Uses shared initialization logic from dbFactoryHelper
 */
async function initializeTruckChecksDatabaseService(): Promise<ITruckChecksDatabase> {
  return initializeDatabase({
    name: 'Truck Checks',
    inMemoryDb: inMemoryTruckChecksDb as ITruckChecksDatabase,
    tableStorageDb: tableStorageTruckChecksDb as ITruckChecksDatabase & { connect: () => Promise<void> },
  });
}

// Export a promise that resolves to the database instance
export const getTruckChecksDatabase = initializeTruckChecksDatabaseService();

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

// Helper function for testing: reset the database instance
export function __resetTruckChecksDatabase(): void {
  truckChecksDbInstance = null;
}

