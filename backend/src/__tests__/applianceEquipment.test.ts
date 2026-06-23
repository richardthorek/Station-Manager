/**
 * Appliance Equipment API + DB tests (A1 — per-truck inventory).
 *
 * Covers the equipment CRUD routes on the truck-checks router and the in-memory
 * ApplianceEquipmentDatabase (active filtering, slug, list-by-appliance, patch).
 */

jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import truckChecksRouter from '../routes/truckChecks';
import { ApplianceEquipmentDatabase, sortEquipment } from '../services/applianceEquipmentDatabase';

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
    .send({ name: 'Cat 1 — Equipment Test Truck', description: 'fixture' })
    .expect(201);
  applianceId = res.body.id;
});

describe('Appliance Equipment API', () => {
  let itemId: string;

  describe('POST /appliances/:applianceId/equipment', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app).post(`/api/truck-checks/appliances/${applianceId}/equipment`).send({ name: 'BA set' }).expect(401);
    });

    it('404s for an unknown appliance', async () => {
      await request(app)
        .post('/api/truck-checks/appliances/nope/equipment')
        .set(auth()).send({ name: 'BA set' }).expect(404);
    });

    it('400s when name is missing', async () => {
      await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/equipment`)
        .set(auth()).send({ serialNumber: 'X1' }).expect(400);
    });

    it('creates equipment with a derived code, active by default', async () => {
      const res = await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/equipment`)
        .set(auth()).send({ name: 'Holmatro Spreader', serialNumber: 'HS-42' }).expect(201);
      expect(res.body.name).toBe('Holmatro Spreader');
      expect(res.body.equipmentCode).toBe('holmatro-spreader');
      expect(res.body.serialNumber).toBe('HS-42');
      expect(res.body.active).toBe(true);
      expect(res.body.applianceId).toBe(applianceId);
      itemId = res.body.id;
    });
  });

  describe('GET /appliances/:applianceId/equipment', () => {
    it('lists active equipment by default and hides retired unless asked', async () => {
      // add a second item and retire it
      const retired = await request(app)
        .post(`/api/truck-checks/appliances/${applianceId}/equipment`)
        .set(auth()).send({ name: 'Old BA set', active: false }).expect(201);
      expect(retired.body.active).toBe(false);

      const activeOnly = await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}/equipment`).set(auth()).expect(200);
      expect(activeOnly.body.find((e: { id: string }) => e.id === retired.body.id)).toBeUndefined();

      const all = await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}/equipment?includeInactive=true`).set(auth()).expect(200);
      expect(all.body.find((e: { id: string }) => e.id === retired.body.id)).toBeDefined();
    });
  });

  describe('PUT /equipment/:id', () => {
    it('updates fields and can retire via active:false', async () => {
      const res = await request(app)
        .put(`/api/truck-checks/equipment/${itemId}`)
        .set(auth()).send({ name: 'Holmatro Spreader (cab)', notes: 'in cab', active: false }).expect(200);
      expect(res.body.name).toBe('Holmatro Spreader (cab)');
      expect(res.body.notes).toBe('in cab');
      expect(res.body.active).toBe(false);
    });

    it('404s for an unknown item', async () => {
      await request(app).put('/api/truck-checks/equipment/nope').set(auth()).send({ name: 'x' }).expect(404);
    });
  });

  describe('DELETE /equipment/:id', () => {
    it('deletes an item', async () => {
      await request(app).delete(`/api/truck-checks/equipment/${itemId}`).set(auth()).expect(204);
      const all = await request(app)
        .get(`/api/truck-checks/appliances/${applianceId}/equipment?includeInactive=true`).set(auth()).expect(200);
      expect(all.body.find((e: { id: string }) => e.id === itemId)).toBeUndefined();
    });

    it('404s for an unknown item', async () => {
      await request(app).delete('/api/truck-checks/equipment/nope').set(auth()).expect(404);
    });
  });
});

describe('ApplianceEquipmentDatabase (in-memory)', () => {
  it('defaults active true, derives code, scopes per appliance', async () => {
    const db = new ApplianceEquipmentDatabase();
    const a = await db.create({ applianceId: 't1', name: 'Akron Branch' });
    await db.create({ applianceId: 't2', name: 'BA set' });
    expect(a.active).toBe(true);
    expect(a.equipmentCode).toBe('akron-branch');
    expect((await db.listForAppliance('t1')).length).toBe(1);
  });

  it('listForAppliance hides inactive unless includeInactive', async () => {
    const db = new ApplianceEquipmentDatabase();
    await db.create({ applianceId: 't1', name: 'Active item' });
    await db.create({ applianceId: 't1', name: 'Retired item', active: false });
    expect((await db.listForAppliance('t1')).map((e) => e.name)).toEqual(['Active item']);
    expect((await db.listForAppliance('t1', true)).map((e) => e.name)).toEqual(['Active item', 'Retired item']);
  });

  it('update patches every optional field; delete removes', async () => {
    const db = new ApplianceEquipmentDatabase();
    const e = await db.create({ applianceId: 't1', name: 'Spreader' });
    const u = await db.update(e.id, {
      equipmentCode: 'spr', zoneId: 'z1', serialNumber: 'S1', notes: 'n', active: false, stationId: 's1',
    });
    expect(u?.equipmentCode).toBe('spr');
    expect(u?.zoneId).toBe('z1');
    expect(u?.serialNumber).toBe('S1');
    expect(u?.notes).toBe('n');
    expect(u?.active).toBe(false);
    expect(u?.stationId).toBe('s1');
    expect(await db.update('missing', { name: 'x' })).toBeNull();
    expect(await db.delete(e.id)).toBe(true);
    expect(await db.getById(e.id)).toBeNull();
  });

  it('sortEquipment orders by name', () => {
    const mk = (name: string) => ({ id: name, applianceId: 't', name, active: true, createdAt: new Date(), updatedAt: new Date() });
    expect(sortEquipment([mk('Zulu'), mk('Alpha'), mk('Mike')]).map((e) => e.name)).toEqual(['Alpha', 'Mike', 'Zulu']);
  });
});
