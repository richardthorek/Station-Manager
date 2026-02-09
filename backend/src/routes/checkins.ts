/**
 * Check-In Management Routes
 * 
 * Handles member check-in/check-out operations:
 * - Getting active check-ins
 * - Creating new check-ins with activity association
 * - Toggling check-in status (undo check-in)
 * - Tracking check-in methods (kiosk, mobile, QR)
 * - Location tracking and offsite flagging
 * 
 * Multi-Station Support:
 * - All GET endpoints filter by stationId (from X-Station-Id header or query param)
 * - POST endpoints assign stationId to new check-ins
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import {
  validateCreateCheckIn,
  validateUrlCheckIn,
  validateMemberIdParam,
} from '../middleware/checkinValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { flexibleAuth } from '../middleware/flexibleAuth';
import { logger } from '../services/logger';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

// Get all check-ins (both active and inactive, filtered by station)
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.get('/', flexibleAuth({ scope: 'station' }), async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const checkIns = await db.getAllCheckIns(stationId);
    res.json(checkIns);
  } catch (error) {
    logger.error('Error fetching check-ins', { error, stationId: getStationIdFromRequest(req), requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Get all active check-ins (filtered by station)
// Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
router.get('/active', flexibleAuth({ scope: 'station' }), async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const checkIns = await db.getActiveCheckIns(stationId);
    res.json(checkIns);
  } catch (error) {
    logger.error('Error fetching active check-ins', { error, stationId: getStationIdFromRequest(req), requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch active check-ins' });
  }
});

// Check in a member (assigns station)
router.post('/', validateCreateCheckIn, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { memberId, activityId, method, location, isOffsite } = req.body;
    const stationId = getStationIdFromRequest(req);

    // Validate required fields
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    // Check if member exists
    const member = await db.getMemberById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Use active activity if no activity specified
    let finalActivityId = activityId;
    if (!finalActivityId) {
      const activeActivity = await db.getActiveActivity(stationId);
      if (!activeActivity) {
        return res.status(400).json({ error: 'No active activity set' });
      }
      finalActivityId = activeActivity.activityId;
    }

    // Check if activity exists
    const activity = await db.getActivityById(finalActivityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if member is already checked in
    const existingCheckIn = await db.getCheckInByMember(memberId);
    if (existingCheckIn) {
      // Undo the check-in
      await db.deactivateCheckIn(existingCheckIn.id);
      return res.json({ 
        action: 'undone',
        checkIn: existingCheckIn,
      });
    }

    // Create new check-in
    const checkIn = await db.createCheckIn(
      memberId,
      finalActivityId,
      method || 'mobile',
      location,
      isOffsite || false,
      stationId
    );

    res.status(201).json({
      action: 'checked-in',
      checkIn,
    });
  } catch (error) {
    logger.error('Check-in error', { error, requestId: req.id });
    res.status(500).json({ error: 'Failed to process check-in' });
  }
});

// Undo check-in (alternative endpoint)
router.delete('/:memberId', validateMemberIdParam, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { memberId } = req.params;
    const success = await db.deactivateCheckInByMember(memberId);
    
    if (!success) {
      return res.status(404).json({ error: 'No active check-in found for member' });
    }

    res.json({ message: 'Check-in undone successfully' });
  } catch (error) {
    logger.error('Error undoing check-in', { error, memberId: req.params.memberId, requestId: req.id });
    res.status(500).json({ error: 'Failed to undo check-in' });
  }
});

// URL-based check-in (assigns station)
router.post('/url-checkin', validateUrlCheckIn, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { identifier, stationId: urlStationId } = req.body;
    
    // Prioritize stationId from URL parameter, fallback to header
    const stationId = urlStationId || getStationIdFromRequest(req);

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ error: 'User identifier is required' });
    }

    // Try to find member by ID first (preferred method for reliability)
    let member = await db.getMemberById(identifier);
    
    // Fallback to name-based lookup for backward compatibility (deprecated)
    // This supports existing QR codes and URLs that use member names
    if (!member) {
      logger.debug('Member ID not found, falling back to name lookup', { 
        identifier, 
        stationId, 
        requestId: req.id 
      });
      const members = await db.getAllMembers(stationId);
      member = members.find(
        m => m.name.toLowerCase() === decodeURIComponent(identifier).toLowerCase()
      );
    }

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Verify member belongs to the station (if found by ID)
    if (member.stationId !== stationId) {
      logger.warn('Member found but belongs to different station', {
        memberId: member.id,
        memberStation: member.stationId,
        requestedStation: stationId,
        requestId: req.id
      });
      return res.status(404).json({ error: 'Member not found in this station' });
    }

    // Get active activity for this station
    const activeActivity = await db.getActiveActivity(stationId);
    if (!activeActivity) {
      return res.status(400).json({ error: 'No active activity set' });
    }

    // Check if already checked in
    const existingCheckIn = await db.getCheckInByMember(member.id);
    if (existingCheckIn) {
      return res.json({
        action: 'already-checked-in',
        member: member.name,
        checkIn: existingCheckIn,
      });
    }

    // Create new check-in with 'qr' method for URL-based check-ins
    const checkIn = await db.createCheckIn(
      member.id,
      activeActivity.activityId,
      'qr',
      undefined,
      false,
      stationId
    );

    logger.info('URL check-in successful', {
      memberId: member.id,
      memberName: member.name,
      stationId,
      requestId: req.id
    });

    res.status(201).json({
      action: 'checked-in',
      member: member.name,
      checkIn,
    });
  } catch (error) {
    logger.error('URL check-in error', { error, requestId: req.id });
    res.status(500).json({ error: 'Failed to process URL check-in' });
  }
});

export default router;
