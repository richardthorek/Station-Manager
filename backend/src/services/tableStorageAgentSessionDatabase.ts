/**
 * Azure Table Storage Agent Session Database Service
 *
 * A3 — production twin of AgentSessionDatabase.
 *
 * Partition strategy:
 *   AgentSessions  — PartitionKey = applianceId, RowKey = id
 *   AgentTurns     — PartitionKey = sessionId,   RowKey = zero-padded sequence
 *
 * Both strategies give cheap sequential scans on the primary access pattern
 * ("all turns for a session") while keeping each entity small enough for
 * Table Storage's 1 MB entity limit. Keep in sync with the in-memory twin.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { AgentSession, AgentTurn } from '../types';
import type {
  IAgentSessionDatabase,
  AgentSessionInput,
  AgentSessionPatch,
  AgentTurnInput,
} from './agentSessionDatabase';

function buildTableName(baseName: string): string {
  const sanitize = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  let defaultSuffix = '';
  if (process.env.NODE_ENV === 'test') defaultSuffix = 'Test';
  else if (process.env.NODE_ENV === 'development') defaultSuffix = 'Dev';
  const suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName;
}

// ── Entity shapes ─────────────────────────────────────────────────────────────

interface AgentSessionEntity extends TableEntity {
  applianceId: string;
  stationId?: string;
  memberId?: string;
  initiatedBy: string;
  modality: string;
  status: string;
  summary?: string;
  models: string;            // JSON array serialised as string
  runId?: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentTurnEntity extends TableEntity {
  sessionId: string;
  role: string;
  text?: string;
  toolPayload?: string;
  audioRef?: string;
  imageRef?: string;
  sequence: number;
  createdAt: string;
}

export class TableStorageAgentSessionDatabase implements IAgentSessionDatabase {
  private connectionString: string;
  private sessionsTable!: TableClient;
  private turnsTable!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const sessionsName = buildTableName('AgentSessions');
    const turnsName = buildTableName('AgentTurns');
    this.sessionsTable = TableClient.fromConnectionString(this.connectionString, sessionsName);
    this.turnsTable = TableClient.fromConnectionString(this.connectionString, turnsName);
    for (const [client, name] of [[this.sessionsTable, sessionsName], [this.turnsTable, turnsName]] as const) {
      try {
        await client.createTable();
      } catch (err: any) {
        if (err.statusCode !== 409) {
          logger.error(`Failed to create ${name} table`, { error: err });
          throw err;
        }
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for agent sessions', { sessionsName, turnsName });
  }

  // ── Session helpers ─────────────────────────────────────────────────────────

  private sessionToEntity(s: AgentSession): AgentSessionEntity {
    return {
      partitionKey: s.applianceId,
      rowKey: s.id,
      applianceId: s.applianceId,
      stationId: s.stationId,
      memberId: s.memberId,
      initiatedBy: s.initiatedBy,
      modality: s.modality,
      status: s.status,
      summary: s.summary,
      models: JSON.stringify(s.models),
      runId: s.runId,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private sessionFromEntity(e: AgentSessionEntity): AgentSession {
    return {
      id: e.rowKey as string,
      applianceId: e.applianceId,
      stationId: e.stationId || undefined,
      memberId: e.memberId || undefined,
      initiatedBy: e.initiatedBy,
      modality: (e.modality as AgentSession['modality']) || 'voice',
      status: (e.status as AgentSession['status']) || 'active',
      summary: e.summary || undefined,
      models: e.models ? (JSON.parse(e.models) as string[]) : [],
      runId: e.runId || undefined,
      startedAt: new Date(e.startedAt),
      endedAt: e.endedAt ? new Date(e.endedAt) : undefined,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    };
  }

  private async findSessionEntity(id: string): Promise<AgentSessionEntity | null> {
    const it = this.sessionsTable.listEntities<AgentSessionEntity>({
      queryOptions: { filter: odata`RowKey eq ${id}` },
    });
    for await (const e of it) return e as AgentSessionEntity;
    return null;
  }

  // ── IAgentSessionDatabase — sessions ───────────────────────────────────────

  async createSession(input: AgentSessionInput): Promise<AgentSession> {
    const now = new Date();
    const session: AgentSession = {
      id: uuidv4(),
      applianceId: input.applianceId,
      stationId: input.stationId,
      memberId: input.memberId,
      initiatedBy: input.initiatedBy,
      modality: input.modality ?? 'voice',
      status: 'active',
      models: input.models ?? [],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await this.sessionsTable.createEntity(this.sessionToEntity(session));
    return session;
  }

  async getSession(id: string): Promise<AgentSession | null> {
    const e = await this.findSessionEntity(id);
    return e ? this.sessionFromEntity(e) : null;
  }

  async updateSession(id: string, patch: AgentSessionPatch): Promise<AgentSession | null> {
    const existing = await this.getSession(id);
    if (!existing) return null;
    const updated: AgentSession = {
      ...existing,
      ...(patch.runId !== undefined ? { runId: patch.runId } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.endedAt !== undefined ? { endedAt: patch.endedAt } : {}),
      ...(patch.models !== undefined ? { models: patch.models } : {}),
      updatedAt: new Date(),
    };
    await this.sessionsTable.updateEntity(this.sessionToEntity(updated), 'Replace');
    return updated;
  }

  async listSessionsForAppliance(applianceId: string): Promise<AgentSession[]> {
    const it = this.sessionsTable.listEntities<AgentSessionEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${applianceId}` },
    });
    const rows: AgentSession[] = [];
    for await (const e of it) rows.push(this.sessionFromEntity(e as AgentSessionEntity));
    return rows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  // ── IAgentSessionDatabase — turns ──────────────────────────────────────────

  private turnToEntity(t: AgentTurn): AgentTurnEntity {
    return {
      partitionKey: t.sessionId,
      rowKey: String(t.sequence).padStart(8, '0') + '-' + t.id,
      sessionId: t.sessionId,
      role: t.role,
      text: t.text,
      toolPayload: t.toolPayload,
      audioRef: t.audioRef,
      imageRef: t.imageRef,
      sequence: t.sequence,
      createdAt: t.createdAt.toISOString(),
    };
  }

  private turnFromEntity(e: AgentTurnEntity): AgentTurn {
    // RowKey is "<sequence>-<id>"; recover id from after the first '-'
    const rowKey = e.rowKey as string;
    const dashIdx = rowKey.indexOf('-');
    const id = dashIdx >= 0 ? rowKey.slice(dashIdx + 1) : rowKey;
    return {
      id,
      sessionId: e.sessionId,
      role: e.role as AgentTurn['role'],
      text: e.text || undefined,
      toolPayload: e.toolPayload || undefined,
      audioRef: e.audioRef || undefined,
      imageRef: e.imageRef || undefined,
      sequence: typeof e.sequence === 'number' ? e.sequence : 0,
      createdAt: new Date(e.createdAt),
    };
  }

  async addTurn(input: AgentTurnInput): Promise<AgentTurn> {
    const turn: AgentTurn = {
      id: uuidv4(),
      sessionId: input.sessionId,
      role: input.role,
      text: input.text,
      toolPayload: input.toolPayload,
      audioRef: input.audioRef,
      imageRef: input.imageRef,
      sequence: input.sequence,
      createdAt: new Date(),
    };
    await this.turnsTable.createEntity(this.turnToEntity(turn));
    return turn;
  }

  async getTurnsForSession(sessionId: string): Promise<AgentTurn[]> {
    const it = this.turnsTable.listEntities<AgentTurnEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${sessionId}` },
    });
    const rows: AgentTurn[] = [];
    for await (const e of it) rows.push(this.turnFromEntity(e as AgentTurnEntity));
    return rows.sort((a, b) => a.sequence - b.sequence);
  }

  async clear(): Promise<void> {
    for (const client of [this.sessionsTable, this.turnsTable]) {
      const it = client.listEntities({});
      for await (const e of it) {
        await client.deleteEntity(e.partitionKey as string, e.rowKey as string);
      }
    }
  }
}
