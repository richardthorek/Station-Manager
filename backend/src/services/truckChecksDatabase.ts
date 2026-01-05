import { 
  Appliance, 
  ChecklistTemplate, 
  ChecklistItem, 
  CheckRun, 
  CheckResult,
  CheckRunWithResults,
  CheckStatus
} from '../types';
import { v4 as uuidv4 } from 'uuid';

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

  getAllAppliances(): Appliance[] {
    return Array.from(this.appliances.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  getApplianceById(id: string): Appliance | undefined {
    return this.appliances.get(id);
  }

  createAppliance(name: string, description?: string, photoUrl?: string): Appliance {
    const appliance: Appliance = {
      id: uuidv4(),
      name,
      description,
      photoUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.appliances.set(appliance.id, appliance);
    
    // Create a default template for the new appliance
    const template = this.createDefaultTemplate(appliance);
    this.templates.set(template.id, template);
    
    return appliance;
  }

  updateAppliance(id: string, name: string, description?: string, photoUrl?: string): Appliance | undefined {
    const appliance = this.appliances.get(id);
    if (appliance) {
      appliance.name = name;
      appliance.description = description;
      appliance.photoUrl = photoUrl;
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
    items: Omit<ChecklistItem, 'id'>[]
  ): ChecklistTemplate {
    const appliance = this.appliances.get(applianceId);
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    // Find existing template or create new one
    let template = this.getTemplateByApplianceId(applianceId);
    
    if (template) {
      // Update existing template
      template.items = items.map(item => ({
        ...item,
        id: uuidv4(),
      }));
      template.updatedAt = new Date();
    } else {
      // Create new template
      template = {
        id: uuidv4(),
        applianceId,
        applianceName: appliance.name,
        items: items.map(item => ({
          ...item,
          id: uuidv4(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.templates.set(template.id, template);
    }

    return template;
  }

  // ============================================
  // Check Run Methods
  // ============================================

  createCheckRun(applianceId: string, completedBy: string, completedByName?: string): CheckRun {
    const appliance = this.appliances.get(applianceId);
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
      contributors: [completedByName || completedBy],
      status: 'in-progress',
      hasIssues: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.checkRuns.set(checkRun.id, checkRun);
    return checkRun;
  }

  getActiveCheckRunForAppliance(applianceId: string): CheckRun | undefined {
    return Array.from(this.checkRuns.values()).find(
      run => run.applianceId === applianceId && run.status === 'in-progress'
    );
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

  getAllCheckRuns(): CheckRun[] {
    return Array.from(this.checkRuns.values()).sort((a, b) =>
      b.startTime.getTime() - a.startTime.getTime()
    );
  }

  getCheckRunsByAppliance(applianceId: string): CheckRun[] {
    return Array.from(this.checkRuns.values())
      .filter(run => run.applianceId === applianceId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getCheckRunsByDateRange(startDate: Date, endDate: Date): CheckRun[] {
    return Array.from(this.checkRuns.values())
      .filter(run => {
        const runDate = run.startTime.getTime();
        return runDate >= startDate.getTime() && runDate <= endDate.getTime();
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  completeCheckRun(id: string, additionalComments?: string): CheckRun | undefined {
    const checkRun = this.checkRuns.get(id);
    if (checkRun) {
      checkRun.endTime = new Date();
      checkRun.status = 'completed';
      checkRun.additionalComments = additionalComments;
      checkRun.updatedAt = new Date();
      
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
    completedBy?: string
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
      status,
      comment,
      photoUrl,
      completedBy,
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

  deleteCheckResult(id: string): boolean {
    return this.checkResults.delete(id);
  }

  // ============================================
  // Query Methods for Admin Dashboard
  // ============================================

  getRunsWithIssues(): CheckRunWithResults[] {
    return Array.from(this.checkRuns.values())
      .filter(run => run.hasIssues)
      .map(run => ({
        ...run,
        results: this.getResultsByRunId(run.id),
      }))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getAllRunsWithResults(): CheckRunWithResults[] {
    return Array.from(this.checkRuns.values())
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
  getTruckCheckCompliance(startDate: Date, endDate: Date): {
    totalChecks: number;
    completedChecks: number;
    inProgressChecks: number;
    checksWithIssues: number;
    complianceRate: number; // percentage
    applianceStats: Array<{
      applianceId: string;
      applianceName: string;
      checkCount: number;
      lastCheckDate: Date | null;
    }>;
  } {
    const runs = Array.from(this.checkRuns.values())
      .filter(run => run.startTime >= startDate && run.startTime <= endDate);

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
        lastCheckDate: stats.lastCheck,
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
