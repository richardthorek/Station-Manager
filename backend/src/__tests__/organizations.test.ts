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
