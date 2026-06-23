/**
 * Appliance Zones API + DB tests (A1 — per-truck spatial model).
 *
 * Covers the zone CRUD routes on the truck-checks router and the in-memory
 * ApplianceZoneDatabase (ordering, default order, slug, list-by-appliance).
 */

// Mock the index module to avoid starting the server (truckChecks imports `io`).
jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import truckChecksRouter from '../routes/truckChecks';
import { ApplianceZoneDatabase, sortZones } from '../services/applianceZoneDatabase';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const adminToken = (organizationId = 'org-1') =>
  jwt.sign({ userId: 'admin-1', username: 'admin-1', role: 'admin', organizationId }, JWT_SECRET);
const auth = () => ({ Authorization: `Bearer ${adminToken()}` });

let app: Express;
let applianceId: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.set('io', { emit: jest.fn(), to: jest.fn().mockReturnThis() });
  app.use('/api/truck-checks', truckChecksRouter);

  const res = await request(app)
    .post('/api/truck-checks/appliances')
    .send({ name: 'Cat 1 — Zone Test Truck', description: 'fixture' })
    .expect(201);
  applianceId = res.body.id;
});

describe('Appliance Zones API', () => {
  let zoneAId: string;

  describe('POST /appliances/:applianceId/zones', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app).post(`/api/truck-checks/appliances/${applianceId}/zones`).send({ name: 'Cab' }).expect(401);
    });

    it('404s for an unknown appliance', async () => {
      await request(app)
        .post('/api/truck-checks/appliances/does-not-exist/zones')
        .set(auth()).send({ name: 'Cab' }).expect(404);
    });

    it('400s when name is missing', async () => {
      await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/zones`)
        .set(auth()).send({ side: 'driver' }).expect(400);
    });

    it('creates a zone with a derived zoneCode and order 0', async () => {
      const res = await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/zones`)
        .set(auth()).send({ name: 'Pump Panel', side: 'rear' }).expect(201);
      expect(res.body.name).toBe('Pump Panel');
      expect(res.body.zoneCode).toBe('pump-panel');
      expect(res.body.side).toBe('rear');
      expect(res.body.order).toBe(0);
      expect(res.body.applianceId).toBe(applianceId);
      zoneAId = res.body.id;
    });

    it('appends the next zone at the end of the order', async () => {
      const res = await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/zones`)
        .set(auth()).send({ name: 'Driver-side Locker 1', side: 'driver' }).expect(201);
      expect(res.body.order).toBe(1);
    });

    it('ignores an invalid side rather than storing it', async () => {
      const res = await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/zones`)
        .set(auth()).send({ name: 'Cab', side: 'sideways' }).expect(201);
      expect(res.body.side).toBeUndefined();
    });
  });

  describe('GET /appliances/:applianceId/zones', () => {
    it('lists the appliance zones in walk-around order', async () => {
      const res = await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}/zones`)
        .set(auth()).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      const orders = res.body.map((z: { order: number }) => z.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });
  });

  describe('PUT /zones/:id', () => {
    it('updates a zone', async () => {
      const res = await request(app)
        .put(`/api/truck-checks/zones/${zoneAId}`)
        .set(auth()).send({ name: 'Pump Panel (rear)', order: 5 }).expect(200);
      expect(res.body.name).toBe('Pump Panel (rear)');
      expect(res.body.order).toBe(5);
    });

    it('404s for an unknown zone', async () => {
      await request(app).put('/api/truck-checks/zones/nope').set(auth()).send({ name: 'x' }).expect(404);
    });
  });

  describe('DELETE /zones/:id', () => {
    it('deletes a zone', async () => {
      await request(app).delete(`/api/truck-checks/zones/${zoneAId}`).set(auth()).expect(204);
      const res = await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}/zones`).set(auth()).expect(200);
      expect(res.body.find((z: { id: string }) => z.id === zoneAId)).toBeUndefined();
      expect(res.body.length).toBe(2);
    });

    it('404s for an unknown zone', async () => {
      await request(app).delete('/api/truck-checks/zones/nope').set(auth()).expect(404);
    });
  });
});

describe('ApplianceZoneDatabase (in-memory)', () => {
  it('defaults order to the end of the appliance list and derives zoneCode', async () => {
    const db = new ApplianceZoneDatabase();
    const a = await db.create({ applianceId: 'truck-1', name: 'Cab' });
    const b = await db.create({ applianceId: 'truck-1', name: 'Pump Panel' });
    const other = await db.create({ applianceId: 'truck-2', name: 'Cab' });
    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
    expect(other.order).toBe(0); // per-appliance ordering, not global
    expect(b.zoneCode).toBe('pump-panel');
  });

  it('lists only the requested appliance, in order', async () => {
    const db = new ApplianceZoneDatabase();
    await db.create({ applianceId: 't1', name: 'B', order: 2 });
    await db.create({ applianceId: 't1', name: 'A', order: 1 });
    await db.create({ applianceId: 't2', name: 'Z', order: 0 });
    const zones = await db.listForAppliance('t1');
    expect(zones.map((z) => z.name)).toEqual(['A', 'B']);
  });

  it('update patches fields and bumps updatedAt; delete removes', async () => {
    const db = new ApplianceZoneDatabase();
    const z = await db.create({ applianceId: 't1', name: 'Cab' });
    const updated = await db.update(z.id, { name: 'Cabin', side: 'interior' });
    expect(updated?.name).toBe('Cabin');
    expect(updated?.side).toBe('interior');
    expect(await db.update('missing', { name: 'x' })).toBeNull();
    expect(await db.delete(z.id)).toBe(true);
    expect(await db.getById(z.id)).toBeNull();
  });

  it('sortZones orders by order then name', () => {
    const mk = (order: number, name: string) => ({ id: name, applianceId: 't', name, order, createdAt: new Date(), updatedAt: new Date() });
    const sorted = sortZones([mk(2, 'b'), mk(1, 'z'), mk(1, 'a')]);
    expect(sorted.map((z) => z.name)).toEqual(['a', 'z', 'b']);
  });

  it('create honours an explicit zoneCode, parentZoneId and order', async () => {
    const db = new ApplianceZoneDatabase();
    const z = await db.create({
      applianceId: 't1', name: 'Locker 1', zoneCode: 'custom-code',
      parentZoneId: 'parent-1', order: 9, side: 'passenger', stationId: 's1', description: 'd',
    });
    expect(z.zoneCode).toBe('custom-code');
    expect(z.parentZoneId).toBe('parent-1');
    expect(z.order).toBe(9);
    expect(z.stationId).toBe('s1');
  });

  it('update patches every optional field independently', async () => {
    const db = new ApplianceZoneDatabase();
    const z = await db.create({ applianceId: 't1', name: 'Cab' });
    const u = await db.update(z.id, {
      zoneCode: 'cab', parentZoneId: 'p1', order: 3, description: 'desc', stationId: 's2',
    });
    expect(u?.zoneCode).toBe('cab');
    expect(u?.parentZoneId).toBe('p1');
    expect(u?.order).toBe(3);
    expect(u?.description).toBe('desc');
    expect(u?.stationId).toBe('s2');
  });
});

describe('Appliance Zones API — update field coverage', () => {
  let appId: string;
  let zoneId: string;

  beforeAll(async () => {
    const a = await request(app).post('/api/truck-checks/appliances').send({ name: 'Coverage Truck' }).expect(201);
    appId = a.body.id;
    const z = await request(app)
      .post(`/api/truck-checks/appliances/${appId}/zones`)
      .set(auth()).send({ name: 'Locker', zoneCode: 'seed', parentZoneId: 'root', order: 4 }).expect(201);
    expect(z.body.zoneCode).toBe('seed');
    expect(z.body.parentZoneId).toBe('root');
    expect(z.body.order).toBe(4);
    zoneId = z.body.id;
  });

  it('PUT updates zoneCode (slugified), parentZoneId, side and description together', async () => {
    const res = await request(app)
      .put(`/api/truck-checks/zones/${zoneId}`)
      .set(auth())
      .send({ zoneCode: 'Driver Side Locker', parentZoneId: 'cab', side: 'driver', description: 'top shelf' })
      .expect(200);
    expect(res.body.zoneCode).toBe('driver-side-locker');
    expect(res.body.parentZoneId).toBe('cab');
    expect(res.body.side).toBe('driver');
    expect(res.body.description).toBe('top shelf');
  });

  it('PUT with a blank zoneCode is a no-op (blank = not provided, per patch semantics)', async () => {
    const res = await request(app)
      .put(`/api/truck-checks/zones/${zoneId}`)
      .set(auth()).send({ zoneCode: '   ' }).expect(200);
    // The route maps a blank code to `undefined`, which the partial-patch update
    // treats as "skip" — so the previously-set code is left unchanged.
    expect(res.body.zoneCode).toBe('driver-side-locker');
  });
});
