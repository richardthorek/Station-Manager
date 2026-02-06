/**
 * Member Management Routes
 * 
 * Handles CRUD operations for members including:
 * - Fetching all members
 * - Getting member by ID or QR code
 * - Creating new members with auto-generated QR codes
 * - Updating member information
 * - Deleting members
 * 
 * Multi-Station Support:
 * - All GET endpoints filter by stationId (from X-Station-Id header or query param)
 * - POST endpoints assign stationId to new members
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import {
  validateCreateMember,
  validateUpdateMember,
  validateMemberId,
  validateQRCode,
} from '../middleware/memberValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { logger } from '../services/logger';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

// Get all members (filtered by station)
router.get('/', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const members = await db.getAllMembers(stationId);
    res.json(members);
  } catch (error) {
    logger.error('Error fetching members', { 
      error, 
      stationId: getStationIdFromRequest(req),
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', validateMemberId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const member = await db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    logger.error('Error fetching member', { 
      error, 
      memberId: req.params.id,
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Get member by QR code
router.get('/qr/:qrCode', validateQRCode, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const member = await db.getMemberByQRCode(req.params.qrCode);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    logger.error('Error fetching member by QR code', { 
      error, 
      qrCode: req.params.qrCode,
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create new member (assigns station)
router.post('/', validateCreateMember, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { name, firstName, lastName, preferredName, rank } = req.body || {};
    const stationId = getStationIdFromRequest(req);

    const clean = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
    const fn = clean(firstName);
    const ln = clean(lastName);
    const pn = clean(preferredName);
    const nm = clean(name);

    const displayFirst = pn || fn || nm;
    const displayName = displayFirst ? `${displayFirst}${ln ? ` ${ln}` : ''}` : '';

    if (!displayName) {
      return res.status(400).json({ error: 'Valid name is required' });
    }

    const member = await db.createMember(displayName, {
      rank: clean(rank) || undefined,
      firstName: fn || undefined,
      lastName: ln || undefined,
      preferredName: pn || undefined,
      stationId,
    });
    res.status(201).json(member);
  } catch (error) {
    logger.error('Error creating member', { 
      error, 
      requestId: req.id,
      stationId: getStationIdFromRequest(req),
    });
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/:id', validateUpdateMember, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const { name, rank } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const member = await db.updateMember(req.params.id, name.trim(), rank || null);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    logger.error('Error updating member', { 
      error, 
      memberId: req.params.id,
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Get member check-in history (filtered by station if member belongs to current station)
router.get('/:id/history', validateMemberId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const member = await db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    // Check-ins are filtered by the member's station (member already filtered by getMemberById)
    const checkIns = await db.getCheckInsByMember(req.params.id);
    res.json(checkIns);
  } catch (error) {
    logger.error('Error fetching member history', { 
      error, 
      memberId: req.params.id,
      requestId: req.id,
    });
    res.status(500).json({ error: 'Failed to fetch member history' });
  }
});

export default router;
