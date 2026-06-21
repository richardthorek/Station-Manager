/**
 * Free-tier resource caps: enforceMemberLimit + enforceVehicleLimit.
 *
 * The DB factories are mocked so the member/vehicle counts are deterministic
 * (the real in-memory DBs are pre-seeded and have no clear()). The organization
 * DB is real, so plan → entitlement resolution (and the UNLIMITED ceiling for
 * paid plans) is exercised end to end.
 */

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Controllable counts for the mocked DBs.
let memberCount = 0;
let vehicleCount = 0;

jest.mock('../services/dbFactory', () => ({
  ensureDatabase: jest.fn(async () => ({
    getAllMembers: () => new Array(memberCount).fill({ id: 'm' }),
  })),
}));

jest.mock('../services/truckChecksDbFactory', () => ({
  ensureTruckChecksDatabase: jest.fn(async () => ({
    getAllAppliances: () => new Array(vehicleCount).fill({ id: 'v' }),
  })),
}));

jest.mock('../services/organizationDbFactory', () => {
  const { getOrganizationDatabase } = require('../services/organizationDatabase');
  return { ensureOrganizationDatabase: () => getOrganizationDatabase() };
});

import { enforceMemberLimit, enforceVehicleLimit } from '../middleware/entitlements';
import { getOrganizationDatabase } from '../services/organizationDatabase';

const orgDb = getOrganizationDatabase();

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.post('/members', enforceMemberLimit(), (_req, res) => res.status(201).json({ ok: true }));
  app.post('/vehicles', enforceVehicleLimit(), (_req, res) => res.status(201).json({ ok: true }));
  return app;
}

function orgToken(organizationId: string): string {
  return jwt.sign({ userId: 'u1', username: 'u1', role: 'admin', organizationId }, JWT_SECRET, { expiresIn: '1h' });
}

function plainToken(): string {
  return jwt.sign({ userId: 'u2', username: 'u2', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const createOrg = (plan: 'community' | 'basic' | 'ai') =>
  orgDb.createOrganization({ name: `Org ${Date.now()}-${Math.random()}`, billingEmail: 'x@x.com', planCode: plan });

beforeEach(() => {
  delete process.env.ENABLE_ENTITLEMENTS; // default ON
  memberCount = 0;
  vehicleCount = 0;
});

afterAll(() => {
  delete process.env.ENABLE_ENTITLEMENTS;
});

describe('enforceMemberLimit (Community cap = 10)', () => {
  it('blocks a community org at the member cap with 403', async () => {
    const org = await createOrg('community');
    memberCount = 10;
    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(res.body.limit).toBe(10);
    expect(res.body.current).toBe(10);
  });

  it('allows a community org under the cap', async () => {
    const org = await createOrg('community');
    memberCount = 9;
    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('allows a paid (basic) org well past 10 — effectively unlimited', async () => {
    const org = await createOrg('basic');
    memberCount = 500;
    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('passes through with no org context (kiosk/back-compat)', async () => {
    memberCount = 50;
    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${plainToken()}`);
    expect(res.status).toBe(201);
  });

  it('is a no-op when ENABLE_ENTITLEMENTS=false', async () => {
    process.env.ENABLE_ENTITLEMENTS = 'false';
    const org = await createOrg('community');
    memberCount = 50;
    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });
});

describe('enforceVehicleLimit (Community cap = 1)', () => {
  it('blocks a community org at the vehicle cap with 403', async () => {
    const org = await createOrg('community');
    vehicleCount = 1;
    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(res.body.limit).toBe(1);
  });

  it('allows a community org with no vehicles yet', async () => {
    const org = await createOrg('community');
    vehicleCount = 0;
    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('allows a paid (ai) org past 1 — effectively unlimited', async () => {
    const org = await createOrg('ai');
    vehicleCount = 30;
    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });
});
