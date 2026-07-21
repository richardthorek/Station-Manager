import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';
import {
  Appliance,
  ChecklistTemplate,
  ChecklistItem,
  CheckRun,
  CheckResult,
  CheckRunWithResults,
  CheckStatus,
  IssueUpdate
} from '../types';
import { ITruckChecksDatabase, ApplianceDetails } from './truckChecksDbFactory';
import { getEffectiveStationId } from '../constants/stations';

/** True when two (possibly undefined/blank) station ids resolve to the same station. */
function sameStation(a: string | undefined, b: string | undefined): boolean {
  return getEffectiveStationId(a || undefined) === getEffectiveStationId(b || undefined);
}

// Build table names with optional prefix/suffix so dev/test can share prod storage without mixing tables
function buildTableName(baseName: string, overrideSuffix?: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  
  // Use override suffix if provided, otherwise use environment-based logic
  let suffix = '';
  if (overrideSuffix !== undefined) {
    suffix = sanitize(overrideSuffix);
  } else {
    // Auto-suffix based on environment if not explicitly set
    let defaultSuffix = '';
    if (process.env.NODE_ENV === 'test') {
      defaultSuffix = 'Test';
    } else if (process.env.NODE_ENV === 'development') {
      defaultSuffix = 'Dev';
    }
    suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  }
  
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
  private tableSuffix: string;

  constructor(connectionString?: string, tableSuffix?: string) {
    this.connectionString = connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    this.tableSuffix = tableSuffix !== undefined ? tableSuffix : '';
    
    // Initialize table clients only if connection string is available
    if (this.connectionString) {
      this.appliancesTable = TableClient.fromConnectionString(this.connectionString, buildTableName('Appliances', this.tableSuffix));
      this.templatesTable = TableClient.fromConnectionString(this.connectionString, buildTableName('ChecklistTemplates', this.tableSuffix));
      this.checkRunsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('CheckRuns', this.tableSuffix));
      this.checkResultsTable = TableClient.fromConnectionString(this.connectionString, buildTableName('CheckResults', this.tableSuffix));
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
        logger.info(`🔌 Connecting to Azure Table Storage for Truck Checks (attempt ${attempt}/${retries})...`);
        
        await Promise.all([
          this.appliancesTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              logger.warn('Warning creating Appliances table:', err.message);
            }
          }),
          this.templatesTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              logger.warn('Warning creating Templates table:', err.message);
            }
          }),
          this.checkRunsTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              logger.warn('Warning creating CheckRuns table:', err.message);
            }
          }),
          this.checkResultsTable.createTable().catch((err) => {
            if (err instanceof Error && !err.message.includes('TableAlreadyExists')) {
              logger.warn('Warning creating CheckResults table:', err.message);
            }
          }),
        ]);

        await this.initializeDefaultAppliances();
        
        this.isConnected = true;
        logger.info(`✅ Connected to Table Storage for Truck Checks (attempt ${attempt}/${retries})`);
        return; // Success, exit function
      } catch (error) {
        lastError = error;
        logger.error(`❌ Failed to connect to Table Storage for Truck Checks (attempt ${attempt}/${retries}):`, error);
        
        if (attempt < retries) {
          logger.info(`⏳ Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // All retries failed
    logger.error('❌ All connection attempts failed for Truck Checks. Last error:', lastError);
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

        logger.info('✅ Initialized default appliances');
      }
    } catch (error) {
      logger.error('Error initializing default appliances:', error);
    }
  }

  // ===== APPLIANCE METHODS =====

  async getAllAppliances(stationId?: string): Promise<Appliance[]> {
    const entities = this.appliancesTable.listEntities<TableEntity>({
      queryOptions: { filter: odata`PartitionKey eq 'Appliance'` }
    });

    const appliances: Appliance[] = [];
    for await (const entity of entities) {
      const appliance = this.entityToAppliance(entity);
      if (stationId === undefined || sameStation(appliance.stationId, stationId)) {
        appliances.push(appliance);
      }
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

  async createAppliance(name: string, description?: string, photoUrl?: string, stationId?: string, vehicleType?: string, details?: ApplianceDetails): Promise<Appliance> {
    const appliance: Appliance = {
      id: uuidv4(),
      name,
      description,
      photoUrl,
      stationId,
      vehicleType,
      vehicleTypeId: details?.vehicleTypeId,
      agencyId: details?.agencyId,
      registration: details?.registration,
      vin: details?.vin,
      make: details?.make,
      model: details?.model,
      year: details?.year,
      variant: details?.variant,
      inServiceDate: details?.inServiceDate,
      quirksNotes: details?.quirksNotes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const entity: TableEntity = {
      partitionKey: 'Appliance',
      rowKey: appliance.id,
      name: appliance.name,
      description: appliance.description || '',
      photoUrl: appliance.photoUrl || '',
      stationId: appliance.stationId || '',
      vehicleType: appliance.vehicleType || '',
      vehicleTypeId: appliance.vehicleTypeId || '',
      agencyId: appliance.agencyId || '',
      registration: appliance.registration || '',
      vin: appliance.vin || '',
      make: appliance.make || '',
      model: appliance.model || '',
      year: appliance.year ?? 0,
      variant: appliance.variant || '',
      inServiceDate: appliance.inServiceDate || '',
      quirksNotes: appliance.quirksNotes || '',
      createdAt: appliance.createdAt.toISOString(),
      updatedAt: appliance.updatedAt.toISOString(),
    };

    await this.appliancesTable.createEntity(entity);
    return appliance;
  }

  async updateAppliance(id: string, name: string, description?: string, photoUrl?: string, vehicleType?: string, details?: ApplianceDetails): Promise<Appliance | null> {
    try {
      const entity = await this.appliancesTable.getEntity<TableEntity>('Appliance', id);

      entity.name = name;
      entity.description = description || '';
      entity.photoUrl = photoUrl || '';
      entity.vehicleType = vehicleType || '';
      if (details) {
        entity.vehicleTypeId = details.vehicleTypeId || '';
        entity.agencyId = details.agencyId || '';
        entity.registration = details.registration || '';
        entity.vin = details.vin || '';
        entity.make = details.make || '';
        entity.model = details.model || '';
        entity.year = details.year ?? 0;
        entity.variant = details.variant || '';
        entity.inServiceDate = details.inServiceDate || '';
        entity.quirksNotes = details.quirksNotes || '';
      }
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
      stationId: (entity.stationId as string) || undefined,
      vehicleType: (entity.vehicleType as string) || undefined,
      vehicleTypeId: (entity.vehicleTypeId as string) || undefined,
      agencyId: (entity.agencyId as string) || undefined,
      registration: (entity.registration as string) || undefined,
      vin: (entity.vin as string) || undefined,
      make: (entity.make as string) || undefined,
      model: (entity.model as string) || undefined,
      year: (entity.year as number) || undefined,
      variant: (entity.variant as string) || undefined,
      inServiceDate: (entity.inServiceDate as string) || undefined,
      quirksNotes: (entity.quirksNotes as string) || undefined,
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

  async updateTemplate(applianceId: string, items: Omit<ChecklistItem, 'id'>[], stationId?: string, itemOrder?: string[]): Promise<ChecklistTemplate> {
    const appliance = await this.getApplianceById(applianceId);
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    // Check if template exists
    const existingTemplate = await this.getTemplateByApplianceId(applianceId);
    const previous = existingTemplate?.items ?? [];

    // Preserve item ids across edits (match by supplied id, else by name) so
    // itemCode/history references stay stable instead of churning a new uuid each save.
    const reuseId = (item: Omit<ChecklistItem, 'id'> & { id?: string }): string => {
      if (item.id) return item.id; // client-owned id (overlay items, existing items) — keep it stable
      const byName = previous.find((p) => p.name === item.name);
      return byName ? byName.id : uuidv4();
    };

    const templateItems: ChecklistItem[] = items.map((item, index) => ({
      id: reuseId(item as Omit<ChecklistItem, 'id'> & { id?: string }),
      name: item.name,
      description: item.description,
      referencePhotoUrl: item.referencePhotoUrl,
      order: index,
      itemCode: item.itemCode,
      section: item.section,
    }));

    const template: ChecklistTemplate = {
      id: existingTemplate?.id || uuidv4(),
      applianceId,
      applianceName: appliance.name,
      stationId: stationId ?? existingTemplate?.stationId ?? appliance.stationId,
      items: templateItems,
      itemOrder: itemOrder ?? existingTemplate?.itemOrder,
      createdAt: existingTemplate?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    const entity: TableEntity = {
      partitionKey: 'Template',
      rowKey: template.id,
      applianceId: template.applianceId,
      applianceName: template.applianceName,
      stationId: template.stationId || '',
      items: JSON.stringify(template.items), // Store as JSON string
      itemOrder: JSON.stringify(template.itemOrder ?? []),
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
      stationId: (entity.stationId as string) || undefined,
      items: JSON.parse(entity.items as string),
      itemOrder: entity.itemOrder ? JSON.parse(entity.itemOrder as string) : undefined,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== CHECK RUN METHODS =====

  async createCheckRun(applianceId: string, completedBy: string, completedByName?: string, stationId?: string, runDetails?: { source?: CheckRun['source']; agentSessionId?: string }, startTimeOverride?: Date): Promise<CheckRun> {
    const appliance = await this.getApplianceById(applianceId);
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    const startTime = startTimeOverride ?? new Date();
    const checkRun: CheckRun = {
      id: uuidv4(),
      applianceId,
      applianceName: appliance.name,
      stationId: stationId ?? appliance.stationId,
      startTime,
      completedBy,
      completedByName,
      contributors: completedByName ? [completedByName] : [],
      status: 'in-progress',
      hasIssues: false,
      source: runDetails?.source,
      agentSessionId: runDetails?.agentSessionId,
      createdAt: startTime,
      updatedAt: startTime,
    };

    // Partition by month
    const monthKey = checkRun.startTime.toISOString().slice(0, 7); // YYYY-MM

    const entity: TableEntity = {
      partitionKey: `CheckRun_${monthKey}`,
      rowKey: checkRun.id,
      applianceId: checkRun.applianceId,
      applianceName: checkRun.applianceName,
      stationId: checkRun.stationId || '',
      startTime: checkRun.startTime.toISOString(),
      endTime: checkRun.endTime?.toISOString() || '',
      completedBy: checkRun.completedBy,
      completedByName: checkRun.completedByName || '',
      contributors: JSON.stringify(checkRun.contributors),
      additionalComments: checkRun.additionalComments || '',
      status: checkRun.status,
      hasIssues: checkRun.hasIssues,
      source: checkRun.source || '',
      agentSessionId: checkRun.agentSessionId || '',
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

  async getAllCheckRuns(stationId?: string): Promise<CheckRun[]> {
    // Query recent months. Each month is a separate partition query against
    // Table Storage — run them concurrently rather than one-after-another, or
    // the roster page pays a full network round-trip per month in series
    // (the dominant cost behind "the vehicle screen takes ages to load").
    const now = new Date();
    const monthRuns = await Promise.all(
      Array.from({ length: 3 }, (_, i) => {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        return date.toISOString().slice(0, 7);
      }).map(async (monthKey) => {
        const entities = this.checkRunsTable.listEntities<TableEntity>({
          queryOptions: { filter: odata`PartitionKey eq ${'CheckRun_' + monthKey}` }
        });

        const runs: CheckRun[] = [];
        for await (const entity of entities) {
          const run = this.entityToCheckRun(entity);
          if (stationId === undefined || sameStation(run.stationId, stationId)) {
            runs.push(run);
          }
        }
        return runs;
      }),
    );

    const allRuns = monthRuns.flat();
    // Sort by startTime descending
    allRuns.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    return allRuns;
  }

  async getCheckRunsByAppliance(applianceId: string): Promise<CheckRun[]> {
    const allRuns = await this.getAllCheckRuns();
    return allRuns.filter(run => run.applianceId === applianceId);
  }

  async getCheckRunsByDateRange(startDate: Date, endDate: Date, stationId?: string): Promise<CheckRun[]> {
    const allRuns = await this.getAllCheckRuns(stationId);
    return allRuns.filter(run =>
      run.startTime >= startDate && run.startTime <= endDate
    );
  }

  async completeCheckRun(id: string, additionalComments?: string, endTimeOverride?: Date): Promise<CheckRun | null> {
    const checkRun = await this.getCheckRunById(id);
    if (!checkRun) return null;

    const monthKey = checkRun.startTime.toISOString().slice(0, 7);
    const endTime = endTimeOverride ?? new Date();

    try {
      const entity = await this.checkRunsTable.getEntity<TableEntity>(`CheckRun_${monthKey}`, id);
      entity.endTime = endTime.toISOString();
      entity.status = 'completed';
      entity.additionalComments = additionalComments || '';
      entity.updatedAt = endTime.toISOString();

      await this.checkRunsTable.updateEntity(entity, 'Replace');
      
      return this.entityToCheckRun(entity);
    } catch (error) {
      return null;
    }
  }

  async deleteCheckRun(id: string): Promise<boolean> {
    const checkRun = await this.getCheckRunById(id);
    if (!checkRun) return false;

    // Cascade-delete the run's results (partitioned by runId) first, then the run.
    const results = await this.getResultsByRunId(id);
    await Promise.all(
      results.map((r) =>
        this.checkResultsTable.deleteEntity(id, r.id).catch((error: any) => {
          if (error?.statusCode !== 404) throw error;
        }),
      ),
    );

    const monthKey = checkRun.startTime.toISOString().slice(0, 7);
    try {
      await this.checkRunsTable.deleteEntity(`CheckRun_${monthKey}`, id);
    } catch (error: any) {
      if (error?.statusCode !== 404) throw error;
    }
    return true;
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
      stationId: (entity.stationId as string) || undefined,
      startTime: new Date(entity.startTime as string),
      endTime: entity.endTime ? new Date(entity.endTime as string) : undefined,
      completedBy: entity.completedBy as string,
      completedByName: (entity.completedByName as string) || undefined,
      contributors: JSON.parse(entity.contributors as string),
      additionalComments: (entity.additionalComments as string) || undefined,
      status: entity.status as 'in-progress' | 'completed',
      hasIssues: entity.hasIssues as boolean,
      source: (entity.source as CheckRun['source']) || undefined,
      agentSessionId: (entity.agentSessionId as string) || undefined,
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
    completedBy?: string,
    stationId?: string,
    itemCode?: string,
    section?: string
  ): Promise<CheckResult> {
    const checkResult: CheckResult = {
      id: uuidv4(),
      runId,
      itemId,
      itemName,
      itemDescription,
      stationId,
      itemCode,
      section,
      status,
      comment,
      photoUrl,
      completedBy,
      issueStatus: status === 'issue' ? 'open' : undefined,
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
      stationId: checkResult.stationId || '',
      itemCode: checkResult.itemCode || '',
      section: checkResult.section || '',
      status: checkResult.status,
      comment: checkResult.comment || '',
      photoUrl: checkResult.photoUrl || '',
      completedBy: checkResult.completedBy || '',
      issueStatus: checkResult.issueStatus || '',
      issueNote: '',
      assignedTo: '',
      acknowledgedBy: '',
      acknowledgedAt: '',
      resolvedBy: '',
      resolvedAt: '',
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
    logger.warn('updateCheckResult: Inefficient without runId in Table Storage');
    return null;
  }

  async deleteCheckResult(id: string): Promise<boolean> {
    // Need to find which run this result belongs to
    // This is inefficient without the runId
    logger.warn('deleteCheckResult: Inefficient without runId in Table Storage');
    return false;
  }

  async updateIssueStatus(id: string, update: IssueUpdate, runId?: string): Promise<CheckResult | null> {
    if (!runId) {
      logger.warn('updateIssueStatus: runId is required in Table Storage');
      return null;
    }
    try {
      const entity = await this.checkResultsTable.getEntity<TableEntity>(runId, id);
      if (update.issueStatus !== undefined) entity.issueStatus = update.issueStatus;
      if (update.issueNote !== undefined) entity.issueNote = update.issueNote;
      if (update.assignedTo !== undefined) entity.assignedTo = update.assignedTo;
      if (update.issueStatus === 'acknowledged') {
        entity.acknowledgedBy = update.acknowledgedBy || '';
        entity.acknowledgedAt = new Date().toISOString();
      }
      if (update.issueStatus === 'resolved') {
        entity.resolvedBy = update.resolvedBy || '';
        entity.resolvedAt = new Date().toISOString();
      }
      entity.updatedAt = new Date().toISOString();
      await this.checkResultsTable.updateEntity(entity, 'Replace');
      return this.entityToCheckResult(entity, runId);
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  private entityToCheckResult(entity: TableEntity, runId: string): CheckResult {
    return {
      id: entity.rowKey as string,
      runId,
      itemId: entity.itemId as string,
      itemName: entity.itemName as string,
      itemDescription: entity.itemDescription as string,
      stationId: (entity.stationId as string) || undefined,
      itemCode: (entity.itemCode as string) || undefined,
      section: (entity.section as string) || undefined,
      status: entity.status as CheckStatus,
      comment: (entity.comment as string) || undefined,
      photoUrl: (entity.photoUrl as string) || undefined,
      completedBy: (entity.completedBy as string) || undefined,
      issueStatus: (entity.issueStatus as CheckResult['issueStatus']) || undefined,
      issueNote: (entity.issueNote as string) || undefined,
      assignedTo: (entity.assignedTo as string) || undefined,
      acknowledgedBy: (entity.acknowledgedBy as string) || undefined,
      acknowledgedAt: entity.acknowledgedAt ? new Date(entity.acknowledgedAt as string) : undefined,
      resolvedBy: (entity.resolvedBy as string) || undefined,
      resolvedAt: entity.resolvedAt ? new Date(entity.resolvedAt as string) : undefined,
      createdAt: new Date(entity.createdAt as string),
      updatedAt: new Date(entity.updatedAt as string),
    };
  }

  // ===== QUERY METHODS =====

  async getRunsWithIssues(stationId?: string): Promise<CheckRunWithResults[]> {
    const allRuns = await this.getAllCheckRuns(stationId);
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

  async getAllRunsWithResults(stationId?: string): Promise<CheckRunWithResults[]> {
    const allRuns = await this.getAllCheckRuns(stationId);

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

  /**
   * Get truck check compliance statistics
   */
  async getTruckCheckCompliance(startDate: Date, endDate: Date, stationId?: string): Promise<{
    totalChecks: number;
    completedChecks: number;
    inProgressChecks: number;
    checksWithIssues: number;
    complianceRate: number;
    applianceStats: Array<{
      applianceId: string;
      applianceName: string;
      checkCount: number;
      lastCheckDate: string | null;
    }>;
  }> {
    const runs = await this.getCheckRunsByDateRange(startDate, endDate, stationId);

    const completedChecks = runs.filter(r => r.status === 'completed').length;
    const inProgressChecks = runs.filter(r => r.status === 'in-progress').length;
    const checksWithIssues = runs.filter(r => r.hasIssues).length;

    // Calculate compliance rate (completed without issues)
    const completedWithoutIssues = runs.filter(r => r.status === 'completed' && !r.hasIssues).length;
    const complianceRate = runs.length > 0
      ? Math.round((completedWithoutIssues / runs.length) * 100)
      : 100;

    // Group by appliance
    const applianceMap = new Map<string, { name: string; count: number; lastCheck: Date | null }>();
    runs.forEach(run => {
      const runStartTime = new Date(run.startTime);
      const existing = applianceMap.get(run.applianceId);
      if (!existing) {
        applianceMap.set(run.applianceId, {
          name: run.applianceName,
          count: 1,
          lastCheck: runStartTime,
        });
      } else {
        existing.count += 1;
        if (!existing.lastCheck || runStartTime > existing.lastCheck) {
          existing.lastCheck = runStartTime;
        }
      }
    });

    const applianceStats = Array.from(applianceMap.entries())
      .map(([applianceId, stats]) => ({
        applianceId,
        applianceName: stats.name,
        checkCount: stats.count,
        lastCheckDate: stats.lastCheck ? stats.lastCheck.toISOString() : null,
      }))
      .sort((a, b) => b.checkCount - a.checkCount);

    return {
      totalChecks: runs.length,
      completedChecks,
      inProgressChecks,
      checksWithIssues,
      complianceRate,
      applianceStats,
    };
  }
}

// Export singleton instances - one for production, one for demo/test
export const tableStorageTruckChecksDb = new TableStorageTruckChecksDatabase(); // Production instance (uses env suffix)
export const tableStorageTruckChecksTestDb = new TableStorageTruckChecksDatabase(undefined, 'Test'); // Demo/test instance
