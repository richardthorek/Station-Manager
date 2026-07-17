/**
 * Anonymous-access gate — integration coverage across the mount chain
 * actually used in index.ts, not just the bare router.
 *
 * The F1 fix (anonymous `/api/export` leak) sat undetected for a while
 * because `export.test.ts` only ever mounted the router directly
 * (`app.use('/api/export', exportRouter)`), never the `requireSession(...)`
 * gate index.ts actually applies — so a regression in the gate itself would
 * never fail a test. This file replicates each real mount line (rate limiter
 * omitted; irrelevant here and would burn test-run budget) so a credential-less
 * GET is verified against the actual production gate, for every mount that
 * carries member/attendance PII: members, activities, checkins, events,
 * truck-checks, reports, export (the AC-4 walk-up sweep, 2026-07-17 —
 * activities/checkins/events were found relying solely on the
 * ENABLE_DATA_PROTECTION-conditional flexibleAuth and are now also gated by
 * the unconditional requireSession, matching members/truck-checks/reports/export).
 * Also covers achievements (Q36, found 2026-07-17 investigating Q9) — it had
 * no auth gate at all, the same PII class (attendance/streak patterns).
 */

import request from 'supertest';
import express, { Express } from 'express';
// truckChecks.ts imports `io` from '../index' for its WebSocket broadcasts;
// auto-mock so importing it here doesn't execute index.ts's own module-level
// app.use()/httpServer.listen() side effects (same pattern as
// applianceZones.test.ts and friends).
jest.mock('../index');
import membersRouter from '../routes/members';
import activitiesRouter from '../routes/activities';
import checkinsRouter from '../routes/checkins';
import eventsRouter from '../routes/events';
import truckChecksRouter from '../routes/truckChecks';
import reportsRouter from '../routes/reports';
import exportRouter from '../routes/export';
import { createAchievementRoutes } from '../routes/achievements';
import { requireSession } from '../middleware/flexibleAuth';
import { requireFeature } from '../middleware/entitlements';
import { authHeader } from './helpers/authHelpers';
import { generateBrigadeAccessToken } from '../services/brigadeAccessService';
import { DEMO_STATION_ID } from '../constants/stations';

function mountedApp(mount: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  mount(app);
  return app;
}

const mounts: Array<{ name: string; path: string; mount: (app: Express) => void }> = [
  {
    name: 'members',
    path: '/api/members',
    mount: (app) => app.use('/api/members', requireSession({ readsOnly: true }), membersRouter),
  },
  {
    name: 'activities',
    path: '/api/activities',
    mount: (app) => app.use('/api/activities', requireSession({ readsOnly: true }), activitiesRouter),
  },
  {
    name: 'checkins',
    path: '/api/checkins',
    mount: (app) =>
      app.use('/api/checkins', requireSession({ readsOnly: true }), requireFeature('signInEnabled'), checkinsRouter),
  },
  {
    name: 'events',
    path: '/api/events',
    mount: (app) =>
      app.use('/api/events', requireSession({ readsOnly: true }), requireFeature('signInEnabled'), eventsRouter),
  },
  {
    name: 'truck-checks',
    path: '/api/truck-checks',
    mount: (app) =>
      app.use(
        '/api/truck-checks',
        requireSession({ readsOnly: true }),
        requireFeature('truckCheckEnabled'),
        truckChecksRouter
      ),
  },
  {
    name: 'reports',
    path: '/api/reports',
    mount: (app) =>
      app.use('/api/reports', requireSession({ readsOnly: true }), requireFeature('reportsEnabled'), reportsRouter),
  },
  {
    name: 'export',
    path: '/api/export',
    mount: (app) =>
      app.use('/api/export', requireSession({ readsOnly: true }), requireFeature('reportsEnabled'), exportRouter),
  },
  {
    name: 'achievements',
    path: '/api/achievements/some-member-id',
    mount: (app) =>
      app.use('/api/achievements', requireSession({ readsOnly: true }), createAchievementRoutes()),
  },
];

describe('Anonymous-access gate (fully-wired mount chain)', () => {
  describe.each(mounts)('$name', ({ path, mount }) => {
    it('rejects a credential-less GET for a real (non-demo) station', async () => {
      const app = mountedApp(mount);
      const response = await request(app).get(path).set('X-Station-Id', 'some-real-station');
      expect(response.status).toBe(401);
    });

    it('allows a valid admin JWT through the gate', async () => {
      const app = mountedApp(mount);
      const response = await request(app).get(path).set('X-Station-Id', 'some-real-station').set(authHeader());
      expect(response.status).not.toBe(401);
    });

    it('allows a valid brigade/kiosk token through the gate', async () => {
      const app = mountedApp(mount);
      const brigadeToken = generateBrigadeAccessToken('brigade-gate-test', 'station-gate-test');
      const response = await request(app)
        .get(path)
        .set('X-Station-Id', 'station-gate-test')
        .set('X-Brigade-Token', brigadeToken.token);
      expect(response.status).not.toBe(401);
    });

    it('allows the public demo station through with no credential', async () => {
      const app = mountedApp(mount);
      const response = await request(app).get(path).set('X-Station-Id', DEMO_STATION_ID);
      expect(response.status).not.toBe(401);
    });
  });
});
