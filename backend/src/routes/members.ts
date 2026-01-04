/**
 * Member Management Routes
 * 
 * Handles CRUD operations for members including:
 * - Fetching all members
 * - Getting member by ID or QR code
 * - Creating new members with auto-generated QR codes
 * - Updating member information
 * - Deleting members
 */

import { Router } from 'express';
import { ensureDatabase } from '../services/dbFactory';

const router = Router();

// Get all members
router.get('/', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const members = await db.getAllMembers();
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const member = await db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Get member by QR code
router.get('/qr/:qrCode', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const member = await db.getMemberByQRCode(req.params.qrCode);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    console.error('Error fetching member by QR code:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create new member
router.post('/', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const { name, firstName, lastName, preferredName, rank } = req.body || {};

    const clean = (val: any) => (typeof val === 'string' ? val.trim() : '');
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
    });
    res.status(201).json(member);
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/:id', async (req, res) => {
  try {
    const db = await ensureDatabase();
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
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Get member check-in history
router.get('/:id/history', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const member = await db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const checkIns = await db.getCheckInsByMember(req.params.id);
    res.json(checkIns);
  } catch (error) {
    console.error('Error fetching member history:', error);
    res.status(500).json({ error: 'Failed to fetch member history' });
  }
});

export default router;
