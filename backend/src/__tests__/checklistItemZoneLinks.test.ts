/**
 * A1 inc 3 — ChecklistItem zone/equipment links + response metadata.
 *
 * The new optional fields (zoneId, equipmentId, expectedResponseType, unit,
 * promptHint) must round-trip through BOTH checklist persistence paths:
 *   - a brigade's per-appliance custom overlay (template), and
 *   - a VehicleType's locked standard items.
 * These are the link that makes the per-truck zone/equipment model useful.
 */

jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import truckChecksRouter from '../routes/truckChecks';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const adminAuth = () => ({
  Authorization: `Bearer ${jwt.sign({ userId: 'a1', username: 'a1', role: 'admin', organizationId: 'org-links' }, JWT_SECRET)}`,
});

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.set('io', { emit: jest.fn(), to: jest.fn().mockReturnThis() });
  app.use('/api/truck-checks', truckChecksRouter);
});

describe('ChecklistItem zone/equipment links — custom overlay round-trip', () => {
  it('preserves zoneId/equipmentId/expectedResponseType/unit/promptHint through save + effective checklist', async () => {
    const appliance = await request(app)
      .post('/api/truck-checks/appliances')
      .send({ name: 'Links Truck' }).expect(201);
    const applianceId = appliance.body.id;

    const customItems = [{
      id: 'ci-1', name: 'Primary pump pressure', description: 'Read the gauge',
      order: 0,
      zoneId: 'zone-pump-panel',
      equipmentId: 'equip-akron',
      expectedResponseType: 'numeric',
      unit: 'psi',
      promptHint: 'Ask for the reading at idle',
    }];

    await request(app)
      .put(`/api/truck-checks/appliances/${applianceId}/checklist`)
      .send({ customItems, itemOrder: ['ci-1'] }).expect(200);

    const res = await request(app)
      .get(`/api/truck-checks/appliances/${applianceId}/checklist`).expect(200);

    const item = res.body.items.find((i: { name: string }) => i.name === 'Primary pump pressure');
    expect(item).toBeDefined();
    expect(item.zoneId).toBe('zone-pump-panel');
    expect(item.equipmentId).toBe('equip-akron');
    expect(item.expectedResponseType).toBe('numeric');
    expect(item.unit).toBe('psi');
    expect(item.promptHint).toBe('Ask for the reading at idle');
    expect(item.isStandard).toBe(false);
  });
});

describe('ChecklistItem zone/equipment links — VehicleType standard items round-trip', () => {
  it('preserves the new fields on a VehicleType standardItems through create + list', async () => {
    const standardItems = [{
      name: 'Foam tank level', description: 'Check level',
      zoneId: 'zone-tank',
      expectedResponseType: 'level',
      promptHint: 'low / half / full',
    }];

    const created = await request(app)
      .post('/api/truck-checks/vehicle-types')
      .set(adminAuth())
      .send({ name: 'Links Cat 1', standardItems }).expect(201);

    // normaliseStandardItems forces id/order/itemCode/isStandard but must keep extras.
    const item = created.body.standardItems[0];
    expect(item.zoneId).toBe('zone-tank');
    expect(item.expectedResponseType).toBe('level');
    expect(item.promptHint).toBe('low / half / full');
    expect(item.isStandard).toBe(true);
    expect(item.itemCode).toBe('foam-tank-level');

    const list = await request(app)
      .get('/api/truck-checks/vehicle-types').set(adminAuth()).expect(200);
    const listed = list.body.find((t: { id: string }) => t.id === created.body.id);
    expect(listed.standardItems[0].zoneId).toBe('zone-tank');
    expect(listed.standardItems[0].expectedResponseType).toBe('level');
  });
});
