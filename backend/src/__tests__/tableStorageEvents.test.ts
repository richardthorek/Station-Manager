/**
 * Table Storage twin test for getEvents() (Q25, found 2026-07-14): it used
 * to hard-scan only the last 3 calendar months regardless of `limit`, so
 * deep pagination and any report needing older history silently came back
 * empty. Uses an in-memory fake of `@azure/data-tables`, one Map per table
 * name (so Events/Activities/Stations entities don't collide), to exercise
 * the real month-partition-walking logic without Azure.
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

/** Directly seed an event entity in a specific month partition, bypassing createEvent's "now" timestamp. */
function seedEvent(monthKey: string, id: string, startTime: Date, stationId = 'default-station'): void {
  const store = storeFor('Events');
  store.set(`Event_${monthKey}::${id}`, {
    partitionKey: `Event_${monthKey}`,
    rowKey: id,
    id,
    name: `Event ${id}`,
    activityId: 'activity-1',
    startTime: startTime.toISOString(),
    endTime: null,
    isActive: false,
    stationId,
    createdAt: startTime.toISOString(),
    updatedAt: startTime.toISOString(),
    isDeleted: false,
  } as unknown as Entity);
}

describe('TableStorageDatabase.getEvents — Q25 month-partition scan', () => {
  it('finds events far older than 3 months when limit requires paging back further', async () => {
    const now = new Date();
    // One event 8 months ago — well outside the old hardcoded 3-month window.
    const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 8, 15);
    seedEvent(eightMonthsAgo.toISOString().slice(0, 7), 'old-event', eightMonthsAgo);

    const events = await db.getEvents(50, 0);
    expect(events.map((e) => e.id)).toContain('old-event');
  });

  it('still returns recent events first and respects limit/offset (pagination unaffected)', async () => {
    const now = new Date();
    const recent = new Date(now.getFullYear(), now.getMonth(), 1);
    const older = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    seedEvent(recent.toISOString().slice(0, 7), 'recent-event', recent);
    seedEvent(older.toISOString().slice(0, 7), 'older-event', older);

    const page1 = await db.getEvents(1, 0);
    expect(page1.map((e) => e.id)).toEqual(['recent-event']);

    const page2 = await db.getEvents(1, 1);
    expect(page2.map((e) => e.id)).toEqual(['older-event']);
  });

  it('does not scan back forever when there is no older history (bounded scan)', async () => {
    // No events seeded at all — getEvents should return quickly with an empty array,
    // not hang or throw walking back through an unbounded number of empty months.
    const events = await db.getEvents(50, 0);
    expect(events).toEqual([]);
  });

  it('filters by station across the extended scan range', async () => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 10);
    seedEvent(sixMonthsAgo.toISOString().slice(0, 7), 'station-a-event', sixMonthsAgo, 'station-a');
    seedEvent(sixMonthsAgo.toISOString().slice(0, 7), 'station-b-event', sixMonthsAgo, 'station-b');

    const events = await db.getEvents(50, 0, 'station-a');
    expect(events.map((e) => e.id)).toEqual(['station-a-event']);
  });
});
