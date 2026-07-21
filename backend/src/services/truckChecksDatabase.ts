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
import type { ApplianceDetails } from './truckChecksDbFactory';
import { getEffectiveStationId } from '../constants/stations';
import { v4 as uuidv4 } from 'uuid';

/** True when two (possibly undefined) station ids resolve to the same station. */
function sameStation(a: string | undefined, b: string | undefined): boolean {
  return getEffectiveStationId(a) === getEffectiveStationId(b);
}

class TruckChecksDatabase {
  private appliances: Map<string, Appliance> = new Map();
  private templates: Map<string, ChecklistTemplate> = new Map();
  private checkRuns: Map<string, CheckRun> = new Map();
  private checkResults: Map<string, CheckResult> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create 5 default appliances
    const defaultAppliances = [
      { name: 'Cat 1', description: 'Category 1 Fire Truck' },
      { name: 'Cat 7', description: 'Category 7 Fire Truck' },
      { name: 'Cat 9', description: 'Category 9 Fire Truck' },
      { name: 'Bulk Water', description: 'Bulk Water Carrier' },
      { name: 'Command Vehicle', description: 'Command Vehicle' },
    ];

    defaultAppliances.forEach(({ name, description }) => {
      const appliance: Appliance = {
        id: uuidv4(),
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.appliances.set(appliance.id, appliance);

      // Create a default template for each appliance
      const template = this.createDefaultTemplate(appliance);
      this.templates.set(template.id, template);
    });
  }

  private createDefaultTemplate(appliance: Appliance): ChecklistTemplate {
    const defaultItems: Omit<ChecklistItem, 'id'>[] = [
      {
        name: 'Tyre Condition',
        description: 'Check all tyres for wear, damage, and correct pressure',
        order: 1,
      },
      {
        name: 'Lights & Indicators',
        description: 'Test all lights, indicators, and emergency lighting systems',
        order: 2,
      },
      {
        name: 'Fluid Levels',
        description: 'Check engine oil, coolant, brake fluid, and windscreen washer',
        order: 3,
      },
      {
        name: 'Hoses & Connections',
        description: 'Inspect all hoses and connections for leaks or damage',
        order: 4,
      },
      {
        name: 'Pump Operation',
        description: 'Test pump operation and pressure gauge',
        order: 5,
      },
      {
        name: 'Radio Equipment',
        description: 'Test all radio and communication equipment',
        order: 6,
      },
      {
        name: 'Safety Equipment',
        description: 'Check first aid kit, fire extinguisher, and safety equipment',
        order: 7,
      },
      {
        name: 'Tools & Equipment',
        description: 'Verify all tools and equipment are present and functional',
        order: 8,
      },
    ];

    const items: ChecklistItem[] = defaultItems.map(item => ({
      ...item,
      id: uuidv4(),
    }));

    return {
      id: uuidv4(),
      applianceId: appliance.id,
      applianceName: appliance.name,
      items,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ============================================
  // Appliance Methods
  // ============================================

  getAllAppliances(stationId?: string): Appliance[] {
    return Array.from(this.appliances.values())
      .filter((a) => stationId === undefined || sameStation(a.stationId, stationId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getApplianceById(id: string): Appliance | undefined {
    return this.appliances.get(id);
  }

  createAppliance(name: string, description?: string, photoUrl?: string, stationId?: string, vehicleType?: string, details?: ApplianceDetails): Appliance {
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
    this.appliances.set(appliance.id, appliance);

    // Legacy convenience: only auto-seed a generic template when the appliance is
    // NOT linked to a vehicle type. Type-linked appliances get their checklist
    // from the type's standard items + a (initially empty) custom overlay.
    if (!appliance.vehicleTypeId) {
      const template = this.createDefaultTemplate(appliance);
      this.templates.set(template.id, template);
    }

    return appliance;
  }

  updateAppliance(id: string, name: string, description?: string, photoUrl?: string, vehicleType?: string, details?: ApplianceDetails): Appliance | undefined {
    const appliance = this.appliances.get(id);
    if (appliance) {
      appliance.name = name;
      appliance.description = description;
      appliance.photoUrl = photoUrl;
      appliance.vehicleType = vehicleType;
      if (details) {
        appliance.vehicleTypeId = details.vehicleTypeId;
        appliance.agencyId = details.agencyId;
        appliance.registration = details.registration;
        appliance.vin = details.vin;
        appliance.make = details.make;
        appliance.model = details.model;
        appliance.year = details.year;
        appliance.variant = details.variant;
        appliance.inServiceDate = details.inServiceDate;
        appliance.quirksNotes = details.quirksNotes;
      }
      appliance.updatedAt = new Date();
      return appliance;
    }
    return undefined;
  }

  deleteAppliance(id: string): boolean {
    return this.appliances.delete(id);
  }

  // ============================================
  // Template Methods
  // ============================================

  getTemplateByApplianceId(applianceId: string): ChecklistTemplate | undefined {
    return Array.from(this.templates.values()).find(
      t => t.applianceId === applianceId
    );
  }

  getTemplateById(id: string): ChecklistTemplate | undefined {
    return this.templates.get(id);
  }

  updateTemplate(
    applianceId: string,
    items: Omit<ChecklistItem, 'id'>[],
    stationId?: string,
    itemOrder?: string[]
  ): ChecklistTemplate {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    // Preserve item ids across edits so itemCode/history references stay stable:
    // match incoming items to existing ones by id when supplied, else by name.
    const existing = this.getTemplateByApplianceId(applianceId);
    const previous = existing?.items ?? [];
    const reuseId = (item: Omit<ChecklistItem, 'id'> & { id?: string }): string => {
      if (item.id) return item.id; // client-owned id (overlay items, existing items) — keep it stable
      const byName = previous.find((p) => p.name === item.name);
      return byName ? byName.id : uuidv4();
    };
    const mappedItems: ChecklistItem[] = items.map((item) => ({ ...item, id: reuseId(item) }));

    if (existing) {
      existing.items = mappedItems;
      existing.stationId = stationId ?? existing.stationId;
      if (itemOrder !== undefined) existing.itemOrder = itemOrder;
      existing.updatedAt = new Date();
      return existing;
    }

    const template: ChecklistTemplate = {
      id: uuidv4(),
      applianceId,
      applianceName: appliance.name,
      stationId,
      items: mappedItems,
      itemOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.set(template.id, template);
    return template;
  }

  // ============================================
  // Check Run Methods
  // ============================================

  createCheckRun(applianceId: string, completedBy: string, completedByName?: string, stationId?: string, runDetails?: { source?: CheckRun['source']; agentSessionId?: string }, startTimeOverride?: Date): CheckRun {
    const appliance = this.appliances.get(applianceId);
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
      contributors: [completedByName || completedBy],
      status: 'in-progress',
      hasIssues: false,
      source: runDetails?.source,
      agentSessionId: runDetails?.agentSessionId,
      createdAt: startTime,
      updatedAt: startTime,
    };

    this.checkRuns.set(checkRun.id, checkRun);
    return checkRun;
  }

  getActiveCheckRunForAppliance(applianceId: string): CheckRun | undefined {
    return Array.from(this.checkRuns.values()).find(
      run => run.applianceId === applianceId && run.status === 'in-progress'
    );
  }

  deleteCheckRun(id: string): boolean {
    if (!this.checkRuns.has(id)) return false;
    // Cascade-delete the run's results so no orphans linger.
    for (const result of this.getResultsByRunId(id)) {
      this.checkResults.delete(result.id);
    }
    return this.checkRuns.delete(id);
  }

  addContributorToCheckRun(runId: string, contributorName: string): CheckRun | undefined {
    const run = this.checkRuns.get(runId);
    if (!run) return undefined;

    if (!run.contributors.includes(contributorName)) {
      run.contributors.push(contributorName);
      run.updatedAt = new Date();
    }

    return run;
  }

  getCheckRunById(id: string): CheckRun | undefined {
    return this.checkRuns.get(id);
  }

  getAllCheckRuns(stationId?: string): CheckRun[] {
    return Array.from(this.checkRuns.values())
      .filter((run) => stationId === undefined || sameStation(run.stationId, stationId))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getCheckRunsByAppliance(applianceId: string): CheckRun[] {
    return Array.from(this.checkRuns.values())
      .filter(run => run.applianceId === applianceId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getCheckRunsByDateRange(startDate: Date, endDate: Date, stationId?: string): CheckRun[] {
    return Array.from(this.checkRuns.values())
      .filter(run => {
        const runDate = run.startTime.getTime();
        const inRange = runDate >= startDate.getTime() && runDate <= endDate.getTime();
        return inRange && (stationId === undefined || sameStation(run.stationId, stationId));
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  completeCheckRun(id: string, additionalComments?: string, endTimeOverride?: Date): CheckRun | undefined {
    const checkRun = this.checkRuns.get(id);
    if (checkRun) {
      const endTime = endTimeOverride ?? new Date();
      checkRun.endTime = endTime;
      checkRun.status = 'completed';
      checkRun.additionalComments = additionalComments;
      checkRun.updatedAt = endTime;
      
      // Check if there are any issues in the results
      const results = this.getResultsByRunId(id);
      checkRun.hasIssues = results.some(r => r.status === 'issue');
      
      return checkRun;
    }
    return undefined;
  }

  // ============================================
  // Check Result Methods
  // ============================================

  createCheckResult(
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
  ): CheckResult {
    const checkRun = this.checkRuns.get(runId);
    if (!checkRun) {
      throw new Error('Check run not found');
    }

    const result: CheckResult = {
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
      // An issue starts its follow-up lifecycle as 'open' (TC-4).
      issueStatus: status === 'issue' ? 'open' : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.checkResults.set(result.id, result);
    
    // Update check run's hasIssues flag if this result is an issue
    if (status === 'issue') {
      checkRun.hasIssues = true;
      checkRun.updatedAt = new Date();
    }
    
    return result;
  }

  getResultsByRunId(runId: string): CheckResult[] {
    return Array.from(this.checkResults.values())
      .filter(result => result.runId === runId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  getCheckRunWithResults(runId: string): CheckRunWithResults | null {
    const checkRun = this.checkRuns.get(runId);
    if (!checkRun) {
      return null;
    }

    const results = this.getResultsByRunId(runId);
    
    return {
      ...checkRun,
      results,
    };
  }

  updateCheckResult(
    id: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string
  ): CheckResult | undefined {
    const result = this.checkResults.get(id);
    if (result) {
      result.status = status;
      result.comment = comment;
      result.photoUrl = photoUrl;
      result.updatedAt = new Date();
      return result;
    }
    return undefined;
  }

  updateIssueStatus(id: string, update: IssueUpdate, _runId?: string): CheckResult | undefined {
    const result = this.checkResults.get(id);
    if (!result) return undefined;
    if (update.issueStatus !== undefined) result.issueStatus = update.issueStatus;
    if (update.issueNote !== undefined) result.issueNote = update.issueNote;
    if (update.assignedTo !== undefined) result.assignedTo = update.assignedTo;
    if (update.issueStatus === 'acknowledged') {
      result.acknowledgedBy = update.acknowledgedBy;
      result.acknowledgedAt = new Date();
    }
    if (update.issueStatus === 'resolved') {
      result.resolvedBy = update.resolvedBy;
      result.resolvedAt = new Date();
    }
    result.updatedAt = new Date();
    return result;
  }

  deleteCheckResult(id: string): boolean {
    return this.checkResults.delete(id);
  }

  // ============================================
  // Query Methods for Admin Dashboard
  // ============================================

  getRunsWithIssues(stationId?: string): CheckRunWithResults[] {
    return Array.from(this.checkRuns.values())
      .filter(run => run.hasIssues && (stationId === undefined || sameStation(run.stationId, stationId)))
      .map(run => ({
        ...run,
        results: this.getResultsByRunId(run.id),
      }))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getAllRunsWithResults(stationId?: string): CheckRunWithResults[] {
    return Array.from(this.checkRuns.values())
      .filter(run => stationId === undefined || sameStation(run.stationId, stationId))
      .map(run => ({
        ...run,
        results: this.getResultsByRunId(run.id),
      }))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  // ============================================
  // Reporting Methods
  // ============================================

  /**
   * Get truck check compliance statistics
   */
  getTruckCheckCompliance(startDate: Date, endDate: Date, stationId?: string): {
    totalChecks: number;
    completedChecks: number;
    inProgressChecks: number;
    checksWithIssues: number;
    complianceRate: number; // percentage
    applianceStats: Array<{
      applianceId: string;
      applianceName: string;
      checkCount: number;
      lastCheckDate: string | null;
    }>;
  } {
    const runs = Array.from(this.checkRuns.values())
      .filter(run => run.startTime >= startDate && run.startTime <= endDate)
      .filter(run => stationId === undefined || sameStation(run.stationId, stationId));

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
      const existing = applianceMap.get(run.applianceId);
      if (!existing) {
        applianceMap.set(run.applianceId, {
          name: run.applianceName,
          count: 1,
          lastCheck: run.startTime,
        });
      } else {
        existing.count += 1;
        if (!existing.lastCheck || run.startTime > existing.lastCheck) {
          existing.lastCheck = run.startTime;
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

export const truckChecksDb = new TruckChecksDatabase();
