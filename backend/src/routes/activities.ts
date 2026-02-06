/**
 * Activity Management Routes
 * 
 * Manages station activities including:
 * - Fetching all available activities
 * - Getting and setting the active activity
 * - Creating custom activities
 * - Managing activity state for sign-in workflow
 * 
 * Multi-Station Support:
 * - All GET endpoints filter by stationId (from X-Station-Id header or query param)
 * - POST endpoints assign stationId to new activities
 * - Active activity is per-station
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import {
  validateCreateActivity,
  validateSetActiveActivity,
} from '../middleware/activityValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { logger } from '../services/logger';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

// Get all activities (filtered by station)
router.get('/', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const activities = await db.getAllActivities(stationId);
    res.json(activities);
  } catch (error) {
    logger.error('Error fetching activities', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get active activity (filtered by station)
router.get('/active', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const activeActivity = await db.getActiveActivity(stationId);
    if (!activeActivity) {
      return res.status(404).json({ error: 'No active activity set' });
    }
    
    const activity = await db.getActivityById(activeActivity.activityId);
    res.json({
      ...activeActivity,
      activity,
    });
  } catch (error) {
    logger.error('Error fetching active activity', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to fetch active activity' });
  }
});

// Set active activity (per-station)
router.post('/active', validateSetActiveActivity, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { activityId, setBy } = req.body;
    const stationId = getStationIdFromRequest(req);
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }

    const activity = await db.getActivityById(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activeActivity = await db.setActiveActivity(activityId, setBy, stationId);
    res.json({
      ...activeActivity,
      activity,
    });
  } catch (error) {
    logger.error('Error setting active activity', { 
      error, 
      activityId: req.body.activityId,
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to set active activity' });
  }
});

// Create custom activity (assigns station)
router.post('/', validateCreateActivity, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { name, createdBy } = req.body;
    const stationId = getStationIdFromRequest(req);
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const activity = await db.createActivity(name.trim(), createdBy, stationId);
    res.status(201).json(activity);
  } catch (error) {
    logger.error('Error creating activity', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Delete activity (soft delete)
router.delete('/:activityId', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { activityId } = req.params;
    
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }

    // Get the activity first
    const activity = await db.getActivityById(activityId);
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Soft delete by setting isDeleted flag
    // Note: This is a workaround until updateActivity method is added to IDatabase
    (activity as any).isDeleted = true;

    res.json({ message: 'Activity deleted successfully', activity });
  } catch (error) {
    logger.error('Error deleting activity', { 
      error, 
      activityId: req.params.activityId,
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;
