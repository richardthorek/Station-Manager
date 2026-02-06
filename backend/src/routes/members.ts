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
import multer from 'multer';
import Papa from 'papaparse';
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

// Configure multer for CSV upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Apply station middleware to all routes
router.use(stationMiddleware);

// Get all members (filtered by station with search, filter, and sort)
router.get('/', async (req, res) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    
    // Extract query parameters
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const filter = typeof req.query.filter === 'string' ? req.query.filter : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
    
    const members = await db.getAllMembers(stationId, { search, filter, sort });
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

// Bulk import members from CSV
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const stationId = getStationIdFromRequest(req);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse CSV
    const csvText = req.file.buffer.toString('utf-8');
    const parseResult = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'CSV parsing failed',
        details: parseResult.errors,
      });
    }

    const db = await ensureDatabase(req.isDemoMode);
    const existingMembers = await db.getAllMembers(stationId);
    const existingNames = new Set(existingMembers.map(m => m.name.toLowerCase()));

    interface ValidationResult {
      row: number;
      data: {
        firstName?: string;
        lastName?: string;
        name: string;
        rank?: string;
        roles?: string;
      };
      isValid: boolean;
      isDuplicate: boolean;
      errors: string[];
    }

    const validationResults: ValidationResult[] = parseResult.data.map((row, index) => {
      const errors: string[] = [];
      const clean = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
      
      // Handle both "First Name"/"Last Name" and "name" columns
      const firstName = clean(row['First Name'] || row['firstName'] || '');
      const lastName = clean(row['Last Name'] || row['lastName'] || '');
      const directName = clean(row['name'] || row['Name'] || '');
      const rank = clean(row['Rank'] || row['rank'] || '');
      const roles = clean(row['Roles'] || row['roles'] || '');

      // Construct the full name
      let name = '';
      if (firstName || lastName) {
        name = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
      } else if (directName) {
        name = directName;
      }

      // Validation
      if (!name) {
        errors.push('Name is required (either First Name + Last Name or Name column)');
      }

      const isDuplicate = name ? existingNames.has(name.toLowerCase()) : false;
      if (isDuplicate) {
        errors.push('Duplicate member name');
      }

      return {
        row: index + 2, // +2 because: +1 for 1-indexed, +1 for header row
        data: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          name,
          rank: rank || undefined,
          roles: roles || undefined,
        },
        isValid: errors.length === 0,
        isDuplicate,
        errors,
      };
    });

    // Filter valid members for import
    const validMembers = validationResults.filter(r => r.isValid && !r.isDuplicate);
    const invalidCount = validationResults.filter(r => !r.isValid).length;
    const duplicateCount = validationResults.filter(r => r.isDuplicate && r.isValid).length;

    // Return validation results for preview
    res.json({
      totalRows: validationResults.length,
      validCount: validMembers.length,
      invalidCount,
      duplicateCount,
      validationResults,
    });
  } catch (error) {
    logger.error('Error importing members', { 
      error, 
      requestId: req.id,
      stationId: getStationIdFromRequest(req),
    });
    res.status(500).json({ error: 'Failed to import members' });
  }
});

// Execute bulk import (after validation/preview)
router.post('/import/execute', async (req: Request, res: Response) => {
  try {
    const db = await ensureDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'No members provided for import' });
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    // Import members one by one
    for (const memberData of members) {
      try {
        const { firstName, lastName, name, rank } = memberData;
        
        const member = await db.createMember(name, {
          rank: rank || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          stationId,
        });

        results.successful.push({
          name: member.name,
          id: member.id,
          qrCode: member.qrCode,
        });
      } catch (error) {
        results.failed.push({
          name: memberData.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      totalAttempted: members.length,
      successCount: results.successful.length,
      failureCount: results.failed.length,
      successful: results.successful,
      failed: results.failed,
    });
  } catch (error) {
    logger.error('Error executing bulk import', { 
      error, 
      requestId: req.id,
      stationId: getStationIdFromRequest(req),
    });
    res.status(500).json({ error: 'Failed to execute bulk import' });
  }
});

export default router;
