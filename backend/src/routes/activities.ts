import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

// Get all activities
router.get('/', async (req, res) => {
  try {
    const activities = await db.getAllActivities();
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get active activity
router.get('/active', async (req, res) => {
  try {
    const activeActivity = await db.getActiveActivity();
    if (!activeActivity) {
      return res.status(404).json({ error: 'No active activity set' });
    }
    
    const activity = await db.getActivityById(activeActivity.activityId);
    res.json({
      ...activeActivity,
      activity,
    });
  } catch (error) {
    console.error('Error fetching active activity:', error);
    res.status(500).json({ error: 'Failed to fetch active activity' });
  }
});

// Set active activity
router.post('/active', async (req, res) => {
  try {
    const { activityId, setBy } = req.body;
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }

    const activity = await db.getActivityById(activityId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const activeActivity = await db.setActiveActivity(activityId, setBy);
    res.json({
      ...activeActivity,
      activity,
    });
  } catch (error) {
    console.error('Error setting active activity:', error);
    res.status(500).json({ error: 'Failed to set active activity' });
  }
});

// Create custom activity
router.post('/', async (req, res) => {
  try {
    const { name, createdBy } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const activity = await db.createActivity(name.trim(), createdBy);
    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

export default router;
