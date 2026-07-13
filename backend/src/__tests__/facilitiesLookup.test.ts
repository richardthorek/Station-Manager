import request from 'supertest';
import express, { Express } from 'express';
import facilitiesRouter, { clearClaimedKeysCache } from '../routes/facilities';
import { getFacilitiesParser } from '../services/facilitiesParser';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { installFacilitiesFixture, restoreFacilitiesFixture } from './helpers/facilitiesFixture';

describe('GET /api/facilities/lookup', () => {
  let app: Express;

  beforeAll(async () => {
    installFacilitiesFixture();
    await initializeOrganizationDatabase();
  });

  afterAll(() => {
    restoreFacilitiesFixture();
  });

  beforeEach(async () => {
    getFacilitiesParser().resetForTesting();
    clearClaimedKeysCache();
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    app = express();
    app.use(express.json());
    app.use('/api/facilities', facilitiesRouter);
  });

  it('requires a query or lat/lon', async () => {
    const res = await request(app).get('/api/facilities/lookup');
    expect(res.status).toBe(400);
  });

  it('returns matching facilities across service types', async () => {
    const res = await request(app).get('/api/facilities/lookup').query({ q: 'bungendore' });
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(2);
    const serviceTypes = res.body.results.map((r: { serviceType: string }) => r.serviceType);
    expect(serviceTypes).toEqual(expect.arrayContaining(['rural-fire', 'ses']));
  });

  it('filters by serviceType', async () => {
    const res = await request(app).get('/api/facilities/lookup').query({ q: 'bungendore', serviceType: 'ses' });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].serviceType).toBe('ses');
  });

  it('rejects an invalid serviceType', async () => {
    const res = await request(app).get('/api/facilities/lookup').query({ q: 'bungendore', serviceType: 'volunteer' });
    expect(res.status).toBe(400);
  });

  it('marks a facility claimed once an organization holds its key', async () => {
    const orgDb = ensureOrganizationDatabase();
    await orgDb.createOrganization({
      name: 'Bungendore RFS',
      billingEmail: 'x@example.com',
      facilityKey: 'rural-fire:101',
      facilityObjectId: '101',
      facilityServiceType: 'rural-fire',
      facilityName: 'Bungendore Rural Fire Brigade',
    });
    const res = await request(app).get('/api/facilities/lookup').query({ q: 'bungendore rural' });
    expect(res.status).toBe(200);
    const match = res.body.results.find((r: { facilityKey: string }) => r.facilityKey === 'rural-fire:101');
    expect(match.claimed).toBe(true);
  });

  it('does not expose the claiming organization identity', async () => {
    const orgDb = ensureOrganizationDatabase();
    await orgDb.createOrganization({
      name: 'Secret Org Name',
      billingEmail: 'x@example.com',
      facilityKey: 'rural-fire:101',
    });
    const res = await request(app).get('/api/facilities/lookup').query({ q: 'bungendore rural' });
    expect(JSON.stringify(res.body)).not.toContain('Secret Org Name');
  });

  it('returns 503 when the snapshot is unavailable', async () => {
    restoreFacilitiesFixture(); // remove the fixture entirely for this one test
    getFacilitiesParser().resetForTesting();
    const res = await request(app).get('/api/facilities/lookup').query({ q: 'bungendore' });
    expect(res.status).toBe(503);
    installFacilitiesFixture(); // restore for subsequent tests
  });
});
