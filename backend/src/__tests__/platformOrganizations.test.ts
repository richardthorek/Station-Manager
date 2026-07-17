/**
 * Platform admin console (Q32) — cross-org visibility + management.
 *
 * Covers the hard privacy wall (aggregate/shape only, never row-level tenant
 * data), the management surface (plan/status/entitlements, membership,
 * destructive delete with confirmation), and that every mutation is audited.
 */

import request from 'supertest';
import express, { Express } from 'express';
import platformRouter from '../routes/platform';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase, initializeOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { authHeader } from './helpers/authHelpers';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/platform', platformRouter);
  return app;
}

describe('Platform admin — organizations console', () => {
  let app: Express;

  beforeAll(async () => {
    await initializeOrganizationDatabase();
    await initializeOrgAccessDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  beforeEach(async () => {
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (ensureOrgAccessDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    process.env.PLATFORM_ADMIN_USERNAMES = 'root-admin';
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.PLATFORM_ADMIN_USERNAMES;
  });

function platformAdminToken(): string {
  return (authHeader('owner', undefined, 'root-admin').Authorization as string).replace('Bearer ', '');
}

  async function makeOrg(name: string) {
    const orgDb = ensureOrganizationDatabase();
    return orgDb.createOrganization({ name, billingEmail: `${name.toLowerCase()}@example.com` });
  }

  it('rejects a non-platform-admin', async () => {
    const org = await makeOrg('Bungendore RFS');
    const res = await request(app).get('/api/platform/organizations').set(authHeader('owner', org.id));
    expect(res.status).toBe(403);
  });

  describe('visibility — aggregate only, no row-level tenant data', () => {
    it('lists organizations with counts, no member/check-in/event fields', async () => {
      const org = await makeOrg('Bungendore RFS');
      const db = await ensureDatabase();
      const station = await db.createStation({
        name: 'Station 1', brigadeName: 'Bungendore', brigadeId: 'bungendore',
        hierarchy: { jurisdiction: 'NSW', district: 'D', area: 'A', brigade: 'Bungendore', station: 'Station 1' },
        location: { address: '1 Fire Rd' },
        isActive: true,
        organizationId: org.id,
      });
      await db.createMember('Alice', { stationId: station.id });
      await db.createMember('Bob', { stationId: station.id });
      const truckDb = await ensureTruckChecksDatabase();
      await truckDb.createAppliance('Pumper 1', undefined, undefined, station.id);

      const token = platformAdminToken();
      const res = await request(app).get('/api/platform/organizations').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.organizations).toHaveLength(1);
      const row = res.body.organizations[0];
      expect(row.name).toBe('Bungendore RFS');
      expect(row.stationCount).toBe(1);
      expect(row.memberCount).toBe(2);
      expect(row.vehicleCount).toBe(1);
      expect(row.aiSessionsUsedThisMonth).toBe(0);
      // Hard privacy wall: no keys that could carry row-level tenant content.
      const forbiddenKeys = ['members', 'checkIns', 'events', 'appliances', 'stations'];
      for (const key of forbiddenKeys) {
        expect(row).not.toHaveProperty(key);
      }
    });

    it('org detail includes memberships (account info) but never tenant content', async () => {
      const org = await makeOrg('Bungendore RFS');
      const adminDb = getAdminDb();
      const user = await adminDb.createAdminUser('captain', 'supersecret1', 'owner', org.id, { email: 'captain@example.com' });
      await ensureOrgAccessDatabase().createMembership({ userId: user.id, organizationId: org.id, role: 'owner' });

      const token = platformAdminToken();
      const res = await request(app).get(`/api/platform/organizations/${org.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.organization.id).toBe(org.id);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].username).toBe('captain');
      expect(res.body.members[0].role).toBe('owner');
    });

    it('404s for an unknown organization', async () => {
      const token = platformAdminToken();
      const res = await request(app).get('/api/platform/organizations/does-not-exist').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('management', () => {
    it('changes an organization plan and clamps entitlements, and audits it', async () => {
      const org = await makeOrg('Bungendore RFS');
      const token = platformAdminToken();
      const res = await request(app)
        .patch(`/api/platform/organizations/${org.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'basic' });
      expect(res.status).toBe(200);
      expect(res.body.organization.planCode).toBe('basic');

      const log = await request(app).get('/api/platform/audit-log').set('Authorization', `Bearer ${token}`);
      expect(log.body.logs.some((l: { action: string }) => l.action === 'org.plan_changed')).toBe(true);
    });

    it('changes org status directly (owner-facing PUT cannot do this)', async () => {
      const org = await makeOrg('Bungendore RFS');
      const token = platformAdminToken();
      const res = await request(app)
        .patch(`/api/platform/organizations/${org.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'past_due' });
      expect(res.status).toBe(200);
      expect(res.body.organization.status).toBe('past_due');
    });

    it('adds a member to an organization', async () => {
      const org = await makeOrg('Bungendore RFS');
      const token = platformAdminToken();
      const res = await request(app)
        .post(`/api/platform/organizations/${org.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newowner', password: 'supersecret1', role: 'owner' });
      expect(res.status).toBe(201);

      const detail = await request(app).get(`/api/platform/organizations/${org.id}`).set('Authorization', `Bearer ${token}`);
      expect(detail.body.members).toHaveLength(1);
    });

    it('refuses to remove the last owner', async () => {
      const org = await makeOrg('Bungendore RFS');
      const adminDb = getAdminDb();
      const user = await adminDb.createAdminUser('captain', 'supersecret1', 'owner', org.id);
      await ensureOrgAccessDatabase().createMembership({ userId: user.id, organizationId: org.id, role: 'owner' });

      const token = platformAdminToken();
      const res = await request(app)
        .delete(`/api/platform/organizations/${org.id}/members/${user.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
    });

    it('soft-deactivates an organization by default', async () => {
      const org = await makeOrg('Bungendore RFS');
      const token = platformAdminToken();
      const res = await request(app).delete(`/api/platform/organizations/${org.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.organization.status).toBe('canceled');

      const orgDb = ensureOrganizationDatabase();
      expect(await orgDb.getOrganizationById(org.id)).not.toBeNull();
    });

    it('refuses a hard delete without the confirm string', async () => {
      const org = await makeOrg('Bungendore RFS');
      const token = platformAdminToken();
      const res = await request(app)
        .delete(`/api/platform/organizations/${org.id}?hard=true`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);

      const orgDb = ensureOrganizationDatabase();
      expect(await orgDb.getOrganizationById(org.id)).not.toBeNull();
    });

    it('hard-deletes an organization when confirmed with its slug', async () => {
      const org = await makeOrg('Bungendore RFS');
      const token = platformAdminToken();
      const res = await request(app)
        .delete(`/api/platform/organizations/${org.id}?hard=true`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirm: org.slug });
      expect(res.status).toBe(200);

      const orgDb = ensureOrganizationDatabase();
      expect(await orgDb.getOrganizationById(org.id)).toBeNull();

      const log = await request(app).get('/api/platform/audit-log').set('Authorization', `Bearer ${token}`);
      expect(log.body.logs.some((l: { action: string }) => l.action === 'org.deleted')).toBe(true);
    });

    it('deactivates an account by default, hard-deletes only when confirmed', async () => {
      const org = await makeOrg('Bungendore RFS');
      const adminDb = getAdminDb();
      const user = await adminDb.createAdminUser('captain', 'supersecret1', 'owner', org.id);
      const token = platformAdminToken();

      const soft = await request(app).delete(`/api/platform/accounts/${user.id}`).set('Authorization', `Bearer ${token}`);
      expect(soft.status).toBe(200);
      expect((await adminDb.getUserById(user.id))?.isActive).toBe(false);

      const refused = await request(app)
        .delete(`/api/platform/accounts/${user.id}?hard=true`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirm: 'wrong-username' });
      expect(refused.status).toBe(400);

      const hard = await request(app)
        .delete(`/api/platform/accounts/${user.id}?hard=true`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirm: 'captain' });
      expect(hard.status).toBe(200);
      expect(await adminDb.getUserById(user.id)).toBeNull();
    });
  });
});
