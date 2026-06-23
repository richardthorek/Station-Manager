/**
 * Table Storage twin tests for ApplianceZone, using an in-memory fake of
 * `@azure/data-tables` (TableClient + odata). Exercises the production
 * persistence path without Azure.
 */

type Entity = Record<string, unknown> & { partitionKey: string; rowKey: string };

const store = new Map<string, Entity>();
const key = (pk: string, rk: string) => `${pk}::${rk}`;

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

import { TableStorageApplianceZoneDatabase } from '../services/tableStorageApplianceZoneDatabase';

let db: TableStorageApplianceZoneDatabase;

beforeEach(async () => {
  store.clear();
  db = new TableStorageApplianceZoneDatabase('UseDevelopmentStorage=true');
  await db.connect();
});

describe('TableStorageApplianceZoneDatabase', () => {
  it('creates with derived code + default order and lists per appliance in order', async () => {
    const a = await db.create({ applianceId: 't1', name: 'Pump Panel', side: 'rear' });
    await db.create({ applianceId: 't1', name: 'Cab' });
    await db.create({ applianceId: 't2', name: 'Locker' });

    expect(a.zoneCode).toBe('pump-panel');
    expect(a.order).toBe(0);
    const zones = await db.listForAppliance('t1');
    expect(zones.map((z) => z.order)).toEqual([0, 1]);
    expect(zones.map((z) => z.name)).toEqual(['Pump Panel', 'Cab']);
  });

  it('getById, update and delete round-trip', async () => {
    const z = await db.create({ applianceId: 't1', name: 'Cab' });
    expect((await db.getById(z.id))?.name).toBe('Cab');
    const u = await db.update(z.id, { name: 'Cabin', side: 'interior', order: 3 });
    expect(u?.name).toBe('Cabin');
    expect(u?.side).toBe('interior');
    expect(u?.order).toBe(3);
    expect(await db.update('missing', { name: 'x' })).toBeNull();
    expect(await db.delete(z.id)).toBe(true);
    expect(await db.getById(z.id)).toBeNull();
    expect(await db.delete('missing')).toBe(false);
  });

  it('clear empties the table', async () => {
    await db.create({ applianceId: 't1', name: 'A' });
    await db.create({ applianceId: 't2', name: 'B' });
    await db.clear();
    expect(await db.listForAppliance('t1')).toEqual([]);
    expect(await db.listForAppliance('t2')).toEqual([]);
  });
});
