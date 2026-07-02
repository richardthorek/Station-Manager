/**
 * Voice-agent tool layer (A3 inc 2).
 *
 * The five tools from the maintenance-agent design contract, bound to the
 * existing truck-check / zone / equipment stores. The Azure OpenAI loop
 * (agentLoop.ts) advertises AGENT_TOOL_DEFINITIONS and dispatches each
 * tool_call through an AgentToolExecutor, which is bound to one AgentSession
 * and lazily creates the formal CheckRun on first recording activity.
 *
 * Every tool returns a JSON string (the wire shape of an OpenAI `tool` role
 * message). State lives in the DB, not the transcript — get_appliance_context
 * re-reads live data so the model can always re-ground itself.
 */

import { ensureTruckChecksDatabase } from './truckChecksDbFactory';
import { ensureVehicleTypeDatabase } from './vehicleTypeDbFactory';
import { ensureApplianceZoneDatabase } from './applianceZoneDbFactory';
import { ensureApplianceEquipmentDatabase } from './applianceEquipmentDbFactory';
import { ensureAgentSessionDatabase } from './agentSessionDbFactory';
import { resolveEffectiveChecklist } from './effectiveChecklist';
import { logger } from './logger';
import type { AgentSession, Appliance, ChecklistItem, CheckResult, CheckStatus, EffectiveChecklist } from '../types';

/** OpenAI function-calling definitions advertised to the model. */
export const AGENT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_appliance_context',
      description:
        'Get everything known about the truck being checked: identity (make/model/year/variant), brigade quirks notes, walk-around zones in order, equipment inventory, the full checklist (each item with its zone link and expected response type), and any results already recorded in this check. Call this first, and again any time you need to re-orient.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_result',
      description:
        'Record the outcome of one checklist item. Identify the item by its id, itemCode, or (exact, case-insensitive) name. Re-recording an item updates the earlier result.',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Checklist item id, itemCode, or exact name' },
          status: { type: 'string', enum: ['done', 'issue', 'skipped'] },
          value: { type: 'string', description: 'Captured reading for numeric/level items, e.g. "650 psi" or "half"' },
          comment: { type: 'string', description: 'Inspector remark, or the issue detail when status is issue' },
        },
        required: ['item', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_issue',
      description: 'Shortcut to record a checklist item as an issue with a detail note. Equivalent to record_result with status "issue".',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Checklist item id, itemCode, or exact name' },
          detail: { type: 'string', description: 'What is wrong, as described by the inspector' },
        },
        required: ['item', 'detail'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'next_unchecked_in_zone',
      description:
        'Get the next checklist item that has no recorded result, in walk-around order. Pass a zone (id or name) to stay in the same physical area; omit it for the next unchecked item overall.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', description: 'Zone id or name to stay within (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_run',
      description:
        'Finish the check: closes the formal check run and stores a short summary on the session. Only call when the inspector confirms they are done.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'One-to-three-sentence summary of the check and any issues found' },
        },
        required: ['summary'],
      },
    },
  },
];

/** Names of the advertised tools, for dispatch validation. */
export const AGENT_TOOL_NAMES = new Set(
  AGENT_TOOL_DEFINITIONS.map((t) => t.function.name),
);

interface RecordResultArgs {
  item?: string;
  status?: string;
  value?: string;
  comment?: string;
  detail?: string;
}

const CHECK_STATUSES: readonly CheckStatus[] = ['done', 'issue', 'skipped'];

function asRecord(argsJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(argsJson || '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Executes agent tool calls for one session. Lazily creates the CheckRun
 * (source = session modality, linked both ways) the first time the agent
 * records anything.
 */
export class AgentToolExecutor {
  constructor(private readonly session: AgentSession) {}

  private get applianceId(): string {
    return this.session.applianceId;
  }

  /** Dispatch one tool call; always resolves to a JSON string for the tool message. */
  async execute(name: string, argsJson: string): Promise<string> {
    try {
      const args = asRecord(argsJson);
      switch (name) {
        case 'get_appliance_context':
          return JSON.stringify(await this.getApplianceContext());
        case 'record_result':
          return JSON.stringify(await this.recordResult({
            item: str(args.item),
            status: str(args.status),
            value: str(args.value),
            comment: str(args.comment),
          }));
        case 'flag_issue':
          return JSON.stringify(await this.recordResult({
            item: str(args.item),
            status: 'issue',
            comment: str(args.detail),
          }));
        case 'next_unchecked_in_zone':
          return JSON.stringify(await this.nextUnchecked(str(args.zone)));
        case 'complete_run':
          return JSON.stringify(await this.completeRun(str(args.summary)));
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err) {
      logger.error('Agent tool execution failed', { tool: name, sessionId: this.session.id, error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' });
    }
  }

  // ── Shared lookups ──────────────────────────────────────────────────────────

  private async getAppliance(): Promise<Appliance> {
    const db = await ensureTruckChecksDatabase();
    const appliance = await db.getApplianceById(this.applianceId);
    if (!appliance) throw new Error('Appliance not found');
    return appliance;
  }

  private async getChecklist(appliance: Appliance): Promise<EffectiveChecklist> {
    const db = await ensureTruckChecksDatabase();
    const template = await db.getTemplateByApplianceId(this.applianceId);
    const vehicleType = appliance.vehicleTypeId
      ? await ensureVehicleTypeDatabase().getById(appliance.vehicleTypeId)
      : null;
    return resolveEffectiveChecklist(appliance, template, vehicleType);
  }

  /** Results recorded so far in this session's run (empty before the run exists). */
  private async getRunResults(): Promise<CheckResult[]> {
    if (!this.session.runId) return [];
    const db = await ensureTruckChecksDatabase();
    return db.getResultsByRunId(this.session.runId);
  }

  /** Create the formal CheckRun on first use and link it to the session both ways. */
  private async ensureRun(appliance: Appliance): Promise<string> {
    if (this.session.runId) return this.session.runId;
    const db = await ensureTruckChecksDatabase();
    const run = await db.createCheckRun(
      this.applianceId,
      this.session.memberId ?? this.session.initiatedBy,
      this.session.initiatedBy,
      this.session.stationId ?? appliance.stationId,
      { source: this.session.modality, agentSessionId: this.session.id },
    );
    this.session.runId = run.id;
    await ensureAgentSessionDatabase().updateSession(this.session.id, { runId: run.id });
    return run.id;
  }

  /** Resolve a spoken/typed item reference: id → itemCode → exact name (case-insensitive). */
  private findItem(checklist: EffectiveChecklist, ref: string): ChecklistItem | undefined {
    const needle = ref.trim().toLowerCase();
    return (
      checklist.items.find((i) => i.id === ref) ??
      checklist.items.find((i) => (i.itemCode ?? '').toLowerCase() === needle) ??
      checklist.items.find((i) => i.name.trim().toLowerCase() === needle)
    );
  }

  // ── Tools ───────────────────────────────────────────────────────────────────

  private async getApplianceContext(): Promise<Record<string, unknown>> {
    const appliance = await this.getAppliance();
    const [zones, equipment, checklist, results] = await Promise.all([
      ensureApplianceZoneDatabase().listForAppliance(this.applianceId),
      ensureApplianceEquipmentDatabase().listForAppliance(this.applianceId),
      this.getChecklist(appliance),
      this.getRunResults(),
    ]);
    const resultByItem = new Map(results.map((r) => [r.itemId, r]));
    return {
      appliance: {
        name: appliance.name,
        agencyId: appliance.agencyId,
        make: appliance.make,
        model: appliance.model,
        year: appliance.year,
        variant: appliance.variant,
        inServiceDate: appliance.inServiceDate,
        quirksNotes: appliance.quirksNotes,
      },
      zones: zones.map((z) => ({ id: z.id, name: z.name, side: z.side, order: z.order })),
      equipment: equipment.map((e) => ({ id: e.id, name: e.name, zoneId: e.zoneId })),
      checklist: checklist.items.map((i) => ({
        id: i.id,
        itemCode: i.itemCode,
        name: i.name,
        description: i.description,
        section: i.section,
        zoneId: i.zoneId,
        equipmentId: i.equipmentId,
        expectedResponseType: i.expectedResponseType ?? 'ok-issue',
        unit: i.unit,
        promptHint: i.promptHint,
        recorded: resultByItem.get(i.id)?.status,
      })),
      itemsRecorded: results.length,
      itemsTotal: checklist.items.length,
      openIssues: results
        .filter((r) => r.status === 'issue')
        .map((r) => ({ item: r.itemName, comment: r.comment })),
    };
  }

  private async recordResult(args: RecordResultArgs): Promise<Record<string, unknown>> {
    if (!args.item) return { error: 'item is required' };
    const status = args.status as CheckStatus;
    if (!CHECK_STATUSES.includes(status)) {
      return { error: `status must be one of: ${CHECK_STATUSES.join(', ')}` };
    }

    const appliance = await this.getAppliance();
    const checklist = await this.getChecklist(appliance);
    const item = this.findItem(checklist, args.item);
    if (!item) {
      return {
        error: `No checklist item matches "${args.item}"`,
        availableItems: checklist.items.map((i) => i.name),
      };
    }

    const comment = [args.value, args.comment].filter(Boolean).join(' — ') || undefined;
    const runId = await this.ensureRun(appliance);
    const db = await ensureTruckChecksDatabase();

    // Re-recording an item updates the earlier result instead of duplicating it,
    // so "next unchecked" stays truthful.
    const existing = (await db.getResultsByRunId(runId)).find((r) => r.itemId === item.id);
    const result = existing
      ? await db.updateCheckResult(existing.id, status, comment)
      : await db.createCheckResult(
          runId,
          item.id,
          item.name,
          item.description,
          status,
          comment,
          undefined,
          this.session.initiatedBy,
          this.session.stationId ?? appliance.stationId,
          item.itemCode,
          item.section,
        );

    const results = await db.getResultsByRunId(runId);
    return {
      recorded: { item: item.name, status, comment: result?.comment ?? comment },
      updated: Boolean(existing),
      progress: `${results.length} of ${checklist.items.length} items recorded`,
    };
  }

  private async nextUnchecked(zoneRef?: string): Promise<Record<string, unknown>> {
    const appliance = await this.getAppliance();
    const checklist = await this.getChecklist(appliance);
    const results = await this.getRunResults();
    const done = new Set(results.map((r) => r.itemId));
    const unchecked = checklist.items.filter((i) => !done.has(i.id));

    if (unchecked.length === 0) {
      return { done: true, message: 'All checklist items have a recorded result. Confirm with the inspector, then call complete_run.' };
    }

    let zoneId: string | undefined;
    let zoneName: string | undefined;
    if (zoneRef) {
      const zones = await ensureApplianceZoneDatabase().listForAppliance(this.applianceId);
      const needle = zoneRef.trim().toLowerCase();
      const zone = zones.find((z) => z.id === zoneRef) ?? zones.find((z) => z.name.trim().toLowerCase() === needle);
      if (!zone) {
        return { error: `No zone matches "${zoneRef}"`, availableZones: zones.map((z) => z.name) };
      }
      zoneId = zone.id;
      zoneName = zone.name;
    }

    const inZone = zoneId ? unchecked.filter((i) => i.zoneId === zoneId) : unchecked;
    const next = inZone[0] ?? unchecked[0];
    return {
      ...(zoneId && inZone.length === 0
        ? { note: `Nothing left unchecked in ${zoneName}; this is the next item overall.` }
        : {}),
      next: {
        id: next.id,
        itemCode: next.itemCode,
        name: next.name,
        description: next.description,
        zoneId: next.zoneId,
        expectedResponseType: next.expectedResponseType ?? 'ok-issue',
        unit: next.unit,
        promptHint: next.promptHint,
      },
      remaining: unchecked.length,
    };
  }

  private async completeRun(summary?: string): Promise<Record<string, unknown>> {
    if (!this.session.runId) {
      return { error: 'Nothing has been recorded yet — there is no check run to complete.' };
    }
    const db = await ensureTruckChecksDatabase();
    const run = await db.completeCheckRun(this.session.runId, summary);
    await ensureAgentSessionDatabase().updateSession(this.session.id, {
      status: 'completed',
      summary,
      endedAt: new Date(),
    });
    this.session.status = 'completed';
    const results = await db.getResultsByRunId(this.session.runId);
    return {
      completed: true,
      hasIssues: run?.hasIssues ?? results.some((r) => r.status === 'issue'),
      itemsRecorded: results.length,
      issues: results.filter((r) => r.status === 'issue').map((r) => r.itemName),
    };
  }
}
