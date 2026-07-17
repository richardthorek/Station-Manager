/**
 * Platform admin console — station → organization backfill (Q35).
 *
 * Stations created before Q33 tagged organizationId on creation have none;
 * this tool lists them and lets a platform admin assign the right org.
 */

import request from 'supertest';
import express, { Express } from 'express';
import platformRouter from '../routes/platform';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase, initializeOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { authHeader } from './helpers/authHelpers';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/platform', platformRouter);
  return app;
}

describe('Platform admin — station organization backfill (Q35)', () => {
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

  async function makeOrphanStation(name: string) {
    const db = await ensureDatabase();
    return db.createStation({
      name,
      brigadeName: name,
      brigadeId: name.toLowerCase().replace(/\s+/g, '-'),
      hierarchy: { jurisdiction: 'NSW', district: 'D', area: 'A', brigade: name, station: name },
      location: { address: '1 Fire Rd' },
      isActive: true,
      // No organizationId — simulates a pre-Q33 station.
    });
  }

  it('rejects a non-platform-admin', async () => {
    const org = await makeOrg('Bungendore RFS');
    const res = await request(app).get('/api/platform/stations/orphaned').set(authHeader('owner', org.id));
    expect(res.status).toBe(403);
  });

  it('lists active stations with no organizationId', async () => {
    const orphan = await makeOrphanStation('Listable Orphan Station');
    const db = await ensureDatabase();
    await db.createMember('Alice', { stationId: orphan.id });

    const token = platformAdminToken();
    const res = await request(app).get('/api/platform/stations/orphaned').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const row = res.body.stations.find((s: { id: string }) => s.id === orphan.id);
    expect(row).toBeTruthy();
    expect(row.name).toBe('Listable Orphan Station');
    expect(row.memberCount).toBe(1);
  });

  it('does not list a station that already has an organizationId', async () => {
    const org = await makeOrg('Bungendore RFS');
    const db = await ensureDatabase();
    await db.createStation({
      name: 'Tagged Station',
      brigadeName: 'Tagged',
      brigadeId: 'tagged',
      hierarchy: { jurisdiction: 'NSW', district: 'D', area: 'A', brigade: 'Tagged', station: 'Tagged Station' },
      location: { address: '1 Fire Rd' },
      isActive: true,
      organizationId: org.id,
    });

    const token = platformAdminToken();
    const res = await request(app).get('/api/platform/stations/orphaned').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stations.some((s: { name: string }) => s.name === 'Tagged Station')).toBe(false);
  });

  it('assigns an orphaned station to an organization and audits it', async () => {
    const org = await makeOrg('Bungendore RFS');
    const station = await makeOrphanStation('Orphan Station');
    const token = platformAdminToken();

    const res = await request(app)
      .patch(`/api/platform/stations/${station.id}/organization`)
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: org.id });
    expect(res.status).toBe(200);
    expect(res.body.station.organizationId).toBe(org.id);

    const db = await ensureDatabase();
    const updated = (await db.getAllStations()).find((s) => s.id === station.id);
    expect(updated?.organizationId).toBe(org.id);

    const log = await request(app).get('/api/platform/audit-log').set('Authorization', `Bearer ${token}`);
    expect(log.body.logs.some((l: { action: string }) => l.action === 'station.organization_assigned')).toBe(true);
  });

  it('404s assigning a station that does not exist', async () => {
    const org = await makeOrg('Bungendore RFS');
    const token = platformAdminToken();
    const res = await request(app)
      .patch('/api/platform/stations/does-not-exist/organization')
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: org.id });
    expect(res.status).toBe(404);
  });

  it('404s assigning to an organization that does not exist', async () => {
    const station = await makeOrphanStation('Orphan Station');
    const token = platformAdminToken();
    const res = await request(app)
      .patch(`/api/platform/stations/${station.id}/organization`)
      .set('Authorization', `Bearer ${token}`)
      .send({ organizationId: 'does-not-exist' });
    expect(res.status).toBe(404);
  });

  it('400s without an organizationId in the body', async () => {
    const station = await makeOrphanStation('Orphan Station');
    const token = platformAdminToken();
    const res = await request(app)
      .patch(`/api/platform/stations/${station.id}/organization`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
