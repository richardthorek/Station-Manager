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
import { logger } from '../services/logger';

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
    logger.error('Error generating attendance summary:', error);
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
    logger.error('Error generating member participation:', error);
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
    logger.error('Error generating activity breakdown:', error);
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
    logger.error('Error generating event statistics:', error);
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
    logger.error('Error generating truck check compliance:', error);
    res.status(500).json({ error: 'Failed to generate truck check compliance' });
  }
});

/**
 * GET /api/reports/cross-station/attendance-summary
 * Get monthly attendance statistics across multiple stations
 * Query params: stationIds (comma-separated), startDate, endDate (ISO date strings)
 */
router.get('/cross-station/attendance-summary', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    const stationIdsParam = req.query.stationIds as string;
    
    if (!stationIdsParam) {
      return res.status(400).json({ error: 'stationIds parameter is required' });
    }
    
    const stationIds = stationIdsParam.split(',').map(id => id.trim());
    
    // Get summary for each station
    const summaries: Record<string, Array<{ month: string; count: number }>> = {};
    for (const stationId of stationIds) {
      summaries[stationId] = await db.getAttendanceSummary(startDate, endDate, stationId);
    }
    
    res.json({
      startDate,
      endDate,
      stationIds,
      summaries,
    });
  } catch (error) {
    logger.error('Error generating cross-station attendance summary:', error);
    res.status(500).json({ error: 'Failed to generate cross-station attendance summary' });
  }
});

/**
 * GET /api/reports/cross-station/member-participation
 * Get top members by participation across multiple stations
 * Query params: stationIds (comma-separated), startDate, endDate, limit (default 10)
 */
router.get('/cross-station/member-participation', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    const stationIdsParam = req.query.stationIds as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!stationIdsParam) {
      return res.status(400).json({ error: 'stationIds parameter is required' });
    }
    
    const stationIds = stationIdsParam.split(',').map(id => id.trim());
    
    // Get participation for each station
    const participation: Record<string, Array<{
      memberId: string;
      memberName: string;
      participationCount: number;
      lastCheckIn: string;
    }>> = {};
    
    for (const stationId of stationIds) {
      participation[stationId] = await db.getMemberParticipation(startDate, endDate, limit, stationId);
    }
    
    res.json({
      startDate,
      endDate,
      stationIds,
      limit,
      participation,
    });
  } catch (error) {
    logger.error('Error generating cross-station member participation:', error);
    res.status(500).json({ error: 'Failed to generate cross-station member participation' });
  }
});

/**
 * GET /api/reports/cross-station/activity-breakdown
 * Get activity breakdown across multiple stations
 * Query params: stationIds (comma-separated), startDate, endDate
 */
router.get('/cross-station/activity-breakdown', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    const stationIdsParam = req.query.stationIds as string;
    
    if (!stationIdsParam) {
      return res.status(400).json({ error: 'stationIds parameter is required' });
    }
    
    const stationIds = stationIdsParam.split(',').map(id => id.trim());
    
    // Get breakdown for each station
    const breakdowns: Record<string, Array<{
      category: string;
      count: number;
      percentage: number;
    }>> = {};
    
    for (const stationId of stationIds) {
      breakdowns[stationId] = await db.getActivityBreakdown(startDate, endDate, stationId);
    }
    
    res.json({
      startDate,
      endDate,
      stationIds,
      breakdowns,
    });
  } catch (error) {
    logger.error('Error generating cross-station activity breakdown:', error);
    res.status(500).json({ error: 'Failed to generate cross-station activity breakdown' });
  }
});

/**
 * GET /api/reports/cross-station/event-statistics
 * Get event statistics across multiple stations
 * Query params: stationIds (comma-separated), startDate, endDate
 */
router.get('/cross-station/event-statistics', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    const stationIdsParam = req.query.stationIds as string;
    
    if (!stationIdsParam) {
      return res.status(400).json({ error: 'stationIds parameter is required' });
    }
    
    const stationIds = stationIdsParam.split(',').map(id => id.trim());
    
    // Get statistics for each station
    const statistics: Record<string, {
      totalEvents: number;
      activeEvents: number;
      completedEvents: number;
      totalParticipants: number;
      averageParticipantsPerEvent: number;
      averageDuration: number;
    }> = {};
    
    for (const stationId of stationIds) {
      statistics[stationId] = await db.getEventStatistics(startDate, endDate, stationId);
    }
    
    res.json({
      startDate,
      endDate,
      stationIds,
      statistics,
    });
  } catch (error) {
    logger.error('Error generating cross-station event statistics:', error);
    res.status(500).json({ error: 'Failed to generate cross-station event statistics' });
  }
});

/**
 * GET /api/reports/brigade-summary
 * Get aggregated summary for all stations in a brigade
 * Query params: brigadeId, startDate, endDate
 */
router.get('/brigade-summary', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { startDate, endDate } = parseDateRange(req);
    const brigadeId = req.query.brigadeId as string;
    
    if (!brigadeId) {
      return res.status(400).json({ error: 'brigadeId parameter is required' });
    }
    
    // Get all stations in the brigade
    const allStations = await db.getAllStations();
    const brigadeStations = allStations.filter(s => s.brigadeId === brigadeId);
    const stationIds = brigadeStations.map(s => s.id);
    
    if (stationIds.length === 0) {
      return res.json({
        brigadeId,
        stations: [],
        summary: {
          totalEvents: 0,
          totalParticipants: 0,
          totalStations: 0,
        },
      });
    }
    
    // Aggregate statistics across all brigade stations
    let totalEvents = 0;
    let totalParticipants = 0;
    let totalCompletedEvents = 0;
    
    for (const stationId of stationIds) {
      const stats = await db.getEventStatistics(startDate, endDate, stationId);
      totalEvents += stats.totalEvents;
      totalParticipants += stats.totalParticipants;
      totalCompletedEvents += stats.completedEvents;
    }
    
    res.json({
      startDate,
      endDate,
      brigadeId,
      stations: brigadeStations.map(s => ({ id: s.id, name: s.name })),
      summary: {
        totalEvents,
        totalParticipants,
        totalCompletedEvents,
        totalStations: stationIds.length,
        averageEventsPerStation: stationIds.length > 0 ? Math.round((totalEvents / stationIds.length) * 10) / 10 : 0,
        averageParticipantsPerStation: stationIds.length > 0 ? Math.round((totalParticipants / stationIds.length) * 10) / 10 : 0,
      },
    });
  } catch (error) {
    logger.error('Error generating brigade summary:', error);
    res.status(500).json({ error: 'Failed to generate brigade summary' });
  }
});

export default router;
