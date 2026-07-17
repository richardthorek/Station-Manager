/**
 * SaaS foundation tests — signup, organization management, entitlement gating.
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';
import organizationsRouter from '../routes/organizations';
import { authMiddleware } from '../middleware/auth';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { requireFeature } from '../middleware/entitlements';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureDeviceDatabase } from '../services/deviceDbFactory';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/organizations', organizationsRouter);
  // A stand-in for a gated module (avoids the routes↔index socket import cycle
  // that real routers carry). Exercises the entitlement middleware directly.
  app.get('/api/gated', authMiddleware, requireFeature('truckCheckEnabled'), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('SaaS foundation', () => {
  let app: express.Express;

  beforeAll(async () => {
    await initializeOrganizationDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  beforeEach(async () => {
    // Fresh state per test.
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    delete process.env.ENABLE_ENTITLEMENTS;
    app = buildApp();
  });

  async function signup(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/auth/signup')
      .send({
        organizationName: 'Bungendore RFS',
        billingEmail: 'captain@bungendorerfs.org',
        username: 'captain',
        password: 'supersecret1',
        email: 'captain@bungendorerfs.org',
        ...overrides,
      });
  }

  describe('POST /api/auth/signup', () => {
    it('creates an organization (Community plan) and an owner, returns a token', async () => {
      const res = await signup();
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.role).toBe('owner');
      expect(res.body.user.organizationId).toBeTruthy();
      expect(res.body.organization.planCode).toBe('community');
      expect(res.body.organization.slug).toBe('bungendore-rfs');
      // Community defaults: AI off, reports off, sign-in + truck check on.
      expect(res.body.organization.entitlements.aiEnabled).toBe(false);
      expect(res.body.organization.entitlements.reportsEnabled).toBe(false);
      expect(res.body.organization.entitlements.signInEnabled).toBe(true);
      expect(res.body.organization.entitlements.truckCheckEnabled).toBe(true);
    });

    it('rejects a short password', async () => {
      const res = await signup({ password: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate username', async () => {
      await signup();
      const res = await signup({ organizationName: 'Other Brigade' });
      expect(res.status).toBe(409);
    });

    it('requires all fields', async () => {
      const res = await request(app).post('/api/auth/signup').send({ username: 'x' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET/PUT /api/organizations/current', () => {
    async function ownerToken() {
      const res = await signup();
      return res.body.token as string;
    }

    it('returns the current organization with the plan catalog', async () => {
      const token = await ownerToken();
      const res = await request(app)
        .get('/api/organizations/current')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.organization.name).toBe('Bungendore RFS');
      expect(Array.isArray(res.body.plans)).toBe(true);
    });

    it('lets an owner disable the sign-in book (maintenance-only brigade)', async () => {
      const token = await ownerToken();
      const res = await request(app)
        .put('/api/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ moduleToggles: { signInEnabled: false } });
      expect(res.status).toBe(200);
      expect(res.body.organization.entitlements.signInEnabled).toBe(false);
      // Truck check stays on.
      expect(res.body.organization.entitlements.truckCheckEnabled).toBe(true);
    });

    it('cannot enable AI on a non-AI plan (clamped to plan ceiling)', async () => {
      const token = await ownerToken();
      const res = await request(app)
        .put('/api/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ moduleToggles: { aiEnabled: true } });
      expect(res.status).toBe(200);
      expect(res.body.organization.entitlements.aiEnabled).toBe(false);
    });

    it('enables AI after upgrading to the AI plan', async () => {
      const token = await ownerToken();
      const res = await request(app)
        .put('/api/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'ai' });
      expect(res.status).toBe(200);
      expect(res.body.organization.planCode).toBe('ai');
      expect(res.body.organization.entitlements.aiEnabled).toBe(true);
      expect(res.body.organization.entitlements.aiIncludedSessions).toBeGreaterThan(0);
    });
  });

  describe('organization users', () => {
    it('owner can create an admin user scoped to the org', async () => {
      const token = (await signup()).body.token as string;
      const res = await request(app)
        .post('/api/organizations/current/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'firefighter', password: 'anothersecret1', role: 'admin' });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('admin');

      const list = await request(app)
        .get('/api/organizations/current/users')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.users).toHaveLength(2); // owner + new admin
    });
  });

  describe('GET /api/organizations/current/export', () => {
    it('lets the owner download a data export', async () => {
      const token = (await signup()).body.token as string;
      const res = await request(app)
        .get('/api/organizations/current/export')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.organization.name).toBe('Bungendore RFS');
      expect(Array.isArray(res.body.stations)).toBe(true);
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(Array.isArray(res.body.limitations)).toBe(true);
      expect(res.body.exportedAt).toBeTruthy();
    });

    it('includes truck-check history and device records', async () => {
      const signupRes = await signup();
      const token = signupRes.body.token as string;
      const organizationId = signupRes.body.organization.id as string;

      const db = await ensureDatabase();
      const station = await db.createStation({
        name: 'Bungendore Station',
        brigadeName: 'Bungendore',
        brigadeId: 'bungendore',
        hierarchy: { jurisdiction: 'NSW', district: 'D', area: 'A', brigade: 'Bungendore', station: 'Bungendore Station' },
        location: { address: '1 Fire Rd' },
        isActive: true,
        organizationId,
      });

      const truckDb = await ensureTruckChecksDatabase();
      const appliance = await truckDb.createAppliance('Pumper 1', undefined, undefined, station.id);
      await truckDb.createCheckRun(appliance.id, 'captain', 'Captain', station.id);

      await ensureDeviceDatabase().create({ organizationId, stationId: station.id, type: 'kiosk', name: 'Main shed kiosk' });

      const res = await request(app)
        .get('/api/organizations/current/export')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.vehicles.some((v: { id: string }) => v.id === appliance.id)).toBe(true);
      expect(res.body.truckCheckRuns.some((r: { applianceId: string }) => r.applianceId === appliance.id)).toBe(true);
      expect(res.body.devices.some((d: { name: string }) => d.name === 'Main shed kiosk')).toBe(true);
    });

    it('rejects a non-owner', async () => {
      const ownerToken = (await signup()).body.token as string;
      const adminRes = await request(app)
        .post('/api/organizations/current/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ username: 'admin-user', password: 'anothersecret1', role: 'admin' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin-user', password: 'anothersecret1' });

      const res = await request(app)
        .get('/api/organizations/current/export')
        .set('Authorization', `Bearer ${loginRes.body.token}`);
      expect(adminRes.status).toBe(201);
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/organizations/current/export');
      expect(res.status).toBe(401);
    });
  });

  describe('entitlement gating', () => {
    it('allows a gated route when ENABLE_ENTITLEMENTS=false, even if the feature is disabled (back-compat)', async () => {
      process.env.ENABLE_ENTITLEMENTS = 'false'; // explicitly opt-out
      const token = (await signup()).body.token as string;
      await request(app)
        .put('/api/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ moduleToggles: { truckCheckEnabled: false } });

      const res = await request(app).get('/api/gated').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200); // gating is a no-op when explicitly disabled
    });

    it('blocks a gated route for an org without the feature when entitlements are enabled', async () => {
      process.env.ENABLE_ENTITLEMENTS = 'true';
      const token = (await signup()).body.token as string;
      await request(app)
        .put('/api/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .send({ moduleToggles: { truckCheckEnabled: false } });

      const res = await request(app).get('/api/gated').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.upgradeRequired).toBe(true);
    });

    it('allows the gated route when the feature is enabled', async () => {
      process.env.ENABLE_ENTITLEMENTS = 'true';
      const token = (await signup()).body.token as string; // community has truckCheck on
      const res = await request(app).get('/api/gated').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
