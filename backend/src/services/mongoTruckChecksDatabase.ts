import { MongoClient, Db, Collection } from 'mongodb';
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

class MongoTruckChecksDatabase {
  private client: MongoClient;
  private db: Db | null = null;
  private appliancesCollection: Collection<Appliance> | null = null;
  private templatesCollection: Collection<ChecklistTemplate> | null = null;
  private checkRunsCollection: Collection<CheckRun> | null = null;
  private checkResultsCollection: Collection<CheckResult> | null = null;
  private isConnected: boolean = false;

  constructor(connectionString?: string) {
    const uri = connectionString || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      this.db = this.client.db('StationManager');
      
      // Initialize collections
      this.appliancesCollection = this.db.collection<Appliance>('Appliances');
      this.templatesCollection = this.db.collection<ChecklistTemplate>('ChecklistTemplates');
      this.checkRunsCollection = this.db.collection<CheckRun>('CheckRuns');
      this.checkResultsCollection = this.db.collection<CheckResult>('CheckResults');

      // Create indexes
      await this.createIndexes();

      // Initialize default data if collections are empty
      await this.initializeDefaultData();

      this.isConnected = true;
      console.log('Connected to MongoDB for Truck Checks');
    } catch (error) {
      console.error('MongoDB Truck Checks connection error:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    await this.appliancesCollection?.createIndex({ name: 1 });
    await this.templatesCollection?.createIndex({ applianceId: 1 }, { unique: true });
    await this.checkRunsCollection?.createIndex({ applianceId: 1 });
    await this.checkRunsCollection?.createIndex({ startTime: -1 });
    await this.checkRunsCollection?.createIndex({ hasIssues: 1 });
    await this.checkResultsCollection?.createIndex({ runId: 1 });
  }

  private async initializeDefaultData(): Promise<void> {
    const applianceCount = await this.appliancesCollection?.countDocuments();
    
    if (applianceCount === 0) {
      const defaultAppliances = [
        { name: 'Cat 1', description: 'Category 1 Fire Truck' },
        { name: 'Cat 7', description: 'Category 7 Fire Truck' },
        { name: 'Cat 9', description: 'Category 9 Fire Truck' },
        { name: 'Bulk Water', description: 'Bulk Water Carrier' },
        { name: 'Command Vehicle', description: 'Command Vehicle' },
      ];

      for (const { name, description } of defaultAppliances) {
        const appliance: Appliance = {
          id: uuidv4(),
          name,
          description,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await this.appliancesCollection?.insertOne(appliance);

        // Create a default template for each appliance
        const template = this.createDefaultTemplate(appliance);
        await this.templatesCollection?.insertOne(template);
      }
    }
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

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('Disconnected from MongoDB Truck Checks');
    }
  }

  // ============================================
  // Appliance Methods
  // ============================================

  async getAllAppliances(): Promise<Appliance[]> {
    if (!this.appliancesCollection) throw new Error('Database not connected');
    return await this.appliancesCollection.find().sort({ name: 1 }).toArray();
  }

  async getApplianceById(id: string): Promise<Appliance | null> {
    if (!this.appliancesCollection) throw new Error('Database not connected');
    return await this.appliancesCollection.findOne({ id });
  }

  async createAppliance(name: string, description?: string): Promise<Appliance> {
    if (!this.appliancesCollection || !this.templatesCollection) {
      throw new Error('Database not connected');
    }
    
    const appliance: Appliance = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await this.appliancesCollection.insertOne(appliance);
    
    // Create a default template for the new appliance
    const template = this.createDefaultTemplate(appliance);
    await this.templatesCollection.insertOne(template);
    
    return appliance;
  }

  async updateAppliance(id: string, name: string, description?: string): Promise<Appliance | null> {
    if (!this.appliancesCollection) throw new Error('Database not connected');
    
    const result = await this.appliancesCollection.findOneAndUpdate(
      { id },
      { 
        $set: { 
          name,
          description,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  async deleteAppliance(id: string): Promise<boolean> {
    if (!this.appliancesCollection) throw new Error('Database not connected');
    
    const result = await this.appliancesCollection.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // ============================================
  // Template Methods
  // ============================================

  async getTemplateByApplianceId(applianceId: string): Promise<ChecklistTemplate | null> {
    if (!this.templatesCollection) throw new Error('Database not connected');
    return await this.templatesCollection.findOne({ applianceId });
  }

  async getTemplateById(id: string): Promise<ChecklistTemplate | null> {
    if (!this.templatesCollection) throw new Error('Database not connected');
    return await this.templatesCollection.findOne({ id });
  }

  async updateTemplate(
    applianceId: string, 
    items: Omit<ChecklistItem, 'id'>[]
  ): Promise<ChecklistTemplate> {
    if (!this.appliancesCollection || !this.templatesCollection) {
      throw new Error('Database not connected');
    }
    
    const appliance = await this.appliancesCollection.findOne({ id: { $eq: applianceId } });
    if (!appliance) {
      throw new Error('Appliance not found');
    }

    // Find existing template
    const existingTemplate = await this.templatesCollection.findOne({ applianceId });
    
    const templateItems: ChecklistItem[] = items.map(item => ({
      ...item,
      id: uuidv4(),
    }));

    if (existingTemplate) {
      // Update existing template
      const result = await this.templatesCollection.findOneAndUpdate(
        { applianceId },
        { 
          $set: { 
            items: templateItems,
            updatedAt: new Date()
          } 
        },
        { returnDocument: 'after' }
      );
      return result!;
    } else {
      // Create new template
      const template: ChecklistTemplate = {
        id: uuidv4(),
        applianceId,
        applianceName: appliance.name,
        items: templateItems,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.templatesCollection.insertOne(template);
      return template;
    }
  }

  // ============================================
  // Check Run Methods
  // ============================================

  async createCheckRun(applianceId: string, completedBy: string, completedByName?: string): Promise<CheckRun> {
    if (!this.appliancesCollection || !this.checkRunsCollection) {
      throw new Error('Database not connected');
    }
    
    const appliance = await this.appliancesCollection.findOne({ id: { $eq: applianceId } });
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
      status: 'in-progress',
      hasIssues: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.checkRunsCollection.insertOne(checkRun);
    return checkRun;
  }

  async getCheckRunById(id: string): Promise<CheckRun | null> {
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    return await this.checkRunsCollection.findOne({ id });
  }

  async getAllCheckRuns(): Promise<CheckRun[]> {
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    return await this.checkRunsCollection
      .find()
      .sort({ startTime: -1 })
      .toArray();
  }

  async getCheckRunsByAppliance(applianceId: string): Promise<CheckRun[]> {
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    return await this.checkRunsCollection
      .find({ applianceId: { $eq: applianceId } })
      .sort({ startTime: -1 })
      .toArray();
  }

  async getCheckRunsByDateRange(startDate: Date, endDate: Date): Promise<CheckRun[]> {
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    return await this.checkRunsCollection
      .find({
        startTime: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ startTime: -1 })
      .toArray();
  }

  async completeCheckRun(id: string, additionalComments?: string): Promise<CheckRun | null> {
    if (!this.checkRunsCollection || !this.checkResultsCollection) {
      throw new Error('Database not connected');
    }
    
    // Check if there are any issues in the results
    const results = await this.getResultsByRunId(id);
    const hasIssues = results.some(r => r.status === 'issue');
    
    const result = await this.checkRunsCollection.findOneAndUpdate(
      { id },
      { 
        $set: { 
          endTime: new Date(),
          status: 'completed',
          additionalComments,
          hasIssues,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  // ============================================
  // Check Result Methods
  // ============================================

  async createCheckResult(
    runId: string,
    itemId: string,
    itemName: string,
    itemDescription: string,
    status: CheckStatus,
    comment?: string,
    photoUrl?: string
  ): Promise<CheckResult> {
    if (!this.checkRunsCollection || !this.checkResultsCollection) {
      throw new Error('Database not connected');
    }
    
    const checkRun = await this.checkRunsCollection.findOne({ id: runId });
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.checkResultsCollection.insertOne(result);
    return result;
  }

  async getResultsByRunId(runId: string): Promise<CheckResult[]> {
    if (!this.checkResultsCollection) throw new Error('Database not connected');
    return await this.checkResultsCollection
      .find({ runId })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async getCheckRunWithResults(runId: string): Promise<CheckRunWithResults | null> {
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    
    const checkRun = await this.checkRunsCollection.findOne({ id: runId });
    if (!checkRun) {
      return null;
    }

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
    if (!this.checkResultsCollection) throw new Error('Database not connected');
    
    const result = await this.checkResultsCollection.findOneAndUpdate(
      { id },
      { 
        $set: { 
          status,
          comment,
          photoUrl,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    return result || null;
  }

  async deleteCheckResult(id: string): Promise<boolean> {
    if (!this.checkResultsCollection) throw new Error('Database not connected');
    
    const result = await this.checkResultsCollection.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // ============================================
  // Query Methods for Admin Dashboard
  // ============================================

  async getRunsWithIssues(): Promise<CheckRunWithResults[]> {
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    
    const runsWithIssues = await this.checkRunsCollection
      .find({ hasIssues: true })
      .sort({ startTime: -1 })
      .toArray();

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
    if (!this.checkRunsCollection) throw new Error('Database not connected');
    
    const runs = await this.checkRunsCollection
      .find()
      .sort({ startTime: -1 })
      .toArray();

    const runsWithResults = await Promise.all(
      runs.map(async (run) => {
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

// Create and export singleton instance
export const truckChecksDb = new MongoTruckChecksDatabase();
