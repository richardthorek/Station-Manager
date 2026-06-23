/**
 * A1 inc 5 — Per-vehicleType starter zone-vocabulary seed.
 *
 * Tests:
 *  - getStarterZones() unit tests (pure function, no HTTP)
 *  - POST /appliances auto-seeds zones when vehicleTypeId is given
 *  - POST /appliances/:id/seed-zones happy path, idempotency, replace=true, 422s
 */

jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import truckChecksRouter from '../routes/truckChecks';
import { getStarterZones, ZONE_VOCABULARY } from '../constants/zoneVocabulary';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const adminToken = () =>
  jwt.sign({ userId: 'admin-1', username: 'admin', role: 'admin', organizationId: 'org-1' }, JWT_SECRET);
const auth = () => ({ Authorization: `Bearer ${adminToken()}` });

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.set('io', { emit: jest.fn(), to: jest.fn().mockReturnThis() });
  app.use('/api/truck-checks', truckChecksRouter);
});

// ─── Unit: vocabulary helper ──────────────────────────────────────────────────

describe('getStarterZones()', () => {
  it('returns zones for cat1-tanker', () => {
    const zones = getStarterZones('cat1-tanker');
    expect(zones.length).toBeGreaterThan(0);
    const codes = zones.map((z) => z.zoneCode);
    expect(codes).toContain('cab');
    expect(codes).toContain('pump-panel');
    expect(codes).toContain('rear');
  });

  it('cat1 alias returns the same layout as cat1-tanker', () => {
    expect(getStarterZones('cat1')).toBe(getStarterZones('cat1-tanker'));
  });

  it('returns zones for pumper', () => {
    const zones = getStarterZones('pumper');
    const codes = zones.map((z) => z.zoneCode);
    expect(codes).toContain('pump-panel');
    expect(codes).toContain('compt-driver-front');
    expect(codes).toContain('compt-passenger-rear');
  });

  it('returns zones for bulk-water-tender', () => {
    const zones = getStarterZones('bulk-water-tender');
    expect(zones.map((z) => z.zoneCode)).toContain('tank-top');
  });

  it('returns zones for rescue-tender', () => {
    const zones = getStarterZones('rescue-tender');
    expect(zones.map((z) => z.zoneCode)).toContain('compt-driver');
  });

  it('returns zones for command', () => {
    const zones = getStarterZones('command');
    expect(zones.map((z) => z.zoneCode)).toContain('cab');
    expect(zones.length).toBeLessThan(5);
  });

  it('returns empty array for unknown code', () => {
    expect(getStarterZones('unknown-type-xyz')).toEqual([]);
  });

  it('all entries in ZONE_VOCABULARY have unique zoneCode per array', () => {
    for (const [code, specs] of Object.entries(ZONE_VOCABULARY)) {
      const seen = new Set(specs.map((s) => s.zoneCode));
      expect(seen.size).toBe(specs.length);
      // each spec must have a non-empty zoneCode
      for (const s of specs) {
        expect(s.zoneCode).toBeTruthy();
        expect(typeof s.name).toBe('string');
      }
      void code; // suppress unused var lint
    }
  });

  it('zones are in ascending order', () => {
    const zones = getStarterZones('cat1-tanker');
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].order).toBeGreaterThan(zones[i - 1].order);
    }
  });
});

// ─── Integration: auto-seed on appliance create ───────────────────────────────

describe('Auto-seed zones on appliance create', () => {
  it('seeds zones when vehicleTypeId matches a known type code', async () => {
    // Create a vehicle type with a known vocabulary code
    const vtRes = await request(app)
      .post('/api/truck-checks/vehicle-types')
      .set(auth())
      .send({ name: 'Cat 1 Tanker', code: 'cat1-tanker', isStandard: false, standardItems: [] })
      .expect(201);
    const vehicleTypeId = vtRes.body.id;

    // Create appliance linked to it
    const appRes = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Seed Test Tanker', vehicleTypeId })
      .expect(201);
    const applianceId = appRes.body.id;

    // Zones should have been auto-seeded
    const zonesRes = await request(app)
      .get(`/api/truck-checks/appliances/${applianceId}/zones`)
      .set(auth())
      .expect(200);

    const codes = (zonesRes.body as { zoneCode: string }[]).map((z) => z.zoneCode);
    expect(codes).toContain('cab');
    expect(codes).toContain('pump-panel');
    expect(codes).toContain('rear');
    expect(zonesRes.body).toHaveLength(getStarterZones('cat1-tanker').length);
  });

  it('does not seed zones when vehicleTypeId is absent', async () => {
    const appRes = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'No-Type Truck' })
      .expect(201);

    const zonesRes = await request(app)
      .get(`/api/truck-checks/appliances/${appRes.body.id}/zones`)
      .set(auth())
      .expect(200);

    expect(zonesRes.body).toHaveLength(0);
  });

  it('does not fail create when vehicleTypeId points to an unknown vehicle type', async () => {
    const appRes = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Ghost Type Truck', vehicleTypeId: 'does-not-exist' })
      .expect(201); // must succeed

    // No zones seeded
    const zonesRes = await request(app)
      .get(`/api/truck-checks/appliances/${appRes.body.id}/zones`)
      .set(auth())
      .expect(200);
    expect(zonesRes.body).toHaveLength(0);
  });
});

// ─── Integration: POST seed-zones endpoint ────────────────────────────────────

describe('POST /appliances/:id/seed-zones', () => {
  let applianceWithTypeId: string;
  let applianceNoTypeId: string;

  beforeAll(async () => {
    // Vehicle type whose code is in the vocabulary
    const vtRes = await request(app)
      .post('/api/truck-checks/vehicle-types')
      .set(auth())
      .send({ name: 'Pumper (seed test)', code: 'pumper', isStandard: false, standardItems: [] })
      .expect(201);

    // Appliance WITHOUT vehicleTypeId (create first to skip auto-seed)
    const noType = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Seed-Zones No-Type' })
      .expect(201);
    applianceNoTypeId = noType.body.id;

    // Appliance WITH vehicleTypeId — but we'll create a separate one for the
    // seed-zones tests so the auto-seeded one doesn't interfere.
    const withType = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Seed-Zones Pumper', vehicleTypeId: vtRes.body.id })
      .expect(201);
    applianceWithTypeId = withType.body.id;
  });

  it('401 when unauthenticated', async () => {
    await request(app)
      .post(`/api/truck-checks/appliances/${applianceWithTypeId}/seed-zones`)
      .expect(401);
  });

  it('404 for unknown appliance', async () => {
    await request(app)
      .post('/api/truck-checks/appliances/no-such-id/seed-zones')
      .set(auth())
      .expect(404);
  });

  it('422 when appliance has no vehicleTypeId', async () => {
    const res = await request(app)
      .post(`/api/truck-checks/appliances/${applianceNoTypeId}/seed-zones`)
      .set(auth())
      .expect(422);
    expect(res.body.error).toMatch(/vehicleTypeId/);
  });

  it('is idempotent — returns existing zones without re-seeding', async () => {
    // auto-seed already happened on create; call seed-zones again
    const res = await request(app)
      .post(`/api/truck-checks/appliances/${applianceWithTypeId}/seed-zones`)
      .set(auth())
      .expect(200);

    expect(res.body.seeded).toBe(0);
    expect(res.body.message).toMatch(/already exist/);
    expect(res.body.zones.length).toBeGreaterThan(0);
  });

  it('re-seeds when ?replace=true', async () => {
    const expectedCount = getStarterZones('pumper').length;

    const res = await request(app)
      .post(`/api/truck-checks/appliances/${applianceWithTypeId}/seed-zones?replace=true`)
      .set(auth())
      .expect(200);

    expect(res.body.seeded).toBe(expectedCount);
    expect(res.body.zones).toHaveLength(expectedCount);

    // After replace, zones list must match the expected count
    const list = await request(app)
      .get(`/api/truck-checks/appliances/${applianceWithTypeId}/zones`)
      .set(auth())
      .expect(200);
    expect(list.body).toHaveLength(expectedCount);
  });

  it('returns seeded=0 and a message for an unknown vehicle type code', async () => {
    // Create a vehicle type whose code is NOT in the vocabulary
    const vtRes = await request(app)
      .post('/api/truck-checks/vehicle-types')
      .set(auth())
      .send({ name: 'Custom Type', code: 'brigade-custom-xyz', isStandard: false, standardItems: [] })
      .expect(201);

    const appRes = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Custom Type Truck', vehicleTypeId: vtRes.body.id })
      .expect(201);

    const res = await request(app)
      .post(`/api/truck-checks/appliances/${appRes.body.id}/seed-zones`)
      .set(auth())
      .expect(200);

    expect(res.body.seeded).toBe(0);
    expect(res.body.message).toMatch(/brigade-custom-xyz/);
  });
});
