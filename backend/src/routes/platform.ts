/**
 * Platform administration routes — mounted at /api/platform, gated by the
 * PLATFORM_ADMIN_USERNAMES allowlist (middleware/platformAdmin.ts).
 *
 * Currently: facility claim-conflict review. When a signup is blocked because
 * a facility is already claimed, a ClaimConflict row is written; the platform
 * admin reviews it here and can dismiss it, mark the parties contacted, or
 * reassign the facility link to a different organization.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/platformAdmin';
import { ensureOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { logger } from '../services/logger';
import type { ClaimConflict } from '../types';

const router = Router();

router.use(authMiddleware, requirePlatformAdmin);

/** GET /api/platform/claim-conflicts?status=open|resolved */
router.get('/claim-conflicts', async (req: Request, res: Response) => {
  try {
    const statusRaw = req.query.status;
    let status: ClaimConflict['status'] | undefined;
    if (statusRaw !== undefined) {
      if (statusRaw !== 'open' && statusRaw !== 'resolved') {
        return res.status(400).json({ error: 'status must be open or resolved' });
      }
      status = statusRaw;
    }

    const conflicts = await ensureOrgAccessDatabase().getClaimConflicts(status);
    const orgDb = ensureOrganizationDatabase();
    const enriched = await Promise.all(
      conflicts.map(async (conflict) => {
        const org = await orgDb.getOrganizationById(conflict.existingOrganizationId);
        return {
          ...conflict,
          existingOrganization: org
            ? { id: org.id, name: org.name, slug: org.slug, billingEmail: org.billingEmail }
            : null,
        };
      }),
    );
    enriched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return res.json({ conflicts: enriched });
  } catch (error) {
    logger.error('Error listing claim conflicts', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/platform/claim-conflicts/:id/resolve
 * Body: { resolution: 'dismissed'|'contacted'|'reassigned', notes?, reassignToOrganizationId? }
 * 'reassigned' moves the facility link from the current holder (which becomes
 * a custom/unlinked org, keeping its name) to the target organization.
 */
router.post('/claim-conflicts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolution, notes, reassignToOrganizationId } = req.body ?? {};
    if (resolution !== 'dismissed' && resolution !== 'contacted' && resolution !== 'reassigned') {
      return res.status(400).json({ error: 'resolution must be dismissed, contacted or reassigned' });
    }

    const orgAccessDb = ensureOrgAccessDatabase();
    const conflicts = await orgAccessDb.getClaimConflicts();
    const conflict = conflicts.find((c) => c.id === req.params.id);
    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }
    if (conflict.status === 'resolved') {
      return res.status(409).json({ error: 'Conflict already resolved' });
    }

    if (resolution === 'reassigned') {
      if (typeof reassignToOrganizationId !== 'string' || !reassignToOrganizationId.trim()) {
        return res.status(400).json({ error: 'reassignToOrganizationId is required for reassignment' });
      }
      const orgDb = ensureOrganizationDatabase();
      const target = await orgDb.getOrganizationById(reassignToOrganizationId);
      if (!target) {
        return res.status(404).json({ error: 'Reassignment target organization not found' });
      }
      const holder = await orgDb.getOrganizationById(conflict.existingOrganizationId);
      if (holder && holder.facilityKey === conflict.facilityKey) {
        // Current holder keeps its name but loses the dataset link.
        await orgDb.updateOrganization(holder.id, {
          facilityKey: undefined,
          facilityObjectId: undefined,
          facilityCustom: true,
          claimedAt: undefined,
          claimedByUserId: undefined,
        });
      }
      const [serviceType, objectid] = conflict.facilityKey.split(':');
      await orgDb.updateOrganization(target.id, {
        facilityKey: conflict.facilityKey,
        facilityObjectId: objectid,
        facilityServiceType: serviceType as import('../types').FacilityServiceType,
        facilityName: conflict.facilityName,
        facilityCustom: false,
        claimedAt: new Date(),
      });
      logger.info('Facility claim reassigned', {
        conflictId: conflict.id,
        facilityKey: conflict.facilityKey,
        from: conflict.existingOrganizationId,
        to: target.id,
      });
    }

    const updated = await orgAccessDb.updateClaimConflict(conflict.id, {
      status: 'resolved',
      resolution,
      resolutionNotes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
      resolvedBy: req.user?.username,
      resolvedAt: new Date(),
    });

    logger.info('Claim conflict resolved', { conflictId: conflict.id, resolution });
    return res.json({ conflict: updated });
  } catch (error) {
    logger.error('Error resolving claim conflict', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
