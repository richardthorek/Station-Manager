import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

// Get all active check-ins
router.get('/active', (req, res) => {
  try {
    const checkIns = db.getActiveCheckIns();
    res.json(checkIns);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active check-ins' });
  }
});

// Check in a member
router.post('/', (req, res) => {
  try {
    const { memberId, activityId, method, location, isOffsite } = req.body;

    // Validate required fields
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    // Check if member exists
    const member = db.getMemberById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Use active activity if no activity specified
    let finalActivityId = activityId;
    if (!finalActivityId) {
      const activeActivity = db.getActiveActivity();
      if (!activeActivity) {
        return res.status(400).json({ error: 'No active activity set' });
      }
      finalActivityId = activeActivity.activityId;
    }

    // Check if activity exists
    const activity = db.getActivityById(finalActivityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if member is already checked in
    const existingCheckIn = db.getCheckInByMember(memberId);
    if (existingCheckIn) {
      // Undo the check-in
      db.deactivateCheckIn(existingCheckIn.id);
      return res.json({ 
        action: 'undone',
        checkIn: existingCheckIn,
      });
    }

    // Create new check-in
    const checkIn = db.createCheckIn(
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
router.delete('/:memberId', (req, res) => {
  try {
    const { memberId } = req.params;
    const success = db.deactivateCheckInByMember(memberId);
    
    if (!success) {
      return res.status(404).json({ error: 'No active check-in found for member' });
    }

    res.json({ message: 'Check-in undone successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to undo check-in' });
  }
});

export default router;
