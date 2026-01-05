/**
 * Reports Routes
 * 
 * Provides endpoints for generating various reports and analytics:
 * - Attendance summary (monthly participation)
 * - Member participation (top contributors)
 * - Activity breakdown (by category)
 * - Event statistics
 * - Truck check compliance
 * 
 * Multi-Station Support:
 * - All endpoints filter by stationId (from X-Station-Id header or query param)
 * - Reports can be filtered to single station or cross-station (admin feature)
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

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
 * Get monthly attendance statistics (filtered by station)
 * Query params: startDate, endDate (ISO date strings)
 */
router.get('/attendance-summary', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);
    
    const summary = await db.getAttendanceSummary(startDate, endDate, stationId);
    
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
 * Get top members by participation (filtered by station)
 * Query params: startDate, endDate, limit (default 10)
 */
router.get('/member-participation', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);
    const limit = parseInt(req.query.limit as string) || 10;
    
    const participation = await db.getMemberParticipation(startDate, endDate, limit, stationId);
    
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
 * Get activity breakdown by category (filtered by station)
 * Query params: startDate, endDate
 */
router.get('/activity-breakdown', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);
    
    const breakdown = await db.getActivityBreakdown(startDate, endDate, stationId);
    
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
 * Get event statistics (filtered by station)
 * Query params: startDate, endDate
 */
router.get('/event-statistics', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);
    
    const statistics = await db.getEventStatistics(startDate, endDate, stationId);
    
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
 * Get truck check compliance statistics (filtered by station)
 * Query params: startDate, endDate
 */
router.get('/truckcheck-compliance', async (req, res) => {
  try {
    const truckDb = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);
    
    const compliance = await truckDb.getTruckCheckCompliance(startDate, endDate, stationId);
    
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
