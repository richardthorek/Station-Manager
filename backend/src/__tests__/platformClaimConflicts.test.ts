import request from 'supertest';
import express, { Express } from 'express';
import authRouter from '../routes/auth';
import platformRouter from '../routes/platform';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase, initializeOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { getFacilitiesParser } from '../services/facilitiesParser';
import { installFacilitiesFixture, restoreFacilitiesFixture } from './helpers/facilitiesFixture';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/platform', platformRouter);
  return app;
}

describe('Platform admin — claim conflicts', () => {
  let app: Express;

  beforeAll(async () => {
    installFacilitiesFixture();
    await initializeOrganizationDatabase();
    await initializeOrgAccessDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  afterAll(() => {
    restoreFacilitiesFixture();
  });

  beforeEach(async () => {
    getFacilitiesParser().resetForTesting();
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (ensureOrgAccessDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    process.env.PLATFORM_ADMIN_USERNAMES = 'root-admin';
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.PLATFORM_ADMIN_USERNAMES;
  });

  async function signup(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        organizationName: 'Bungendore RFS',
        billingEmail: 'captain@example.com',
        username: 'captain',
        password: 'supersecret1',
        email: 'captain@example.com',
        ...overrides,
      });
    return res.body as { token: string; user: { id: string }; organization: { id: string } };
  }

  async function triggerConflict() {
    await signup({ facility: { facilityKey: 'rural-fire:101' } });
    return signup({
      username: 'rival',
      email: 'rival@example.com',
      organizationName: 'Rival Brigade',
      facility: { facilityKey: 'rural-fire:101' },
    });
  }

  async function platformAdminToken(): Promise<string> {
    const adminDb = getAdminDb();
    await adminDb.createAdminUser('root-admin', 'supersecret1', 'owner');
    const res = await request(app).post('/api/auth/login').send({ username: 'root-admin', password: 'supersecret1' });
    return res.body.token as string;
  }

  it('rejects a non-platform-admin', async () => {
    const owner = await signup({ facility: { facilityKey: 'rural-fire:101' } });
    const res = await request(app)
      .get('/api/platform/claim-conflicts')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('lists open conflicts for the platform admin, with the existing org identity', async () => {
    await triggerConflict();
    const token = await platformAdminToken();
    const res = await request(app)
      .get('/api/platform/claim-conflicts?status=open')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0].existingOrganization.name).toBe('Bungendore RFS');
    expect(res.body.conflicts[0].attemptedByUsername).toBe('rival');
  });

  it('dismisses a conflict', async () => {
    await triggerConflict();
    const token = await platformAdminToken();
    const list = await request(app).get('/api/platform/claim-conflicts').set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .post(`/api/platform/claim-conflicts/${list.body.conflicts[0].id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolution: 'dismissed', notes: 'Talked to both brigades' });
    expect(res.status).toBe(200);
    expect(res.body.conflict.status).toBe('resolved');
    expect(res.body.conflict.resolution).toBe('dismissed');
  });

  it('reassigns a facility claim to a different organization', async () => {
    // triggerConflict's second signup is blocked (409) and creates no org, so
    // create the reassignment target separately via the custom/unlisted path.
    await triggerConflict();
    const rivalOrg = await request(app)
      .post('/api/auth/signup')
      .send({
        organizationName: 'Rival Brigade Two',
        billingEmail: 'rival2@example.com',
        username: 'rival2',
        password: 'supersecret1',
        email: 'rival2@example.com',
        facility: { custom: { name: 'Rival Brigade Two', serviceType: 'rural-fire' } },
      });

    const token = await platformAdminToken();
    const list = await request(app).get('/api/platform/claim-conflicts').set('Authorization', `Bearer ${token}`);
    const conflictId = list.body.conflicts[0].id;

    const res = await request(app)
      .post(`/api/platform/claim-conflicts/${conflictId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolution: 'reassigned', reassignToOrganizationId: rivalOrg.body.organization.id });
    expect(res.status).toBe(200);
    expect(res.body.conflict.status).toBe('resolved');

    const orgDb = ensureOrganizationDatabase();
    const original = await orgDb.getOrganizationById(list.body.conflicts[0].existingOrganizationId);
    const reassigned = await orgDb.getOrganizationById(rivalOrg.body.organization.id);
    expect(original?.facilityKey).toBeUndefined();
    expect(original?.facilityCustom).toBe(true);
    expect(reassigned?.facilityKey).toBe('rural-fire:101');
  });

  it('rejects an invalid resolution value', async () => {
    await triggerConflict();
    const token = await platformAdminToken();
    const list = await request(app).get('/api/platform/claim-conflicts').set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .post(`/api/platform/claim-conflicts/${list.body.conflicts[0].id}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ resolution: 'ignore-it' });
    expect(res.status).toBe(400);
  });
});
