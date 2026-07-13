/**
 * Organization membership resolution.
 *
 * Membership rows (OrganizationMembership) are the source of truth for which
 * orgs a user belongs to and their per-org role. Users created before the
 * org-onboarding rework only carry `AdminUser.organizationId` + a global
 * `role`; the first time such a user's memberships are resolved, a matching
 * row is lazily materialized. If the write fails the virtual row is still
 * returned — a legacy user is never locked out by the migration.
 */

import { ensureOrgAccessDatabase } from './orgAccessDbFactory';
import { logger } from './logger';
import type { AdminUser, OrgRole, OrganizationMembership } from '../types';

/** Resolve all memberships for a user, lazily materializing the legacy one. */
export async function resolveMemberships(user: AdminUser): Promise<OrganizationMembership[]> {
  const orgAccessDb = ensureOrgAccessDatabase();
  let memberships: OrganizationMembership[] = [];
  try {
    memberships = await orgAccessDb.getMembershipsByUser(user.id);
  } catch (error) {
    logger.error('Failed to read memberships; falling back to AdminUser org', { error, userId: user.id });
  }

  const active = memberships.filter((m) => m.status === 'active');
  if (user.organizationId && !memberships.some((m) => m.organizationId === user.organizationId)) {
    // Legacy user: materialize the membership implied by AdminUser fields.
    const virtual: OrganizationMembership = {
      id: `legacy-${user.id}-${user.organizationId}`,
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      status: 'active',
      createdAt: user.createdAt,
      updatedAt: new Date(),
    };
    try {
      const created = await orgAccessDb.createMembership({
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
      });
      active.push(created);
    } catch (error) {
      logger.warn('Failed to materialize legacy membership; using virtual row', {
        error,
        userId: user.id,
        organizationId: user.organizationId,
      });
      active.push(virtual);
    }
  }
  return active;
}

/**
 * Resolve the user's role within one organization: the membership role when a
 * row exists, else the global AdminUser role when the org matches the user's
 * default org (legacy fallback), else null (not a member).
 */
export async function resolveActiveRole(user: AdminUser, organizationId: string): Promise<OrgRole | null> {
  const memberships = await resolveMemberships(user);
  const membership = memberships.find(
    (m) => m.organizationId === organizationId && m.status === 'active',
  );
  if (membership) return membership.role;
  return user.organizationId === organizationId ? user.role : null;
}
