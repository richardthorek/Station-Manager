/**
 * Unit tests for the voice-agent tool layer (A3 inc 2) — the five tools from
 * the maintenance-agent design contract, run against the in-memory twins.
 */

import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureApplianceZoneDatabase } from '../services/applianceZoneDbFactory';
import { ensureAgentSessionDatabase } from '../services/agentSessionDbFactory';
import { AgentToolExecutor, AGENT_TOOL_DEFINITIONS, AGENT_TOOL_NAMES } from '../services/agentTools';
import type { AgentSession, ChecklistItem } from '../types';

let applianceId: string;
let frontZoneId: string;
let itemIds: Record<string, string> = {};
let itemCodes: Record<string, string | undefined> = {};

async function newSession(): Promise<{ session: AgentSession; executor: AgentToolExecutor }> {
  const session = await ensureAgentSessionDatabase().createSession({
    applianceId,
    initiatedBy: 'Test Member',
    modality: 'voice',
  });
  return { session, executor: new AgentToolExecutor(session) };
}

async function run(executor: AgentToolExecutor, tool: string, args: Record<string, unknown> = {}) {
  return JSON.parse(await executor.execute(tool, JSON.stringify(args)));
}

beforeAll(async () => {
  const db = await ensureTruckChecksDatabase();
  const appliance = await db.createAppliance('Agent Test Tanker', 'fixture', undefined, 'station-1', undefined, {
    quirksNotes: 'Rear hatch sticks in cold weather',
    make: 'Isuzu',
    year: 2014,
  });
  applianceId = appliance.id;

  const zoneDb = ensureApplianceZoneDatabase();
  const front = await zoneDb.create({ applianceId, name: 'Front', side: 'front', order: 0 });
  const driver = await zoneDb.create({ applianceId, name: 'Driver Side', side: 'driver', order: 1 });
  frontZoneId = front.id;

  const items: Array<Omit<ChecklistItem, 'id'>> = [
    { name: 'Pump operation', description: 'Prime and run the pump', order: 0, itemCode: 'pump-operation', zoneId: front.id },
    { name: 'Tyre condition', description: 'Tread and pressure', order: 1, itemCode: 'tyre-condition', zoneId: driver.id },
    { name: 'Stowage secure', description: 'All lockers latched', order: 2 },
  ];
  const template = await db.updateTemplate(applianceId, items, 'station-1');
  for (const item of template.items) {
    itemIds[item.name] = item.id;
    itemCodes[item.name] = item.itemCode;
  }
});

describe('tool definitions', () => {
  it('advertises exactly the five design-contract tools', () => {
    expect([...AGENT_TOOL_NAMES].sort()).toEqual([
      'complete_run',
      'flag_issue',
      'get_appliance_context',
      'next_unchecked_in_zone',
      'record_result',
    ]);
    for (const def of AGENT_TOOL_DEFINITIONS) {
      expect(def.type).toBe('function');
      expect(def.function.parameters).toBeDefined();
    }
  });
});

describe('get_appliance_context', () => {
  it('returns identity, quirks, ordered zones, and the checklist with zone links', async () => {
    const { executor } = await newSession();
    const ctx = await run(executor, 'get_appliance_context');

    expect(ctx.appliance.name).toBe('Agent Test Tanker');
    expect(ctx.appliance.quirksNotes).toMatch(/hatch sticks/);
    expect(ctx.zones.map((z: { name: string }) => z.name)).toEqual(['Front', 'Driver Side']);
    expect(ctx.itemsTotal).toBe(3);
    expect(ctx.itemsRecorded).toBe(0);
    const pump = ctx.checklist.find((i: { name: string }) => i.name === 'Pump operation');
    expect(pump.zoneId).toBe(frontZoneId);
    expect(pump.recorded).toBeUndefined();
  });
});

describe('record_result', () => {
  it('lazily creates a voice-sourced CheckRun linked to the session both ways', async () => {
    const { session, executor } = await newSession();
    const out = await run(executor, 'record_result', { item: 'tyre condition', status: 'done' });

    expect(out.recorded).toEqual(expect.objectContaining({ item: 'Tyre condition', status: 'done' }));
    expect(out.progress).toBe('1 of 3 items recorded');
    expect(session.runId).toBeTruthy();

    const db = await ensureTruckChecksDatabase();
    const checkRun = await db.getCheckRunById(session.runId!);
    expect(checkRun?.source).toBe('voice');
    expect(checkRun?.agentSessionId).toBe(session.id);

    const stored = await ensureAgentSessionDatabase().getSession(session.id);
    expect(stored?.runId).toBe(session.runId);
  });

  it('resolves an item by itemCode and folds value into the comment', async () => {
    const { executor } = await newSession();
    const out = await run(executor, 'record_result', {
      item: 'pump-operation', status: 'done', value: '650 kPa', comment: 'primes a little slowly',
    });
    expect(out.recorded.item).toBe('Pump operation');
    expect(out.recorded.comment).toBe('650 kPa — primes a little slowly');
  });

  it('updates the earlier result instead of duplicating on re-record', async () => {
    const { session, executor } = await newSession();
    await run(executor, 'record_result', { item: 'Stowage secure', status: 'skipped' });
    const out = await run(executor, 'record_result', { item: 'Stowage secure', status: 'done' });

    expect(out.updated).toBe(true);
    expect(out.progress).toBe('1 of 3 items recorded');
    const db = await ensureTruckChecksDatabase();
    const results = await db.getResultsByRunId(session.runId!);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('done');
  });

  it('rejects an unknown item, offering the available names', async () => {
    const { executor } = await newSession();
    const out = await run(executor, 'record_result', { item: 'Warp drive', status: 'done' });
    expect(out.error).toMatch(/no checklist item/i);
    expect(out.availableItems).toContain('Pump operation');
  });

  it('rejects an invalid status and a missing item', async () => {
    const { executor } = await newSession();
    expect((await run(executor, 'record_result', { item: 'Tyre condition', status: 'broken' })).error).toMatch(/status must be/);
    expect((await run(executor, 'record_result', { status: 'done' })).error).toBe('item is required');
  });
});

describe('flag_issue', () => {
  it('records an issue with the detail and marks the run', async () => {
    const { session, executor } = await newSession();
    const out = await run(executor, 'flag_issue', { item: 'Tyre condition', detail: 'Front left tread below limit' });
    expect(out.recorded.status).toBe('issue');
    expect(out.recorded.comment).toBe('Front left tread below limit');

    const db = await ensureTruckChecksDatabase();
    expect((await db.getCheckRunById(session.runId!))?.hasIssues).toBe(true);
  });
});

describe('next_unchecked_in_zone', () => {
  it('walks the checklist in order and narrows to a zone by name', async () => {
    const { executor } = await newSession();
    expect((await run(executor, 'next_unchecked_in_zone')).next.name).toBe('Pump operation');

    await run(executor, 'record_result', { item: 'Pump operation', status: 'done' });
    const after = await run(executor, 'next_unchecked_in_zone');
    expect(after.next.name).toBe('Tyre condition');
    expect(after.remaining).toBe(2);

    // Front zone is now clear — falls through to the next item overall with a note.
    const front = await run(executor, 'next_unchecked_in_zone', { zone: 'front' });
    expect(front.note).toMatch(/nothing left unchecked in Front/i);
    expect(front.next.name).toBe('Tyre condition');
  });

  it('rejects an unknown zone, offering the available names', async () => {
    const { executor } = await newSession();
    const out = await run(executor, 'next_unchecked_in_zone', { zone: 'Basement' });
    expect(out.error).toMatch(/no zone matches/i);
    expect(out.availableZones).toEqual(['Front', 'Driver Side']);
  });

  it('reports done when everything is recorded', async () => {
    const { executor } = await newSession();
    for (const name of ['Pump operation', 'Tyre condition', 'Stowage secure']) {
      await run(executor, 'record_result', { item: name, status: 'done' });
    }
    expect((await run(executor, 'next_unchecked_in_zone')).done).toBe(true);
  });
});

describe('complete_run', () => {
  it('refuses before anything is recorded', async () => {
    const { executor } = await newSession();
    expect((await run(executor, 'complete_run', { summary: 'nothing' })).error).toMatch(/no check run/i);
  });

  it('closes the run and finalises the session with the summary', async () => {
    const { session, executor } = await newSession();
    await run(executor, 'record_result', { item: 'Pump operation', status: 'done' });
    await run(executor, 'flag_issue', { item: 'Tyre condition', detail: 'slow leak' });

    const out = await run(executor, 'complete_run', { summary: 'One issue: tyre leak.' });
    expect(out).toEqual(expect.objectContaining({ completed: true, hasIssues: true, itemsRecorded: 2 }));
    expect(out.issues).toEqual(['Tyre condition']);

    const db = await ensureTruckChecksDatabase();
    expect((await db.getCheckRunById(session.runId!))?.status).toBe('completed');
    const stored = await ensureAgentSessionDatabase().getSession(session.id);
    expect(stored?.status).toBe('completed');
    expect(stored?.summary).toBe('One issue: tyre leak.');
    expect(session.status).toBe('completed'); // shared object mutated for the WS close handler
  });
});

describe('dispatch hygiene', () => {
  it('returns an error payload for an unknown tool and tolerates malformed JSON args', async () => {
    const { executor } = await newSession();
    expect(JSON.parse(await executor.execute('self_destruct', '{}')).error).toMatch(/unknown tool/i);
    expect(JSON.parse(await executor.execute('record_result', 'not json')).error).toBe('item is required');
  });
});
