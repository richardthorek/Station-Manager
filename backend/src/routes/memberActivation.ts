/**
 * Public member activation routes (no auth required).
 * Mounted at /api/members BEFORE the requireSession middleware so these
 * endpoints are reachable without a session token.
 */

import { Router, Request, Response } from 'express';
import { ensureDatabase } from '../services/dbFactory';
import { ensureAdminUserDatabase } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { logger } from '../services/logger';
import { isValidEmail } from '../utils/emailValidation';

const router = Router();

// GET /api/members/activate/:token — validate token and return member name for the form
router.get('/activate/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' });
    }
    const db = await ensureDatabase(false);
    const member = await db.getMemberByInviteToken(token);
    if (!member) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }
    if (member.authStatus === 'active') {
      return res.status(409).json({ error: 'This invite has already been used' });
    }

    // Resolve org name: the invite's own org when recorded (multi-org safe),
    // falling back to the legacy first-org heuristic for pre-fix invites.
    let orgName: string | undefined;
    try {
      const orgDb = ensureOrganizationDatabase();
      if (member.inviteOrganizationId) {
        orgName = (await orgDb.getOrganizationById(member.inviteOrganizationId))?.name;
      }
      if (!orgName) {
        const orgs = await orgDb.getAllOrganizations();
        if (orgs.length > 0) orgName = orgs[0].name;
      }
    } catch {
      // non-fatal
    }

    res.json({ memberName: member.name, orgName, inviteEmail: member.inviteEmail });
  } catch (error) {
    logger.error('Error validating invite token', { error, token: req.params.token as string });
    res.status(500).json({ error: 'Failed to validate invite' });
  }
});

// POST /api/members/activate/:token — complete activation: create AdminUser + mark member active
router.post('/activate/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const { username, password, email } = (req.body as { username?: string; password?: string; email?: string }) ?? {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' });
    }
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    // Email is preferred but tolerated absent for legacy invite flows; when
    // supplied it must be valid. The invite's recorded email is the fallback.
    if (email !== undefined && !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const db = await ensureDatabase(false);
    const member = await db.getMemberByInviteToken(token);
    if (!member) {
      return res.status(404).json({ error: 'Invite not found or already used' });
    }
    if (member.authStatus === 'active') {
      return res.status(409).json({ error: 'This invite has already been used' });
    }

    // Resolve org for the new AdminUser: the invite's own org when recorded
    // (multi-org safe), falling back to the legacy first-org heuristic only
    // for invites generated before inviteOrganizationId existed.
    let organizationId: string | undefined = member.inviteOrganizationId;
    if (!organizationId) {
      try {
        const orgDb = ensureOrganizationDatabase();
        const orgs = await orgDb.getAllOrganizations();
        if (orgs.length > 0) organizationId = orgs[0].id;
      } catch {
        // non-fatal; viewer account created without org
      }
    }

    const adminDb = ensureAdminUserDatabase();
    const accountEmail = email ?? member.inviteEmail;
    const newUser = await adminDb.createAdminUser(
      username.trim(),
      password,
      'viewer',
      organizationId,
      accountEmail ? { email: accountEmail } : undefined,
    );

    // Membership row keeps the multi-org model authoritative.
    if (organizationId) {
      try {
        await ensureOrgAccessDatabase().createMembership({
          userId: newUser.id,
          organizationId,
          role: 'viewer',
        });
      } catch (membershipError) {
        logger.warn('Failed to create membership row for activated member', { error: membershipError });
      }
    }

    // Mark member as active and clear invite token
    await db.updateMemberAuth(member.id, {
      authStatus: 'active',
      inviteToken: null,
    });

    logger.info('Member activation completed', { memberId: member.id, username: username.trim() });
    res.json({ success: true, message: 'Account created. You can now log in.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Username already exists') {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    logger.error('Error activating member', { error, token: req.params.token as string });
    res.status(500).json({ error: 'Failed to activate account' });
  }
});

export default router;
