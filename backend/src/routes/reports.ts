/**
 * Reports Routes
 * 
 * Provides endpoints for generating various reports and analytics:
 * - Attendance summary (monthly participation)
 * - Member participation (top contributors)
 * - Activity breakdown (by category)
 * - Event statistics
 * - Truck check compliance
 */

import { Router } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';

const router = Router();

/**
 * Helper function to parse date range parameters
 */
function parseDateRange(req: any): { startDate: Date; endDate: Date } {
  const { startDate, endDate } = req.query;
  
  let start: Date;
  let end: Date = new Date(); // Default to now
  
  if (startDate && typeof startDate === 'string') {
    start = new Date(startDate);
  } else {
    // Default to 30 days ago
    start = new Date();
    start.setDate(start.getDate() - 30);
  }
  
  if (endDate && typeof endDate === 'string') {
    end = new Date(endDate);
  }
  
  return { startDate: start, endDate: end };
}

/**
 * GET /api/reports/attendance-summary
 * Get monthly attendance statistics
 * Query params: startDate, endDate (ISO date strings)
 */
router.get('/attendance-summary', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    
    const summary = db.getAttendanceSummary(startDate, endDate);
    
    res.json({
      startDate,
      endDate,
      summary,
    });
  } catch (error) {
    console.error('Error generating attendance summary:', error);
    res.status(500).json({ error: 'Failed to generate attendance summary' });
  }
});

/**
 * GET /api/reports/member-participation
 * Get top members by participation
 * Query params: startDate, endDate, limit (default 10)
 */
router.get('/member-participation', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    const limit = parseInt(req.query.limit as string) || 10;
    
    const participation = db.getMemberParticipation(startDate, endDate, limit);
    
    res.json({
      startDate,
      endDate,
      limit,
      participation,
    });
  } catch (error) {
    console.error('Error generating member participation:', error);
    res.status(500).json({ error: 'Failed to generate member participation' });
  }
});

/**
 * GET /api/reports/activity-breakdown
 * Get activity breakdown by category
 * Query params: startDate, endDate
 */
router.get('/activity-breakdown', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    
    const breakdown = db.getActivityBreakdown(startDate, endDate);
    
    res.json({
      startDate,
      endDate,
      breakdown,
    });
  } catch (error) {
    console.error('Error generating activity breakdown:', error);
    res.status(500).json({ error: 'Failed to generate activity breakdown' });
  }
});

/**
 * GET /api/reports/event-statistics
 * Get event statistics
 * Query params: startDate, endDate
 */
router.get('/event-statistics', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    
    const statistics = db.getEventStatistics(startDate, endDate);
    
    res.json({
      startDate,
      endDate,
      statistics,
    });
  } catch (error) {
    console.error('Error generating event statistics:', error);
    res.status(500).json({ error: 'Failed to generate event statistics' });
  }
});

/**
 * GET /api/reports/truckcheck-compliance
 * Get truck check compliance statistics
 * Query params: startDate, endDate
 */
router.get('/truckcheck-compliance', async (req, res) => {
  try {
    const truckDb = await ensureTruckChecksDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    
    const compliance = truckDb.getTruckCheckCompliance(startDate, endDate);
    
    res.json({
      startDate,
      endDate,
      compliance,
    });
  } catch (error) {
    console.error('Error generating truck check compliance:', error);
    res.status(500).json({ error: 'Failed to generate truck check compliance' });
  }
});

export default router;
