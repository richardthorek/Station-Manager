/**
 * GET /api/reports/truckcheck-comparative
 *
 * Cross-brigade comparative truck-check reporting (MASTER_PLAN Q5): aggregates
 * CheckResult outcomes by VehicleType + the stable itemCode (TC-D1) across
 * stations, and scopes the requested stationIds down to the caller's own
 * organization when an org context is present.
 */

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import reportsRouter from '../routes/reports';
import { requireFeature } from '../middleware/entitlements';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureVehicleTypeDatabase } from '../services/vehicleTypeDbFactory';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function orgToken(organizationId: string): string {
  return jwt.sign({ userId: 'u1', username: 'u1', role: 'admin', organizationId }, JWT_SECRET, { expiresIn: '1h' });
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/reports', requireFeature('reportsEnabled'), reportsRouter);
});

describe('GET /api/reports/truckcheck-comparative', () => {
  it('returns 400 when stationIds is missing', async () => {
    await request(app).get('/api/reports/truckcheck-comparative').expect(400);
  });

  it('aggregates results by vehicle type + itemCode across stations, and scopes stationIds to the caller org', async () => {
    const orgDb = ensureOrganizationDatabase();
    const ownOrg = await orgDb.createOrganization({ name: 'Own Brigade District', billingEmail: 'own@example.com', planCode: 'basic' });
    const otherOrg = await orgDb.createOrganization({ name: 'Other Brigade', billingEmail: 'other@example.com', planCode: 'basic' });

    const mainDb = await ensureDatabase();
    const stationA1 = await mainDb.createStation({
      name: 'Station A1', brigadeId: 'brigade-a1', brigadeName: 'Brigade A1',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Brigade A1', station: 'Station A1' },
      isActive: true, organizationId: ownOrg.id,
    });
    const stationA2 = await mainDb.createStation({
      name: 'Station A2', brigadeId: 'brigade-a2', brigadeName: 'Brigade A2',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Brigade A2', station: 'Station A2' },
      isActive: true, organizationId: ownOrg.id,
    });
    const stationB1 = await mainDb.createStation({
      name: 'Station B1', brigadeId: 'brigade-b1', brigadeName: 'Brigade B1',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Brigade B1', station: 'Station B1' },
      isActive: true, organizationId: otherOrg.id,
    });

    const vehicleTypeDb = ensureVehicleTypeDatabase();
    const vehicleType = await vehicleTypeDb.create({
      organizationId: ownOrg.id,
      code: 'cat1-tanker',
      name: 'Cat 1 Tanker',
      standardItems: [
        { id: 'std-1', name: 'Tyre Condition', description: 'Check tyres', order: 0, itemCode: 'tyre-condition', isStandard: true },
      ],
    });

    const truckDb = await ensureTruckChecksDatabase();
    const applianceA1 = await truckDb.createAppliance('Tanker A1', undefined, undefined, stationA1.id, undefined, { vehicleTypeId: vehicleType.id });
    const applianceA2 = await truckDb.createAppliance('Tanker A2', undefined, undefined, stationA2.id, undefined, { vehicleTypeId: vehicleType.id });
    const applianceB1 = await truckDb.createAppliance('Tanker B1', undefined, undefined, stationB1.id, undefined, { vehicleTypeId: vehicleType.id });

    const runA1 = await truckDb.createCheckRun(applianceA1.id, 'Alice', 'Alice', stationA1.id);
    await truckDb.createCheckResult(runA1.id, 'std-1', 'Tyre Condition', 'Check tyres', 'done', undefined, undefined, 'Alice', stationA1.id, 'tyre-condition');

    const runA2 = await truckDb.createCheckRun(applianceA2.id, 'Bob', 'Bob', stationA2.id);
    await truckDb.createCheckResult(runA2.id, 'std-1', 'Tyre Condition', 'Check tyres', 'issue', 'worn', undefined, 'Bob', stationA2.id, 'tyre-condition');

    const runB1 = await truckDb.createCheckRun(applianceB1.id, 'Carol', 'Carol', stationB1.id);
    await truckDb.createCheckResult(runB1.id, 'std-1', 'Tyre Condition', 'Check tyres', 'done', undefined, undefined, 'Carol', stationB1.id, 'tyre-condition');

    const stationIds = [stationA1.id, stationA2.id, stationB1.id].join(',');

    // Scoped to the org: station B1 (a different organization) must not appear.
    const scoped = await request(app)
      .get('/api/reports/truckcheck-comparative')
      .set('Authorization', `Bearer ${orgToken(ownOrg.id)}`)
      .query({ stationIds })
      .expect(200);

    expect(scoped.body.vehicleTypes).toHaveLength(1);
    const vt = scoped.body.vehicleTypes[0];
    expect(vt.vehicleTypeCode).toBe('cat1-tanker');
    expect(vt.items).toHaveLength(1);
    const item = vt.items[0];
    expect(item.itemCode).toBe('tyre-condition');

    const stationResults = item.stations;
    expect(stationResults.map((s: { stationId: string }) => s.stationId).sort()).toEqual([stationA1.id, stationA2.id].sort());

    const a1Result = stationResults.find((s: { stationId: string }) => s.stationId === stationA1.id);
    expect(a1Result).toMatchObject({ totalChecks: 1, doneCount: 1, issueCount: 0, skippedCount: 0, passRate: 100 });

    const a2Result = stationResults.find((s: { stationId: string }) => s.stationId === stationA2.id);
    expect(a2Result).toMatchObject({ totalChecks: 1, doneCount: 0, issueCount: 1, skippedCount: 0, passRate: 0 });

    // No auth/org context (kiosk/demo back-compat): all requested stations pass through.
    const unscoped = await request(app)
      .get('/api/reports/truckcheck-comparative')
      .query({ stationIds })
      .expect(200);

    const unscopedStations = unscoped.body.vehicleTypes[0].items[0].stations;
    expect(unscopedStations).toHaveLength(3);
  });

  it('skips results with no itemCode (pre-TC-D1 back-compat data)', async () => {
    const mainDb = await ensureDatabase();
    const station = await mainDb.createStation({
      name: 'Legacy Station', brigadeId: 'brigade-legacy', brigadeName: 'Brigade Legacy',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Brigade Legacy', station: 'Legacy Station' },
      isActive: true,
    });

    const truckDb = await ensureTruckChecksDatabase();
    const appliance = await truckDb.createAppliance('Legacy Tanker', undefined, undefined, station.id, 'cat1-pumper');
    const run = await truckDb.createCheckRun(appliance.id, 'Dana', 'Dana', station.id);
    await truckDb.createCheckResult(run.id, 'legacy-1', 'Old Item', 'no itemCode', 'done', undefined, undefined, 'Dana', station.id);

    const response = await request(app)
      .get('/api/reports/truckcheck-comparative')
      .query({ stationIds: station.id })
      .expect(200);

    expect(response.body.vehicleTypes).toHaveLength(0);
  });
});
