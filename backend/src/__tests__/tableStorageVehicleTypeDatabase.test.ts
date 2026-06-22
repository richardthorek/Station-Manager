/**
 * Tests for the Table Storage VehicleType twin against the in-memory
 * @azure/data-tables mock. Exercises the round-trip + mapping (standardItems
 * JSON, isStandard, chunk-free fields) so the production twin stays in step with
 * the in-memory one.
 *
 * Note: the data-tables mock only understands `PartitionKey eq` filters, so the
 * list assertions check membership rather than strict org/standard exclusion
 * (that filtering is asserted against the in-memory twin in
 * vehicleTypeDatabase.test.ts).
 */

jest.mock('@azure/data-tables');

import { TableStorageVehicleTypeDatabase } from '../services/tableStorageVehicleTypeDatabase';
import * as dataTables from '@azure/data-tables';
import type { ChecklistItem } from '../types';

// The manual mock exposes __clearMockTables; the real module's types don't.
const clearMockTables = (dataTables as unknown as { __clearMockTables: () => void }).__clearMockTables;

const items = (...names: string[]): ChecklistItem[] =>
  names.map((name, i) => ({ id: '', name, description: `${name} desc`, order: i }));

describe('TableStorageVehicleTypeDatabase', () => {
  let db: TableStorageVehicleTypeDatabase;

  beforeEach(async () => {
    clearMockTables();
    db = new TableStorageVehicleTypeDatabase('UseDevelopmentStorage=true');
    await db.connect();
    await db.connect(); // idempotent second call (covers the early return)
  });

  it('creates and reads back a type with normalised standard items', async () => {
    const created = await db.create({
      organizationId: 'org-1',
      isStandard: true,
      code: 'cat1-tanker',
      name: 'Cat 1 Tanker',
      description: 'desc',
      category: 'tanker',
      standardItems: items('Tyre Condition', 'Pump'),
      createdBy: 'u1',
    });
    expect(created.id).toBeTruthy();

    const fetched = await db.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Cat 1 Tanker');
    expect(fetched!.isStandard).toBe(true);
    expect(fetched!.organizationId).toBe('org-1');
    expect(fetched!.standardItems).toHaveLength(2);
    expect(fetched!.standardItems[0].itemCode).toBe('tyre-condition');
    expect(fetched!.standardItems[0].isStandard).toBe(true);
  });

  it('getById returns null for a missing id', async () => {
    expect(await db.getById('nope')).toBeNull();
  });

  it('updates fields and re-normalises standard items', async () => {
    const created = await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: items('Old') });
    const updated = await db.update(created.id, { name: 'A2', standardItems: items('New Check'), category: 'pumper' });
    expect(updated?.name).toBe('A2');
    expect(updated?.category).toBe('pumper');
    expect(updated?.standardItems[0].itemCode).toBe('new-check');

    const refetched = await db.getById(created.id);
    expect(refetched?.name).toBe('A2');
    expect(refetched?.standardItems[0].name).toBe('New Check');
  });

  it('update returns null for a missing id', async () => {
    expect(await db.update('nope', { name: 'x' })).toBeNull();
  });

  it('lists types and standards (membership)', async () => {
    await db.create({ organizationId: 'org-1', isStandard: true, code: 'std', name: 'Standard', standardItems: [] });
    await db.create({ organizationId: 'org-1', code: 'priv', name: 'Private', standardItems: [] });

    const forOrg = await db.listForOrganization('org-1');
    expect(forOrg.map((t) => t.name).sort()).toContain('Standard');

    const standards = await db.listStandards();
    expect(standards.length).toBeGreaterThanOrEqual(1);
  });

  it('deletes a type', async () => {
    const created = await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: [] });
    expect(await db.delete(created.id)).toBe(true);
    expect(await db.getById(created.id)).toBeNull();
  });

  it('clear empties the table', async () => {
    await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: [] });
    await db.clear();
    expect((await db.listStandards()).length).toBe(0);
  });
});
