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
  validateActivityId,
} from '../middleware/activityValidation';
import { DEFAULT_STATION_ID, getEffectiveStationId } from '../constants/stations';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { flexibleAuth } from '../middleware/flexibleAuth';
import { logger } from '../services/logger';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

// Get all activities (filtered by station)
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.get('/', flexibleAuth({ scope: 'station' }), async (req, res) => {
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
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.get('/active', flexibleAuth({ scope: 'station' }), async (req, res) => {
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
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.post('/active', validateSetActiveActivity, handleValidationErrors, flexibleAuth({ scope: 'station' }), async (req: Request, res: Response) => {
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
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.post('/', validateCreateActivity, handleValidationErrors, flexibleAuth({ scope: 'station' }), async (req: Request, res: Response) => {
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

// Delete activity (soft delete, persisted via the database service)
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.delete('/:activityId', validateActivityId, handleValidationErrors, flexibleAuth({ scope: 'station' }), async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const activityId = req.params.activityId as string;
    const stationId = getStationIdFromRequest(req);

    const activity = await db.getActivityById(activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Only allow deleting activities visible to this station
    // (station-specific activities of the same station, or shared defaults)
    const activityStationId = getEffectiveStationId(activity.stationId);
    if (activityStationId !== getEffectiveStationId(stationId) && activityStationId !== DEFAULT_STATION_ID) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const deletedActivity = await db.deleteActivity(activityId);

    if (!deletedActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ message: 'Activity deleted successfully', activity: deletedActivity });
  } catch (error) {
    logger.error('Error deleting activity', { 
      error, 
      activityId: req.params.activityId as string,
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;
