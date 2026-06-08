/**
 * In-Memory Organization Database Service
 *
 * SaaS billing-tenant store for development and testing. Production uses the
 * Table Storage twin (tableStorageOrganizationDatabase.ts), selected by the
 * factory. Keep the two implementations in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Organization, PlanCode, Entitlements } from '../types';
import { getDefaultEntitlements } from '../constants/plans';

export interface CreateOrganizationInput {
  name: string;
  billingEmail: string;
  planCode?: PlanCode;
}

/** Generate a url-safe slug from an organization name. */
export function slugify(name: string): string {
  // Collapse every run of non-alphanumerics to a single '-'. After this there
  // are no consecutive dashes, so trimming needs only a single-character,
  // non-backtracking pattern (avoids the polynomial-ReDoS of an anchored `-+`).
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'org';
}

export interface IOrganizationDatabase {
  createOrganization(input: CreateOrganizationInput): Promise<Organization>;
  getOrganizationById(id: string): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  updateOrganization(
    id: string,
    updates: Partial<Pick<Organization, 'name' | 'billingEmail' | 'planCode' | 'status' | 'entitlements' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'trialEndsAt'>>,
  ): Promise<Organization | null>;
  getAllOrganizations(): Promise<Organization[]>;
  clear(): Promise<void>;
}

export class OrganizationDatabase implements IOrganizationDatabase {
  private orgs: Map<string, Organization> = new Map();
  private orgsBySlug: Map<string, Organization> = new Map();

  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    const planCode: PlanCode = input.planCode ?? 'community';

    // Ensure a unique slug.
    let slug = slugify(input.name);
    let suffix = 1;
    while (this.orgsBySlug.has(slug)) {
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
      createdAt: now,
      updatedAt: now,
    };

    this.orgs.set(org.id, org);
    this.orgsBySlug.set(org.slug, org);
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    return this.orgsBySlug.get(slug) ?? null;
  }

  async updateOrganization(
    id: string,
    updates: Partial<Pick<Organization, 'name' | 'billingEmail' | 'planCode' | 'status' | 'entitlements' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'trialEndsAt'>>,
  ): Promise<Organization | null> {
    const org = this.orgs.get(id);
    if (!org) return null;

    const updated: Organization = { ...org, ...updates, updatedAt: new Date() };
    this.orgs.set(id, updated);
    // slug never changes here, but keep the secondary index consistent
    this.orgsBySlug.set(updated.slug, updated);
    return updated;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return Array.from(this.orgs.values());
  }

  async clear(): Promise<void> {
    this.orgs.clear();
    this.orgsBySlug.clear();
  }
}

let instance: OrganizationDatabase | null = null;

export function getOrganizationDatabase(): OrganizationDatabase {
  if (!instance) {
    instance = new OrganizationDatabase();
  }
  return instance;
}

// Re-export for callers that want the helper without importing constants directly.
export type { Entitlements };
