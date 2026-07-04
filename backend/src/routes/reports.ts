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
import { ensureVehicleTypeDatabase } from '../services/vehicleTypeDbFactory';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { logger } from '../services/logger';
import type { VehicleType } from '../types';

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
 * GET /api/reports/truckcheck-comparative
 * Compare truck check outcomes for the same vehicle type across stations,
 * grouped by the checklist's stable itemCode (TC-D1) so results line up even
 * when brigades word an item differently. Query params: stationIds
 * (comma-separated, required), startDate, endDate.
 */
router.get('/truckcheck-comparative', async (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const stationIdsParam = req.query.stationIds as string;

    if (!stationIdsParam) {
      return res.status(400).json({ error: 'stationIds parameter is required' });
    }

    const db = await ensureDatabase(req.isDemoMode);
    const truckDb = await ensureTruckChecksDatabase(req.isDemoMode);
    const vehicleTypeDb = ensureVehicleTypeDatabase();

    let stationIds = stationIdsParam.split(',').map(id => id.trim()).filter(Boolean);

    const allStations = await db.getAllStations();

    // When we have an authenticated org context, only ever compare the
    // caller's own stations — never let a client-supplied stationId reach
    // into another organization's data.
    if (req.organization) {
      const orgId = req.organization.id;
      const orgStationIds = new Set(allStations.filter(s => s.organizationId === orgId).map(s => s.id));
      stationIds = stationIds.filter(id => orgStationIds.has(id));
    }

    const stationNames = new Map(allStations.map(s => [s.id, s.name]));
    const vehicleTypeCache = new Map<string, VehicleType | null>();

    interface StationBucket {
      stationId: string;
      stationName: string;
      totalChecks: number;
      doneCount: number;
      issueCount: number;
      skippedCount: number;
    }
    interface ItemBucket {
      itemCode: string;
      itemName: string;
      stations: Map<string, StationBucket>;
    }
    const vehicleTypeBuckets = new Map<string, { vehicleTypeCode: string; vehicleTypeName: string; items: Map<string, ItemBucket> }>();

    for (const stationId of stationIds) {
      const runs = await truckDb.getCheckRunsByDateRange(startDate, endDate, stationId);

      for (const run of runs) {
        const appliance = await truckDb.getApplianceById(run.applianceId);
        if (!appliance) continue;

        let vehicleTypeCode: string;
        let vehicleTypeName: string;
        if (appliance.vehicleTypeId) {
          if (!vehicleTypeCache.has(appliance.vehicleTypeId)) {
            vehicleTypeCache.set(appliance.vehicleTypeId, await vehicleTypeDb.getById(appliance.vehicleTypeId));
          }
          const vt = vehicleTypeCache.get(appliance.vehicleTypeId);
          vehicleTypeCode = vt?.code ?? appliance.vehicleTypeId;
          vehicleTypeName = vt?.name ?? appliance.vehicleType ?? 'Unknown vehicle type';
        } else if (appliance.vehicleType) {
          // Legacy free-form slug — group on itself since there's no VehicleType record.
          vehicleTypeCode = appliance.vehicleType;
          vehicleTypeName = appliance.vehicleType;
        } else {
          continue; // No vehicle type to compare by — skip.
        }

        if (!vehicleTypeBuckets.has(vehicleTypeCode)) {
          vehicleTypeBuckets.set(vehicleTypeCode, { vehicleTypeCode, vehicleTypeName, items: new Map() });
        }
        const vtBucket = vehicleTypeBuckets.get(vehicleTypeCode)!;

        const results = await truckDb.getResultsByRunId(run.id);
        for (const result of results) {
          if (!result.itemCode) continue; // Back-compat: pre-itemCode results aren't comparable.

          if (!vtBucket.items.has(result.itemCode)) {
            vtBucket.items.set(result.itemCode, { itemCode: result.itemCode, itemName: result.itemName, stations: new Map() });
          }
          const itemBucket = vtBucket.items.get(result.itemCode)!;

          if (!itemBucket.stations.has(stationId)) {
            itemBucket.stations.set(stationId, {
              stationId,
              stationName: stationNames.get(stationId) ?? stationId,
              totalChecks: 0,
              doneCount: 0,
              issueCount: 0,
              skippedCount: 0,
            });
          }
          const stationBucket = itemBucket.stations.get(stationId)!;
          stationBucket.totalChecks += 1;
          if (result.status === 'done') stationBucket.doneCount += 1;
          else if (result.status === 'issue') stationBucket.issueCount += 1;
          else stationBucket.skippedCount += 1;
        }
      }
    }

    const vehicleTypes = Array.from(vehicleTypeBuckets.values())
      .map(vt => ({
        vehicleTypeCode: vt.vehicleTypeCode,
        vehicleTypeName: vt.vehicleTypeName,
        items: Array.from(vt.items.values()).map(item => ({
          itemCode: item.itemCode,
          itemName: item.itemName,
          stations: Array.from(item.stations.values()).map(s => ({
            ...s,
            passRate: s.doneCount + s.issueCount > 0
              ? Math.round((s.doneCount / (s.doneCount + s.issueCount)) * 100)
              : 100,
          })),
        })),
      }))
      // A vehicle type with only pre-itemCode (TC-D1) legacy results has no
      // comparable items — drop it rather than reporting an empty group.
      .filter(vt => vt.items.length > 0);

    res.json({
      startDate,
      endDate,
      stationIds,
      vehicleTypes,
    });
  } catch (error) {
    logger.error('Error generating truck check comparative report:', error);
    res.status(500).json({ error: 'Failed to generate truck check comparative report' });
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

/**
 * GET /api/reports/advanced/trend-analysis
 * Get trend analysis with month-over-month and year-over-year growth
 * Query params: startDate, endDate (ISO date strings)
 */
router.get('/advanced/trend-analysis', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);

    const trends = await db.getTrendAnalysis(startDate, endDate, stationId);

    res.json({
      startDate,
      endDate,
      trends,
    });
  } catch (error) {
    logger.error('Error generating trend analysis:', error);
    res.status(500).json({ error: 'Failed to generate trend analysis' });
  }
});

/**
 * GET /api/reports/advanced/heat-map
 * Get activity heat map showing patterns by day of week and hour
 * Query params: startDate, endDate (ISO date strings)
 */
router.get('/advanced/heat-map', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);

    const heatMap = await db.getActivityHeatMap(startDate, endDate, stationId);

    res.json({
      startDate,
      endDate,
      heatMap,
    });
  } catch (error) {
    logger.error('Error generating activity heat map:', error);
    res.status(500).json({ error: 'Failed to generate activity heat map' });
  }
});

/**
 * GET /api/reports/advanced/funnel
 * Get member funnel analysis showing conversion rates through stages
 * Query params: startDate, endDate (ISO date strings)
 */
router.get('/advanced/funnel', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);

    const funnel = await db.getMemberFunnel(startDate, endDate, stationId);

    res.json({
      startDate,
      endDate,
      funnel,
    });
  } catch (error) {
    logger.error('Error generating member funnel:', error);
    res.status(500).json({ error: 'Failed to generate member funnel' });
  }
});

/**
 * GET /api/reports/advanced/cohort
 * Get cohort analysis tracking member retention by registration month
 * Query params: startDate, endDate (ISO date strings)
 */
router.get('/advanced/cohort', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { startDate, endDate } = parseDateRange(req);

    const cohort = await db.getCohortAnalysis(startDate, endDate, stationId);

    res.json({
      startDate,
      endDate,
      cohort,
    });
  } catch (error) {
    logger.error('Error generating cohort analysis:', error);
    res.status(500).json({ error: 'Failed to generate cohort analysis' });
  }
});

export default router;
