/**
 * Organization (SaaS tenant) management routes.
 *
 * - GET  /api/organizations/current        → org + plan + entitlements (any member)
 * - PUT  /api/organizations/current        → update name/email/plan/module toggles (owner)
 * - GET  /api/organizations/current/users  → list users in the org (admin/owner)
 * - POST /api/organizations/current/users  → invite/create a user (admin/owner)
 *
 * Plan changes here set entitlements from the plan defaults; Stripe billing
 * (which would drive plan changes via webhooks) is a follow-up. Owners may
 * narrow module toggles (e.g. hide the sign-in book for a maintenance-only
 * brigade) but never exceed the plan ceiling — enforced by clampEntitlements.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin, requireOwner } from '../middleware/auth';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { getAdminDb } from '../services/adminUserDbFactory';
import { clampEntitlements, getDefaultEntitlements, isPlanCode, PLANS } from '../constants/plans';
import { logger } from '../services/logger';
import type { Entitlements, PlanCode } from '../types';

const router = Router();

/** Resolve the caller's organization id or send 400. */
function orgId(req: Request, res: Response): string | null {
  const id = req.user?.organizationId;
  if (!id) {
    res.status(400).json({ error: 'No organization associated with this account' });
    return null;
  }
  return id;
}

/** GET current organization (+ plan catalog for the UI). */
router.get('/current', authMiddleware, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  const db = ensureOrganizationDatabase();
  const organization = await db.getOrganizationById(id);
  if (!organization) {
    return res.status(404).json({ error: 'Organization not found' });
  }
  return res.json({ organization, plans: Object.values(PLANS) });
});

/** PUT current organization — owner only. */
router.put('/current', authMiddleware, requireOwner, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  const db = ensureOrganizationDatabase();
  const organization = await db.getOrganizationById(id);
  if (!organization) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  const { name, billingEmail, planCode, moduleToggles } = req.body ?? {};

  if (planCode !== undefined && !isPlanCode(planCode)) {
    return res.status(400).json({ error: 'Invalid planCode' });
  }

  const effectivePlan: PlanCode = (planCode as PlanCode) ?? organization.planCode;

  // Start from plan defaults if the plan changed, otherwise current entitlements.
  const baseline: Entitlements =
    planCode && planCode !== organization.planCode
      ? getDefaultEntitlements(effectivePlan)
      : organization.entitlements;

  // Apply owner module toggles (only the boolean module flags are user-editable).
  const desired: Entitlements = { ...baseline };
  if (moduleToggles && typeof moduleToggles === 'object') {
    for (const key of ['signInEnabled', 'truckCheckEnabled', 'reportsEnabled', 'aiEnabled'] as const) {
      if (typeof moduleToggles[key] === 'boolean') {
        desired[key] = moduleToggles[key];
      }
    }
  }

  const entitlements = clampEntitlements(effectivePlan, desired);

  const updated = await db.updateOrganization(id, {
    ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
    ...(typeof billingEmail === 'string' && billingEmail.trim() ? { billingEmail: billingEmail.trim() } : {}),
    planCode: effectivePlan,
    entitlements,
  });

  logger.info('Organization updated', { organizationId: id, planCode: effectivePlan });
  return res.json({ organization: updated });
});

/** GET users in the current organization — admin/owner. */
router.get('/current/users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  const adminDb = getAdminDb();
  const all = await adminDb.getAllUsers();
  const users = all
    .filter((u) => u.organizationId === id)
    .map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  return res.json({ users });
});

/** POST create a user within the current organization — admin/owner. */
router.post('/current/users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  const { username, password, role } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  // Only owners may mint other owners.
  const requestedRole: 'owner' | 'admin' | 'viewer' =
    role === 'admin' || role === 'viewer' || role === 'owner' ? role : 'viewer';
  if (requestedRole === 'owner' && req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Only an owner can create another owner' });
  }

  try {
    const adminDb = getAdminDb();
    const user = await adminDb.createAdminUser(username, password, requestedRole, id);
    return res.status(201).json({
      user: { id: user.id, username: user.username, role: user.role, organizationId: user.organizationId },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Username already exists') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    logger.error('Error creating organization user', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
