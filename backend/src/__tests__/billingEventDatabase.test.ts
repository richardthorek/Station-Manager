/**
 * Unit tests for the in-memory BillingEventDatabase — the audit twin used in
 * dev/test. Covers the idempotency lookup and ordering guarantees the webhook
 * handler relies on.
 */

import { BillingEventDatabase } from '../services/billingEventDatabase';

describe('BillingEventDatabase', () => {
  let db: BillingEventDatabase;

  beforeEach(() => {
    db = new BillingEventDatabase();
  });

  it('records an event with a generated id and processedAt', async () => {
    const row = await db.record({
      organizationId: 'org-1',
      stripeEventId: 'evt_1',
      eventType: 'invoice.paid',
      payload: '{}',
    });
    expect(row.id).toBeTruthy();
    expect(row.processedAt).toBeInstanceOf(Date);
    expect(row.stripeEventId).toBe('evt_1');
  });

  it('finds a recorded event by its Stripe event id (idempotency lookup)', async () => {
    await db.record({ organizationId: 'org-1', stripeEventId: 'evt_42', eventType: 'x', payload: '{}' });
    const found = await db.findByStripeEventId('evt_42');
    expect(found?.stripeEventId).toBe('evt_42');
    expect(await db.findByStripeEventId('evt_missing')).toBeNull();
  });

  it('lists an org’s events and isolates other orgs', async () => {
    await db.record({ organizationId: 'org-1', stripeEventId: 'a', eventType: 'x', payload: '{}' });
    await db.record({ organizationId: 'org-1', stripeEventId: 'b', eventType: 'x', payload: '{}' });
    await db.record({ organizationId: 'org-2', stripeEventId: 'c', eventType: 'x', payload: '{}' });

    const org1 = await db.listByOrganization('org-1');
    expect(org1.map((e) => e.stripeEventId).sort()).toEqual(['a', 'b']);

    const all = await db.listAll();
    expect(all).toHaveLength(3);
  });

  it('orders distinct-timestamp events newest-first', async () => {
    const older = await db.record({ organizationId: 'org-1', stripeEventId: 'old', eventType: 'x', payload: '{}' });
    older.processedAt = new Date(Date.now() - 60_000);
    await db.record({ organizationId: 'org-1', stripeEventId: 'new', eventType: 'x', payload: '{}' });

    const rows = await db.listByOrganization('org-1');
    expect(rows[0].stripeEventId).toBe('new');
    expect(rows[1].stripeEventId).toBe('old');
  });

  it('keeps audit rows for events with no org metadata (listAll only)', async () => {
    await db.record({ stripeEventId: 'evt_noorg', eventType: 'x', payload: '{}' });
    expect(await db.listByOrganization('org-1')).toHaveLength(0);
    expect(await db.listAll()).toHaveLength(1);
  });

  it('clear() empties the store', async () => {
    await db.record({ organizationId: 'org-1', stripeEventId: 'a', eventType: 'x', payload: '{}' });
    await db.clear();
    expect(await db.listAll()).toHaveLength(0);
  });
});
