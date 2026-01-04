import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import {
  Appliance,
  ChecklistTemplate,
  ChecklistItem,
  CheckRun,
  CheckResult,
  CheckRunWithResults,
  CheckStatus
} from '../types';
import { ITruckChecksDatabase } from './truckChecksDbFactory';

// Build table names with optional prefix/suffix so dev/test can share prod storage without mixing tables
function buildTableName(baseName: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  
  // Auto-suffix based on environment if not explicitly set
  let defaultSuffix = '';
  if (process.env.NODE_ENV === 'test') {
    defaultSuffix = 'Test';
  } else if (process.env.NODE_ENV === 'development') {
    defaultSuffix = 'Dev';
  }
  
  const suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName; // Fallback to base if everything was stripped
}

/**
 * Azure Table Storage implementation for Truck Checks
 * 
 * Partition Strategy:
 * - Appliances: PartitionKey = 'Appliance'
 * - Templates: PartitionKey = 'Template'
 * - CheckRuns: PartitionKey = 'CheckRun_YYYY-MM' (partitioned by month)
 * - CheckResults: PartitionKey = runId (co-located with their check run)
 */
export class TableStorageTruckChecksDatabase implements ITruckChecksDatabase {
  private connectionString: string;
  private appliancesTable!: TableClient;
  private templatesTable!: TableClient;
  private checkRunsTable!: TableClient;
  private checkResultsTable!: TableClient;
  private isConnected: boolean = false;

  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    
    // Initialize table clients only if connection string is available
    if (this.connectionString) {
      this.appliancesTable = TableClient.fromConnectionString(this.connectionString, buildTableName('Appliances'));
      this.templatesTable = TableClient.fromConnectionString(this.connectionString, buildTableName('ChecklistTemplates'));
      this.checkRunsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('CheckRuns'));
      this.checkResultsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('CheckResults'));
    }
  }

  async connect(retries = 3, delayMs = 2000): Promise<void> {
    if (this.isConnected) return;

    if (!this.connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required for Table Storage. Cannot connect without credentials.');
    }

    let lastError: any;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔌 Connecting to Azure Table Storage for Truck Checks (attempt ${attempt}/${retries})...`);
        
        await Promise.all([
          this.appliancesTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              console.warn('Warning creating Appliances table:', err.message);
            }
          }),
          this.templatesTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              console.warn('Warning creating Templates table:', err.message);
            }
          }),
          this.checkRunsTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              console.warn('Warning creating CheckRuns table:', err.message);
            }
          }),
          this.checkResultsTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              console.warn('Warning creating CheckResults table:', err.message);
            }
          }),
        ]);

        await this.initializeDefaultAppliances();
        
        this.isConnected = true;
        console.log(`✅ Connected to Table Storage for Truck Checks (attempt ${attempt}/${retries})`);
        return; // Success, exit function
      } catch (error) {
        lastError = error;
        console.error(`❌ Failed to connect to Table Storage for Truck Checks (attempt ${attempt}/${retries}):`, error);
        
        if (attempt < retries) {
          console.log(`⏳ Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // All retries failed
    console.error('❌ All connection attempts failed for Truck Checks. Last error:', lastError);
    throw lastError || new Error(`Failed to connect to Table Storage for Truck Checks after ${retries} attempts`);
  }

  private async initializeDefaultAppliances(): Promise<void> {
    try {
      // Check if appliances exist
      const entities = this.appliancesTable.listEntities({
        queryOptions: { filter: odata`PartitionKey eq 'Appliance'` }
      });

      let count = 0;
      for await (const _ of entities) {
        count++;
        break;
      }

      if (count === 0) {
        const defaultAppliances = [
          { name: 'Cat 1', description: 'Category 1 Fire Truck' },
          { name: 'Cat 7', description: 'Category 7 Fire Truck' },
          { name: 'Cat 9', description: 'Category 9 Fire Truck' },
          { name: 'Bulk Water', description: 'Bulk Water Carrier' },
          { name: 'Command Vehicle', description: 'Command Vehicle' },
        ];

        for (const app of defaultAppliances) {
          await this.createAppliance(app.name, app.description);
        }

        console.log('✅ Initialized default appliances');
      }
    } catch (error) {
      console.error('Error initializing default appliances:', error);
    }
  }

  // ===== APPLIANCE METHODS =====

  async getAllAppliances(): Promise<Appliance[]> {
    const entities = this.appliancesTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'Appliance'` }
    });

    const appliances: Appliance[] = [];
    for await (const entity of entities) {
      appliances.push(this.entityToAppliance(entity));
    }

    appliances.sort((a, b) => a.name.localeCompare(b.name));
    return appliances;
  }

  async getApplianceById(id: string): Promise<Appliance | null> {
    try {
      const entity = await this.appliancesTable.getEntity<TableEntity>('Appliance', id);
      return this.entityToAppliance(entity);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async createAppliance(name: string, description?: string, photoUrl?: string): Promise<Appliance> {
    const appliance: Appliance = {
      id: uuidv4(),
      name,
      description,
      photoUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const entity: TableEntity = {
      partitionKey: 'Appliance',
      rowKey: appliance.id,
      name: appliance.name,
      description: appliance.description || '',
      photoUrl: appliance.photoUrl || '',
      createdAt: appliance.createdAt.toISOString(),
      updatedAt: appliance.updatedAt.toISOString(),
    };

    await this.appliancesTable.createEntity(entity);
    return appliance;
  }

  async updateAppliance(id: string, name: string, description?: string, photoUrl?: string): Promise<Appliance | null> {
    try {
      const entity = await this.appliancesTable.getEntity<TableEntity>('Appliance', id);
      
      entity.name = name;
      entity.description = description || '';
      entity.photoUrl = photoUrl || '';
      entity.updatedAt = new Date().toISOString();

      await this.appliancesTable.updateEntity(entity, 'Replace');
      
      return this.entityToAppliance(entity);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async deleteAppliance(id: string): Promise<boolean> {
    try {
      await this.appliancesTable.deleteEntity('Appliance', id);
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) return false;
      throw error;
    }
  }

  private entityToAppliance(entity: TableEntity): Appliance {
    return {
      id: entity.rowKey as string,
      name: entity.name as string,
      description: (entity.description as string) || undefined,
      photoUrl: (entity.photoUrl as string) || undefined,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== TEMPLATE METHODS =====

  async getTemplateByApplianceId(applianceId: string): Promise<ChecklistTemplate | null> {
    const entities = this.templatesTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'Template' and applianceId eq ${applianceId}` }
    });

    for await (const entity of entities) {
      return this.entityToTemplate(entity);
    }

    return null;
  }

  async getTemplateById(id: string): Promise<ChecklistTemplate | null> {
    try {
      const entity = await this.templatesTable.getEntity<TableEntity>('Template', id);
      return this.entityToTemplate(entity);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  async updateTemplate(applianceId: string, items: Omit<ChecklistItem, 'id'>[]): Promise<ChecklistTemplate> {
    const appliance = await this.getApplianceById(applianceId);
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    // Check if template exists
    let existingTemplate = await this.getTemplateByApplianceId(applianceId);
    
    const templateItems: ChecklistItem[] = items.map((item, index) => ({
      id: uuidv4(),
      name: item.name,
      description: item.description,
      referencePhotoUrl: item.referencePhotoUrl,
      order: index,
    }));

    const template: ChecklistTemplate = {
      id: existingTemplate?.id || uuidv4(),
      applianceId,
      applianceName: appliance.name,
      items: templateItems,
      createdAt: existingTemplate?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    const entity: TableEntity = {
      partitionKey: 'Template',
      rowKey: template.id,
      applianceId: template.applianceId,
      applianceName: template.applianceName,
      items: JSON.stringify(template.items), // Store as JSON string
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    if (existingTemplate) {
      await this.templatesTable.updateEntity(entity, 'Replace');
    } else {
      await this.templatesTable.createEntity(entity);
    }

    return template;
  }

  private entityToTemplate(entity: TableEntity): ChecklistTemplate {
    return {
      id: entity.rowKey as string,
      applianceId: entity.applianceId as string,
      applianceName: entity.applianceName as string,
      items: JSON.parse(entity.items as string),
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== CHECK RUN METHODS =====

  async createCheckRun(applianceId: string, completedBy: string, completedByName?: string): Promise<CheckRun> {
    const appliance = await this.getApplianceById(applianceId);
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    const checkRun: CheckRun = {
      id: uuidv4(),
      applianceId,
      applianceName: appliance.name,
      startTime: new Date(),
      completedBy,
      completedByName,
      contributors: completedByName ? [completedByName] : [],
      status: 'in-progress',
      hasIssues: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Partition by month
    const monthKey = checkRun.startTime.toISOString().slice(0, 7); // YYYY-MM

    const entity: TableEntity = {
      partitionKey: `CheckRun_${monthKey}`,
      rowKey: checkRun.id,
      applianceId: checkRun.applianceId,
      applianceName: checkRun.applianceName,
      startTime: checkRun.startTime.toISOString(),
      endTime: checkRun.endTime?.toISOString() || '',
      completedBy: checkRun.completedBy,
      completedByName: checkRun.completedByName || '',
      contributors: JSON.stringify(checkRun.contributors),
      additionalComments: checkRun.additionalComments || '',
      status: checkRun.status,
      hasIssues: checkRun.hasIssues,
      createdAt: checkRun.createdAt.toISOString(),
      updatedAt: checkRun.updatedAt.toISOString(),
    };

    await this.checkRunsTable.createEntity(entity);
    return checkRun;
  }

  async getCheckRunById(id: string): Promise<CheckRun | null> {
    // Search across recent months
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7);
      
      try {
        const entity = await this.checkRunsTable.getEntity<TableEntity>(`CheckRun_${monthKey}`, id);
        return this.entityToCheckRun(entity);
      } catch (error: any) {
        if (error.statusCode !== 404) throw error;
      }
    }
    
    return null;
  }

  async getAllCheckRuns(): Promise<CheckRun[]> {
    // Query recent months
    const now = new Date();
    const allRuns: CheckRun[] = [];
    
    for (let i = 0; i < 3; i++) { // Last 3 months
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7);
      
      const entities = this.checkRunsTable.listEntities<TableEntity>({
        queryOptions: { filter: odata`PartitionKey eq ${'CheckRun_' + monthKey}` }
      });

      for await (const entity of entities) {
        allRuns.push(this.entityToCheckRun(entity));
      }
    }

    // Sort by startTime descending
    allRuns.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    return allRuns;
  }

  async getCheckRunsByAppliance(applianceId: string): Promise<CheckRun[]> {
    const allRuns = await this.getAllCheckRuns();
    return allRuns.filter(run => run.applianceId === applianceId);
  }

  async getCheckRunsByDateRange(startDate: Date, endDate: Date): Promise<CheckRun[]> {
    const allRuns = await this.getAllCheckRuns();
    return allRuns.filter(run => 
      run.startTime >= startDate && run.startTime <= endDate
    );
  }

  async completeCheckRun(id: string, additionalComments?: string): Promise<CheckRun | null> {
    const checkRun = await this.getCheckRunById(id);
    if (!checkRun) return null;

    const monthKey = checkRun.startTime.toISOString().slice(0, 7);
    
    try {
      const entity = await this.checkRunsTable.getEntity<TableEntity>(`CheckRun_${monthKey}`, id);
      entity.endTime = new Date().toISOString();
      entity.status = 'completed';
      entity.additionalComments = additionalComments || '';
      entity.updatedAt = new Date().toISOString();

      await this.checkRunsTable.updateEntity(entity, 'Replace');
      
      return this.entityToCheckRun(entity);
    } catch (error) {
      return null;
    }
  }

  async getActiveCheckRunForAppliance(applianceId: string): Promise<CheckRun | null> {
    const runs = await this.getCheckRunsByAppliance(applianceId);
    return runs.find(run => run.status === 'in-progress') || null;
  }

  async addContributorToCheckRun(runId: string, contributorName: string): Promise<CheckRun | null> {
    const checkRun = await this.getCheckRunById(runId);
    if (!checkRun) return null;

    const monthKey = checkRun.startTime.toISOString().slice(0, 7);
    
    try {
      const entity = await this.checkRunsTable.getEntity<TableEntity>(`CheckRun_${monthKey}`, runId);
      
      const contributors = JSON.parse(entity.contributors as string) as string[];
      if (!contributors.includes(contributorName)) {
        contributors.push(contributorName);
        entity.contributors = JSON.stringify(contributors);
        entity.updatedAt = new Date().toISOString();

        await this.checkRunsTable.updateEntity(entity, 'Replace');
      }
      
      return this.entityToCheckRun(entity);
    } catch (error) {
      return null;
    }
  }

  private entityToCheckRun(entity: TableEntity): CheckRun {
    return {
      id: entity.rowKey as string,
      applianceId: entity.applianceId as string,
      applianceName: entity.applianceName as string,
      startTime: new Date(entity.startTime as string),
      endTime: entity.endTime ? new Date(entity.endTime as string) : undefined,
      completedBy: entity.completedBy as string,
      completedByName: (entity.completedByName as string) || undefined,
      contributors: JSON.parse(entity.contributors as string),
      additionalComments: (entity.additionalComments as string) || undefined,
      status: entity.status as 'in-progress' | 'completed',
      hasIssues: entity.hasIssues as boolean,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== CHECK RESULT METHODS =====

  async createCheckResult(
    runId: string,
    itemId: string,
    itemName: string,
    itemDescription: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string,
    completedBy?: string
  ): Promise<CheckResult> {
    const checkResult: CheckResult = {
      id: uuidv4(),
      runId,
      itemId,
      itemName,
      itemDescription,
      status,
      comment,
      photoUrl,
      completedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Co-locate results with their check run
    const entity: TableEntity = {
      partitionKey: runId,
      rowKey: checkResult.id,
      itemId: checkResult.itemId,
      itemName: checkResult.itemName,
      itemDescription: checkResult.itemDescription,
      status: checkResult.status,
      comment: checkResult.comment || '',
      photoUrl: checkResult.photoUrl || '',
      completedBy: checkResult.completedBy || '',
      createdAt: checkResult.createdAt.toISOString(),
      updatedAt: checkResult.updatedAt.toISOString(),
    };

    await this.checkResultsTable.createEntity(entity);

    // Update hasIssues flag on check run if this result has an issue
    if (status === 'issue') {
      const checkRun = await this.getCheckRunById(runId);
      if (checkRun && !checkRun.hasIssues) {
        const monthKey = checkRun.startTime.toISOString().slice(0, 7);
        const runEntity = await this.checkRunsTable.getEntity<TableEntity>(`CheckRun_${monthKey}`, runId);
        runEntity.hasIssues = true;
        runEntity.updatedAt = new Date().toISOString();
        await this.checkRunsTable.updateEntity(runEntity, 'Replace');
      }
    }

    return checkResult;
  }

  async getResultsByRunId(runId: string): Promise<CheckResult[]> {
    const entities = this.checkResultsTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${runId}` }
    });

    const results: CheckResult[] = [];
    for await (const entity of entities) {
      results.push(this.entityToCheckResult(entity, runId));
    }

    return results;
  }

  async getCheckRunWithResults(runId: string): Promise<CheckRunWithResults | null> {
    const checkRun = await this.getCheckRunById(runId);
    if (!checkRun) return null;

    const results = await this.getResultsByRunId(runId);

    return {
      ...checkRun,
      results,
    };
  }

  async updateCheckResult(
    id: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string
  ): Promise<CheckResult | null> {
    // Need to find which run this result belongs to
    // This is inefficient without the runId
    console.warn('updateCheckResult: Inefficient without runId in Table Storage');
    return null;
  }

  async deleteCheckResult(id: string): Promise<boolean> {
    // Need to find which run this result belongs to
    // This is inefficient without the runId
    console.warn('deleteCheckResult: Inefficient without runId in Table Storage');
    return false;
  }

  private entityToCheckResult(entity: TableEntity, runId: string): CheckResult {
    return {
      id: entity.rowKey as string,
      runId,
      itemId: entity.itemId as string,
      itemName: entity.itemName as string,
      itemDescription: entity.itemDescription as string,
      status: entity.status as CheckStatus,
      comment: (entity.comment as string) || undefined,
      photoUrl: (entity.photoUrl as string) || undefined,
      completedBy: (entity.completedBy as string) || undefined,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== QUERY METHODS =====

  async getRunsWithIssues(): Promise<CheckRunWithResults[]> {
    const allRuns = await this.getAllCheckRuns();
    const runsWithIssues = allRuns.filter(run => run.hasIssues);
    
    const runsWithResults = await Promise.all(
      runsWithIssues.map(async (run) => {
        const results = await this.getResultsByRunId(run.id);
        return {
          ...run,
          results,
        };
      })
    );

    return runsWithResults;
  }

  async getAllRunsWithResults(): Promise<CheckRunWithResults[]> {
    const allRuns = await this.getAllCheckRuns();
    
    const runsWithResults = await Promise.all(
      allRuns.map(async (run) => {
        const results = await this.getResultsByRunId(run.id);
        return {
          ...run,
          results,
        };
      })
    );

    return runsWithResults;
  }
}

// Export singleton instance
export const tableStorageTruckChecksDb = new TableStorageTruckChecksDatabase();
