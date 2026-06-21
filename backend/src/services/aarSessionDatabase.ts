/**
 * In-Memory AAR Session Database Service
 *
 * Persists AAR Studio reviews server-side, scoped to the owning organization,
 * so a review survives device loss and is visible to the whole brigade rather
 * than living only in one facilitator's localStorage. Production uses the Table
 * Storage twin (tableStorageAarSessionDatabase.ts), selected by the factory.
 * Keep the two implementations in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { AARSession } from '../types';

/** Fields a caller provides when saving a review. */
export interface UpsertAarSessionInput {
  id: string;                    // client-owned id (AAR Studio generates it)
  organizationId: string;
  stationId?: string;
  title: string;
  incidentDate?: string;
  schemaVersion: number;
  payload: string;
  createdBy?: string;
  createdByName?: string;
}

/** Lightweight row for the roster listing (no payload). */
export type AarSessionSummary = Omit<AARSession, 'payload'>;

export interface IAarSessionDatabase {
  /** Create or replace a review (client owns the id; org scoping is enforced). */
  upsert(input: UpsertAarSessionInput): Promise<AARSession>;
  /** Full review by id, scoped to an org (null if missing or another org's). */
  getById(organizationId: string, id: string): Promise<AARSession | null>;
  /** Review summaries for an org, newest-updated first. */
  listByOrganization(organizationId: string): Promise<AarSessionSummary[]>;
  /** Delete a review; returns true if a row was removed. */
  delete(organizationId: string, id: string): Promise<boolean>;
  clear(): Promise<void>;
}

function toSummary(row: AARSession): AarSessionSummary {
  const { payload: _payload, ...summary } = row;
  return summary;
}

export class AarSessionDatabase implements IAarSessionDatabase {
  // Keyed by `${organizationId}/${id}` to mirror Table Storage's composite
  // (partitionKey, rowKey) — so two orgs that happen to share a client id never
  // collide and one org can never read or clobber another's review.
  private rows: Map<string, AARSession> = new Map();

  private key(organizationId: string, id: string): string {
    return `${organizationId}/${id}`;
  }

  async upsert(input: UpsertAarSessionInput): Promise<AARSession> {
    const existing = this.rows.get(this.key(input.organizationId, input.id));
    const now = new Date();
    const row: AARSession = {
      id: input.id,
      organizationId: input.organizationId,
      stationId: input.stationId,
      title: input.title,
      incidentDate: input.incidentDate,
      schemaVersion: input.schemaVersion,
      payload: input.payload,
      // Preserve creation metadata when an org updates its own existing review.
      createdBy: existing ? existing.createdBy ?? input.createdBy : input.createdBy,
      createdByName: existing ? existing.createdByName ?? input.createdByName : input.createdByName,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    this.rows.set(this.key(row.organizationId, row.id), row);
    return row;
  }

  async getById(organizationId: string, id: string): Promise<AARSession | null> {
    return this.rows.get(this.key(organizationId, id)) ?? null;
  }

  async listByOrganization(organizationId: string): Promise<AarSessionSummary[]> {
    return Array.from(this.rows.values())
      .filter((r) => r.organizationId === organizationId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(toSummary);
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    return this.rows.delete(this.key(organizationId, id));
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: AarSessionDatabase | null = null;

export function getAarSessionDatabase(): AarSessionDatabase {
  if (!instance) {
    instance = new AarSessionDatabase();
  }
  return instance;
}

export { uuidv4 as generateAarSessionId };
