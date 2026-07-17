/**
 * Free-tier resource caps: enforceMemberLimit, enforceVehicleLimit, and
 * enforceStationLimit.
 *
 * The DB factories are mocked so member/vehicle/station data is deterministic
 * (the real in-memory DBs are pre-seeded and have no clear()). The organization
 * DB is real, so plan → entitlement resolution (and the UNLIMITED ceiling for
 * paid plans) is exercised end to end.
 *
 * Q33 (found 2026-07-17 while verifying AC-3): enforceMemberLimit/
 * enforceVehicleLimit/enforceStationLimit used to count members/vehicles/
 * stations across *every* organisation instead of scoping to the caller's
 * own org — a brand-new Community org could be blocked by a totally
 * unrelated org's (or the demo station's) data. The mocks below now model
 * real station-scoped data (members/appliances carry a stationId; stations
 * carry an organizationId) specifically so the cross-org isolation tests
 * exercise the real counting logic, not just a stubbed count.
 */

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface MockStation { id: string; organizationId?: string; isActive: boolean }
interface MockMember { id: string; stationId?: string }
interface MockAppliance { id: string; stationId?: string }

// Controllable fixtures for the mocked DBs.
let mockStations: MockStation[] = [];
let mockMembers: MockMember[] = [];
let mockAppliances: MockAppliance[] = [];

jest.mock('../services/dbFactory', () => ({
  ensureDatabase: jest.fn(async () => ({
    getAllMembers: () => mockMembers,
    getAllStations: () => mockStations,
  })),
}));

jest.mock('../services/truckChecksDbFactory', () => ({
  ensureTruckChecksDatabase: jest.fn(async () => ({
    getAllAppliances: () => mockAppliances,
  })),
}));

jest.mock('../services/organizationDbFactory', () => {
  const { getOrganizationDatabase } = require('../services/organizationDatabase');
  return { ensureOrganizationDatabase: () => getOrganizationDatabase() };
});

import { enforceMemberLimit, enforceVehicleLimit, enforceStationLimit } from '../middleware/entitlements';
import { getOrganizationDatabase } from '../services/organizationDatabase';

const orgDb = getOrganizationDatabase();

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.post('/members', enforceMemberLimit(), (_req, res) => res.status(201).json({ ok: true }));
  app.post('/vehicles', enforceVehicleLimit(), (_req, res) => res.status(201).json({ ok: true }));
  app.post('/stations', enforceStationLimit(), (_req, res) => res.status(201).json({ ok: true }));
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

/** Seed `n` members/appliances/stations all belonging to `organizationId`. */
function seedStationFor(organizationId: string, stationId: string): void {
  mockStations.push({ id: stationId, organizationId, isActive: true });
}

beforeEach(() => {
  delete process.env.ENABLE_ENTITLEMENTS; // default ON
  mockStations = [];
  mockMembers = [];
  mockAppliances = [];
});

afterAll(() => {
  delete process.env.ENABLE_ENTITLEMENTS;
});

describe('enforceMemberLimit (Community cap = 10)', () => {
  it('blocks a community org at the member cap with 403', async () => {
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');
    mockMembers = new Array(10).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-a' }));

    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(res.body.limit).toBe(10);
    expect(res.body.current).toBe(10);
  });

  it('allows a community org under the cap', async () => {
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');
    mockMembers = new Array(9).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-a' }));

    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('allows a paid (basic) org well past 10 — effectively unlimited', async () => {
    const org = await createOrg('basic');
    seedStationFor(org.id, 'station-a');
    mockMembers = new Array(500).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-a' }));

    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('passes through with no org context (kiosk/back-compat)', async () => {
    mockMembers = new Array(50).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-a' }));
    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${plainToken()}`);
    expect(res.status).toBe(201);
  });

  it('is a no-op when ENABLE_ENTITLEMENTS=false', async () => {
    process.env.ENABLE_ENTITLEMENTS = 'false';
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');
    mockMembers = new Array(50).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-a' }));

    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('Q33: does not count another organisation\'s members toward this org\'s cap', async () => {
    const orgA = await createOrg('community');
    const orgB = await createOrg('community');
    seedStationFor(orgA.id, 'station-a');
    seedStationFor(orgB.id, 'station-b');
    // Org B alone is already over the Community cap — org A has none yet.
    mockMembers = new Array(20).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-b' }));

    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(orgA.id)}`);
    expect(res.status).toBe(201);
  });

  it('Q33: a station with no organizationId (pre-fix legacy data) does not count toward any org', async () => {
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');
    mockStations.push({ id: 'legacy-station', isActive: true }); // no organizationId
    mockMembers = [
      ...new Array(3).fill(null).map((_, i) => ({ id: `m${i}`, stationId: 'station-a' })),
      ...new Array(20).fill(null).map((_, i) => ({ id: `legacy-m${i}`, stationId: 'legacy-station' })),
    ];

    const res = await request(buildApp()).post('/members').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });
});

describe('enforceVehicleLimit (Community cap = 1)', () => {
  it('blocks a community org at the vehicle cap with 403', async () => {
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');
    mockAppliances = [{ id: 'v1', stationId: 'station-a' }];

    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(res.body.limit).toBe(1);
  });

  it('allows a community org with no vehicles yet', async () => {
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');
    mockAppliances = [];

    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('allows a paid (ai) org past 1 — effectively unlimited', async () => {
    const org = await createOrg('ai');
    seedStationFor(org.id, 'station-a');
    mockAppliances = new Array(30).fill(null).map((_, i) => ({ id: `v${i}`, stationId: 'station-a' }));

    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('Q33: does not count another organisation\'s vehicles toward this org\'s cap', async () => {
    const orgA = await createOrg('community');
    const orgB = await createOrg('community');
    seedStationFor(orgA.id, 'station-a');
    seedStationFor(orgB.id, 'station-b');
    // Reproduces the exact bug found live: another org's (or the demo
    // station's) fleet alone exceeded the cap, so a brand-new org's first
    // vehicle was refused.
    mockAppliances = new Array(5).fill(null).map((_, i) => ({ id: `v${i}`, stationId: 'station-b' }));

    const res = await request(buildApp()).post('/vehicles').set('Authorization', `Bearer ${orgToken(orgA.id)}`);
    expect(res.status).toBe(201);
  });
});

describe('enforceStationLimit (Community cap = 1)', () => {
  it('blocks a community org at the station cap with 403', async () => {
    const org = await createOrg('community');
    seedStationFor(org.id, 'station-a');

    const res = await request(buildApp()).post('/stations').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(res.body.limit).toBe(1);
  });

  it('allows a community org with no stations yet', async () => {
    const org = await createOrg('community');

    const res = await request(buildApp()).post('/stations').set('Authorization', `Bearer ${orgToken(org.id)}`);
    expect(res.status).toBe(201);
  });

  it('Q33: does not count another organisation\'s stations toward this org\'s cap', async () => {
    const orgA = await createOrg('community');
    const orgB = await createOrg('community');
    seedStationFor(orgB.id, 'station-b');
    seedStationFor(orgB.id, 'station-b2');

    const res = await request(buildApp()).post('/stations').set('Authorization', `Bearer ${orgToken(orgA.id)}`);
    expect(res.status).toBe(201);
  });
});
