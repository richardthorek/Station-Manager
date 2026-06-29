/**
 * Integration tests for GET /api/agent-sessions/:id and :id/turns.
 */

jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { agentCheckRouter } from '../routes/agentCheck';
import { AgentSessionDatabase } from '../services/agentSessionDatabase';
import * as factory from '../services/agentSessionDbFactory';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const adminToken = () =>
  jwt.sign({ userId: 'admin-1', username: 'admin', role: 'admin', organizationId: 'org-1' }, JWT_SECRET);
const auth = () => ({ Authorization: `Bearer ${adminToken()}` });

let app: Express;
let db: AgentSessionDatabase;

beforeEach(() => {
  db = new AgentSessionDatabase();
  jest.spyOn(factory, 'ensureAgentSessionDatabase').mockReturnValue(db);

  app = express();
  app.use(express.json());
  app.use('/api/agent-sessions', agentCheckRouter);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/agent-sessions/:id', () => {
  it('returns 401 without auth', async () => {
    await request(app).get('/api/agent-sessions/some-id').expect(401);
  });

  it('returns 404 for an unknown session', async () => {
    await request(app)
      .get('/api/agent-sessions/does-not-exist')
      .set(auth())
      .expect(404);
  });

  it('returns the session for a known id', async () => {
    const session = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
    const res = await request(app)
      .get(`/api/agent-sessions/${session.id}`)
      .set(auth())
      .expect(200);
    expect(res.body.session.id).toBe(session.id);
    expect(res.body.session.applianceId).toBe('app-1');
  });
});

describe('GET /api/agent-sessions/:id/turns', () => {
  it('returns 401 without auth', async () => {
    await request(app).get('/api/agent-sessions/some-id/turns').expect(401);
  });

  it('returns 404 for an unknown session', async () => {
    await request(app)
      .get('/api/agent-sessions/does-not-exist/turns')
      .set(auth())
      .expect(404);
  });

  it('returns turns in sequence order', async () => {
    const session = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
    await db.addTurn({ sessionId: session.id, role: 'agent', text: 'Second', sequence: 1 });
    await db.addTurn({ sessionId: session.id, role: 'user', text: 'First', sequence: 0 });

    const res = await request(app)
      .get(`/api/agent-sessions/${session.id}/turns`)
      .set(auth())
      .expect(200);
    expect(res.body.turns).toHaveLength(2);
    expect(res.body.turns[0].sequence).toBe(0);
    expect(res.body.turns[1].sequence).toBe(1);
  });

  it('returns empty array when no turns exist', async () => {
    const session = await db.createSession({ applianceId: 'app-1', initiatedBy: 'tester' });
    const res = await request(app)
      .get(`/api/agent-sessions/${session.id}/turns`)
      .set(auth())
      .expect(200);
    expect(res.body.turns).toEqual([]);
  });
});
