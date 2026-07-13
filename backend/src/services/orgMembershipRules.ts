/**
 * Organization membership rules — pure functions, zero I/O.
 *
 * Centralises the invariants for org invites, role changes, and removals so
 * the route handlers and any future service layer enforce identical logic.
 * The one hard invariant: an organization must always retain at least one
 * active owner.
 */

import type { OrgRole, OrganizationMembership } from '../types';

const ROLE_RANK: Record<OrgRole, number> = { owner: 3, admin: 2, viewer: 1 };

export function isOrgRole(value: unknown): value is OrgRole {
  return value === 'owner' || value === 'admin' || value === 'viewer';
}

/**
 * Who may mint an invite for a given role: owners may invite any role
 * (including another owner); admins may invite admins/viewers; viewers may
 * not invite anyone.
 */
export function canInviteRole(inviterRole: OrgRole, inviteRole: OrgRole): boolean {
  if (inviterRole === 'owner') return true;
  if (inviterRole === 'admin') return inviteRole !== 'owner';
  return false;
}

/**
 * Role-change permissions: only an owner may grant or revoke the owner role,
 * and nobody but an owner may change an owner's role at all. Admins may move
 * non-owners between admin and viewer. Viewers change nothing.
 */
export function canChangeRole(actorRole: OrgRole, targetRole: OrgRole, newRole: OrgRole): boolean {
  if (actorRole === 'viewer') return false;
  if (targetRole === 'owner' || newRole === 'owner') return actorRole === 'owner';
  return ROLE_RANK[actorRole] >= ROLE_RANK[targetRole];
}

/**
 * Removal permissions: anyone may remove themself (leave); owners may remove
 * anyone; admins may remove non-owners.
 */
export function canRemoveMember(actorRole: OrgRole, targetRole: OrgRole, isSelf: boolean): boolean {
  if (isSelf) return true;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole !== 'owner';
  return false;
}

export interface MembershipChange {
  userId: string;
  newRole?: OrgRole;
  remove?: boolean;
}

/**
 * True when applying `change` to the given memberships would leave the org
 * with no active owner. Pass ALL memberships for the org (any status); only
 * `active` rows count toward the owner tally.
 */
export function violatesLastOwner(
  memberships: OrganizationMembership[],
  change: MembershipChange,
): boolean {
  const activeOwners = memberships.filter((m) => m.status === 'active' && m.role === 'owner');
  const target = activeOwners.find((m) => m.userId === change.userId);
  if (!target) {
    // The change doesn't touch an active owner, so the owner count can't drop.
    return false;
  }
  const losesOwner = change.remove === true || (change.newRole !== undefined && change.newRole !== 'owner');
  return losesOwner && activeOwners.length <= 1;
}
