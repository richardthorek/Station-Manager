/**
 * Organization (SaaS tenant) management routes.
 *
 * - GET  /api/organizations/current        → org + plan + entitlements (any member)
 * - PUT  /api/organizations/current        → update name/email/plan/module toggles (owner)
 * - GET  /api/organizations/current/users  → list users in the org (admin/owner)
 * - POST /api/organizations/current/users  → invite/create a user (admin/owner)
 * - GET  /api/organizations/current/export → full data export as JSON (owner)
 *
 * Plan changes here set entitlements from the plan defaults; Stripe billing
 * (which would drive plan changes via webhooks) is a follow-up. Owners may
 * narrow module toggles (e.g. hide the sign-in book for a maintenance-only
 * brigade) but never exceed the plan ceiling — enforced by clampEntitlements.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireAdmin, requireOwner } from '../middleware/auth';
import { sensitiveActionRateLimiter } from '../middleware/rateLimiter';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { getAdminDb } from '../services/adminUserDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureDeviceDatabase } from '../services/deviceDbFactory';
import {
  canChangeRole,
  canInviteRole,
  canRemoveMember,
  isOrgRole,
  violatesLastOwner,
} from '../services/orgMembershipRules';
import { clampEntitlements, getDefaultEntitlements, isPlanCode, PLANS, trialEndDate } from '../constants/plans';
import { logger } from '../services/logger';
import type { Entitlements, OrganizationStatus, OrgInvite, OrgRole, PlanCode } from '../types';

const router = Router();

const DEFAULT_INVITE_DAYS = 7;
const MAX_INVITE_DAYS = 30;

/** First configured frontend origin — the base for shareable invite URLs. */
function frontendBase(): string {
  return (process.env.FRONTEND_URLS || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
}

/** Report an active-but-past-expiry invite as expired without a write. */
function effectiveInviteStatus(invite: OrgInvite): OrgInvite['status'] {
  if (invite.status === 'active' && invite.expiresAt.getTime() < Date.now()) {
    return 'expired';
  }
  return invite.status;
}

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
router.put('/current', sensitiveActionRateLimiter, authMiddleware, requireOwner, async (req: Request, res: Response) => {
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

  // D1: a genuine plan change with no live Stripe subscription driving status
  // (billing unconfigured, or the org hasn't checked out yet) starts/ends a
  // trial here directly — otherwise a self-serve upgrade to a paid plan would
  // never get a trial deadline at all. A real subscription's status/trialEndsAt
  // stays governed by Stripe webhooks (routes/billing.ts), untouched by this route.
  let statusUpdate: { status?: OrganizationStatus; trialEndsAt?: Date } = {};
  const isRealPlanChange = planCode !== undefined && planCode !== organization.planCode;
  if (isRealPlanChange && !organization.stripeSubscriptionId) {
    statusUpdate =
      effectivePlan === 'community'
        ? { status: 'active', trialEndsAt: undefined }
        : { status: 'trialing', trialEndsAt: trialEndDate() };
  }

  const updated = await db.updateOrganization(id, {
    ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
    ...(typeof billingEmail === 'string' && billingEmail.trim() ? { billingEmail: billingEmail.trim() } : {}),
    planCode: effectivePlan,
    entitlements,
    ...statusUpdate,
  });

  logger.info('Organization updated', { organizationId: id, planCode: effectivePlan, status: statusUpdate.status });
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
router.post('/current/users', sensitiveActionRateLimiter, authMiddleware, requireAdmin, async (req: Request, res: Response) => {
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
    const { email } = req.body ?? {};
    const user = await adminDb.createAdminUser(
      username,
      password,
      requestedRole,
      id,
      typeof email === 'string' && email.trim() ? { email: email.trim() } : undefined,
    );
    // Membership row keeps the multi-org model authoritative.
    try {
      await ensureOrgAccessDatabase().createMembership({
        userId: user.id,
        organizationId: id,
        role: requestedRole,
        invitedBy: req.user?.userId,
      });
    } catch (membershipError) {
      logger.warn('Failed to create membership row for direct-created user', { error: membershipError });
    }
    return res.status(201).json({
      user: { id: user.id, username: user.username, role: user.role, organizationId: user.organizationId, email: user.email },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Username already exists') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    logger.error('Error creating organization user', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Invite links (shareable, multi-use until expiry/revocation)
// ─────────────────────────────────────────────────────────────

/** POST create an invite link — admin/owner; role limits per orgMembershipRules. */
router.post('/current/invites', sensitiveActionRateLimiter, authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const { role, email, expiresInDays } = req.body ?? {};
    const inviteRole: OrgRole = isOrgRole(role) ? role : 'viewer';
    const actorRole = req.user?.role as OrgRole;
    if (!canInviteRole(actorRole, inviteRole)) {
      return res.status(403).json({ error: `A ${actorRole} cannot create ${inviteRole} invites` });
    }

    let days = DEFAULT_INVITE_DAYS;
    if (expiresInDays !== undefined) {
      const parsed = Number(expiresInDays);
      if (isNaN(parsed) || parsed < 1 || parsed > MAX_INVITE_DAYS) {
        return res.status(400).json({ error: `expiresInDays must be between 1 and ${MAX_INVITE_DAYS}` });
      }
      days = Math.floor(parsed);
    }

    const invite = await ensureOrgAccessDatabase().createInvite({
      organizationId: id,
      role: inviteRole,
      createdBy: req.user!.userId,
      email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    });

    const inviteUrl = `${frontendBase()}/invite/${invite.token}`;
    logger.info('Org invite created', { organizationId: id, inviteId: invite.id, role: inviteRole });
    return res.status(201).json({ invite, inviteUrl });
  } catch (error) {
    logger.error('Error creating org invite', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET invite links for the org — admin/owner. */
router.get('/current/invites', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const invites = await ensureOrgAccessDatabase().getInvitesByOrganization(id);
    const base = frontendBase();
    return res.json({
      invites: invites.map((invite) => ({
        ...invite,
        status: effectiveInviteStatus(invite),
        inviteUrl: `${base}/invite/${invite.token}`,
      })),
    });
  } catch (error) {
    logger.error('Error listing org invites', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE (revoke) an invite link — admin/owner. */
router.delete('/current/invites/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const orgAccessDb = ensureOrgAccessDatabase();
    const invites = await orgAccessDb.getInvitesByOrganization(id);
    const invite = invites.find((i) => i.id === req.params.id);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    const updated = await orgAccessDb.updateInvite(invite.id, { status: 'revoked' });
    logger.info('Org invite revoked', { organizationId: id, inviteId: invite.id });
    return res.json({ invite: updated });
  } catch (error) {
    logger.error('Error revoking org invite', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Membership management (multi-org, per-org roles)
// ─────────────────────────────────────────────────────────────

/** GET members of the current org (memberships joined with users) — admin/owner. */
router.get('/current/members', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const orgAccessDb = ensureOrgAccessDatabase();
    const adminDb = getAdminDb();
    const memberships = await orgAccessDb.getMembershipsByOrganization(id);
    const byUserId = new Map(memberships.map((m) => [m.userId, m]));

    // Include legacy users (AdminUser.organizationId only) by materializing
    // rows on the fly so the members table is complete from day one.
    const allUsers = await adminDb.getAllUsers();
    const members: Array<{
      userId: string;
      username: string;
      email: string | null;
      role: OrgRole;
      status: string;
      lastLoginAt?: Date;
      createdAt: Date;
    }> = [];

    for (const user of allUsers) {
      let membership = byUserId.get(user.id);
      if (!membership && user.organizationId === id) {
        try {
          membership = await orgAccessDb.createMembership({
            userId: user.id,
            organizationId: id,
            role: user.role,
          });
        } catch {
          membership = {
            id: `legacy-${user.id}-${id}`,
            userId: user.id,
            organizationId: id,
            role: user.role,
            status: 'active',
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          };
        }
      }
      if (!membership || membership.status !== 'active') continue;
      members.push({
        userId: user.id,
        username: user.username,
        email: user.email ?? null,
        role: membership.role,
        status: membership.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: membership.createdAt,
      });
    }

    return res.json({ members });
  } catch (error) {
    logger.error('Error listing org members', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT change a member's role in the current org. */
router.put('/current/members/:userId', sensitiveActionRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const { role: newRole } = req.body ?? {};
    if (!isOrgRole(newRole)) {
      return res.status(400).json({ error: 'role must be owner, admin or viewer' });
    }
    const orgAccessDb = ensureOrgAccessDatabase();
    const membership = await orgAccessDb.getMembership(req.params.userId, id);
    if (!membership || membership.status !== 'active') {
      return res.status(404).json({ error: 'Member not found in this organisation' });
    }

    const actorRole = req.user?.role as OrgRole;
    if (!canChangeRole(actorRole, membership.role, newRole)) {
      return res.status(403).json({ error: 'You do not have permission to make that role change' });
    }
    const memberships = await orgAccessDb.getMembershipsByOrganization(id);
    if (violatesLastOwner(memberships, { userId: req.params.userId, newRole })) {
      return res.status(403).json({ error: 'An organisation must keep at least one owner' });
    }

    const updated = await orgAccessDb.updateMembership(membership.id, { role: newRole });

    // Keep the legacy global role coherent when this org is the user's default.
    const adminDb = getAdminDb();
    const targetUser = await adminDb.getUserById(req.params.userId);
    if (targetUser && targetUser.organizationId === id) {
      await adminDb.updateUser(targetUser.id, { role: newRole });
    }

    logger.info('Org member role changed', { organizationId: id, userId: req.params.userId, role: newRole });
    return res.json({ membership: updated });
  } catch (error) {
    logger.error('Error changing member role', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE remove a member from the current org (or leave, when self). */
router.delete('/current/members/:userId', sensitiveActionRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const orgAccessDb = ensureOrgAccessDatabase();
    const membership = await orgAccessDb.getMembership(req.params.userId, id);
    if (!membership || membership.status !== 'active') {
      return res.status(404).json({ error: 'Member not found in this organisation' });
    }

    const isSelf = req.user?.userId === req.params.userId;
    const actorRole = req.user?.role as OrgRole;
    if (!canRemoveMember(actorRole, membership.role, isSelf)) {
      return res.status(403).json({ error: 'You do not have permission to remove that member' });
    }
    const memberships = await orgAccessDb.getMembershipsByOrganization(id);
    if (violatesLastOwner(memberships, { userId: req.params.userId, remove: true })) {
      return res.status(403).json({ error: 'An organisation must keep at least one owner' });
    }

    await orgAccessDb.updateMembership(membership.id, { status: 'removed' });

    // If this org was the user's default, repoint to their next active org.
    const adminDb = getAdminDb();
    const targetUser = await adminDb.getUserById(req.params.userId);
    if (targetUser && targetUser.organizationId === id) {
      const remaining = (await orgAccessDb.getMembershipsByUser(targetUser.id)).filter(
        (m) => m.status === 'active' && m.organizationId !== id,
      );
      await adminDb.updateUser(targetUser.id, {
        organizationId: remaining[0]?.organizationId,
        ...(remaining[0] ? { role: remaining[0].role } : {}),
      });
    }

    logger.info('Org member removed', { organizationId: id, userId: req.params.userId, isSelf });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error removing org member', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET current organization's data as a downloadable JSON bundle — owner only.
 * Covers the org record, its stations, members, event/attendance history,
 * truck-check history (vehicles + check runs with results), and device
 * records — for privacy/retention requests and a brigade's own record-keeping.
 */
router.get('/current/export', sensitiveActionRateLimiter, authMiddleware, requireOwner, async (req: Request, res: Response) => {
  const id = orgId(req, res);
  if (!id) return;
  try {
    const orgDb = ensureOrganizationDatabase();
    const organization = await orgDb.getOrganizationById(id);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const db = await ensureDatabase();
    const allStations = await db.getAllStations();
    const stations = allStations.filter((s) => s.organizationId === id);

    const members = (
      await Promise.all(stations.map((s) => db.getAllMembers(s.id)))
    ).flat();

    // A large limit rather than true unbounded pagination. getEventsWithParticipants
    // (Table Storage) used to hard-cap its scan at the last ~3 months regardless
    // of limit (Q25) — fixed 2026-07-17, it now pages back through month
    // partitions until this limit is satisfied.
    const EVENTS_EXPORT_LIMIT = 5000;
    const events = (
      await Promise.all(stations.map((s) => db.getEventsWithParticipants(EVENTS_EXPORT_LIMIT, 0, s.id)))
    ).flat();

    // Q26: truck-check history (vehicles + check runs with results) and device
    // records, completing the export beyond org/stations/members/events.
    const truckDb = await ensureTruckChecksDatabase();
    const vehicles = (
      await Promise.all(stations.map((s) => truckDb.getAllAppliances(s.id)))
    ).flat();

    const TRUCK_CHECK_RUNS_EXPORT_LIMIT = 5000;
    let truckCheckRuns = (
      await Promise.all(stations.map((s) => truckDb.getAllRunsWithResults(s.id)))
    ).flat();
    truckCheckRuns.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const truckCheckRunsTruncated = truckCheckRuns.length > TRUCK_CHECK_RUNS_EXPORT_LIMIT;
    truckCheckRuns = truckCheckRuns.slice(0, TRUCK_CHECK_RUNS_EXPORT_LIMIT);

    const devices = await ensureDeviceDatabase().listForOrganization(id);

    logger.info('Org data export generated', {
      organizationId: id,
      stationCount: stations.length,
      memberCount: members.length,
      eventCount: events.length,
      vehicleCount: vehicles.length,
      truckCheckRunCount: truckCheckRuns.length,
      deviceCount: devices.length,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="org-export-${id}-${new Date().toISOString().split('T')[0]}.json"`);
    return res.json({
      exportedAt: new Date().toISOString(),
      organization,
      stations,
      members,
      events,
      vehicles,
      truckCheckRuns,
      devices,
      limitations: [
        `Event/attendance history is limited to the most recent ${EVENTS_EXPORT_LIMIT.toLocaleString()} events per station.`,
        ...(truckCheckRunsTruncated
          ? [`Truck-check history is limited to the most recent ${TRUCK_CHECK_RUNS_EXPORT_LIMIT.toLocaleString()} check runs across all stations.`]
          : []),
      ],
    });
  } catch (error) {
    logger.error('Error generating org data export', { error, organizationId: id });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
