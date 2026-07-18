/**
 * Azure Table Storage Organization Database Service
 *
 * Production twin of OrganizationDatabase. Persists SaaS billing tenants.
 * Partition strategy: PartitionKey = 'Organization', RowKey = org.id.
 * Entitlements are stored as a JSON string column.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { Organization, PlanCode, Entitlements, OrganizationStatus, FacilityServiceType } from '../types';
import { getDefaultEntitlements } from '../constants/plans';
import {
  slugify,
  type IOrganizationDatabase,
  type CreateOrganizationInput,
  type OrganizationUpdate,
} from './organizationDatabase';

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

interface OrganizationEntity extends TableEntity {
  name: string;
  slug: string;
  billingEmail: string;
  planCode: string;
  status: string;
  entitlementsJson: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  aiBonusSessions?: number;
  facilityKey?: string;
  facilityObjectId?: string;
  facilityServiceType?: string;
  facilityName?: string;
  facilityState?: string;
  facilityCustom?: boolean;
  claimedByUserId?: string;
  claimedAt?: string;
  agencyName?: string;
  agencyLogoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export class TableStorageOrganizationDatabase implements IOrganizationDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('Organizations');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create Organizations table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for Organizations', { tableName });
  }

  private toEntity(org: Organization): OrganizationEntity {
    return {
      partitionKey: 'Organization',
      rowKey: org.id,
      name: org.name,
      slug: org.slug,
      billingEmail: org.billingEmail,
      planCode: org.planCode,
      status: org.status,
      entitlementsJson: JSON.stringify(org.entitlements),
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: org.stripeSubscriptionId,
      trialEndsAt: org.trialEndsAt?.toISOString(),
      aiBonusSessions: org.aiBonusSessions,
      facilityKey: org.facilityKey,
      facilityObjectId: org.facilityObjectId,
      facilityServiceType: org.facilityServiceType,
      facilityName: org.facilityName,
      facilityState: org.facilityState,
      facilityCustom: org.facilityCustom,
      claimedByUserId: org.claimedByUserId,
      claimedAt: org.claimedAt?.toISOString(),
      agencyName: org.agencyName,
      agencyLogoUrl: org.agencyLogoUrl,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  private fromEntity(entity: OrganizationEntity): Organization {
    return {
      id: entity.rowKey as string,
      name: entity.name,
      slug: entity.slug,
      billingEmail: entity.billingEmail,
      planCode: entity.planCode as PlanCode,
      status: entity.status as OrganizationStatus,
      entitlements: JSON.parse(entity.entitlementsJson) as Entitlements,
      stripeCustomerId: entity.stripeCustomerId,
      stripeSubscriptionId: entity.stripeSubscriptionId,
      trialEndsAt: entity.trialEndsAt ? new Date(entity.trialEndsAt) : undefined,
      aiBonusSessions: entity.aiBonusSessions,
      facilityKey: entity.facilityKey,
      facilityObjectId: entity.facilityObjectId,
      facilityServiceType: entity.facilityServiceType as FacilityServiceType | undefined,
      facilityName: entity.facilityName,
      facilityState: entity.facilityState,
      facilityCustom: entity.facilityCustom,
      claimedByUserId: entity.claimedByUserId,
      claimedAt: entity.claimedAt ? new Date(entity.claimedAt) : undefined,
      agencyName: entity.agencyName,
      agencyLogoUrl: entity.agencyLogoUrl,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    const planCode: PlanCode = input.planCode ?? 'community';

    // Ensure unique slug by probing existing rows.
    let slug = slugify(input.name);
    let suffix = 1;
    while (await this.getOrganizationBySlug(slug)) {
      slug = `${slugify(input.name)}-${suffix++}`;
    }

    const now = new Date();
    const org: Organization = {
      id: uuidv4(),
      name: input.name,
      slug,
      billingEmail: input.billingEmail,
      planCode,
      status: planCode === 'community' ? 'active' : 'trialing',
      entitlements: getDefaultEntitlements(planCode),
      facilityKey: input.facilityKey,
      facilityObjectId: input.facilityObjectId,
      facilityServiceType: input.facilityServiceType,
      facilityName: input.facilityName,
      facilityState: input.facilityState,
      facilityCustom: input.facilityCustom,
      claimedByUserId: input.claimedByUserId,
      claimedAt: input.claimedAt,
      agencyName: input.agencyName,
      agencyLogoUrl: input.agencyLogoUrl,
      createdAt: now,
      updatedAt: now,
    };

    await this.table.createEntity(this.toEntity(org));
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      const entity = await this.table.getEntity<OrganizationEntity>('Organization', id);
      return this.fromEntity(entity as OrganizationEntity);
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    // Use the odata tagged-template helper, which safely parameterises the
    // value (no manual string interpolation into the filter).
    const iterator = this.table.listEntities<OrganizationEntity>({
      queryOptions: { filter: odata`slug eq ${slug}` },
    });
    for await (const entity of iterator) {
      return this.fromEntity(entity as OrganizationEntity);
    }
    return null;
  }

  async updateOrganization(id: string, updates: OrganizationUpdate): Promise<Organization | null> {
    const existing = await this.getOrganizationById(id);
    if (!existing) return null;
    const updated: Organization = { ...existing, ...updates, updatedAt: new Date() };
    await this.table.updateEntity(this.toEntity(updated), 'Replace');
    return updated;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    try {
      await this.table.deleteEntity('Organization', id);
      return true;
    } catch (err: any) {
      if (err.statusCode === 404) return false;
      throw err;
    }
  }

  async getAllOrganizations(): Promise<Organization[]> {
    const result: Organization[] = [];
    const iterator = this.table.listEntities<OrganizationEntity>();
    for await (const entity of iterator) {
      result.push(this.fromEntity(entity as OrganizationEntity));
    }
    return result;
  }

  async getOrganizationsByFacilityKey(facilityKey: string): Promise<Organization[]> {
    const result: Organization[] = [];
    const iterator = this.table.listEntities<OrganizationEntity>({
      queryOptions: { filter: odata`facilityKey eq ${facilityKey}` },
    });
    for await (const entity of iterator) {
      result.push(this.fromEntity(entity as OrganizationEntity));
    }
    return result;
  }

  async getAllFacilityKeys(): Promise<Set<string>> {
    const keys = new Set<string>();
    const iterator = this.table.listEntities<OrganizationEntity>({
      queryOptions: { select: ['facilityKey'] },
    });
    for await (const entity of iterator) {
      if (entity.facilityKey) keys.add(entity.facilityKey);
    }
    return keys;
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<OrganizationEntity>();
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
