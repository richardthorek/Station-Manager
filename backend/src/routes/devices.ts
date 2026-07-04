/**
 * Device Routes (AC-5)
 *
 * Manages first-class Device accounts — named, typed, revocable credentials
 * for brigade-locked kiosks/tablets/phones/wearables, formalising the
 * anonymous BrigadeAccessToken UUID (see docs/wiki/developer/history/archive/
 * SAAS_COMMERCIALIZATION_DESIGN.md §4). A device's token backs the same
 * `/signin?brigade=<token>` kiosk URL as before, so nothing about the kiosk
 * URL shape or the AccessRoute gate changes.
 *
 * - GET    /api/devices             → list the caller's org's devices (owner/admin)
 * - POST   /api/devices             → enroll a new device (owner/admin)
 * - PATCH  /api/devices/:id         → rename / revoke (owner/admin, own org only)
 * - DELETE /api/devices/:id         → remove a device (owner/admin, own org only)
 * - POST   /api/devices/validate    → public: resolve a device token (called by the device itself)
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validationHandler';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { attachOrganization } from '../middleware/entitlements';
import { ensureDeviceDatabase } from '../services/deviceDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { logger } from '../services/logger';
import type { DeviceType, DeviceStatus } from '../types';

const router = Router();

const DEVICE_TYPES: DeviceType[] = ['kiosk', 'tablet', 'phone', 'wearable'];
const DEVICE_STATUSES: DeviceStatus[] = ['active', 'revoked'];

// All device management requires an authenticated org admin.
const deviceAuth = [authMiddleware, attachOrganization, requireAdmin];

/**
 * GET /api/devices
 * List the caller's org's devices, optionally filtered to one station.
 */
router.get(
  '/',
  deviceAuth,
  [query('stationId').optional().trim().notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const db = ensureDeviceDatabase();
      const stationId = req.query.stationId as string | undefined;
      const devices = stationId
        ? (await db.listForStation(stationId)).filter((d) => d.organizationId === req.user?.organizationId)
        : await db.listForOrganization(req.user?.organizationId);
      res.json({ devices, count: devices.length });
    } catch (error) {
      logger.error('Error listing devices:', error);
      res.status(500).json({ error: 'Failed to list devices' });
    }
  }
);

/**
 * POST /api/devices
 * Enroll a new device for a station in the caller's org.
 */
router.post(
  '/',
  deviceAuth,
  [
    body('stationId').trim().notEmpty().withMessage('stationId is required'),
    body('type').isIn(DEVICE_TYPES).withMessage(`type must be one of: ${DEVICE_TYPES.join(', ')}`),
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 200 }),
    body('expiresInDays').optional().isInt({ min: 1, max: 3650 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { stationId, type, name, description, expiresInDays } = req.body;

      let expiresAt: Date | undefined;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      const device = await ensureDeviceDatabase().create({
        organizationId: req.user?.organizationId,
        stationId,
        type,
        name: name.trim(),
        description: typeof description === 'string' ? description : undefined,
        expiresAt,
      });

      res.status(201).json({
        device,
        kioskUrl: `${req.protocol}://${req.get('host')}/signin?brigade=${device.token}`,
      });
    } catch (error) {
      logger.error('Error creating device:', error);
      res.status(500).json({ error: 'Failed to create device' });
    }
  }
);

/**
 * PATCH /api/devices/:id
 * Rename or revoke a device your org owns.
 */
router.patch(
  '/:id',
  deviceAuth,
  [
    param('id').trim().notEmpty(),
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 200 }),
    body('status').optional().isIn(DEVICE_STATUSES),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const db = ensureDeviceDatabase();
      const existing = await db.getById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Device not found' });
      if (existing.organizationId && existing.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ error: 'You can only manage devices your organisation owns' });
      }

      const { name, description, status } = req.body ?? {};
      const updated = await db.update(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
      });
      res.json(updated);
    } catch (error) {
      logger.error('Error updating device:', error);
      res.status(500).json({ error: 'Failed to update device' });
    }
  }
);

/**
 * DELETE /api/devices/:id
 * Remove a device your org owns.
 */
router.delete(
  '/:id',
  deviceAuth,
  [param('id').trim().notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const db = ensureDeviceDatabase();
      const existing = await db.getById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Device not found' });
      if (existing.organizationId && existing.organizationId !== req.user?.organizationId) {
        return res.status(403).json({ error: 'You can only remove devices your organisation owns' });
      }
      await db.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting device:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  }
);

/**
 * POST /api/devices/validate
 * Public — resolve a device token to its station (called by the device
 * itself, e.g. a kiosk on load). Not gated by auth: the token IS the
 * credential. Updates the device's lastSeenAt audit trail on success.
 */
router.post(
  '/validate',
  [body('token').trim().notEmpty().isUUID().withMessage('token must be a valid UUID')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const device = await ensureDeviceDatabase().getByToken(token);
      if (!device) {
        return res.status(404).json({ valid: false, error: 'Token not found or expired' });
      }

      await ensureDeviceDatabase().touchLastSeen(device.id);
      const mainDb = await ensureDatabase();
      const station = await mainDb.getStationById(device.stationId);

      res.json({
        valid: true,
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        stationId: device.stationId,
        brigadeId: station?.brigadeId,
        description: device.description,
        createdAt: device.createdAt,
        expiresAt: device.expiresAt,
      });
    } catch (error) {
      logger.error('Error validating device token:', error);
      res.status(500).json({ error: 'Failed to validate device token' });
    }
  }
);

export default router;
