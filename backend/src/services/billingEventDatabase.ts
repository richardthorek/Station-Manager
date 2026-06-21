/**
 * In-Memory Billing Event Database Service
 *
 * Persists an audit row for every Stripe webhook event received (including
 * failures), providing an idempotency check and a troubleshooting trail.
 * Production uses the Table Storage twin (tableStorageBillingEventDatabase.ts),
 * selected by the factory. Keep the two implementations in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { BillingEvent } from '../types';

/** A new billing event before it is assigned an id / processedAt timestamp. */
export type RecordBillingEventInput = Omit<BillingEvent, 'id' | 'processedAt'>;

export interface IBillingEventDatabase {
  /** Append an audit row; returns the stored record (with id + processedAt). */
  record(input: RecordBillingEventInput): Promise<BillingEvent>;
  /** Look a row up by its Stripe event id — used for webhook idempotency. */
  findByStripeEventId(stripeEventId: string): Promise<BillingEvent | null>;
  /** All audit rows for an org, newest first. */
  listByOrganization(organizationId: string): Promise<BillingEvent[]>;
  /** All audit rows (admin/debug), newest first. */
  listAll(): Promise<BillingEvent[]>;
  clear(): Promise<void>;
}

export class BillingEventDatabase implements IBillingEventDatabase {
  private rows: Map<string, BillingEvent> = new Map();

  async record(input: RecordBillingEventInput): Promise<BillingEvent> {
    const row: BillingEvent = { id: uuidv4(), processedAt: new Date(), ...input };
    this.rows.set(row.id, row);
    return row;
  }

  async findByStripeEventId(stripeEventId: string): Promise<BillingEvent | null> {
    for (const row of this.rows.values()) {
      if (row.stripeEventId === stripeEventId) return row;
    }
    return null;
  }

  async listByOrganization(organizationId: string): Promise<BillingEvent[]> {
    return Array.from(this.rows.values())
      .filter((r) => r.organizationId === organizationId)
      .sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }

  async listAll(): Promise<BillingEvent[]> {
    return Array.from(this.rows.values()).sort(
      (a, b) => b.processedAt.getTime() - a.processedAt.getTime(),
    );
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: BillingEventDatabase | null = null;

export function getBillingEventDatabase(): BillingEventDatabase {
  if (!instance) {
    instance = new BillingEventDatabase();
  }
  return instance;
}
