import { Router } from 'express';
import { db } from '../services/database';

const router = Router();

// Get all members
router.get('/', (req, res) => {
  try {
    const members = db.getAllMembers();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', (req, res) => {
  try {
    const member = db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Get member by QR code
router.get('/qr/:qrCode', (req, res) => {
  try {
    const member = db.getMemberByQRCode(req.params.qrCode);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create new member
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Valid name is required' });
    }
    const member = db.createMember(name.trim());
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create member' });
  }
});

export default router;
