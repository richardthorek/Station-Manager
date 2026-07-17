/**
 * In-Memory Org Access Database Service
 *
 * One service for the three org-onboarding tables — organization memberships,
 * org invite links, and facility claim conflicts — for development and
 * testing. Production uses the Table Storage twin
 * (tableStorageOrgAccessDatabase.ts), selected by orgAccessDbFactory.
 * Keep the two implementations in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ClaimConflict, OrgInvite, OrgRole, OrganizationMembership, PlatformAuditAction, PlatformAuditLog } from '../types';

export interface CreateMembershipInput {
  userId: string;
  organizationId: string;
  role: OrgRole;
  invitedBy?: string;
  inviteId?: string;
}

export interface CreateInviteInput {
  organizationId: string;
  role: OrgRole;
  createdBy: string;
  email?: string;
  expiresAt: Date;
}

export interface CreateClaimConflictInput {
  facilityKey: string;
  facilityName: string;
  existingOrganizationId: string;
  attemptedOrgName: string;
  attemptedByUsername: string;
  attemptedByEmail: string;
}

export interface CreatePlatformAuditLogInput {
  actorUserId: string;
  actorUsername: string;
  action: PlatformAuditAction;
  targetOrganizationId?: string;
  targetUserId?: string;
  details?: string;
}

export interface IOrgAccessDatabase {
  // Memberships
  createMembership(input: CreateMembershipInput): Promise<OrganizationMembership>;
  getMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null>;
  getMembershipsByUser(userId: string): Promise<OrganizationMembership[]>;
  getMembershipsByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
  updateMembership(
    id: string,
    updates: Partial<Pick<OrganizationMembership, 'role' | 'status'>>,
  ): Promise<OrganizationMembership | null>;
  // Invites
  createInvite(input: CreateInviteInput): Promise<OrgInvite>;
  getInviteByToken(token: string): Promise<OrgInvite | null>;
  getInvitesByOrganization(organizationId: string): Promise<OrgInvite[]>;
  updateInvite(
    id: string,
    updates: Partial<Pick<OrgInvite, 'status' | 'usageCount'>>,
  ): Promise<OrgInvite | null>;
  // Claim conflicts
  createClaimConflict(input: CreateClaimConflictInput): Promise<ClaimConflict>;
  getClaimConflicts(status?: ClaimConflict['status']): Promise<ClaimConflict[]>;
  updateClaimConflict(
    id: string,
    updates: Partial<
      Pick<ClaimConflict, 'status' | 'resolution' | 'resolutionNotes' | 'resolvedBy' | 'resolvedAt'>
    >,
  ): Promise<ClaimConflict | null>;
  // Platform audit log (Q32)
  createPlatformAuditLog(input: CreatePlatformAuditLogInput): Promise<PlatformAuditLog>;
  /** Newest first. */
  getPlatformAuditLogs(limit?: number, offset?: number): Promise<PlatformAuditLog[]>;
  clear(): Promise<void>;
}

export class OrgAccessDatabase implements IOrgAccessDatabase {
  private memberships: Map<string, OrganizationMembership> = new Map();
  private invites: Map<string, OrgInvite> = new Map();
  private conflicts: Map<string, ClaimConflict> = new Map();
  private auditLogs: Map<string, PlatformAuditLog> = new Map();

  // ─── Memberships ───

  async createMembership(input: CreateMembershipInput): Promise<OrganizationMembership> {
    const existing = await this.getMembership(input.userId, input.organizationId);
    if (existing && existing.status === 'active') {
      throw new Error('Membership already exists');
    }
    // A removed membership is revived in place rather than duplicated.
    if (existing) {
      const revived: OrganizationMembership = {
        ...existing,
        role: input.role,
        status: 'active',
        invitedBy: input.invitedBy ?? existing.invitedBy,
        inviteId: input.inviteId ?? existing.inviteId,
        updatedAt: new Date(),
      };
      this.memberships.set(revived.id, revived);
      return revived;
    }

    const now = new Date();
    const membership: OrganizationMembership = {
      id: uuidv4(),
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
      status: 'active',
      invitedBy: input.invitedBy,
      inviteId: input.inviteId,
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(membership.id, membership);
    return membership;
  }

  async getMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null> {
    for (const m of this.memberships.values()) {
      if (m.userId === userId && m.organizationId === organizationId) return m;
    }
    return null;
  }

  async getMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    return Array.from(this.memberships.values()).filter((m) => m.userId === userId);
  }

  async getMembershipsByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    return Array.from(this.memberships.values()).filter((m) => m.organizationId === organizationId);
  }

  async updateMembership(
    id: string,
    updates: Partial<Pick<OrganizationMembership, 'role' | 'status'>>,
  ): Promise<OrganizationMembership | null> {
    const membership = this.memberships.get(id);
    if (!membership) return null;
    const updated: OrganizationMembership = { ...membership, ...updates, updatedAt: new Date() };
    this.memberships.set(id, updated);
    return updated;
  }

  // ─── Invites ───

  async createInvite(input: CreateInviteInput): Promise<OrgInvite> {
    const now = new Date();
    const invite: OrgInvite = {
      id: uuidv4(),
      token: uuidv4(),
      organizationId: input.organizationId,
      role: input.role,
      email: input.email,
      expiresAt: input.expiresAt,
      status: 'active',
      usageCount: 0,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.invites.set(invite.id, invite);
    return invite;
  }

  async getInviteByToken(token: string): Promise<OrgInvite | null> {
    for (const invite of this.invites.values()) {
      if (invite.token === token) return invite;
    }
    return null;
  }

  async getInvitesByOrganization(organizationId: string): Promise<OrgInvite[]> {
    return Array.from(this.invites.values()).filter((i) => i.organizationId === organizationId);
  }

  async updateInvite(
    id: string,
    updates: Partial<Pick<OrgInvite, 'status' | 'usageCount'>>,
  ): Promise<OrgInvite | null> {
    const invite = this.invites.get(id);
    if (!invite) return null;
    const updated: OrgInvite = { ...invite, ...updates, updatedAt: new Date() };
    this.invites.set(id, updated);
    return updated;
  }

  // ─── Claim conflicts ───

  async createClaimConflict(input: CreateClaimConflictInput): Promise<ClaimConflict> {
    const now = new Date();
    const conflict: ClaimConflict = {
      id: uuidv4(),
      facilityKey: input.facilityKey,
      facilityName: input.facilityName,
      existingOrganizationId: input.existingOrganizationId,
      attemptedOrgName: input.attemptedOrgName,
      attemptedByUsername: input.attemptedByUsername,
      attemptedByEmail: input.attemptedByEmail,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    this.conflicts.set(conflict.id, conflict);
    return conflict;
  }

  async getClaimConflicts(status?: ClaimConflict['status']): Promise<ClaimConflict[]> {
    const all = Array.from(this.conflicts.values());
    return status ? all.filter((c) => c.status === status) : all;
  }

  async updateClaimConflict(
    id: string,
    updates: Partial<
      Pick<ClaimConflict, 'status' | 'resolution' | 'resolutionNotes' | 'resolvedBy' | 'resolvedAt'>
    >,
  ): Promise<ClaimConflict | null> {
    const conflict = this.conflicts.get(id);
    if (!conflict) return null;
    const updated: ClaimConflict = { ...conflict, ...updates, updatedAt: new Date() };
    this.conflicts.set(id, updated);
    return updated;
  }

  // ─── Platform audit log ───

  async createPlatformAuditLog(input: CreatePlatformAuditLogInput): Promise<PlatformAuditLog> {
    const log: PlatformAuditLog = {
      id: uuidv4(),
      actorUserId: input.actorUserId,
      actorUsername: input.actorUsername,
      action: input.action,
      targetOrganizationId: input.targetOrganizationId,
      targetUserId: input.targetUserId,
      details: input.details,
      createdAt: new Date(),
    };
    this.auditLogs.set(log.id, log);
    return log;
  }

  async getPlatformAuditLogs(limit = 100, offset = 0): Promise<PlatformAuditLog[]> {
    const all = Array.from(this.auditLogs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return all.slice(offset, offset + limit);
  }

  async clear(): Promise<void> {
    this.memberships.clear();
    this.invites.clear();
    this.conflicts.clear();
    this.auditLogs.clear();
  }
}

let instance: OrgAccessDatabase | null = null;

export function getOrgAccessDatabase(): OrgAccessDatabase {
  if (!instance) {
    instance = new OrgAccessDatabase();
  }
  return instance;
}
