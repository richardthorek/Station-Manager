/**
 * Entitlement enforcement tests.
 *
 * Covers:
 *  - requireFeature gates /api/export behind reportsEnabled
 *  - enforceStationLimit blocks POST /api/stations at plan cap
 *  - Both gates pass through with no org context (backward compat)
 *  - ENABLE_ENTITLEMENTS=false disables all gating
 *
 * Each buildApp() calls jest.resetModules() so every test group starts with a
 * fresh in-memory DB and fresh middleware closures — no cross-test station
 * or org state leaks.
 */

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/** Re-require everything with a fresh module cache so env changes take effect. */
function buildApp(entitlementsEnv: string | undefined = undefined): {
  app: Express;
  createOrg: (plan?: 'community' | 'basic' | 'ai') => Promise<{ id: string }>;
} {
  if (entitlementsEnv !== undefined) {
    process.env.ENABLE_ENTITLEMENTS = entitlementsEnv;
  } else {
    delete process.env.ENABLE_ENTITLEMENTS;
  }

  jest.resetModules();

  // Re-require so that middleware reads the env var on first construction.
  const { default: exportRouter } = require('../routes/export');
  const { default: stationsRouter } = require('../routes/stations');
  const { requireFeature } = require('../middleware/entitlements');
  const { getOrganizationDatabase } = require('../services/organizationDatabase');

  const app = express();
  app.use(express.json());
  app.set('io', { emit: jest.fn(), to: jest.fn().mockReturnThis() });
  app.use('/api/export', requireFeature('reportsEnabled'), exportRouter);
  app.use('/api/stations', stationsRouter);

  const orgDb = getOrganizationDatabase();

  async function createOrg(plan: 'community' | 'basic' | 'ai' = 'community') {
    return orgDb.createOrganization({
      name: `Test Org ${Date.now()}-${Math.random()}`,
      billingEmail: 'x@x.com',
      planCode: plan,
    });
  }

  return { app, createOrg };
}

function orgToken(organizationId: string, role: 'owner' | 'admin' | 'viewer' = 'admin'): string {
  return jwt.sign({ userId: 'u1', username: 'u1', role, organizationId }, JWT_SECRET, { expiresIn: '1h' });
}

function plainToken(): string {
  return jwt.sign({ userId: 'u2', username: 'u2', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

afterAll(() => {
  delete process.env.ENABLE_ENTITLEMENTS;
  jest.resetModules();
});

// ── requireFeature: reportsEnabled ────────────────────────────────────────────

describe('requireFeature(reportsEnabled) on /api/export', () => {
  it('blocks community-plan org (reportsEnabled=false) with 403', async () => {
    const { app, createOrg } = buildApp(); // default ON
    const org = await createOrg('community'); // reportsEnabled: false

    const res = await request(app)
      .get('/api/export/members')
      .set('Authorization', `Bearer ${orgToken(org.id)}`);

    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(res.body.feature).toBe('reportsEnabled');
  });

  it('allows basic-plan org (reportsEnabled=true)', async () => {
    const { app, createOrg } = buildApp();
    const org = await createOrg('basic'); // reportsEnabled: true

    const res = await request(app)
      .get('/api/export/members')
      .set('Authorization', `Bearer ${orgToken(org.id)}`);

    expect(res.status).not.toBe(403);
  });

  it('passes through with no org context (backward compat)', async () => {
    const { app } = buildApp();

    const res = await request(app)
      .get('/api/export/members')
      .set('Authorization', `Bearer ${plainToken()}`);

    expect(res.status).not.toBe(403);
  });

  it('is a no-op when ENABLE_ENTITLEMENTS=false', async () => {
    const { app, createOrg } = buildApp('false');
    const org = await createOrg('community'); // would be blocked when on

    const res = await request(app)
      .get('/api/export/members')
      .set('Authorization', `Bearer ${orgToken(org.id)}`);

    expect(res.status).not.toBe(403);
  });
});

// ── enforceStationLimit ───────────────────────────────────────────────────────

describe('enforceStationLimit on POST /api/stations', () => {
  function stationPayload(suffix: string) {
    return {
      name: `Station ${suffix}`,
      brigadeId: `brigade-${suffix}-${Date.now()}`,
      brigadeName: `Brigade ${suffix}`,
      hierarchy: {
        jurisdiction: 'NSW',
        area: 'A',
        district: 'D',
        brigade: `B${suffix}`,
        station: `S${suffix}`,
      },
    };
  }

  it('blocks creation when active station count reaches plan maxStations', async () => {
    const { app, createOrg } = buildApp();
    const org = await createOrg('community'); // maxStations: 1

    const first = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${orgToken(org.id)}`)
      .send(stationPayload('alpha'));
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${orgToken(org.id)}`)
      .send(stationPayload('beta'));
    expect(second.status).toBe(403);
    expect(second.body.upgradeRequired).toBe(true);
    expect(second.body.limit).toBe(1);
  });

  it('allows creation when under the plan limit', async () => {
    const { app, createOrg } = buildApp();
    const org = await createOrg('basic'); // maxStations: 5

    const res = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${orgToken(org.id)}`)
      .send(stationPayload('gamma'));
    expect(res.status).toBe(201);
  });

  it('passes through when no org context', async () => {
    const { app } = buildApp();

    const res = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${plainToken()}`)
      .send(stationPayload('delta'));
    expect(res.status).toBe(201);
  });

  it('is a no-op when ENABLE_ENTITLEMENTS=false', async () => {
    const { app, createOrg } = buildApp('false');
    const org = await createOrg('community'); // maxStations: 1

    await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${orgToken(org.id)}`)
      .send(stationPayload('e1'));

    const res = await request(app)
      .post('/api/stations')
      .set('Authorization', `Bearer ${orgToken(org.id)}`)
      .send(stationPayload('e2'));
    expect(res.status).toBe(201);
  });
});
