import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

// Get all members
router.get('/', async (req, res) => {
  try {
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
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const member = await db.createMember(name.trim());
    res.status(201).json(member);
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

export default router;
