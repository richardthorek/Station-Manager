/**
 * Station Management Routes
 * 
 * Handles CRUD operations for stations including:
 * - Fetching all stations with optional filtering
 * - Getting station by ID
 * - Creating new stations
 * - Updating station information
 * - Soft deleting stations
 * - Getting stations by brigade
 * - National dataset lookup (RFS facilities)
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import {
  validateCreateStation,
  validateUpdateStation,
  validateStationId,
  validateBrigadeId,
  validateStationQuery,
} from '../middleware/stationValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { getRFSFacilitiesParser } from '../services/rfsFacilitiesParser';
import { logger } from '../services/logger';

const router = Router();

/**
 * GET /api/stations/lookup
 * Search and locate fire service stations from national dataset
 * Supports all Australian states and territories
 * Query params:
 *   - q: search query (station name, suburb, brigade)
 *   - lat: user latitude (for geolocation sorting)
 *   - lon: user longitude (for geolocation sorting)
 *   - limit: max results per category (default 10, max 50)
 * 
 * Note: This endpoint must be defined before /:id route to avoid conflicts
 */
router.get('/lookup', async (req, res) => {
  try {
    const query = req.query.q as string | undefined;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const parser = getRFSFacilitiesParser();
    
    // Ensure data is loaded
    await parser.loadData();

    // Check if CSV data is available
    if (!parser.isDataAvailable()) {
      return res.status(503).json({
        error: 'Station lookup service unavailable',
        message: 'RFS facilities CSV data is not available. Please contact the administrator.'
      });
    }

    // Validate that at least one parameter is provided
    if (!query && (lat === undefined || lon === undefined)) {
      return res.status(400).json({
        error: 'At least one of query (q) or location (lat, lon) must be provided'
      });
    }

    // Perform lookup
    const results = parser.lookup(query, lat, lon, limit);

    res.json({
      results,
      count: results.length,
      query,
      location: lat !== undefined && lon !== undefined ? { lat, lon } : undefined
    });
  } catch (error) {
    logger.error('Error in station lookup:', error);
    res.status(500).json({
      error: 'Failed to lookup stations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/stations/count
 * Get count of loaded fire service stations nationally (for debugging/monitoring)
 * 
 * Note: This endpoint must be defined before /:id route to avoid conflicts
 */
router.get('/count', async (req, res) => {
  try {
    const parser = getRFSFacilitiesParser();
    await parser.loadData();
    
    if (!parser.isDataAvailable()) {
      return res.json({
        count: 0,
        available: false,
        message: 'RFS facilities CSV data is not available'
      });
    }
    
    res.json({
      count: parser.getCount(),
      available: true
    });
  } catch (error) {
    logger.error('Error getting station count:', error);
    res.status(500).json({
      error: 'Failed to get station count',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/stations/check-brigade/:brigadeId
 * Check if a station with this brigade ID already exists
 * Returns the existing station if found, or a 404 if not found
 */
router.get('/check-brigade/:brigadeId', validateBrigadeId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stations = await db.getStationsByBrigade(req.params.brigadeId);
    
    // Only consider active stations
    const activeStations = stations.filter(s => s.isActive);
    
    if (activeStations.length > 0) {
      // Station exists
      res.json({ 
        exists: true, 
        station: activeStations[0],
        message: `Station "${activeStations[0].name}" already exists with this brigade ID`,
      });
    } else {
      // Station doesn't exist
      res.status(404).json({ 
        exists: false,
        message: 'No active station found with this brigade ID',
      });
    }
  } catch (error) {
    logger.error('Error checking brigade ID:', error);
    res.status(500).json({ error: 'Failed to check brigade ID' });
  }
});

/**
 * GET /api/stations/brigade/:brigadeId
 * Get all stations in a specific brigade
 */
router.get('/brigade/:brigadeId', validateBrigadeId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stations = await db.getStationsByBrigade(req.params.brigadeId);
    
    // Sort by name
    stations.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({ stations, count: stations.length });
  } catch (error) {
    logger.error('Error fetching stations by brigade:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

/**
 * GET /api/stations
 * Get all stations with optional filtering and pagination
 * Query params: brigadeId, area, district, limit, offset
 */
router.get('/', validateStationQuery, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    let stations = await db.getAllStations();
    
    // Apply filters
    const { brigadeId, area, district, limit, offset } = req.query;
    
    if (brigadeId) {
      stations = stations.filter(s => s.brigadeId === brigadeId);
    }
    
    if (area) {
      stations = stations.filter(s => s.hierarchy.area === area);
    }
    
    if (district) {
      stations = stations.filter(s => s.hierarchy.district === district);
    }
    
    // Sort by name
    stations.sort((a, b) => a.name.localeCompare(b.name));
    
    // Apply pagination
    const totalCount = stations.length;
    const limitNum = limit ? parseInt(limit as string) : undefined;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    
    if (limitNum !== undefined) {
      stations = stations.slice(offsetNum, offsetNum + limitNum);
    }
    
    res.json({
      stations,
      pagination: {
        total: totalCount,
        limit: limitNum || totalCount,
        offset: offsetNum,
      },
    });
  } catch (error) {
    logger.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

/**
 * GET /api/stations/:id
 * Get a single station by ID
 */
router.get('/:id', validateStationId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const station = await db.getStationById(req.params.id);
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    res.json(station);
  } catch (error) {
    logger.error('Error fetching station:', error);
    res.status(500).json({ error: 'Failed to fetch station' });
  }
});

/**
 * POST /api/stations
 * Create a new station
 * Validates that brigade ID is unique to prevent duplicate station creation
 */
router.post('/', validateCreateStation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const {
      name,
      brigadeName,
      brigadeId,
      hierarchy,
      location,
      contactInfo,
    } = req.body;
    
    // Check for duplicate brigade ID
    const existingStations = await db.getStationsByBrigade(brigadeId);
    const activeExistingStations = existingStations.filter(s => s.isActive);
    
    if (activeExistingStations.length > 0) {
      return res.status(409).json({ 
        error: 'Station already exists',
        message: `A station with brigade ID "${brigadeId}" already exists: ${activeExistingStations[0].name}`,
        existingStation: activeExistingStations[0],
      });
    }
    
    const newStation = await db.createStation({
      name,
      brigadeName,
      brigadeId,
      hierarchy,
      location,
      contactInfo,
      isActive: true,
    });
    
    // Emit WebSocket event - brigade-scoped
    const io = req.app.get('io');
    if (io && newStation.brigadeId) {
      io.to(`brigade-${newStation.brigadeId}`).emit('station-created', newStation);
    }
    
    res.status(201).json(newStation);
  } catch (error) {
    logger.error('Error creating station:', error);
    res.status(500).json({ error: 'Failed to create station' });
  }
});

/**
 * PUT /api/stations/:id
 * Update a station
 */
router.put('/:id', validateStationId, validateUpdateStation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { id } = req.params;
    
    const updates = {
      name: req.body.name,
      brigadeName: req.body.brigadeName,
      brigadeId: req.body.brigadeId,
      hierarchy: req.body.hierarchy,
      location: req.body.location,
      contactInfo: req.body.contactInfo,
      isActive: req.body.isActive,
    };
    
    // Remove undefined values
    Object.keys(updates).forEach(key => 
      updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]
    );
    
    const updatedStation = await db.updateStation(id, updates);
    
    if (!updatedStation) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    // Emit WebSocket event - brigade-scoped
    const io = req.app.get('io');
    if (io && updatedStation.brigadeId) {
      io.to(`brigade-${updatedStation.brigadeId}`).emit('station-updated', updatedStation);
    }
    
    res.json(updatedStation);
  } catch (error) {
    logger.error('Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

/**
 * DELETE /api/stations/:id
 * Soft delete a station (sets isActive to false)
 * Cannot delete if station has members, events, or other data
 */
router.delete('/:id', validateStationId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { id } = req.params;
    
    // Check if station has any data
    const members = await db.getAllMembers(id);
    const events = await db.getEvents(undefined, undefined, id);
    
    if (members.length > 0 || events.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete station with existing data',
        details: {
          memberCount: members.length,
          eventCount: events.length,
        },
      });
    }
    
    const success = await db.deleteStation(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.emit('station-deleted', { stationId: id });
    }
    
    res.json({ 
      success: true, 
      message: 'Station deactivated successfully',
      stationId: id,
    });
  } catch (error) {
    logger.error('Error deleting station:', error);
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

/**
 * POST /api/stations/demo/reset
 * Reset the demo station with fresh sample data
 * 
 * This endpoint:
 * 1. Deletes all demo station data (members, events, check-ins, appliances, etc.)
 * 2. Recreates the demo station
 * 3. Seeds with fresh sample data
 * 
 * Note: This route must be defined before /:id to avoid conflicts
 */
router.post('/demo/reset', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const truckChecksDb = await (await import('../services/truckChecksDbFactory')).ensureTruckChecksDatabase(req.isDemoMode);
    const { DEMO_STATION_ID } = await import('../constants/stations');
    
    logger.info('Resetting demo station');
    
    // Step 1: Delete all demo station data
    logger.info('Deleting demo station data');
    
    // Delete check-ins
    const checkIns = await db.getAllCheckIns(DEMO_STATION_ID);
    for (const checkIn of checkIns) {
      if (checkIn.isActive) {
        await db.deactivateCheckIn(checkIn.id);
      }
    }
    
    // Delete event participants and events
    const events = await db.getEvents(1000, 0, DEMO_STATION_ID);
    for (const event of events) {
      const participants = await db.getEventParticipants(event.id);
      for (const participant of participants) {
        await db.removeEventParticipant(participant.id, event.id);
      }
      await db.deleteEvent(event.id);
    }
    
    // Delete truck check results and runs
    const checkRuns = await truckChecksDb.getAllCheckRuns(DEMO_STATION_ID);
    for (const run of checkRuns) {
      const results = await truckChecksDb.getResultsByRunId(run.id);
      for (const result of results) {
        await truckChecksDb.deleteCheckResult(result.id);
      }
    }
    
    // Delete appliances (templates are auto-deleted)
    const appliances = await truckChecksDb.getAllAppliances(DEMO_STATION_ID);
    for (const appliance of appliances) {
      await truckChecksDb.deleteAppliance(appliance.id);
    }
    
    logger.info('Demo station data deleted');
    
    // Step 2: Reseed demo station
    logger.info('Reseeding demo station');
    const { seedDemoStation } = await import('../scripts/seedDemoStation');
    await seedDemoStation();
    
    logger.info('Demo station reset complete');
    
    // Emit WebSocket event to notify clients - station-scoped for demo
    const io = req.app.get('io');
    if (io) {
      io.to(`station-${DEMO_STATION_ID}`).emit('demo-station-reset', { 
        stationId: DEMO_STATION_ID,
        resetAt: new Date(),
      });
    }
    
    res.json({
      success: true,
      message: 'Demo station reset successfully',
      stationId: DEMO_STATION_ID,
      resetAt: new Date(),
    });
  } catch (error) {
    logger.error('Error resetting demo station:', error);
    res.status(500).json({ 
      error: 'Failed to reset demo station',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
