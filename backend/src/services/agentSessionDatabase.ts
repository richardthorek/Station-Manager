/**
 * In-Memory Agent Session Database Service
 *
 * A3 — stores AgentSession (one per voice check) and AgentTurn (the transcript
 * turns within a session). Production uses the Table Storage twin
 * (tableStorageAgentSessionDatabase.ts), selected by the factory — keep the
 * two in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { AgentSession, AgentTurn } from '../types';

// ── Input / patch shapes ──────────────────────────────────────────────────────

export interface AgentSessionInput {
  applianceId: string;
  stationId?: string;
  memberId?: string;
  initiatedBy: string;
  modality?: AgentSession['modality'];
  models?: string[];
}

export type AgentSessionPatch = Partial<Pick<
  AgentSession,
  'runId' | 'status' | 'summary' | 'endedAt' | 'models'
>>;

export interface AgentTurnInput {
  sessionId: string;
  role: AgentTurn['role'];
  text?: string;
  toolPayload?: string;
  audioRef?: string;
  imageRef?: string;
  sequence: number;
}

// ── Database interface ────────────────────────────────────────────────────────

export interface IAgentSessionDatabase {
  // Sessions
  createSession(input: AgentSessionInput): Promise<AgentSession>;
  getSession(id: string): Promise<AgentSession | null>;
  updateSession(id: string, patch: AgentSessionPatch): Promise<AgentSession | null>;
  listSessionsForAppliance(applianceId: string): Promise<AgentSession[]>;

  // Turns
  addTurn(input: AgentTurnInput): Promise<AgentTurn>;
  getTurnsForSession(sessionId: string): Promise<AgentTurn[]>;

  clear(): Promise<void>;
}

// ── In-memory implementation ──────────────────────────────────────────────────

export class AgentSessionDatabase implements IAgentSessionDatabase {
  private sessions: Map<string, AgentSession> = new Map();
  private turns: Map<string, AgentTurn> = new Map();

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
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string): Promise<AgentSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async updateSession(id: string, patch: AgentSessionPatch): Promise<AgentSession | null> {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (patch.runId !== undefined) s.runId = patch.runId;
    if (patch.status !== undefined) s.status = patch.status;
    if (patch.summary !== undefined) s.summary = patch.summary;
    if (patch.endedAt !== undefined) s.endedAt = patch.endedAt;
    if (patch.models !== undefined) s.models = patch.models;
    s.updatedAt = new Date();
    return s;
  }

  async listSessionsForAppliance(applianceId: string): Promise<AgentSession[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.applianceId === applianceId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
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
    this.turns.set(turn.id, turn);
    return turn;
  }

  async getTurnsForSession(sessionId: string): Promise<AgentTurn[]> {
    return Array.from(this.turns.values())
      .filter((t) => t.sessionId === sessionId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async clear(): Promise<void> {
    this.sessions.clear();
    this.turns.clear();
  }
}

let instance: AgentSessionDatabase | null = null;

export function getAgentSessionDatabase(): AgentSessionDatabase {
  if (!instance) {
    instance = new AgentSessionDatabase();
  }
  return instance;
}
