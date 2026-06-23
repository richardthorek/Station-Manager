/**
 * Table Storage twin tests for ApplianceEquipment, using an in-memory fake of
 * `@azure/data-tables` (TableClient + odata). Exercises the production
 * persistence path (create/get/update/delete/list/connect/clear) without Azure,
 * mirroring what the in-memory twin guarantees.
 */

type Entity = Record<string, unknown> & { partitionKey: string; rowKey: string };

// In-memory store shared across the fake client instance.
const store = new Map<string, Entity>();
const key = (pk: string, rk: string) => `${pk}::${rk}`;

// Parse the tiny subset of odata our twin emits: `Field eq 'value'`.
function matches(filter: string | undefined, e: Entity): boolean {
  if (!filter) return true;
  const m = filter.match(/(\w+)\s+eq\s+'([^']*)'/);
  if (!m) return true;
  const [, field, value] = m;
  return String((e as Record<string, unknown>)[field === 'RowKey' ? 'rowKey' : field === 'PartitionKey' ? 'partitionKey' : field]) === value;
}

jest.mock('@azure/data-tables', () => ({
  odata: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? `'${values[i]}'` : ''), ''),
  TableClient: {
    fromConnectionString: () => ({
      createTable: async () => {},
      createEntity: async (entity: Entity) => { store.set(key(entity.partitionKey, entity.rowKey), { ...entity }); },
      getEntity: async (pk: string, rk: string) => {
        const e = store.get(key(pk, rk));
        if (!e) { const err: any = new Error('not found'); err.statusCode = 404; throw err; }
        return e;
      },
      updateEntity: async (entity: Entity) => { store.set(key(entity.partitionKey, entity.rowKey), { ...entity }); },
      deleteEntity: async (pk: string, rk: string) => {
        if (!store.has(key(pk, rk))) { const err: any = new Error('not found'); err.statusCode = 404; throw err; }
        store.delete(key(pk, rk));
      },
      listEntities: ({ queryOptions }: { queryOptions?: { filter?: string } } = {}) => ({
        async *[Symbol.asyncIterator]() {
          for (const e of store.values()) if (matches(queryOptions?.filter, e)) yield e;
        },
      }),
    }),
  },
}));

import { TableStorageApplianceEquipmentDatabase } from '../services/tableStorageApplianceEquipmentDatabase';

let db: TableStorageApplianceEquipmentDatabase;

beforeEach(async () => {
  store.clear();
  db = new TableStorageApplianceEquipmentDatabase('UseDevelopmentStorage=true');
  await db.connect();
  await db.connect(); // idempotent second call
});

describe('TableStorageApplianceEquipmentDatabase', () => {
  it('creates, reads back, and lists per appliance (active only by default)', async () => {
    const a = await db.create({ applianceId: 't1', name: 'Holmatro Spreader' });
    await db.create({ applianceId: 't1', name: 'Old BA set', active: false });
    await db.create({ applianceId: 't2', name: 'Akron Branch' });

    expect(a.equipmentCode).toBe('holmatro-spreader');
    expect((await db.getById(a.id))?.name).toBe('Holmatro Spreader');

    const active = await db.listForAppliance('t1');
    expect(active.map((e) => e.name)).toEqual(['Holmatro Spreader']);
    const all = await db.listForAppliance('t1', true);
    expect(all.map((e) => e.name)).toEqual(['Holmatro Spreader', 'Old BA set']);
  });

  it('updates fields and round-trips active flag', async () => {
    const e = await db.create({ applianceId: 't1', name: 'Spreader', active: true });
    const u = await db.update(e.id, { name: 'Spreader (cab)', zoneId: 'z1', notes: 'n', active: false });
    expect(u?.name).toBe('Spreader (cab)');
    expect(u?.zoneId).toBe('z1');
    expect(u?.active).toBe(false);
    expect((await db.getById(e.id))?.active).toBe(false);
    expect(await db.update('missing', { name: 'x' })).toBeNull();
  });

  it('deletes and reports missing', async () => {
    const e = await db.create({ applianceId: 't1', name: 'BA set' });
    expect(await db.delete(e.id)).toBe(true);
    expect(await db.getById(e.id)).toBeNull();
    expect(await db.delete('missing')).toBe(false);
  });

  it('clear empties the table', async () => {
    await db.create({ applianceId: 't1', name: 'A' });
    await db.create({ applianceId: 't2', name: 'B' });
    await db.clear();
    expect(await db.listForAppliance('t1', true)).toEqual([]);
    expect(await db.listForAppliance('t2', true)).toEqual([]);
  });
});
