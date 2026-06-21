/**
 * AAR Sessions route integration tests.
 *
 * Covers auth, org scoping/isolation, CRUD round-trips, payload validation, and
 * the aarStudioEnabled entitlement gate.
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';
import aarSessionsRouter from '../routes/aarSessions';
import { requireFeature } from '../middleware/entitlements';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureAarSessionDatabase, initializeAarSessionDatabase } from '../services/aarSessionDbFactory';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/auth', authRouter);
  // Mounted exactly as index.ts does, behind the entitlement gate.
  app.use('/api/aar-sessions', requireFeature('aarStudioEnabled'), aarSessionsRouter);
  return app;
}

describe('AAR Sessions', () => {
  let app: express.Express;

  beforeAll(async () => {
    await initializeOrganizationDatabase();
    await initializeAarSessionDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  beforeEach(async () => {
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    await ensureAarSessionDatabase().clear();
    // Gate off by default so CRUD tests exercise the handler regardless of plan.
    process.env.ENABLE_ENTITLEMENTS = 'false';
    app = buildApp();
  });

  afterAll(() => {
    delete process.env.ENABLE_ENTITLEMENTS;
  });

  let userSeq = 0;
  async function signup(overrides: Record<string, unknown> = {}) {
    userSeq += 1;
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        organizationName: `AAR Brigade ${userSeq}`,
        billingEmail: `aar${userSeq}@rfs.org`,
        username: `owner${userSeq}`,
        password: 'supersecret1',
        ...overrides,
      });
    return res.body.token as string;
  }

  const samplePayload = JSON.stringify({ id: 'sess-1', schemaVersion: 1, incident: { title: 'Grass fire' } });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/aar-sessions');
    expect(res.status).toBe(401);
  });

  it('round-trips a review: save, list, fetch, delete', async () => {
    const token = await signup();

    const put = await request(app)
      .put('/api/aar-sessions/sess-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Grass fire AAR', incidentDate: '2026-06-21', schemaVersion: 1, payload: samplePayload });
    expect(put.status).toBe(200);
    expect(put.body.session.id).toBe('sess-1');
    expect(put.body.session.title).toBe('Grass fire AAR');

    const list = await request(app).get('/api/aar-sessions').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(1);
    expect(list.body.sessions[0].id).toBe('sess-1');
    expect(list.body.sessions[0].payload).toBeUndefined(); // summary omits payload

    const get = await request(app).get('/api/aar-sessions/sess-1').set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.session.payload).toBe(samplePayload);

    const del = await request(app).delete('/api/aar-sessions/sess-1').set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const after = await request(app).get('/api/aar-sessions/sess-1').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(404);
  });

  it('isolates reviews between organizations', async () => {
    const tokenA = await signup();
    const tokenB = await signup();

    await request(app)
      .put('/api/aar-sessions/shared-id')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Org A review', schemaVersion: 1, payload: samplePayload });

    // Org B cannot see org A's review even with the same id.
    const getB = await request(app).get('/api/aar-sessions/shared-id').set('Authorization', `Bearer ${tokenB}`);
    expect(getB.status).toBe(404);

    const listB = await request(app).get('/api/aar-sessions').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.sessions).toHaveLength(0);

    // Org B writing the same id does not clobber org A.
    await request(app)
      .put('/api/aar-sessions/shared-id')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Org B review', schemaVersion: 1, payload: samplePayload });
    const getA = await request(app).get('/api/aar-sessions/shared-id').set('Authorization', `Bearer ${tokenA}`);
    expect(getA.body.session.title).toBe('Org A review');
  });

  it('rejects a save with no payload (400)', async () => {
    const token = await signup();
    const res = await request(app)
      .put('/api/aar-sessions/sess-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No payload', schemaVersion: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects a stale save with 409 and returns the current server copy', async () => {
    const token = await signup();
    const save = (title: string, clientUpdatedAt: string) =>
      request(app)
        .put('/api/aar-sessions/sess-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, schemaVersion: 1, payload: samplePayload, clientUpdatedAt });

    const first = await save('Newer', '2026-06-21T10:00:00.000Z');
    expect(first.status).toBe(200);

    const stale = await save('Stale', '2026-06-21T09:00:00.000Z');
    expect(stale.status).toBe(409);
    expect(stale.body.current.title).toBe('Newer');
    expect(stale.body.current.payload).toBeUndefined(); // conflict body omits payload

    // A newer edit still goes through.
    const newer = await save('Newest', '2026-06-21T11:00:00.000Z');
    expect(newer.status).toBe(200);
  });

  it('rejects an oversized payload (413)', async () => {
    const token = await signup();
    const huge = JSON.stringify({ blob: 'x'.repeat(900_001) });
    const res = await request(app)
      .put('/api/aar-sessions/sess-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Too big', schemaVersion: 1, payload: huge });
    expect(res.status).toBe(413);
  });

  it('blocks orgs without the aarStudioEnabled entitlement (403)', async () => {
    process.env.ENABLE_ENTITLEMENTS = 'true'; // gate on
    const token = await signup();             // default community plan: aarStudioEnabled=false
    const res = await request(app).get('/api/aar-sessions').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.feature).toBe('aarStudioEnabled');
  });
});
