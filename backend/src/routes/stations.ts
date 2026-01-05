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

const router = Router();

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
    console.error('Error fetching stations:', error);
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
    console.error('Error fetching station:', error);
    res.status(500).json({ error: 'Failed to fetch station' });
  }
});

/**
 * GET /api/stations/brigade/:brigadeId
 * Get all stations in a brigade
 */
router.get('/brigade/:brigadeId', validateBrigadeId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stations = await db.getStationsByBrigade(req.params.brigadeId);
    
    // Sort by name
    stations.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(stations);
  } catch (error) {
    console.error('Error fetching stations by brigade:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

/**
 * POST /api/stations
 * Create a new station
 */
router.post('/', validateCreateStation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { name, brigadeId, brigadeName, hierarchy, location, contactInfo } = req.body;
    
    // Create the station
    const station = await db.createStation({
      name,
      brigadeId,
      brigadeName,
      hierarchy,
      location,
      contactInfo,
      isActive: true,
    });
    
    // Emit WebSocket event for real-time updates
    const io = (req as any).app.get('io');
    if (io) {
      io.emit('station-created', station);
    }
    
    res.status(201).json(station);
  } catch (error) {
    console.error('Error creating station:', error);
    res.status(500).json({ error: 'Failed to create station' });
  }
});

/**
 * PUT /api/stations/:id
 * Update a station
 */
router.put('/:id', validateUpdateStation, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { id } = req.params;
    const updates = req.body;
    
    // Check if station exists
    const existingStation = await db.getStationById(id);
    if (!existingStation) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    // Update the station
    const updatedStation = await db.updateStation(id, updates);
    
    if (!updatedStation) {
      return res.status(500).json({ error: 'Failed to update station' });
    }
    
    // Emit WebSocket event for real-time updates
    const io = (req as any).app.get('io');
    if (io) {
      io.emit('station-updated', updatedStation);
    }
    
    res.json(updatedStation);
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

/**
 * DELETE /api/stations/:id
 * Soft delete a station (set isActive=false)
 * Prevents deletion if station has members or data
 */
router.delete('/:id', validateStationId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { id } = req.params;
    
    // Check if station exists
    const station = await db.getStationById(id);
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    // Check if station has members
    const members = await db.getAllMembers(id);
    if (members.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete station with existing members',
        memberCount: members.length,
      });
    }
    
    // Check if station has active check-ins
    const activeCheckIns = await db.getActiveCheckIns(id);
    if (activeCheckIns.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete station with active check-ins',
        checkInCount: activeCheckIns.length,
      });
    }
    
    // Check if station has events
    const events = await db.getEvents(1, 0, id);
    if (events.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete station with existing events',
        message: 'Archive events first or transfer data to another station',
      });
    }
    
    // Perform soft delete
    const success = await db.deleteStation(id);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete station' });
    }
    
    // Emit WebSocket event for real-time updates
    const io = (req as any).app.get('io');
    if (io) {
      io.emit('station-deleted', { id, name: station.name });
    }
    
    res.json({ 
      success: true, 
      message: 'Station deactivated successfully',
      stationId: id,
    });
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

export default router;
