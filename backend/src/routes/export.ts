/**
 * Data Export Routes
 * 
 * Provides CSV export functionality for:
 * - Members
 * - Check-ins (with date range filtering)
 * - Events with participants (with date range filtering)
 * - Truck check results (with date range filtering)
 * 
 * Multi-Station Support:
 * - All exports filter by stationId (from X-Station-Id header or query param)
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import {
  exportMembersToCSV,
  exportCheckInsToCSV,
  exportEventsToCSV,
  exportTruckCheckResultsToCSV,
  applyDateRangeFilter,
} from '../services/csvExportService';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { logger } from '../services/logger';
import type { CheckInWithDetails } from '../types';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

/**
 * GET /api/export/members
 * Export all members to CSV
 */
router.get('/members', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const members = await db.getAllMembers(stationId);
    
    const csv = exportMembersToCSV(members);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="members-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting members', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to export members' });
  }
});

/**
 * GET /api/export/checkins
 * Export check-ins to CSV with optional date range filtering
 * Query params: startDate (ISO string), endDate (ISO string)
 */
router.get('/checkins', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const checkIns = await db.getAllCheckIns(stationId);
    
    // Parse date range from query params
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate format' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid endDate format' });
    }
    
    // Apply date range filter
    const filteredCheckIns = applyDateRangeFilter(
      checkIns,
      'checkInTime',
      startDate,
      endDate
    );
    
    // Get member and activity names for check-ins
    const members = await db.getAllMembers(stationId);
    const activities = await db.getAllActivities();
    
    const checkInsWithDetails: CheckInWithDetails[] = filteredCheckIns.map(checkIn => {
      const member = members.find(m => m.id === checkIn.memberId);
      const activity = activities.find(a => a.id === checkIn.activityId);
      return {
        ...checkIn,
        memberName: member?.name || 'Unknown',
        activityName: activity?.name || 'Unknown',
        activityTagColor: activity?.tagColor,
      };
    });
    
    const csv = exportCheckInsToCSV(checkInsWithDetails);
    
    // Set headers for file download
    const dateRangeStr = startDate || endDate 
      ? `-${startDate?.toISOString().split('T')[0] || 'all'}-to-${endDate?.toISOString().split('T')[0] || 'all'}`
      : '';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="checkins${dateRangeStr}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting check-ins', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to export check-ins' });
  }
});

/**
 * GET /api/export/events
 * Export events with participants to CSV with optional date range filtering
 * Query params: startDate (ISO string), endDate (ISO string)
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    
    // Parse date range from query params
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate format' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid endDate format' });
    }
    
    // Get all events with participants (paginated, but we'll get all)
    // We'll make multiple requests if needed
    let allEvents = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const events = await db.getEventsWithParticipants(limit, offset, stationId);
      allEvents.push(...events);
      hasMore = events.length === limit;
      offset += limit;
    }
    
    // Apply date range filter
    const filteredEvents = applyDateRangeFilter(
      allEvents,
      'startTime',
      startDate,
      endDate
    );
    
    const csv = exportEventsToCSV(filteredEvents);
    
    // Set headers for file download
    const dateRangeStr = startDate || endDate 
      ? `-${startDate?.toISOString().split('T')[0] || 'all'}-to-${endDate?.toISOString().split('T')[0] || 'all'}`
      : '';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="events${dateRangeStr}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting events', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to export events' });
  }
});

/**
 * GET /api/export/truckcheck-results
 * Export truck check results to CSV with optional date range filtering
 * Query params: startDate (ISO string), endDate (ISO string)
 */
router.get('/truckcheck-results', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    
    // Parse date range from query params
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate format' });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid endDate format' });
    }
    
    // Get all check runs (no pagination in current implementation)
    const checkRuns = await db.getAllCheckRuns(stationId);
    
    // Apply date range filter
    const filteredCheckRuns = applyDateRangeFilter(
      checkRuns,
      'startTime',
      startDate,
      endDate
    );
    
    // Get results for each check run
    const checkRunsWithResults = await Promise.all(
      filteredCheckRuns.map(async (run) => {
        const results = await db.getResultsByRunId(run.id);
        return {
          ...run,
          results,
        };
      })
    );
    
    const csv = exportTruckCheckResultsToCSV(checkRunsWithResults);
    
    // Set headers for file download
    const dateRangeStr = startDate || endDate 
      ? `-${startDate?.toISOString().split('T')[0] || 'all'}-to-${endDate?.toISOString().split('T')[0] || 'all'}`
      : '';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="truckcheck-results${dateRangeStr}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting truck check results', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to export truck check results' });
  }
});

export default router;
