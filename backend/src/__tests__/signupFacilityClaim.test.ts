import request from 'supertest';
import express, { Express } from 'express';
import authRouter from '../routes/auth';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase, initializeOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { getFacilitiesParser } from '../services/facilitiesParser';
import { installFacilitiesFixture, restoreFacilitiesFixture } from './helpers/facilitiesFixture';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('POST /api/auth/signup — facility claiming', () => {
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
    app = buildApp();
  });

  function signupBody(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Bungendore RFS',
      billingEmail: 'captain@example.com',
      username: 'captain',
      password: 'supersecret1',
      email: 'captain@example.com',
      ...overrides,
    };
  }

  it('claims a known facility on first signup', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(signupBody({ facility: { facilityKey: 'rural-fire:101' } }));
    expect(res.status).toBe(201);
    expect(res.body.organization.facilityKey).toBe('rural-fire:101');
    expect(res.body.organization.facilityCustom).toBe(false);
    expect(res.body.organization.claimedByUserId).toBe(res.body.user.id);
    expect(res.body.user.email).toBe('captain@example.com');
  });

  it('blocks a second signup for the same facility with a 409 and records a conflict', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send(signupBody({ facility: { facilityKey: 'rural-fire:101' } }));

    const res = await request(app)
      .post('/api/auth/signup')
      .send(
        signupBody({
          username: 'rival',
          email: 'rival@example.com',
          organizationName: 'Rival Brigade',
          facility: { facilityKey: 'rural-fire:101' },
        }),
      );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('FACILITY_ALREADY_CLAIMED');
    expect(res.body.error).toMatch(/already been claimed/i);

    const conflicts = await ensureOrgAccessDatabase().getClaimConflicts('open');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].facilityKey).toBe('rural-fire:101');
    expect(conflicts[0].attemptedByUsername).toBe('rival');

    // The rival account must NOT have been created.
    expect(await getAdminDb().getUserByUsername('rival')).toBeNull();
  });

  it('rejects an unknown facilityKey', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(signupBody({ facility: { facilityKey: 'rural-fire:999999' } }));
    expect(res.status).toBe(400);
  });

  it('accepts a custom/unlisted facility with no conflict possible', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(
        signupBody({
          facility: { custom: { name: 'My Unlisted Unit', serviceType: 'other', state: 'NSW' } },
        }),
      );
    expect(res.status).toBe(201);
    expect(res.body.organization.facilityCustom).toBe(true);
    expect(res.body.organization.facilityKey).toBeUndefined();
    expect(res.body.organization.facilityName).toBe('My Unlisted Unit');
  });

  it('a second custom signup with the same name is never blocked', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send(signupBody({ facility: { custom: { name: 'Generic Unit', serviceType: 'other' } } }));
    const res = await request(app)
      .post('/api/auth/signup')
      .send(
        signupBody({
          username: 'second',
          email: 'second@example.com',
          facility: { custom: { name: 'Generic Unit', serviceType: 'other' } },
        }),
      );
    expect(res.status).toBe(201);
  });

  it('keeps the legacy no-facility signup working as an unlinked custom org', async () => {
    const res = await request(app).post('/api/auth/signup').send(signupBody());
    expect(res.status).toBe(201);
    expect(res.body.organization.facilityCustom).toBe(true);
  });

  it('rejects signup without an email', async () => {
    const body = signupBody();
    delete (body as Record<string, unknown>).email;
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/api/auth/signup').send(signupBody({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });
});
