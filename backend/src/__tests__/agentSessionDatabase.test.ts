/**
 * Unit tests for the in-memory AgentSessionDatabase — the persistence twin used
 * in dev/test. Covers CRUD, turn management, and status lifecycle.
 */

import { AgentSessionDatabase } from '../services/agentSessionDatabase';

describe('AgentSessionDatabase', () => {
  let db: AgentSessionDatabase;

  beforeEach(() => {
    db = new AgentSessionDatabase();
  });

  describe('sessions', () => {
    it('creates a session with defaults and timestamps', async () => {
      const s = await db.createSession({
        applianceId: 'app-1',
        initiatedBy: 'testuser',
        modality: 'voice',
      });
      expect(s.id).toBeTruthy();
      expect(s.applianceId).toBe('app-1');
      expect(s.initiatedBy).toBe('testuser');
      expect(s.modality).toBe('voice');
      expect(s.status).toBe('active');
      expect(s.models).toEqual([]);
      expect(s.startedAt).toBeInstanceOf(Date);
      expect(s.createdAt).toBeInstanceOf(Date);
      expect(s.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults modality to voice when not supplied', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      expect(s.modality).toBe('voice');
    });

    it('stores organizationId when supplied, and leaves it undefined otherwise', async () => {
      const owned = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u', organizationId: 'org-1' });
      expect(owned.organizationId).toBe('org-1');
      const unowned = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      expect(unowned.organizationId).toBeUndefined();
    });

    it('getSession returns the created session', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      const fetched = await db.getSession(s.id);
      expect(fetched?.id).toBe(s.id);
    });

    it('getSession returns null for unknown id', async () => {
      const result = await db.getSession('does-not-exist');
      expect(result).toBeNull();
    });

    it('updateSession patches status and endedAt', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      const endDate = new Date();
      const updated = await db.updateSession(s.id, { status: 'completed', endedAt: endDate });
      expect(updated?.status).toBe('completed');
      expect(updated?.endedAt).toBe(endDate);
    });

    it('updateSession returns null for unknown id', async () => {
      const result = await db.updateSession('nope', { status: 'aborted' });
      expect(result).toBeNull();
    });

    it('updateSession patches summary', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      const updated = await db.updateSession(s.id, { summary: 'All checks passed.' });
      expect(updated?.summary).toBe('All checks passed.');
    });

    it('updateSession patches runId', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      const updated = await db.updateSession(s.id, { runId: 'run-999' });
      expect(updated?.runId).toBe('run-999');
    });

    it('listSessionsForAppliance returns only matching sessions sorted by startedAt desc', async () => {
      const s1 = await db.createSession({ applianceId: 'app-A', initiatedBy: 'u' });
      await new Promise(r => setTimeout(r, 5));
      const s2 = await db.createSession({ applianceId: 'app-A', initiatedBy: 'u' });
      await db.createSession({ applianceId: 'app-B', initiatedBy: 'u' });

      const list = await db.listSessionsForAppliance('app-A');
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(s2.id); // most recent first
      expect(list[1].id).toBe(s1.id);
    });
  });

  describe('turns', () => {
    it('addTurn creates a turn with a uuid id', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      const t = await db.addTurn({
        sessionId: s.id,
        role: 'user',
        text: 'Hello',
        sequence: 0,
      });
      expect(t.id).toBeTruthy();
      expect(t.sessionId).toBe(s.id);
      expect(t.role).toBe('user');
      expect(t.text).toBe('Hello');
      expect(t.sequence).toBe(0);
      expect(t.createdAt).toBeInstanceOf(Date);
    });

    it('getTurnsForSession returns turns sorted by sequence', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      await db.addTurn({ sessionId: s.id, role: 'agent', text: 'A', sequence: 2 });
      await db.addTurn({ sessionId: s.id, role: 'user', text: 'B', sequence: 1 });
      await db.addTurn({ sessionId: s.id, role: 'user', text: 'C', sequence: 0 });

      const turns = await db.getTurnsForSession(s.id);
      expect(turns.map(t => t.sequence)).toEqual([0, 1, 2]);
    });

    it('getTurnsForSession only returns turns for the requested session', async () => {
      const s1 = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      const s2 = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      await db.addTurn({ sessionId: s1.id, role: 'user', text: 'for s1', sequence: 0 });
      await db.addTurn({ sessionId: s2.id, role: 'user', text: 'for s2', sequence: 0 });

      const turns = await db.getTurnsForSession(s1.id);
      expect(turns).toHaveLength(1);
      expect(turns[0].text).toBe('for s1');
    });
  });

  describe('clear', () => {
    it('removes all sessions and turns', async () => {
      const s = await db.createSession({ applianceId: 'app-1', initiatedBy: 'u' });
      await db.addTurn({ sessionId: s.id, role: 'user', sequence: 0 });
      await db.clear();

      expect(await db.getSession(s.id)).toBeNull();
      expect(await db.getTurnsForSession(s.id)).toHaveLength(0);
    });
  });
});
