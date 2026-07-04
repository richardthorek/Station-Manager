/**
 * In-Memory AI Usage Database Service
 *
 * Records AI gateway usage for metered billing and the monthly allowance
 * check. Production uses the Table Storage twin (tableStorageUsageDatabase.ts),
 * selected by the factory. Keep the two implementations in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { UsageRecord, UsageType } from '../types';

export interface RecordUsageInput {
  organizationId: string;
  type: UsageType;
  units?: number;
  sessionId?: string;
}

/** First instant of the next calendar month (UTC) — when the allowance resets. */
export function monthlyResetAt(from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

/** First instant of the current calendar month (UTC). */
export function monthStart(from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
}

export interface IUsageDatabase {
  recordUsage(input: RecordUsageInput): Promise<UsageRecord>;
  /** Count usage rows of a given type for an org since `since` (default: this month), deduped by sessionId. */
  countUsage(organizationId: string, type: UsageType, since?: Date): Promise<number>;
  /**
   * Has this sessionId already been recorded this month? Lets a route allow a
   * re-vend for an already-counted session through the allowance gate without
   * re-checking (or re-consuming) it (AAR-11).
   */
  hasRecordedSession(organizationId: string, type: UsageType, sessionId: string, since?: Date): Promise<boolean>;
  /** All usage rows for an org (optionally since a date), newest first. */
  listUsage(organizationId: string, since?: Date): Promise<UsageRecord[]>;
  /** Rows not yet reported to Stripe metered billing. */
  listUnreported(): Promise<UsageRecord[]>;
  markReported(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

export class UsageDatabase implements IUsageDatabase {
  private rows: Map<string, UsageRecord> = new Map();

  async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
    const row: UsageRecord = {
      id: uuidv4(),
      organizationId: input.organizationId,
      type: input.type,
      units: input.units ?? 1,
      sessionId: input.sessionId,
      createdAt: new Date(),
      reportedToStripe: false,
    };
    this.rows.set(row.id, row);
    return row;
  }

  /**
   * A speech-token re-vend for the same review (proactive refresh, or a
   * reconnect after a blip — both introduced by the AAR-6/AAR-8 reliability
   * fixes) shares one `sessionId`, so it counts once, not once per vend. Rows
   * with no `sessionId` (older clients, or usage types that don't send one)
   * each count individually, unchanged (AAR Studio hero review 2026-07-03,
   * AAR-11).
   */
  async countUsage(organizationId: string, type: UsageType, since: Date = monthStart()): Promise<number> {
    let total = 0;
    const seenSessionIds = new Set<string>();
    for (const row of this.rows.values()) {
      if (row.organizationId !== organizationId || row.type !== type || row.createdAt < since) continue;
      if (row.sessionId) {
        if (seenSessionIds.has(row.sessionId)) continue;
        seenSessionIds.add(row.sessionId);
      }
      total += row.units;
    }
    return total;
  }

  async hasRecordedSession(organizationId: string, type: UsageType, sessionId: string, since: Date = monthStart()): Promise<boolean> {
    for (const row of this.rows.values()) {
      if (row.organizationId === organizationId && row.type === type && row.sessionId === sessionId && row.createdAt >= since) {
        return true;
      }
    }
    return false;
  }

  async listUsage(organizationId: string, since?: Date): Promise<UsageRecord[]> {
    return Array.from(this.rows.values())
      .filter((r) => r.organizationId === organizationId && (!since || r.createdAt >= since))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listUnreported(): Promise<UsageRecord[]> {
    return Array.from(this.rows.values()).filter((r) => !r.reportedToStripe);
  }

  async markReported(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) row.reportedToStripe = true;
    }
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: UsageDatabase | null = null;

export function getUsageDatabase(): UsageDatabase {
  if (!instance) {
    instance = new UsageDatabase();
  }
  return instance;
}
