/**
 * Table Storage twin regression test: stationToEntity/entityToStation used to
 * silently drop Station.organizationId and Station.kioskToken on every
 * write/read — no error, no type failure (both fields are optional), just a
 * quiet no-op. Since routes/stations.ts filters getAllStations() by
 * `!s.organizationId || s.organizationId === organizationId`, every station
 * with a genuinely dropped organizationId fell into the "unscoped, visible to
 * everyone" branch — meaning every org-scoped station ever created in
 * production was actually visible to every other organization. Found while
 * investigating why a freshly created station's organizationId wasn't
 * sticking; confirmed via a live read against production Table Storage.
 *
 * Uses the same in-memory fake of @azure/data-tables as tableStorageEvents.test.ts.
 */

type Entity = Record<string, unknown> & { partitionKey: string; rowKey: string };

const tables = new Map<string, Map<string, Entity>>();
const key = (pk: string, rk: string) => `${pk}::${rk}`;

function storeFor(tableName: string): Map<string, Entity> {
  let store = tables.get(tableName);
  if (!store) {
    store = new Map();
    tables.set(tableName, store);
  }
  return store;
}

function matchesFilter(filter: string | undefined, e: Entity): boolean {
  if (!filter) return true;
  const m = filter.match(/(\w+)\s+eq\s+'([^']*)'/);
  if (!m) return true;
  const [, field, value] = m;
  const mapped = field === 'RowKey' ? 'rowKey' : field === 'PartitionKey' ? 'partitionKey' : field;
  return String((e as Record<string, unknown>)[mapped]) === value;
}

jest.mock('@azure/data-tables', () => ({
  odata: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? `'${values[i]}'` : ''), ''),
  TableClient: {
    fromConnectionString: (_conn: string, tableName: string) => {
      const store = storeFor(tableName);
      return {
        createTable: async () => {},
        createEntity: async (entity: Entity) => { store.set(key(entity.partitionKey, entity.rowKey), { ...entity }); },
        updateEntity: async (entity: Entity) => { store.set(key(entity.partitionKey, entity.rowKey), { ...entity }); },
        upsertEntity: async (entity: Entity) => { store.set(key(entity.partitionKey, entity.rowKey), { ...entity }); },
        getEntity: async (pk: string, rk: string) => {
          const found = store.get(key(pk, rk));
          if (!found) { const err: any = new Error('not found'); err.statusCode = 404; throw err; }
          return found;
        },
        deleteEntity: async (pk: string, rk: string) => {
          if (!store.has(key(pk, rk))) { const err: any = new Error('not found'); err.statusCode = 404; throw err; }
          store.delete(key(pk, rk));
        },
        listEntities: ({ queryOptions }: { queryOptions?: { filter?: string } } = {}) => ({
          async *[Symbol.asyncIterator]() {
            for (const e of store.values()) if (matchesFilter(queryOptions?.filter, e)) yield e;
          },
        }),
      };
    },
  },
}));

import { TableStorageDatabase } from '../services/tableStorageDatabase';

let db: TableStorageDatabase;

beforeEach(async () => {
  tables.clear();
  db = new TableStorageDatabase('UseDevelopmentStorage=true');
  await db.connect();
});

describe('TableStorageDatabase station organizationId/kioskToken round-trip', () => {
  const hierarchy = { jurisdiction: 'NSW', area: 'A', district: 'D', brigade: 'B', station: 'S' };

  it('persists organizationId through createStation and getStationById', async () => {
    const created = await db.createStation({
      id: 'org-station',
      name: 'Org Station',
      brigadeId: 'org-brigade',
      brigadeName: 'Org Brigade',
      hierarchy,
      isActive: true,
      organizationId: 'org-123',
    });
    expect(created.organizationId).toBe('org-123');

    const fetched = await db.getStationById('org-station');
    expect(fetched?.organizationId).toBe('org-123');
  });

  it('persists kioskToken through createStation and getStationById', async () => {
    await db.createStation({
      id: 'kiosk-station',
      name: 'Kiosk Station',
      brigadeId: 'kiosk-brigade',
      brigadeName: 'Kiosk Brigade',
      hierarchy,
      isActive: true,
      kioskToken: 'unguessable-token',
    });

    const fetched = await db.getStationById('kiosk-station');
    expect(fetched?.kioskToken).toBe('unguessable-token');
  });

  it('leaves organizationId undefined (not an empty string) for a station created without one', async () => {
    await db.createStation({
      id: 'shared-station',
      name: 'Shared Station',
      brigadeId: 'shared-brigade',
      brigadeName: 'Shared Brigade',
      hierarchy,
      isActive: true,
    });

    const fetched = await db.getStationById('shared-station');
    expect(fetched?.organizationId).toBeUndefined();
  });

  it('carries organizationId through getAllStations for every station, not just the first', async () => {
    await db.createStation({ id: 's1', name: 'S1', brigadeId: 'b1', brigadeName: 'B1', hierarchy, isActive: true, organizationId: 'org-a' });
    await db.createStation({ id: 's2', name: 'S2', brigadeId: 'b2', brigadeName: 'B2', hierarchy, isActive: true, organizationId: 'org-b' });
    await db.createStation({ id: 's3', name: 'S3', brigadeId: 'b3', brigadeName: 'B3', hierarchy, isActive: true });

    const all = await db.getAllStations();
    const byId = new Map(all.map((s) => [s.id, s]));
    expect(byId.get('s1')?.organizationId).toBe('org-a');
    expect(byId.get('s2')?.organizationId).toBe('org-b');
    expect(byId.get('s3')?.organizationId).toBeUndefined();
  });

  it('preserves organizationId across updateStation when the update does not touch it', async () => {
    await db.createStation({
      id: 'update-station',
      name: 'Before',
      brigadeId: 'b',
      brigadeName: 'B',
      hierarchy,
      isActive: true,
      organizationId: 'org-keep',
    });

    const updated = await db.updateStation('update-station', { name: 'After' });
    expect(updated?.organizationId).toBe('org-keep');

    const fetched = await db.getStationById('update-station');
    expect(fetched?.organizationId).toBe('org-keep');
  });
});
