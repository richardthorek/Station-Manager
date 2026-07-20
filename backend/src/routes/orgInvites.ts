/**
 * Public org-invite routes — mounted at /api/org-invites.
 *
 * A shareable invite link (/invite/<token> in the SPA) lands here:
 * - GET  /:token          → public preview (org name, role, expiry)
 * - POST /:token/accept   → authenticated existing user joins the org
 * - POST /:token/signup   → new user creates an account directly into the org
 *
 * Invites are multi-use until expiry or revocation; each acceptance bumps
 * usageCount and records invitedBy/inviteId on the membership.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { sensitiveActionRateLimiter } from '../middleware/rateLimiter';
import { ensureOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { getAdminDb } from '../services/adminUserDbFactory';
import { signToken } from './auth';
import { logger } from '../services/logger';
import { isValidEmail } from '../utils/emailValidation';
import type { OrgInvite } from '../types';

const router = Router();

/** Load a usable invite or send the right error (404 unknown, 410 dead). */
async function loadUsableInvite(token: string, res: Response): Promise<OrgInvite | null> {
  const invite = await ensureOrgAccessDatabase().getInviteByToken(token);
  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return null;
  }
  if (invite.status !== 'active' || invite.expiresAt.getTime() < Date.now()) {
    res.status(410).json({ error: 'This invite has expired or been revoked' });
    return null;
  }
  return invite;
}

/** GET /api/org-invites/:token — public invite preview. */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const invite = await loadUsableInvite(req.params.token as string, res);
    if (!invite) return;
    const organization = await ensureOrganizationDatabase().getOrganizationById(invite.organizationId);
    if (!organization) {
      return res.status(410).json({ error: 'This invite has expired or been revoked' });
    }
    return res.json({
      organizationName: organization.name,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    logger.error('Error loading org invite', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/org-invites/:token/accept — existing (signed-in) user joins. */
router.post('/:token/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const invite = await loadUsableInvite(req.params.token as string, res);
    if (!invite) return;

    const orgAccessDb = ensureOrgAccessDatabase();
    const existing = await orgAccessDb.getMembership(req.user.userId, invite.organizationId);
    if (existing && existing.status === 'active') {
      return res.status(409).json({ error: 'You are already a member of this organisation' });
    }

    const membership = await orgAccessDb.createMembership({
      userId: req.user.userId,
      organizationId: invite.organizationId,
      role: invite.role,
      invitedBy: invite.createdBy,
      inviteId: invite.id,
    });
    await orgAccessDb.updateInvite(invite.id, { usageCount: invite.usageCount + 1 });

    const memberships = await orgAccessDb.getMembershipsByUser(req.user.userId);
    logger.info('Org invite accepted', { inviteId: invite.id, userId: req.user.userId, organizationId: invite.organizationId });
    return res.json({
      membership,
      memberships: memberships.filter((m) => m.status === 'active'),
    });
  } catch (error) {
    logger.error('Error accepting org invite', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/org-invites/:token/signup — new user account straight into the org. */
router.post('/:token/signup', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const invite = await loadUsableInvite(req.params.token as string, res);
    if (!invite) return;

    const { username, password, email } = req.body ?? {};
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const organization = await ensureOrganizationDatabase().getOrganizationById(invite.organizationId);
    if (!organization) {
      return res.status(410).json({ error: 'This invite has expired or been revoked' });
    }

    const adminDb = getAdminDb();
    const existing = await adminDb.getUserByUsername(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const user = await adminDb.createAdminUser(username.trim(), password, invite.role, invite.organizationId, { email });

    const orgAccessDb = ensureOrgAccessDatabase();
    try {
      await orgAccessDb.createMembership({
        userId: user.id,
        organizationId: invite.organizationId,
        role: invite.role,
        invitedBy: invite.createdBy,
        inviteId: invite.id,
      });
    } catch (membershipError) {
      logger.warn('Failed to create membership row for invite signup (legacy fallback applies)', {
        error: membershipError,
        userId: user.id,
      });
    }
    await orgAccessDb.updateInvite(invite.id, { usageCount: invite.usageCount + 1 });

    // Same response shape as POST /api/auth/signup so the frontend reuses the
    // post-signup flow.
    const token = signToken(user);

    logger.info('User signed up via org invite', { inviteId: invite.id, userId: user.id, organizationId: invite.organizationId });
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
        email: user.email,
      },
      organization,
    });
  } catch (error) {
    logger.error('Error signing up via org invite', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
