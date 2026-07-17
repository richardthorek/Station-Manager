/**
 * Platform administration routes — mounted at /api/platform, gated by the
 * PLATFORM_ADMIN_USERNAMES allowlist (middleware/platformAdmin.ts).
 *
 * Q32 — the platform-owner console. One operator account (never an
 * assignable org role) can see and manage every organization without ever
 * touching tenant content:
 *  - facility claim-conflict review (original scope)
 *  - cross-org visibility: aggregate counts only (member/vehicle/station
 *    counts, AI sessions used, plan/status/billing email) — never row-level
 *    member/check-in/truck-check/event data. This is the hard privacy wall:
 *    these endpoints compute rollups server-side from the same DBs tenant
 *    routes use, but never return the underlying records.
 *  - management: membership/role, plan/entitlements/status, facility-claim
 *    clearing, soft-deactivate/hard-delete of orgs and accounts
 *  - every mutation writes a PlatformAuditLog row — the only accountability
 *    trail for this level of access, since the privacy wall means nobody
 *    (including the platform admin) can casually browse tenant data instead.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/platformAdmin';
import { ensureOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { getAdminDb } from '../services/adminUserDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureUsageDatabase } from '../services/usageDbFactory';
import { monthStart } from '../services/usageDatabase';
import { isOrgRole, violatesLastOwner } from '../services/orgMembershipRules';
import { clampEntitlements, getDefaultEntitlements, isPlanCode, PLANS } from '../constants/plans';
import { DEFAULT_STATION_ID, DEMO_STATION_ID } from '../constants/stations';
import { logger } from '../services/logger';
import type { ClaimConflict, OrganizationStatus, PlatformAuditAction } from '../types';

const router = Router();

router.use(authMiddleware, requirePlatformAdmin);

/** Write a platform audit row. Never let an audit-log failure block the action it's recording. */
async function auditLog(
  req: Request,
  action: PlatformAuditAction,
  target: { organizationId?: string; userId?: string },
  details?: string,
): Promise<void> {
  try {
    await ensureOrgAccessDatabase().createPlatformAuditLog({
      actorUserId: req.user!.userId,
      actorUsername: req.user!.username,
      action,
      targetOrganizationId: target.organizationId,
      targetUserId: target.userId,
      details,
    });
  } catch (error) {
    logger.error('Failed to write platform audit log', { error, action, target });
  }
}

const SYSTEM_STATION_IDS = new Set([DEFAULT_STATION_ID, DEMO_STATION_ID]);

/** Aggregate, non-PII usage counts for one organization — the only shape platform visibility may return. */
async function organizationAggregate(organizationId: string) {
  const db = await ensureDatabase();
  const truckDb = await ensureTruckChecksDatabase();
  const [allStations, allMembers, allAppliances, aiSessionsThisMonth] = await Promise.all([
    db.getAllStations(),
    db.getAllMembers(),
    truckDb.getAllAppliances(),
    ensureUsageDatabase().countUsage(organizationId, 'speech', monthStart()),
  ]);
  const orgStationIds = new Set(
    allStations.filter((s) => s.organizationId === organizationId && !SYSTEM_STATION_IDS.has(s.id)).map((s) => s.id),
  );
  return {
    stationCount: orgStationIds.size,
    memberCount: allMembers.filter((m) => m.stationId && orgStationIds.has(m.stationId)).length,
    vehicleCount: allAppliances.filter((a) => a.stationId && orgStationIds.has(a.stationId)).length,
    aiSessionsUsedThisMonth: aiSessionsThisMonth,
  };
}

// ─────────────────────────────────────────────────────────────
// Cross-org visibility (Q32) — aggregate/shape only, never row-level data
// ─────────────────────────────────────────────────────────────

/** GET /api/platform/organizations — every org, aggregate counts only. */
router.get('/organizations', async (_req: Request, res: Response) => {
  try {
    const orgDb = ensureOrganizationDatabase();
    const orgs = await orgDb.getAllOrganizations();
    const organizations = await Promise.all(
      orgs.map(async (org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        billingEmail: org.billingEmail,
        planCode: org.planCode,
        status: org.status,
        createdAt: org.createdAt,
        facilityName: org.facilityName ?? null,
        ...(await organizationAggregate(org.id)),
      })),
    );
    organizations.sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ organizations });
  } catch (error) {
    logger.error('Error listing platform organizations', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/platform/organizations/:id — detail + memberships (account info, not tenant content). */
router.get('/organizations/:id', async (req: Request, res: Response) => {
  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgAccessDb = ensureOrgAccessDatabase();
    const adminDb = getAdminDb();
    const [memberships, allUsers, aggregate] = await Promise.all([
      orgAccessDb.getMembershipsByOrganization(org.id),
      adminDb.getAllUsers(),
      organizationAggregate(org.id),
    ]);
    const usersById = new Map(allUsers.map((u) => [u.id, u]));
    const members = memberships
      .filter((m) => m.status === 'active')
      .map((m) => {
        const user = usersById.get(m.userId);
        return {
          userId: m.userId,
          username: user?.username ?? '(deleted account)',
          email: user?.email ?? null,
          role: m.role,
          isActive: user?.isActive ?? false,
          lastLoginAt: user?.lastLoginAt ?? null,
        };
      });

    return res.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        billingEmail: org.billingEmail,
        planCode: org.planCode,
        status: org.status,
        entitlements: org.entitlements,
        facilityName: org.facilityName ?? null,
        facilityCustom: org.facilityCustom ?? false,
        trialEndsAt: org.trialEndsAt ?? null,
        createdAt: org.createdAt,
        ...aggregate,
      },
      members,
      plans: Object.values(PLANS),
    });
  } catch (error) {
    logger.error('Error getting platform organization detail', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/platform/audit-log?limit=&offset= */
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const logs = await ensureOrgAccessDatabase().getPlatformAuditLogs(limit, offset);
    return res.json({ logs });
  } catch (error) {
    logger.error('Error listing platform audit log', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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

// ─────────────────────────────────────────────────────────────
// Station → organization backfill (Q35). Stations created before Q33 tagged
// organizationId on creation have none, so their members/vehicles don't count
// toward any org's plan limits (fails open — safe, but under-enforces). No
// reliable automatic signal exists to map these, so this is a manual,
// operator-reviewed tool: list the orphans, then assign each to the right org.
// ─────────────────────────────────────────────────────────────

/** GET /api/platform/stations/orphaned — active stations with no organizationId. */
router.get('/stations/orphaned', async (_req: Request, res: Response) => {
  try {
    const db = await ensureDatabase();
    const truckDb = await ensureTruckChecksDatabase();
    const [allStations, allMembers, allAppliances] = await Promise.all([
      db.getAllStations(),
      db.getAllMembers(),
      truckDb.getAllAppliances(),
    ]);

    const orphans = allStations.filter((s) => !s.organizationId && !SYSTEM_STATION_IDS.has(s.id));
    const stations = orphans
      .map((s) => ({
        id: s.id,
        name: s.name,
        brigadeName: s.brigadeName,
        brigadeId: s.brigadeId,
        hierarchy: s.hierarchy,
        isActive: s.isActive,
        createdAt: s.createdAt,
        memberCount: allMembers.filter((m) => m.stationId === s.id).length,
        vehicleCount: allAppliances.filter((a) => a.stationId === s.id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ stations });
  } catch (error) {
    logger.error('Error listing orphaned stations', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/platform/stations/:id/organization
 * Body: { organizationId } — assigns (or reassigns) the station's owning org,
 * so its members/vehicles start counting toward that org's plan limits.
 */
router.patch('/stations/:id/organization', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body ?? {};
    if (typeof organizationId !== 'string' || !organizationId.trim()) {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(organizationId);
    if (!org) {
      return res.status(404).json({ error: 'Target organization not found' });
    }

    const db = await ensureDatabase();
    const allStations = await db.getAllStations();
    const station = allStations.find((s) => s.id === req.params.id);
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    if (SYSTEM_STATION_IDS.has(station.id)) {
      return res.status(400).json({ error: 'Cannot assign an organization to a system station' });
    }

    const previousOrganizationId = station.organizationId;
    const updated = await db.updateStation(station.id, { organizationId });

    await auditLog(
      req,
      'station.organization_assigned',
      { organizationId },
      `${station.name} (${station.id})${previousOrganizationId ? ` reassigned from ${previousOrganizationId}` : ''}`,
    );
    logger.info('Platform admin assigned station to organization', {
      stationId: station.id,
      organizationId,
      previousOrganizationId,
      actor: req.user?.username,
    });
    return res.json({ station: updated });
  } catch (error) {
    logger.error('Error assigning station organization', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Management (Q32) — plan/status/entitlements, membership, destructive delete.
// Every mutation writes a PlatformAuditLog row.
// ─────────────────────────────────────────────────────────────

/**
 * PATCH /api/platform/organizations/:id
 * Body: { planCode?, status?, moduleToggles?: Partial<Entitlements booleans>, clearFacilityClaim?: boolean }
 * Unlike the owner-facing PUT /api/organizations/current, a platform admin
 * may also set `status` directly (e.g. reinstating a wrongly-canceled org).
 */
router.patch('/organizations/:id', async (req: Request, res: Response) => {
  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { planCode, status, moduleToggles, clearFacilityClaim } = req.body ?? {};
    const changes: string[] = [];
    const updates: Parameters<typeof orgDb.updateOrganization>[1] = {};

    if (planCode !== undefined) {
      if (!isPlanCode(planCode)) {
        return res.status(400).json({ error: 'Invalid planCode' });
      }
      if (planCode !== org.planCode) {
        const baseline = getDefaultEntitlements(planCode);
        const desired = { ...baseline };
        if (moduleToggles && typeof moduleToggles === 'object') {
          for (const key of ['signInEnabled', 'truckCheckEnabled', 'reportsEnabled', 'aiEnabled'] as const) {
            if (typeof moduleToggles[key] === 'boolean') desired[key] = moduleToggles[key];
          }
        }
        updates.planCode = planCode;
        updates.entitlements = clampEntitlements(planCode, desired);
        changes.push(`planCode: ${org.planCode} -> ${planCode}`);
        await auditLog(req, 'org.plan_changed', { organizationId: org.id }, changes[changes.length - 1]);
      }
    } else if (moduleToggles && typeof moduleToggles === 'object') {
      const desired = { ...org.entitlements };
      for (const key of ['signInEnabled', 'truckCheckEnabled', 'reportsEnabled', 'aiEnabled'] as const) {
        if (typeof moduleToggles[key] === 'boolean') desired[key] = moduleToggles[key];
      }
      updates.entitlements = clampEntitlements(org.planCode, desired);
      await auditLog(req, 'org.entitlements_changed', { organizationId: org.id }, JSON.stringify(moduleToggles));
    }

    if (status !== undefined) {
      const validStatuses: OrganizationStatus[] = ['trialing', 'active', 'past_due', 'canceled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
      }
      if (status !== org.status) {
        updates.status = status;
        await auditLog(req, 'org.status_changed', { organizationId: org.id }, `status: ${org.status} -> ${status}`);
      }
    }

    if (clearFacilityClaim === true && org.facilityKey) {
      updates.facilityKey = undefined;
      updates.facilityObjectId = undefined;
      updates.facilityName = undefined;
      updates.facilityCustom = true;
      updates.claimedAt = undefined;
      updates.claimedByUserId = undefined;
      await auditLog(req, 'org.facility_claim_cleared', { organizationId: org.id }, org.facilityName);
    }

    const updated = await orgDb.updateOrganization(org.id, updates);
    logger.info('Platform admin updated organization', { organizationId: org.id, actor: req.user?.username, updates: Object.keys(updates) });
    return res.json({ organization: updated });
  } catch (error) {
    logger.error('Error updating platform organization', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/platform/organizations/:id
 * Default: soft-deactivate (status -> canceled). Pass ?hard=true and body
 * { confirm: '<org slug>' } to permanently delete the organization record
 * itself (does not cascade to stations/members/events — see deleteOrganization).
 */
router.delete('/organizations/:id', async (req: Request, res: Response) => {
  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const hard = req.query.hard === 'true';
    if (!hard) {
      const updated = await orgDb.updateOrganization(org.id, { status: 'canceled' });
      await auditLog(req, 'org.deactivated', { organizationId: org.id }, org.name);
      logger.info('Platform admin deactivated organization', { organizationId: org.id, actor: req.user?.username });
      return res.json({ organization: updated });
    }

    const { confirm } = req.body ?? {};
    if (confirm !== org.slug) {
      return res.status(400).json({ error: `Hard delete requires { confirm: "${org.slug}" } in the request body` });
    }

    // Remove memberships so removed users stop resolving into this org; the
    // AdminUser accounts themselves are untouched (they may belong to other orgs).
    const orgAccessDb = ensureOrgAccessDatabase();
    const memberships = await orgAccessDb.getMembershipsByOrganization(org.id);
    for (const m of memberships) {
      await orgAccessDb.updateMembership(m.id, { status: 'removed' });
    }

    await orgDb.deleteOrganization(org.id);
    await auditLog(req, 'org.deleted', { organizationId: org.id }, `${org.name} (${org.slug})`);
    logger.warn('Platform admin hard-deleted organization', { organizationId: org.id, slug: org.slug, actor: req.user?.username });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting platform organization', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/platform/organizations/:id/members
 * Body: { username, password, role, email? } — creates a new account and
 * memberships it into this org. To add an *existing* account to another org,
 * use PUT .../members/:userId with a userId that has no membership yet — not
 * supported here; account emails aren't globally searchable by design (privacy wall).
 */
router.post('/organizations/:id/members', async (req: Request, res: Response) => {
  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { username, password, role, email } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!isOrgRole(role)) {
      return res.status(400).json({ error: 'role must be owner, admin or viewer' });
    }

    const adminDb = getAdminDb();
    const user = await adminDb.createAdminUser(username, password, role, org.id, {
      email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
    });
    await ensureOrgAccessDatabase().createMembership({
      userId: user.id,
      organizationId: org.id,
      role,
      invitedBy: req.user?.userId,
    });

    await auditLog(req, 'org.membership_added', { organizationId: org.id, userId: user.id }, `${username} as ${role}`);
    logger.info('Platform admin added org member', { organizationId: org.id, userId: user.id, role, actor: req.user?.username });
    return res.status(201).json({
      user: { id: user.id, username: user.username, role, email: user.email ?? null },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Username already exists') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    logger.error('Error adding platform org member', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/platform/organizations/:id/members/:userId — change role. Body: { role }. */
router.put('/organizations/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const orgAccessDb = ensureOrgAccessDatabase();
    const membership = await orgAccessDb.getMembership(req.params.userId, req.params.id);
    if (!membership || membership.status !== 'active') {
      return res.status(404).json({ error: 'Member not found in this organisation' });
    }
    const { role: newRole } = req.body ?? {};
    if (!isOrgRole(newRole)) {
      return res.status(400).json({ error: 'role must be owner, admin or viewer' });
    }

    const memberships = await orgAccessDb.getMembershipsByOrganization(req.params.id);
    if (violatesLastOwner(memberships, { userId: req.params.userId, newRole })) {
      return res.status(409).json({ error: 'An organisation must keep at least one owner' });
    }

    const updated = await orgAccessDb.updateMembership(membership.id, { role: newRole });
    const adminDb = getAdminDb();
    const targetUser = await adminDb.getUserById(req.params.userId);
    if (targetUser && targetUser.organizationId === req.params.id) {
      await adminDb.updateUser(targetUser.id, { role: newRole });
    }

    await auditLog(
      req,
      'org.membership_role_changed',
      { organizationId: req.params.id, userId: req.params.userId },
      `${membership.role} -> ${newRole}`,
    );
    logger.info('Platform admin changed member role', { organizationId: req.params.id, userId: req.params.userId, role: newRole });
    return res.json({ membership: updated });
  } catch (error) {
    logger.error('Error changing platform org member role', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/platform/organizations/:id/members/:userId — remove membership from this org. */
router.delete('/organizations/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const orgAccessDb = ensureOrgAccessDatabase();
    const membership = await orgAccessDb.getMembership(req.params.userId, req.params.id);
    if (!membership || membership.status !== 'active') {
      return res.status(404).json({ error: 'Member not found in this organisation' });
    }

    const memberships = await orgAccessDb.getMembershipsByOrganization(req.params.id);
    if (violatesLastOwner(memberships, { userId: req.params.userId, remove: true })) {
      return res.status(409).json({ error: 'An organisation must keep at least one owner' });
    }

    await orgAccessDb.updateMembership(membership.id, { status: 'removed' });
    const adminDb = getAdminDb();
    const targetUser = await adminDb.getUserById(req.params.userId);
    if (targetUser && targetUser.organizationId === req.params.id) {
      const remaining = (await orgAccessDb.getMembershipsByUser(targetUser.id)).filter(
        (m) => m.status === 'active' && m.organizationId !== req.params.id,
      );
      await adminDb.updateUser(targetUser.id, {
        organizationId: remaining[0]?.organizationId,
        ...(remaining[0] ? { role: remaining[0].role } : {}),
      });
    }

    await auditLog(req, 'org.membership_removed', { organizationId: req.params.id, userId: req.params.userId });
    logger.info('Platform admin removed org member', { organizationId: req.params.id, userId: req.params.userId });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error removing platform org member', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/platform/accounts/:userId
 * Default: soft-deactivate. Pass ?hard=true and body { confirm: '<username>' }
 * to permanently delete the account (removed from every org's membership list).
 */
router.delete('/accounts/:userId', async (req: Request, res: Response) => {
  try {
    const adminDb = getAdminDb();
    const user = await adminDb.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const hard = req.query.hard === 'true';
    if (!hard) {
      await adminDb.deactivateUser(user.id);
      await auditLog(req, 'account.deactivated', { userId: user.id }, user.username);
      logger.info('Platform admin deactivated account', { userId: user.id, actor: req.user?.username });
      return res.json({ success: true });
    }

    const { confirm } = req.body ?? {};
    if (confirm !== user.username) {
      return res.status(400).json({ error: `Hard delete requires { confirm: "${user.username}" } in the request body` });
    }

    const orgAccessDb = ensureOrgAccessDatabase();
    const memberships = await orgAccessDb.getMembershipsByUser(user.id);
    for (const m of memberships) {
      if (m.status === 'active') await orgAccessDb.updateMembership(m.id, { status: 'removed' });
    }

    await adminDb.deleteUser(user.id);
    await auditLog(req, 'account.deleted', { userId: user.id }, user.username);
    logger.warn('Platform admin hard-deleted account', { userId: user.id, username: user.username, actor: req.user?.username });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting platform account', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
