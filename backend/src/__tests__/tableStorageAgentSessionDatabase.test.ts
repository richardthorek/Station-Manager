/**
 * Table Storage twin tests for AgentSession, using an in-memory fake of
 * `@azure/data-tables` (TableClient + odata). Covers the CRUD round-trip plus
 * the optimistic-concurrency retry added for A3 code review F10 (two writers
 * racing to update the same session must not silently clobber each other).
 */

type Entity = Record<string, unknown> & { partitionKey: string; rowKey: string; etag?: string };

function matches(filter: string | undefined, e: Entity): boolean {
  if (!filter) return true;
  const m = filter.match(/(\w+)\s+eq\s+'([^']*)'/);
  if (!m) return true;
  const [, field, value] = m;
  const prop = field === 'RowKey' ? 'rowKey' : field === 'PartitionKey' ? 'partitionKey' : field;
  return String((e as Record<string, unknown>)[prop]) === value;
}

/** One fake table: its own store + a monotonic etag per write, honouring conditional updates. */
function makeFakeTable() {
  const store = new Map<string, Entity>();
  let etagCounter = 0;
  const key = (pk: string, rk: string) => `${pk}::${rk}`;
  return {
    store,
    createTable: async () => {},
    createEntity: async (entity: Entity) => {
      store.set(key(entity.partitionKey, entity.rowKey), { ...entity, etag: `etag-${++etagCounter}` });
    },
    updateEntity: async (entity: Entity, _mode?: string, options?: { etag?: string }) => {
      const k = key(entity.partitionKey, entity.rowKey);
      const current = store.get(k);
      if (options?.etag && options.etag !== '*' && current?.etag !== options.etag) {
        const err: Error & { statusCode?: number } = new Error('Precondition failed');
        err.statusCode = 412;
        throw err;
      }
      store.set(k, { ...entity, etag: `etag-${++etagCounter}` });
    },
    deleteEntity: async (pk: string, rk: string) => {
      const k = key(pk, rk);
      if (!store.has(k)) {
        const err: Error & { statusCode?: number } = new Error('not found');
        err.statusCode = 404;
        throw err;
      }
      store.delete(k);
    },
    listEntities: ({ queryOptions }: { queryOptions?: { filter?: string } } = {}) => ({
      async *[Symbol.asyncIterator]() {
        for (const e of store.values()) if (matches(queryOptions?.filter, e)) yield e;
      },
    }),
  };
}

const tables = new Map<string, ReturnType<typeof makeFakeTable>>();

jest.mock('@azure/data-tables', () => ({
  odata: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? `'${values[i]}'` : ''), ''),
  TableClient: {
    fromConnectionString: (_conn: string, tableName: string) => {
      if (!tables.has(tableName)) tables.set(tableName, makeFakeTable());
      return tables.get(tableName)!;
    },
  },
}));

import { TableStorageAgentSessionDatabase } from '../services/tableStorageAgentSessionDatabase';

let db: TableStorageAgentSessionDatabase;

beforeEach(async () => {
  tables.clear();
  db = new TableStorageAgentSessionDatabase('UseDevelopmentStorage=true');
  await db.connect();
});

describe('TableStorageAgentSessionDatabase — sessions', () => {
  it('creates and reads back a session, including organizationId', async () => {
    const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester', organizationId: 'org-1' });
    expect(s.status).toBe('active');
    expect(s.models).toEqual([]);

    const fetched = await db.getSession(s.id);
    expect(fetched?.applianceId).toBe('app-1');
    expect(fetched?.organizationId).toBe('org-1');
    expect(fetched?.startedAt).toBeInstanceOf(Date);
  });

  it('leaves organizationId undefined when not supplied', async () => {
    const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
    expect((await db.getSession(s.id))?.organizationId).toBeUndefined();
  });

  it('getSession returns null for an unknown id', async () => {
    expect(await db.getSession('missing')).toBeNull();
  });

  it('updateSession patches fields and returns null for an unknown id', async () => {
    const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
    const updated = await db.updateSession(s.id, { status: 'completed', summary: 'All good.', runId: 'run-1' });
    expect(updated?.status).toBe('completed');
    expect(updated?.summary).toBe('All good.');
    expect(updated?.runId).toBe('run-1');
    expect(await db.updateSession('missing', { status: 'aborted' })).toBeNull();
  });

  it('listSessionsForAppliance filters by appliance and sorts most-recent-first', async () => {
    const a = await db.createSession({ applianceId: 'app-A', initiatedBy: 'u' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await db.createSession({ applianceId: 'app-A', initiatedBy: 'u' });
    await db.createSession({ applianceId: 'app-B', initiatedBy: 'u' });

    const list = await db.listSessionsForAppliance('app-A');
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
  });

  describe('optimistic concurrency (A3 code review F10)', () => {
    it('retries against fresh state on a 412 conflict and still applies the patch', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
      const table = tables.get('AgentSessionsTest')!;
      const realUpdateEntity = table.updateEntity.bind(table);
      let calls = 0;
      table.updateEntity = jest.fn(async (entity, mode, options) => {
        calls++;
        if (calls === 1) {
          // Simulate another writer having changed the entity in between —
          // the caller's etag no longer matches what's stored.
          const err: Error & { statusCode?: number } = new Error('Precondition failed');
          err.statusCode = 412;
          throw err;
        }
        return realUpdateEntity(entity, mode, options);
      });

      const updated = await db.updateSession(s.id, { status: 'completed' });
      expect(updated?.status).toBe('completed');
      expect(table.updateEntity).toHaveBeenCalledTimes(2);
    });

    it('gives up and throws after exhausting retries against a persistent conflict', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
      const table = tables.get('AgentSessionsTest')!;
      table.updateEntity = jest.fn(async () => {
        const err: Error & { statusCode?: number } = new Error('Precondition failed');
        err.statusCode = 412;
        throw err;
      });

      await expect(db.updateSession(s.id, { status: 'aborted' })).rejects.toThrow('Precondition failed');
      expect(table.updateEntity).toHaveBeenCalledTimes(3); // MAX_ATTEMPTS
    });

    it('propagates a non-conflict error immediately without retrying', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
      const table = tables.get('AgentSessionsTest')!;
      table.updateEntity = jest.fn(async () => {
        throw new Error('network blip');
      });

      await expect(db.updateSession(s.id, { status: 'aborted' })).rejects.toThrow('network blip');
      expect(table.updateEntity).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TableStorageAgentSessionDatabase — turns', () => {
  it('adds and lists turns in sequence order, scoped to their session', async () => {
    const s1 = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
    const s2 = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
    await db.addTurn({ sessionId: s1.id, role: 'agent', text: 'B', sequence: 1 });
    await db.addTurn({ sessionId: s1.id, role: 'user', text: 'A', sequence: 0 });
    await db.addTurn({ sessionId: s2.id, role: 'user', text: 'other session', sequence: 0 });

    const turns = await db.getTurnsForSession(s1.id);
    expect(turns.map((t) => t.text)).toEqual(['A', 'B']);
  });
});

describe('TableStorageAgentSessionDatabase — clear', () => {
  it('empties both tables', async () => {
    const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
    await db.addTurn({ sessionId: s.id, role: 'user', sequence: 0 });
    await db.clear();

    expect(await db.getSession(s.id)).toBeNull();
    expect(await db.getTurnsForSession(s.id)).toEqual([]);
  });
});
