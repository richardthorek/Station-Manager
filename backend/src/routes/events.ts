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

import { Router } from 'express';
import { ensureDatabase } from '../services/dbFactory';

const router = Router();

/**
 * Get events with pagination support
 * Query params: limit (default 50), offset (default 0)
 */
router.get('/', async (req, res) => {
  try {
    const db = await ensureDatabase();
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
    const db = await ensureDatabase();
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
router.get('/:eventId', async (req, res) => {
  try {
    const db = await ensureDatabase();
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
router.post('/', async (req, res) => {
  try {
    const db = await ensureDatabase();
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
router.put('/:eventId/end', async (req, res) => {
  try {
    const db = await ensureDatabase();
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
 * Add a participant to an event (check-in)
 */
router.post('/:eventId/participants', async (req, res) => {
  try {
    const db = await ensureDatabase();
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
router.delete('/:eventId/participants/:participantId', async (req, res) => {
  try {
    const db = await ensureDatabase();
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

export default router;
