/**
 * Truck Checks Routes
 * 
 * Comprehensive vehicle inspection workflow including:
 * - Appliance management (fire trucks, bulk water carriers, command vehicles)
 * - Checklist templates with customizable items
 * - Check run creation and management (collaborative checking)
 * - Check result tracking (done, issue, skipped statuses)
 * - Photo upload support (Azure Blob Storage integration)
 * - Real-time collaboration via WebSocket
 * - Issue tracking and reporting
 * 
 * Multi-Station Support:
 * - All GET endpoints filter by stationId (from X-Station-Id header or query param)
 * - POST endpoints assign stationId to new appliances, templates, and check runs
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { CheckStatus } from '../types';
import { azureStorageService } from '../services/azureStorage';
import { io } from '../index';
import {
  validateCreateAppliance,
  validateUpdateAppliance,
  validateApplianceId,
  validateTemplateApplianceId,
  validateUpdateTemplate,
  validateCreateCheckRun,
  validateCheckRunId,
  validateCompleteCheckRun,
  validateCheckRunQuery,
  validateCreateCheckResult,
  validateUpdateCheckResult,
  validateCheckResultId,
} from '../middleware/truckCheckValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { logger } from '../services/logger';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

// Configure multer for memory storage (we'll upload to Azure)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ============================================
// Appliance Routes
// ============================================

/**
 * GET /api/truck-checks/appliances
 * Get all appliances (filtered by station)
 */
router.get('/appliances', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const appliances = await db.getAllAppliances(stationId);
    res.json(appliances);
  } catch (error) {
    logger.error('Error fetching appliances:', error);
    res.status(500).json({ error: 'Failed to fetch appliances' });
  }
});

/**
 * GET /api/truck-checks/appliances/:id
 * Get a specific appliance
 */
router.get('/appliances/:id', validateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.getApplianceById(req.params.id);
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    res.json(appliance);
  } catch (error) {
    logger.error('Error fetching appliance:', error);
    res.status(500).json({ error: 'Failed to fetch appliance' });
  }
});

/**
 * POST /api/truck-checks/appliances
 * Create a new appliance (assigns station)
 */
router.post('/appliances', validateCreateAppliance, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { name, description, photoUrl } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.createAppliance(name, description, photoUrl, stationId);
    res.status(201).json(appliance);
  } catch (error) {
    logger.error('Error creating appliance:', error);
    res.status(500).json({ error: 'Failed to create appliance' });
  }
});

/**
 * PUT /api/truck-checks/appliances/:id
 * Update an appliance
 */
router.put('/appliances/:id', validateUpdateAppliance, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { name, description, photoUrl } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.updateAppliance(req.params.id, name, description, photoUrl);
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    res.json(appliance);
  } catch (error) {
    logger.error('Error updating appliance:', error);
    res.status(500).json({ error: 'Failed to update appliance' });
  }
});

/**
 * DELETE /api/truck-checks/appliances/:id
 * Delete an appliance
 */
router.delete('/appliances/:id', validateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const deleted = await db.deleteAppliance(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting appliance:', error);
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
router.get('/templates/:applianceId', validateTemplateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const template = await db.getTemplateByApplianceId(req.params.applianceId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * PUT /api/truck-checks/templates/:applianceId
 * Update checklist template for an appliance (assigns station)
 */
router.put('/templates/:applianceId', validateUpdateTemplate, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const template = await db.updateTemplate(req.params.applianceId, items, stationId);
    res.json(template);
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================
// Check Run Routes
// ============================================

/**
 * POST /api/truck-checks/runs
 * Find or create a check run for collaborative checking (assigns station)
 * If an active check run exists for the appliance, join it; otherwise create new
 */
router.post('/runs', validateCreateCheckRun, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { applianceId, completedBy, completedByName } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!applianceId || !completedBy) {
      return res.status(400).json({ error: 'applianceId and completedBy are required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    
    // Check for existing active check run
    let checkRun = await db.getActiveCheckRunForAppliance(applianceId);
    
    if (checkRun) {
      // Join existing check run
      checkRun = await db.addContributorToCheckRun(checkRun.id, completedByName || completedBy);
      
      // Ensure checkRun is not undefined after addContributorToCheckRun
      if (!checkRun) {
        return res.status(500).json({ error: 'Failed to add contributor to check run' });
      }
      
      // Emit real-time update that someone joined - station-scoped
      if (checkRun.stationId) {
        io.to(`station-${checkRun.stationId}`).emit('truck-check-update', {
          type: 'contributor-joined',
          runId: checkRun.id,
          contributorName: completedByName || completedBy,
          checkRun,
          timestamp: new Date()
        });
      }
      
      res.json({ ...checkRun, joined: true });
    } else {
      // Create new check run
      checkRun = await db.createCheckRun(applianceId, completedBy, completedByName, stationId);
      
      // Emit real-time update that check run started - station-scoped
      if (checkRun.stationId) {
        io.to(`station-${checkRun.stationId}`).emit('truck-check-update', {
          type: 'check-started',
          runId: checkRun.id,
          checkRun,
          timestamp: new Date()
        });
      }
      
      res.status(201).json({ ...checkRun, joined: false });
    }
  } catch (error) {
    logger.error('Error creating/joining check run:', error);
    res.status(500).json({ error: 'Failed to create/join check run' });
  }
});

/**
 * GET /api/truck-checks/runs/:id
 * Get a specific check run with results
 */
router.get('/runs/:id', validateCheckRunId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const checkRun = await db.getCheckRunWithResults(req.params.id);
    if (!checkRun) {
      return res.status(404).json({ error: 'Check run not found' });
    }
    res.json(checkRun);
  } catch (error) {
    logger.error('Error fetching check run:', error);
    res.status(500).json({ error: 'Failed to fetch check run' });
  }
});

/**
 * GET /api/truck-checks/runs
 * Get all check runs with optional filters (filtered by station)
 */
router.get('/runs', validateCheckRunQuery, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { applianceId, startDate, endDate, withIssues } = req.query;
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    
    let runs;
    
    if (withIssues === 'true') {
      runs = await db.getRunsWithIssues(stationId);
    } else if (applianceId) {
      const simpleRuns = await db.getCheckRunsByAppliance(applianceId as string);
      runs = await Promise.all(simpleRuns.map(async run => ({
        ...run,
        results: await db.getResultsByRunId(run.id),
      })));
    } else if (startDate && endDate) {
      const simpleRuns = await db.getCheckRunsByDateRange(
        new Date(startDate as string),
        new Date(endDate as string),
        stationId
      );
      runs = await Promise.all(simpleRuns.map(async run => ({
        ...run,
        results: await db.getResultsByRunId(run.id),
      })));
    } else {
      runs = await db.getAllRunsWithResults(stationId);
    }
    
    res.json(runs);
  } catch (error) {
    logger.error('Error fetching check runs:', error);
    res.status(500).json({ error: 'Failed to fetch check runs' });
  }
});

/**
 * PUT /api/truck-checks/runs/:id/complete
 * Complete a check run
 */
router.put('/runs/:id/complete', validateCompleteCheckRun, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { additionalComments } = req.body;
    
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const checkRun = await db.completeCheckRun(req.params.id, additionalComments);
    if (!checkRun) {
      return res.status(404).json({ error: 'Check run not found' });
    }
    
    // Emit real-time update that check run completed - station-scoped
    if (checkRun.stationId) {
      io.to(`station-${checkRun.stationId}`).emit('truck-check-update', {
        type: 'check-completed',
        runId: checkRun.id,
        checkRun,
        timestamp: new Date()
      });
    }
    
    res.json(checkRun);
  } catch (error) {
    logger.error('Error completing check run:', error);
    res.status(500).json({ error: 'Failed to complete check run' });
  }
});

// ============================================
// Check Result Routes
// ============================================

/**
 * POST /api/truck-checks/results
 * Create a check result for an item (assigns station)
 */
router.post('/results', validateCreateCheckResult, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { runId, itemId, itemName, itemDescription, status, comment, photoUrl, completedBy } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!runId || !itemId || !itemName || !itemDescription || !status) {
      return res.status(400).json({ 
        error: 'runId, itemId, itemName, itemDescription, and status are required' 
      });
    }

    if (!['done', 'issue', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const result = await db.createCheckResult(
      runId,
      itemId,
      itemName,
      itemDescription,
      status as CheckStatus,
      comment,
      photoUrl,
      completedBy,
      stationId
    );
    
    // Emit real-time update for collaborative checking - station-scoped
    if (stationId) {
      io.to(`station-${stationId}`).emit('truck-check-update', {
        type: 'result-created',
        runId,
        result,
        timestamp: new Date()
      });
    }
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating check result:', error);
    res.status(500).json({ error: 'Failed to create check result' });
  }
});

/**
 * PUT /api/truck-checks/results/:id
 * Update a check result
 */
router.put('/results/:id', validateUpdateCheckResult, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { status, comment, photoUrl } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['done', 'issue', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
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
    logger.error('Error updating check result:', error);
    res.status(500).json({ error: 'Failed to update check result' });
  }
});

/**
 * DELETE /api/truck-checks/results/:id
 * Delete a check result
 */
router.delete('/results/:id', validateCheckResultId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const deleted = await db.deleteCheckResult(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Check result not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting check result:', error);
    res.status(500).json({ error: 'Failed to delete check result' });
  }
});

// ============================================
// Photo Upload Routes
// ============================================

/**
 * POST /api/truck-checks/upload/reference-photo
 * Upload a reference photo for a checklist template item
 */
router.post('/upload/reference-photo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!azureStorageService.isStorageEnabled()) {
      return res.status(503).json({ 
        error: 'Photo upload is not available. Azure Storage is not configured.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoUrl = await azureStorageService.uploadReferencePhoto(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(201).json({ photoUrl });
  } catch (error) {
    logger.error('Error uploading reference photo:', error);
    res.status(500).json({ error: 'Failed to upload reference photo' });
  }
});

/**
 * POST /api/truck-checks/upload/result-photo
 * Upload a result photo for a check result
 */
router.post('/upload/result-photo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!azureStorageService.isStorageEnabled()) {
      return res.status(503).json({ 
        error: 'Photo upload is not available. Azure Storage is not configured.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoUrl = await azureStorageService.uploadResultPhoto(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(201).json({ photoUrl });
  } catch (error) {
    logger.error('Error uploading result photo:', error);
    res.status(500).json({ error: 'Failed to upload result photo' });
  }
});

/**
 * GET /api/truck-checks/storage-status
 * Check if Azure Storage is configured and available
 */
router.get('/storage-status', (req: Request, res: Response) => {
  res.json({
    enabled: azureStorageService.isStorageEnabled(),
    message: azureStorageService.isStorageEnabled() 
      ? 'Photo upload is available' 
      : 'Photo upload is not available. Configure Azure Storage to enable this feature.'
  });
});

export default router;
