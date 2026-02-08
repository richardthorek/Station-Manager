/**
 * Event Management Routes
 * 
 * Manages discrete activity events with participant tracking:
 * - Creating and managing events (training sessions, meetings, callouts)
 * - Adding/removing participants from events
 * - Tracking event start/end times
 * - Pagination support for event history
 * - Active event management
 * 
 * Multi-Station Support:
 * - All GET endpoints filter by stationId (from X-Station-Id header or query param)
 * - POST endpoints assign stationId to new events
 * - Participants inherit event's stationId
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import { deactivateExpiredEvents, EVENT_EXPIRY_HOURS } from '../services/rolloverService';
import {
  validateCreateEvent,
  validateEventId,
  validateAddParticipant,
  validateRemoveParticipant,
  validateEventQuery,
} from '../middleware/eventValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { flexibleAuth } from '../middleware/flexibleAuth';
import { logger } from '../services/logger';
import { extractDeviceInfo, extractLocationInfo, sanitizeNotes } from '../utils/auditUtils';

const router = Router();
const REACTIVATE_WINDOW_HOURS = 24;

// Apply station middleware to all routes
router.use(stationMiddleware);

/**
 * Get events with pagination support (filtered by station)
 * Query params: limit (default 50), offset (default 0)
 * Protected by flexibleAuth when ENABLE_DATA_PROTECTION=true
 */
router.get('/', flexibleAuth({ scope: 'station' }), validateEventQuery, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    
    const events = await db.getEventsWithParticipants(limit, offset, stationId);
    res.json(events);
  } catch (error) {
    logger.error('Error fetching events', { error, stationId: getStationIdFromRequest(req), requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * Get all active events (not yet ended, filtered by station)
 */
router.get('/active', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const activeEvents = await db.getActiveEvents(stationId);
    const eventsWithParticipants = await Promise.all(
      activeEvents.map(async event => {
        const participants = await db.getEventParticipants(event.id);
        return {
          ...event,
          participants,
          participantCount: participants.length,
        };
      })
    );
    
    res.json(eventsWithParticipants);
  } catch (error) {
    logger.error('Error fetching active events', { error, stationId: getStationIdFromRequest(req), requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch active events' });
  }
});

/**
 * Get a specific event with participants
 */
router.get('/:eventId', validateEventId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    const event = await db.getEventWithParticipants(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    logger.error('Error fetching event', { error, eventId: req.params.id, requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * Create a new event from an activity type (assigns station)
 */
router.post('/', validateCreateEvent, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { activityId, createdBy } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }
    
    const activity = await db.getActivityById(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const event = await db.createEvent(activityId, createdBy, stationId);
    const eventWithParticipants = await db.getEventWithParticipants(event.id);
    
    res.status(201).json(eventWithParticipants);
  } catch (error) {
    logger.error('Error creating event', { error, stationId: getStationIdFromRequest(req), requestId: req.id });
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * End an event (sets end time and makes it inactive)
 */
router.put('/:eventId/end', validateEventId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    const event = await db.endEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const eventWithParticipants = await db.getEventWithParticipants(event.id);
    res.json(eventWithParticipants);
  } catch (error) {
    logger.error('Error ending event', { error, eventId: req.params.id, requestId: req.id });
    res.status(500).json({ error: 'Failed to end event' });
  }
});

/**
 * Reactivate an event (clears end time and makes it active again)
 */
router.put('/:eventId/reactivate', validateEventId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    const existingEvent = await db.getEventById(eventId);

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // If event is already active, return it (idempotent operation)
    if (existingEvent.isActive) {
      const eventWithParticipants = await db.getEventWithParticipants(existingEvent.id);
      return res.json(eventWithParticipants || existingEvent);
    }

    if (!existingEvent.endTime) {
      const withoutEndTime = await db.getEventWithParticipants(existingEvent.id);
      return res.json(withoutEndTime || existingEvent);
    }

    const now = Date.now();
    const endedAt = existingEvent.endTime.getTime();
    const hoursSinceEnd = (now - endedAt) / (1000 * 60 * 60);

    if (hoursSinceEnd > REACTIVATE_WINDOW_HOURS) {
      return res.status(403).json({ error: 'Event can only be re-opened within 24 hours of closing' });
    }

    const event = await db.reactivateEvent(eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventWithParticipants = await db.getEventWithParticipants(event.id);
    res.json(eventWithParticipants);
  } catch (error) {
    logger.error('Error reactivating event', { error, eventId: req.params.id, requestId: req.id });
    res.status(500).json({ error: 'Failed to reactivate event' });
  }
});

/**
 * Add a participant to an event (check-in, participant inherits event's stationId)
 */
router.post('/:eventId/participants', validateAddParticipant, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    const { memberId, method, location, isOffsite, performedBy, notes } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }
    
    // Check if event exists
    const event = await db.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check if event is active
    if (!event.isActive) {
      return res.status(400).json({ error: 'Cannot add participants to an ended event' });
    }
    
    // Extract device and location information for audit trail
    const deviceInfo = extractDeviceInfo(req);
    const locationInfo = extractLocationInfo(req);
    const sanitizedNotes = sanitizeNotes(notes);
    
    // Check if member already checked in to this event
    const existing = await db.getMemberParticipantInEvent(eventId, memberId);
    if (existing) {
      // Remove participant (undo check-in)
      await db.removeEventParticipant(existing.id, eventId);
      
      // Create audit log for removal
      await db.createEventAuditLog(
        eventId,
        'participant-removed',
        existing.id,
        existing.memberId,
        existing.memberName,
        existing.memberRank,
        existing.checkInMethod,
        performedBy,
        deviceInfo,
        locationInfo,
        stationId,
        req.id,
        sanitizedNotes || 'Undo check-in (toggle)'
      );
      
      return res.json({ 
        action: 'removed',
        participant: existing,
      });
    }
    
    // Add participant (inherits event's stationId)
    const participant = await db.addEventParticipant(
      eventId,
      memberId,
      method || 'mobile',
      location,
      isOffsite || false,
      event.stationId
    );
    
    // Create audit log for addition
    await db.createEventAuditLog(
      eventId,
      'participant-added',
      participant.id,
      participant.memberId,
      participant.memberName,
      participant.memberRank,
      participant.checkInMethod,
      performedBy,
      deviceInfo,
      locationInfo,
      stationId,
      req.id,
      sanitizedNotes
    );
    
    res.status(201).json({
      action: 'added',
      participant,
    });
  } catch (error) {
    logger.error('Error adding participant', { error, eventId: req.params.id, requestId: req.id });
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

/**
 * Remove a participant from an event (undo check-in)
 */
router.delete('/:eventId/participants/:participantId', validateRemoveParticipant, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId, participantId } = req.params;
    const { performedBy, notes } = req.body || {}; // Handle empty body for DELETE
    const stationId = getStationIdFromRequest(req);
    
    // Try to get participant details before removal for audit log
    // Note: participant might be in the event or might not exist
    const participants = await db.getEventParticipants(eventId);
    const participant = participants.find(p => p.id === participantId);
    
    // Remove participant (this will return false if not found)
    const success = await db.removeEventParticipant(participantId, eventId);
    
    if (!success) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Create audit log only if we successfully removed the participant
    // and we have the participant details
    if (participant) {
      // Extract device and location information for audit trail
      const deviceInfo = extractDeviceInfo(req);
      const locationInfo = extractLocationInfo(req);
      const sanitizedNotes = sanitizeNotes(notes);
      
      await db.createEventAuditLog(
        eventId,
        'participant-removed',
        participantId,
        participant.memberId,
        participant.memberName,
        participant.memberRank,
        participant.checkInMethod,
        performedBy,
        deviceInfo,
        locationInfo,
        stationId,
        req.id,
        sanitizedNotes
      );
    }
    
    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    logger.error('Error removing participant', { error, eventId: req.params.eventId, participantId: req.params.participantId, requestId: req.id });
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

/**
 * Get audit logs for a specific event
 * Returns chronological log of all participant additions and removals
 */
router.get('/:eventId/audit', validateEventId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    
    // Verify event exists
    const event = await db.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get audit logs for this event
    const auditLogs = await db.getEventAuditLogs(eventId);
    
    res.json({
      eventId,
      totalLogs: auditLogs.length,
      logs: auditLogs,
    });
  } catch (error) {
    logger.error('Error fetching event audit logs', { error, eventId: req.params.eventId, requestId: req.id });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Delete an event (soft delete)
 */
router.delete('/:eventId', validateEventId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    
    const event = await db.deleteEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully', event });
  } catch (error) {
    logger.error('Error deleting event', { error, eventId: req.params.id, requestId: req.id });
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/**
 * Manual rollover trigger - deactivates all expired events
 * POST /api/events/admin/rollover
 */
router.post('/admin/rollover', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const deactivatedEventIds = await deactivateExpiredEvents(db);
    
    res.json({
      message: 'Rollover completed successfully',
      deactivatedCount: deactivatedEventIds.length,
      deactivatedEventIds,
      expiryHours: EVENT_EXPIRY_HOURS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error during manual rollover', { error, requestId: req.id });
    res.status(500).json({ error: 'Failed to perform rollover' });
  }
});

export default router;
