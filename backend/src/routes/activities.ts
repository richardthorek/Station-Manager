import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

// Get all activities
router.get('/', (req, res) => {
  try {
    const activities = db.getAllActivities();
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get active activity
router.get('/active', (req, res) => {
  try {
    const activeActivity = db.getActiveActivity();
    if (!activeActivity) {
      return res.status(404).json({ error: 'No active activity set' });
    }
    
    const activity = db.getActivityById(activeActivity.activityId);
    res.json({
      ...activeActivity,
      activity,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active activity' });
  }
});

// Set active activity
router.post('/active', (req, res) => {
  try {
    const { activityId, setBy } = req.body;
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }

    const activity = db.getActivityById(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activeActivity = db.setActiveActivity(activityId, setBy);
    res.json({
      ...activeActivity,
      activity,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set active activity' });
  }
});

// Create custom activity
router.post('/', (req, res) => {
  try {
    const { name, createdBy } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const activity = db.createActivity(name.trim(), createdBy);
    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

export default router;
