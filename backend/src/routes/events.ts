/**
 * Event Management Routes
 * 
 * Manages discrete activity events with participant tracking:
 * - Creating and managing events (training sessions, meetings, callouts)
 * - Adding/removing participants from events
 * - Tracking event start/end times
 * - Pagination support for event history
 * - Active event management
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

const router = Router();

/**
 * Get events with pagination support
 * Query params: limit (default 50), offset (default 0)
 */
router.get('/', validateEventQuery, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    
    const events = await db.getEventsWithParticipants(limit, offset);
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * Get all active events (not yet ended)
 */
router.get('/active', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const activeEvents = await db.getActiveEvents();
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
    console.error('Error fetching active events:', error);
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
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * Create a new event from an activity type
 */
router.post('/', validateCreateEvent, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { activityId, createdBy } = req.body;
    
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }
    
    const activity = await db.getActivityById(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const event = await db.createEvent(activityId, createdBy);
    const eventWithParticipants = await db.getEventWithParticipants(event.id);
    
    res.status(201).json(eventWithParticipants);
  } catch (error) {
    console.error('Error creating event:', error);
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
    console.error('Error ending event:', error);
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
    const event = await db.reactivateEvent(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const eventWithParticipants = await db.getEventWithParticipants(event.id);
    res.json(eventWithParticipants);
  } catch (error) {
    console.error('Error reactivating event:', error);
    res.status(500).json({ error: 'Failed to reactivate event' });
  }
});

/**
 * Add a participant to an event (check-in)
 */
router.post('/:eventId/participants', validateAddParticipant, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { eventId } = req.params;
    const { memberId, method, location, isOffsite } = req.body;
    
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
    
    // Check if member already checked in to this event
    const existing = await db.getMemberParticipantInEvent(eventId, memberId);
    if (existing) {
      // Remove participant (undo check-in)
      await db.removeEventParticipant(existing.id);
      return res.json({ 
        action: 'removed',
        participant: existing,
      });
    }
    
    // Add participant
    const participant = await db.addEventParticipant(
      eventId,
      memberId,
      method || 'mobile',
      location,
      isOffsite || false
    );
    
    res.status(201).json({
      action: 'added',
      participant,
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

/**
 * Remove a participant from an event (undo check-in)
 */
router.delete('/:eventId/participants/:participantId', validateRemoveParticipant, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { participantId } = req.params;
    const success = await db.removeEventParticipant(participantId);
    
    if (!success) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
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
    console.error('Error deleting event:', error);
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
    console.error('Error during manual rollover:', error);
    res.status(500).json({ error: 'Failed to perform rollover' });
  }
});

export default router;
