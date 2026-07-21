/**
 * Station Middleware — organization-aware station resolution.
 *
 * Covers the fix for orgs that used to start with zero stations of their own
 * and silently share the global `default-station` bucket with every other
 * stationless org (any two such orgs, or an org and ambient kiosk/demo
 * traffic, would see each other's members/events/appliances there):
 *
 *  - A caller with an explicit, real X-Station-Id always wins.
 *  - A single-station organization resolves to its own station automatically
 *    (no X-Station-Id needed) — the common case, since most orgs have one.
 *  - A zero-station organization gets one auto-provisioned on first request.
 *  - A multi-station organization is left unresolved — can't be guessed, and
 *    must keep sending an explicit X-Station-Id (frontend station picker).
 *  - No org context (kiosk/demo/anonymous) keeps the legacy fallback.
 */

import request from 'supertest';
import express, { Express } from 'express';
import { authHeader } from './helpers/authHelpers';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { DEFAULT_STATION_ID } from '../constants/stations';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  // A minimal probe route mounted away from /api/stations, so the
  // station-management exclusion doesn't apply — exercises the middleware
  // directly instead of inferring its effect through a real router's
  // filtering behaviour.
  app.use('/probe', stationMiddleware, (req, res) => {
    res.json({ stationId: req.stationId ?? null, isDemoMode: req.isDemoMode, effective: getStationIdFromRequest(req) });
  });
});

async function createOrg(name: string) {
  const orgDb = ensureOrganizationDatabase();
  return orgDb.createOrganization({ name: `${name} ${Date.now()}-${Math.random()}`, billingEmail: 'x@x.com' });
}

describe('stationMiddleware — organization-aware resolution', () => {
  it('honours an explicit, real X-Station-Id header regardless of org context', async () => {
    const org = await createOrg('Explicit Header Org');
    const res = await request(app)
      .get('/probe')
      .set(authHeader('admin', org.id))
      .set('X-Station-Id', 'some-other-real-station')
      .expect(200);

    expect(res.body.stationId).toBe('some-other-real-station');
    expect(res.body.isDemoMode).toBe(false);
  });

  it('auto-provisions and resolves a station for an org with none yet', async () => {
    const org = await createOrg('Zero Station Org');

    const res = await request(app).get('/probe').set(authHeader('admin', org.id)).expect(200);

    expect(res.body.stationId).toBe(`${org.slug}-station`);
    expect(res.body.isDemoMode).toBe(false);

    const db = await ensureDatabase();
    const created = await db.getStationById(`${org.slug}-station`);
    expect(created).toBeTruthy();
    expect(created?.organizationId).toBe(org.id);
  });

  it('resolves to the same auto-provisioned station on a second request (idempotent)', async () => {
    const org = await createOrg('Repeat Request Org');

    const first = await request(app).get('/probe').set(authHeader('admin', org.id)).expect(200);
    const second = await request(app).get('/probe').set(authHeader('admin', org.id)).expect(200);

    expect(second.body.stationId).toBe(first.body.stationId);

    const db = await ensureDatabase();
    const ownStations = (await db.getAllStations()).filter((s) => s.organizationId === org.id);
    expect(ownStations).toHaveLength(1);
  });

  it('resolves automatically to a single already-existing station with no X-Station-Id needed', async () => {
    const org = await createOrg('Single Station Org');
    const db = await ensureDatabase();
    const station = await db.createStation({
      name: org.name,
      brigadeId: `${org.slug}-brigade`,
      brigadeName: org.name,
      hierarchy: { jurisdiction: 'NSW', area: '', district: '', brigade: org.name, station: org.name },
      isActive: true,
      organizationId: org.id,
    });

    const res = await request(app).get('/probe').set(authHeader('admin', org.id)).expect(200);

    expect(res.body.stationId).toBe(station.id);
    expect(res.body.isDemoMode).toBe(false);
  });

  it('leaves a genuine multi-station org unresolved — cannot guess which station', async () => {
    const org = await createOrg('Multi Station Org');
    const db = await ensureDatabase();
    await db.createStation({
      name: `${org.name} A`,
      brigadeId: `${org.slug}-a-brigade`,
      brigadeName: `${org.name} A`,
      hierarchy: { jurisdiction: 'NSW', area: '', district: '', brigade: `${org.name} A`, station: `${org.name} A` },
      isActive: true,
      organizationId: org.id,
    });
    await db.createStation({
      name: `${org.name} B`,
      brigadeId: `${org.slug}-b-brigade`,
      brigadeName: `${org.name} B`,
      hierarchy: { jurisdiction: 'NSW', area: '', district: '', brigade: `${org.name} B`, station: `${org.name} B` },
      isActive: true,
      organizationId: org.id,
    });

    const res = await request(app).get('/probe').set(authHeader('admin', org.id)).expect(200);

    // Can't guess between A and B — falls back to the shared default rather
    // than an arbitrary pick, matching pre-existing multi-station behaviour.
    expect(res.body.effective).toBe(DEFAULT_STATION_ID);
  });

  it('keeps the legacy shared-default fallback with no org context (kiosk/demo/anonymous)', async () => {
    const res = await request(app).get('/probe').expect(200);

    expect(res.body.stationId).toBeNull();
    expect(res.body.effective).toBe(DEFAULT_STATION_ID);
    expect(res.body.isDemoMode).toBe(true);
  });

  it('overrides an explicit but literal default-station value when the org has its own station', async () => {
    const org = await createOrg('Overrides Default Org');
    const db = await ensureDatabase();
    const station = await db.createStation({
      name: org.name,
      brigadeId: `${org.slug}-brigade`,
      brigadeName: org.name,
      hierarchy: { jurisdiction: 'NSW', area: '', district: '', brigade: org.name, station: org.name },
      isActive: true,
      organizationId: org.id,
    });

    const res = await request(app)
      .get('/probe')
      .set(authHeader('admin', org.id))
      .set('X-Station-Id', DEFAULT_STATION_ID)
      .expect(200);

    expect(res.body.stationId).toBe(station.id);
  });
});
