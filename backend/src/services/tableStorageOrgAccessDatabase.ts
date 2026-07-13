/**
 * Azure Table Storage Org Access Database Service
 *
 * Production twin of OrgAccessDatabase — three tables in one service:
 * - OrganizationMemberships: PartitionKey = organizationId, RowKey = userId
 *   (per-org partitioning like Santa Run; user-wide lookups filter on the
 *   userId column cross-partition, acceptable at this scale).
 * - OrgInvites: PartitionKey = 'OrgInvite', RowKey = invite.id (token lookups
 *   filter on the token column).
 * - ClaimConflicts: PartitionKey = 'ClaimConflict', RowKey = conflict.id.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { ClaimConflict, OrgInvite, OrgRole, OrganizationMembership } from '../types';
import type {
  CreateClaimConflictInput,
  CreateInviteInput,
  CreateMembershipInput,
  IOrgAccessDatabase,
} from './orgAccessDatabase';

function buildTableName(baseName: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  let defaultSuffix = '';
  if (process.env.NODE_ENV === 'test') defaultSuffix = 'Test';
  else if (process.env.NODE_ENV === 'development') defaultSuffix = 'Dev';
  const suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName;
}

interface MembershipEntity extends TableEntity {
  membershipId: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  invitedBy?: string;
  inviteId?: string;
  createdAt: string;
  updatedAt: string;
}

interface InviteEntity extends TableEntity {
  token: string;
  organizationId: string;
  role: string;
  email?: string;
  expiresAt: string;
  status: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ClaimConflictEntity extends TableEntity {
  facilityKey: string;
  facilityName: string;
  existingOrganizationId: string;
  attemptedOrgName: string;
  attemptedByUsername: string;
  attemptedByEmail: string;
  status: string;
  resolution?: string;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class TableStorageOrgAccessDatabase implements IOrgAccessDatabase {
  private connectionString: string;
  private membershipsTable!: TableClient;
  private invitesTable!: TableClient;
  private conflictsTable!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    const tables: Array<[string, (client: TableClient) => void]> = [
      ['OrganizationMemberships', (c) => (this.membershipsTable = c)],
      ['OrgInvites', (c) => (this.invitesTable = c)],
      ['ClaimConflicts', (c) => (this.conflictsTable = c)],
    ];
    for (const [baseName, assign] of tables) {
      const tableName = buildTableName(baseName);
      const client = TableClient.fromConnectionString(this.connectionString, tableName);
      try {
        await client.createTable();
      } catch (err: any) {
        if (err.statusCode !== 409) {
          logger.error(`Failed to create ${baseName} table`, { error: err, tableName });
          throw err;
        }
      }
      assign(client);
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for Org Access (memberships/invites/claim conflicts)');
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  // ─── Membership mapping ───

  private membershipToEntity(m: OrganizationMembership): MembershipEntity {
    return {
      partitionKey: m.organizationId,
      rowKey: m.userId,
      membershipId: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      status: m.status,
      invitedBy: m.invitedBy,
      inviteId: m.inviteId,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  private membershipFromEntity(entity: MembershipEntity): OrganizationMembership {
    return {
      id: entity.membershipId,
      userId: entity.userId,
      organizationId: entity.organizationId,
      role: entity.role as OrgRole,
      status: entity.status as OrganizationMembership['status'],
      invitedBy: entity.invitedBy,
      inviteId: entity.inviteId,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async createMembership(input: CreateMembershipInput): Promise<OrganizationMembership> {
    await this.ensureConnected();
    const existing = await this.getMembership(input.userId, input.organizationId);
    if (existing && existing.status === 'active') {
      throw new Error('Membership already exists');
    }
    if (existing) {
      const revived: OrganizationMembership = {
        ...existing,
        role: input.role,
        status: 'active',
        invitedBy: input.invitedBy ?? existing.invitedBy,
        inviteId: input.inviteId ?? existing.inviteId,
        updatedAt: new Date(),
      };
      await this.membershipsTable.updateEntity(this.membershipToEntity(revived), 'Replace');
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
    await this.membershipsTable.createEntity(this.membershipToEntity(membership));
    return membership;
  }

  async getMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null> {
    await this.ensureConnected();
    try {
      const entity = await this.membershipsTable.getEntity<MembershipEntity>(organizationId, userId);
      return this.membershipFromEntity(entity as MembershipEntity);
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async getMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    await this.ensureConnected();
    const result: OrganizationMembership[] = [];
    const iterator = this.membershipsTable.listEntities<MembershipEntity>({
      queryOptions: { filter: odata`userId eq ${userId}` },
    });
    for await (const entity of iterator) {
      result.push(this.membershipFromEntity(entity as MembershipEntity));
    }
    return result;
  }

  async getMembershipsByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    await this.ensureConnected();
    const result: OrganizationMembership[] = [];
    const iterator = this.membershipsTable.listEntities<MembershipEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${organizationId}` },
    });
    for await (const entity of iterator) {
      result.push(this.membershipFromEntity(entity as MembershipEntity));
    }
    return result;
  }

  async updateMembership(
    id: string,
    updates: Partial<Pick<OrganizationMembership, 'role' | 'status'>>,
  ): Promise<OrganizationMembership | null> {
    await this.ensureConnected();
    // Memberships are keyed by (org, user); find the row by membershipId column.
    const iterator = this.membershipsTable.listEntities<MembershipEntity>({
      queryOptions: { filter: odata`membershipId eq ${id}` },
    });
    for await (const entity of iterator) {
      const membership = this.membershipFromEntity(entity as MembershipEntity);
      const updated: OrganizationMembership = { ...membership, ...updates, updatedAt: new Date() };
      await this.membershipsTable.updateEntity(this.membershipToEntity(updated), 'Replace');
      return updated;
    }
    return null;
  }

  // ─── Invite mapping ───

  private inviteToEntity(invite: OrgInvite): InviteEntity {
    return {
      partitionKey: 'OrgInvite',
      rowKey: invite.id,
      token: invite.token,
      organizationId: invite.organizationId,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
      status: invite.status,
      usageCount: invite.usageCount,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt.toISOString(),
      updatedAt: invite.updatedAt.toISOString(),
    };
  }

  private inviteFromEntity(entity: InviteEntity): OrgInvite {
    return {
      id: entity.rowKey as string,
      token: entity.token,
      organizationId: entity.organizationId,
      role: entity.role as OrgRole,
      email: entity.email,
      expiresAt: new Date(entity.expiresAt),
      status: entity.status as OrgInvite['status'],
      usageCount: entity.usageCount,
      createdBy: entity.createdBy,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async createInvite(input: CreateInviteInput): Promise<OrgInvite> {
    await this.ensureConnected();
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
    await this.invitesTable.createEntity(this.inviteToEntity(invite));
    return invite;
  }

  async getInviteByToken(token: string): Promise<OrgInvite | null> {
    await this.ensureConnected();
    const iterator = this.invitesTable.listEntities<InviteEntity>({
      queryOptions: { filter: odata`token eq ${token}` },
    });
    for await (const entity of iterator) {
      return this.inviteFromEntity(entity as InviteEntity);
    }
    return null;
  }

  async getInvitesByOrganization(organizationId: string): Promise<OrgInvite[]> {
    await this.ensureConnected();
    const result: OrgInvite[] = [];
    const iterator = this.invitesTable.listEntities<InviteEntity>({
      queryOptions: { filter: odata`organizationId eq ${organizationId}` },
    });
    for await (const entity of iterator) {
      result.push(this.inviteFromEntity(entity as InviteEntity));
    }
    return result;
  }

  async updateInvite(
    id: string,
    updates: Partial<Pick<OrgInvite, 'status' | 'usageCount'>>,
  ): Promise<OrgInvite | null> {
    await this.ensureConnected();
    try {
      const entity = await this.invitesTable.getEntity<InviteEntity>('OrgInvite', id);
      const invite = this.inviteFromEntity(entity as InviteEntity);
      const updated: OrgInvite = { ...invite, ...updates, updatedAt: new Date() };
      await this.invitesTable.updateEntity(this.inviteToEntity(updated), 'Replace');
      return updated;
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  // ─── Claim conflict mapping ───

  private conflictToEntity(c: ClaimConflict): ClaimConflictEntity {
    return {
      partitionKey: 'ClaimConflict',
      rowKey: c.id,
      facilityKey: c.facilityKey,
      facilityName: c.facilityName,
      existingOrganizationId: c.existingOrganizationId,
      attemptedOrgName: c.attemptedOrgName,
      attemptedByUsername: c.attemptedByUsername,
      attemptedByEmail: c.attemptedByEmail,
      status: c.status,
      resolution: c.resolution,
      resolutionNotes: c.resolutionNotes,
      resolvedBy: c.resolvedBy,
      resolvedAt: c.resolvedAt?.toISOString(),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private conflictFromEntity(entity: ClaimConflictEntity): ClaimConflict {
    return {
      id: entity.rowKey as string,
      facilityKey: entity.facilityKey,
      facilityName: entity.facilityName,
      existingOrganizationId: entity.existingOrganizationId,
      attemptedOrgName: entity.attemptedOrgName,
      attemptedByUsername: entity.attemptedByUsername,
      attemptedByEmail: entity.attemptedByEmail,
      status: entity.status as ClaimConflict['status'],
      resolution: entity.resolution as ClaimConflict['resolution'],
      resolutionNotes: entity.resolutionNotes,
      resolvedBy: entity.resolvedBy,
      resolvedAt: entity.resolvedAt ? new Date(entity.resolvedAt) : undefined,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async createClaimConflict(input: CreateClaimConflictInput): Promise<ClaimConflict> {
    await this.ensureConnected();
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
    await this.conflictsTable.createEntity(this.conflictToEntity(conflict));
    return conflict;
  }

  async getClaimConflicts(status?: ClaimConflict['status']): Promise<ClaimConflict[]> {
    await this.ensureConnected();
    const result: ClaimConflict[] = [];
    const iterator = this.conflictsTable.listEntities<ClaimConflictEntity>({
      queryOptions: status ? { filter: odata`status eq ${status}` } : undefined,
    });
    for await (const entity of iterator) {
      result.push(this.conflictFromEntity(entity as ClaimConflictEntity));
    }
    return result;
  }

  async updateClaimConflict(
    id: string,
    updates: Partial<
      Pick<ClaimConflict, 'status' | 'resolution' | 'resolutionNotes' | 'resolvedBy' | 'resolvedAt'>
    >,
  ): Promise<ClaimConflict | null> {
    await this.ensureConnected();
    try {
      const entity = await this.conflictsTable.getEntity<ClaimConflictEntity>('ClaimConflict', id);
      const conflict = this.conflictFromEntity(entity as ClaimConflictEntity);
      const updated: ClaimConflict = { ...conflict, ...updates, updatedAt: new Date() };
      await this.conflictsTable.updateEntity(this.conflictToEntity(updated), 'Replace');
      return updated;
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async clear(): Promise<void> {
    await this.ensureConnected();
    for (const table of [this.membershipsTable, this.invitesTable, this.conflictsTable]) {
      const iterator = table.listEntities<TableEntity>();
      for await (const entity of iterator) {
        await table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
      }
    }
  }
}
