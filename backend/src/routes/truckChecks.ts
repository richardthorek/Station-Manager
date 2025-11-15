import { Router, Request, Response } from 'express';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { CheckStatus } from '../types';

const router = Router();

// ============================================
// Appliance Routes
// ============================================

/**
 * GET /api/truck-checks/appliances
 * Get all appliances
 */
router.get('/appliances', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase();
    const appliances = await db.getAllAppliances();
    res.json(appliances);
  } catch (error) {
    console.error('Error fetching appliances:', error);
    res.status(500).json({ error: 'Failed to fetch appliances' });
  }
});

/**
 * GET /api/truck-checks/appliances/:id
 * Get a specific appliance
 */
router.get('/appliances/:id', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase();
    const appliance = await db.getApplianceById(req.params.id);
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    res.json(appliance);
  } catch (error) {
    console.error('Error fetching appliance:', error);
    res.status(500).json({ error: 'Failed to fetch appliance' });
  }
});

/**
 * POST /api/truck-checks/appliances
 * Create a new appliance
 */
router.post('/appliances', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await ensureTruckChecksDatabase();
    const appliance = await db.createAppliance(name, description);
    res.status(201).json(appliance);
  } catch (error) {
    console.error('Error creating appliance:', error);
    res.status(500).json({ error: 'Failed to create appliance' });
  }
});

/**
 * PUT /api/truck-checks/appliances/:id
 * Update an appliance
 */
router.put('/appliances/:id', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await ensureTruckChecksDatabase();
    const appliance = await db.updateAppliance(req.params.id, name, description);
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    res.json(appliance);
  } catch (error) {
    console.error('Error updating appliance:', error);
    res.status(500).json({ error: 'Failed to update appliance' });
  }
});

/**
 * DELETE /api/truck-checks/appliances/:id
 * Delete an appliance
 */
router.delete('/appliances/:id', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase();
    const deleted = await db.deleteAppliance(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting appliance:', error);
    res.status(500).json({ error: 'Failed to delete appliance' });
  }
});

// ============================================
// Template Routes
// ============================================

/**
 * GET /api/truck-checks/templates/:applianceId
 * Get checklist template for an appliance
 */
router.get('/templates/:applianceId', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase();
    const template = await db.getTemplateByApplianceId(req.params.applianceId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * PUT /api/truck-checks/templates/:applianceId
 * Update checklist template for an appliance
 */
router.put('/templates/:applianceId', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const db = await ensureTruckChecksDatabase();
    const template = await db.updateTemplate(req.params.applianceId, items);
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================
// Check Run Routes
// ============================================

/**
 * POST /api/truck-checks/runs
 * Create a new check run
 */
router.post('/runs', async (req: Request, res: Response) => {
  try {
    const { applianceId, completedBy, completedByName } = req.body;
    
    if (!applianceId || !completedBy) {
      return res.status(400).json({ error: 'applianceId and completedBy are required' });
    }

    const db = await ensureTruckChecksDatabase();
    const checkRun = await db.createCheckRun(applianceId, completedBy, completedByName);
    res.status(201).json(checkRun);
  } catch (error) {
    console.error('Error creating check run:', error);
    res.status(500).json({ error: 'Failed to create check run' });
  }
});

/**
 * GET /api/truck-checks/runs/:id
 * Get a specific check run with results
 */
router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase();
    const checkRun = await db.getCheckRunWithResults(req.params.id);
    if (!checkRun) {
      return res.status(404).json({ error: 'Check run not found' });
    }
    res.json(checkRun);
  } catch (error) {
    console.error('Error fetching check run:', error);
    res.status(500).json({ error: 'Failed to fetch check run' });
  }
});

/**
 * GET /api/truck-checks/runs
 * Get all check runs with optional filters
 */
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const { applianceId, startDate, endDate, withIssues } = req.query;
    const db = await ensureTruckChecksDatabase();
    
    let runs;
    
    if (withIssues === 'true') {
      runs = await db.getRunsWithIssues();
    } else if (applianceId) {
      const simpleRuns = await db.getCheckRunsByAppliance(applianceId as string);
      runs = await Promise.all(simpleRuns.map(async run => ({
        ...run,
        results: await db.getResultsByRunId(run.id),
      })));
    } else if (startDate && endDate) {
      const simpleRuns = await db.getCheckRunsByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      runs = await Promise.all(simpleRuns.map(async run => ({
        ...run,
        results: await db.getResultsByRunId(run.id),
      })));
    } else {
      runs = await db.getAllRunsWithResults();
    }
    
    res.json(runs);
  } catch (error) {
    console.error('Error fetching check runs:', error);
    res.status(500).json({ error: 'Failed to fetch check runs' });
  }
});

/**
 * PUT /api/truck-checks/runs/:id/complete
 * Complete a check run
 */
router.put('/runs/:id/complete', async (req: Request, res: Response) => {
  try {
    const { additionalComments } = req.body;
    
    const db = await ensureTruckChecksDatabase();
    const checkRun = await db.completeCheckRun(req.params.id, additionalComments);
    if (!checkRun) {
      return res.status(404).json({ error: 'Check run not found' });
    }
    
    res.json(checkRun);
  } catch (error) {
    console.error('Error completing check run:', error);
    res.status(500).json({ error: 'Failed to complete check run' });
  }
});

// ============================================
// Check Result Routes
// ============================================

/**
 * POST /api/truck-checks/results
 * Create a check result for an item
 */
router.post('/results', async (req: Request, res: Response) => {
  try {
    const { runId, itemId, itemName, itemDescription, status, comment, photoUrl } = req.body;
    
    if (!runId || !itemId || !itemName || !itemDescription || !status) {
      return res.status(400).json({ 
        error: 'runId, itemId, itemName, itemDescription, and status are required' 
      });
    }

    if (!['done', 'issue', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const db = await ensureTruckChecksDatabase();
    const result = await db.createCheckResult(
      runId,
      itemId,
      itemName,
      itemDescription,
      status as CheckStatus,
      comment,
      photoUrl
    );
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating check result:', error);
    res.status(500).json({ error: 'Failed to create check result' });
  }
});

/**
 * PUT /api/truck-checks/results/:id
 * Update a check result
 */
router.put('/results/:id', async (req: Request, res: Response) => {
  try {
    const { status, comment, photoUrl } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['done', 'issue', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const db = await ensureTruckChecksDatabase();
    const result = await db.updateCheckResult(
      req.params.id,
      status as CheckStatus,
      comment,
      photoUrl
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Check result not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating check result:', error);
    res.status(500).json({ error: 'Failed to update check result' });
  }
});

/**
 * DELETE /api/truck-checks/results/:id
 * Delete a check result
 */
router.delete('/results/:id', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase();
    const deleted = await db.deleteCheckResult(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Check result not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting check result:', error);
    res.status(500).json({ error: 'Failed to delete check result' });
  }
});

export default router;
