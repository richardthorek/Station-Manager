import { Router } from 'express';
import { ensureDatabase } from '../services/dbFactory';

const router = Router();

// Get all active check-ins
router.get('/active', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const checkIns = await db.getActiveCheckIns();
    res.json(checkIns);
  } catch (error) {
    console.error('Error fetching active check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch active check-ins' });
  }
});

// Check in a member
router.post('/', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const { memberId, activityId, method, location, isOffsite } = req.body;

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
      const activeActivity = await db.getActiveActivity();
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
      isOffsite || false
    );

    res.status(201).json({
      action: 'checked-in',
      checkIn,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to process check-in' });
  }
});

// Undo check-in (alternative endpoint)
router.delete('/:memberId', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const { memberId } = req.params;
    const success = await db.deactivateCheckInByMember(memberId);
    
    if (!success) {
      return res.status(404).json({ error: 'No active check-in found for member' });
    }

    res.json({ message: 'Check-in undone successfully' });
  } catch (error) {
    console.error('Error undoing check-in:', error);
    res.status(500).json({ error: 'Failed to undo check-in' });
  }
});

// URL-based check-in
router.post('/url-checkin', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ error: 'User identifier is required' });
    }

    // Try to find member by name (case-insensitive)
    const members = await db.getAllMembers();
    const member = members.find(
      m => m.name.toLowerCase() === decodeURIComponent(identifier).toLowerCase()
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get active activity
    const activeActivity = await db.getActiveActivity();
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
      false
    );

    res.status(201).json({
      action: 'checked-in',
      member: member.name,
      checkIn,
    });
  } catch (error) {
    console.error('URL check-in error:', error);
    res.status(500).json({ error: 'Failed to process URL check-in' });
  }
});

export default router;
