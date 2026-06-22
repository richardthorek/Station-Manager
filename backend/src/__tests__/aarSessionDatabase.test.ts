/**
 * Unit tests for the in-memory AarSessionDatabase — the persistence twin used in
 * dev/test. Covers org scoping (the composite key that mirrors Table Storage),
 * create-vs-update metadata handling, summary projection, and ordering.
 */

import { AarSessionDatabase, AarSessionConflictError, type UpsertAarSessionInput } from '../services/aarSessionDatabase';

function input(overrides: Partial<UpsertAarSessionInput> = {}): UpsertAarSessionInput {
  return {
    id: 'sess-1',
    organizationId: 'org-1',
    title: 'Grass fire AAR',
    schemaVersion: 1,
    payload: '{"hello":"world"}',
    ...overrides,
  };
}

describe('AarSessionDatabase', () => {
  let db: AarSessionDatabase;

  beforeEach(() => {
    db = new AarSessionDatabase();
  });

  it('creates a review with createdAt/updatedAt and stamps the facilitator', async () => {
    const row = await db.upsert(input({ createdBy: 'user-1', createdByName: 'Alice' }));
    expect(row.id).toBe('sess-1');
    expect(row.organizationId).toBe('org-1');
    expect(row.createdBy).toBe('user-1');
    expect(row.createdByName).toBe('Alice');
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it('preserves createdAt and original facilitator when the owner updates a review', async () => {
    const first = await db.upsert(input({ createdBy: 'user-1', createdByName: 'Alice' }));
    // Simulate time passing so updatedAt can advance.
    first.createdAt = new Date(Date.now() - 60_000);
    db['rows'].set('org-1/sess-1', first); // keep the doctored createdAt in the store

    const updated = await db.upsert(input({ title: 'Renamed', createdBy: 'user-2', createdByName: 'Bob' }));
    expect(updated.title).toBe('Renamed');
    expect(updated.createdAt.getTime()).toBe(first.createdAt.getTime()); // unchanged
    expect(updated.createdBy).toBe('user-1');     // original facilitator kept
    expect(updated.createdByName).toBe('Alice');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(first.createdAt.getTime());
  });

  it('scopes by org: the same client id in two orgs are distinct rows', async () => {
    await db.upsert(input({ id: 'shared', organizationId: 'org-1', title: 'Org1 review' }));
    await db.upsert(input({ id: 'shared', organizationId: 'org-2', title: 'Org2 review' }));

    const a = await db.getById('org-1', 'shared');
    const b = await db.getById('org-2', 'shared');
    expect(a?.title).toBe('Org1 review');
    expect(b?.title).toBe('Org2 review');
  });

  it('getById returns null for another org and for a missing id', async () => {
    await db.upsert(input({ id: 'sess-1', organizationId: 'org-1' }));
    expect(await db.getById('org-2', 'sess-1')).toBeNull();
    expect(await db.getById('org-1', 'nope')).toBeNull();
  });

  it('lists an org’s reviews newest-updated first, without the payload', async () => {
    const older = await db.upsert(input({ id: 'a', title: 'Older' }));
    older.updatedAt = new Date(Date.now() - 60_000);
    db['rows'].set('org-1/a', older);
    await db.upsert(input({ id: 'b', title: 'Newer' }));
    await db.upsert(input({ id: 'c', organizationId: 'org-2', title: 'Other org' }));

    const list = await db.listByOrganization('org-1');
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);
    expect(list.map((s) => s.title)).toEqual(['Newer', 'Older']);
    expect((list[0] as { payload?: string }).payload).toBeUndefined();
  });

  it('delete is org-scoped and reports whether a row was removed', async () => {
    await db.upsert(input({ id: 'sess-1', organizationId: 'org-1' }));
    expect(await db.delete('org-2', 'sess-1')).toBe(false); // wrong org
    expect(await db.getById('org-1', 'sess-1')).not.toBeNull();
    expect(await db.delete('org-1', 'sess-1')).toBe(true);
    expect(await db.getById('org-1', 'sess-1')).toBeNull();
    expect(await db.delete('org-1', 'sess-1')).toBe(false); // already gone
  });

  it('rejects a stale write (older clientUpdatedAt) with a conflict', async () => {
    await db.upsert(input({ clientUpdatedAt: '2026-06-21T10:00:00.000Z' }));
    // An older edit from another device must not clobber the newer stored copy.
    await expect(
      db.upsert(input({ title: 'Stale', clientUpdatedAt: '2026-06-21T09:00:00.000Z' })),
    ).rejects.toBeInstanceOf(AarSessionConflictError);
    const stored = await db.getById('org-1', 'sess-1');
    expect(stored?.title).toBe('Grass fire AAR'); // unchanged
  });

  it('accepts a newer write and a write with no clientUpdatedAt (last-write-wins)', async () => {
    await db.upsert(input({ clientUpdatedAt: '2026-06-21T10:00:00.000Z' }));
    const newer = await db.upsert(input({ title: 'Newer', clientUpdatedAt: '2026-06-21T11:00:00.000Z' }));
    expect(newer.title).toBe('Newer');
    // Omitting clientUpdatedAt opts out of the guard entirely.
    const forced = await db.upsert(input({ title: 'Forced' }));
    expect(forced.title).toBe('Forced');
  });

  it('clear() empties the store', async () => {
    await db.upsert(input({ id: 'a' }));
    await db.upsert(input({ id: 'b' }));
    await db.clear();
    expect(await db.listByOrganization('org-1')).toHaveLength(0);
  });
});
