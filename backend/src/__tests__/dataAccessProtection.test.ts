/**
 * Anonymous data-exposure protection (UAT 2026-06-22).
 *
 * Verifies requireSession() gates READ access to the routers that previously
 * leaked real organisational data and member PII to fully credential-less
 * requests, while preserving:
 *   - the public demo station,
 *   - signed-in sessions (any JWT role),
 *   - kiosk brigade tokens (X-Brigade-Token),
 *   - write-path kiosk actions (pass-through under readsOnly).
 */

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { requireSession } from '../middleware/flexibleAuth';
import { generateBrigadeAccessToken } from '../services/brigadeAccessService';
import { DEMO_STATION_ID } from '../constants/stations';
import reportsRouter from '../routes/reports';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  // Mirror index.ts: gate reads, let writes pass through.
  app.use('/api/reports', requireSession({ readsOnly: true }), reportsRouter);
  // A bare probe route to assert the middleware's own behaviour in isolation.
  app.use('/probe', requireSession({ readsOnly: true }), (req, res) => {
    res.json({ ok: true, method: req.method });
  });
  return app;
}

describe('requireSession — anonymous data-exposure protection', () => {
  const app = buildApp();

  describe('blocks anonymous reads', () => {
    it('returns 401 for an anonymous GET /api/reports/attendance-summary', async () => {
      const res = await request(app).get('/api/reports/attendance-summary');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('returns 401 for an anonymous GET on the probe route', async () => {
      const res = await request(app).get('/probe');
      expect(res.status).toBe(401);
    });
  });

  describe('allows authenticated reads', () => {
    it('allows a GET with a valid JWT (owner role)', async () => {
      const token = jwt.sign(
        { userId: 'u1', username: 'owner1', role: 'owner', organizationId: 'org1' },
        JWT_SECRET,
      );
      const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('allows a GET with a valid JWT (viewer role)', async () => {
      const token = jwt.sign({ userId: 'u2', username: 'v1', role: 'viewer' }, JWT_SECRET);
      const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('rejects a GET with an invalid/garbage JWT', async () => {
      const res = await request(app).get('/probe').set('Authorization', 'Bearer not-a-jwt');
      expect(res.status).toBe(401);
    });
  });

  describe('allows kiosk brigade tokens', () => {
    it('allows a GET carrying a valid X-Brigade-Token', async () => {
      const { token } = generateBrigadeAccessToken('brigade-1', 'station-1', 'test kiosk');
      const res = await request(app).get('/probe').set('X-Brigade-Token', token);
      expect(res.status).toBe(200);
    });

    it('rejects a GET with an unknown brigade token', async () => {
      const res = await request(app).get('/probe').set('X-Brigade-Token', 'unknown-token');
      expect(res.status).toBe(401);
    });
  });

  describe('preserves demo + write pass-through', () => {
    it('allows an anonymous GET for the public demo station', async () => {
      const res = await request(app).get('/probe').set('X-Station-Id', DEMO_STATION_ID);
      expect(res.status).toBe(200);
    });

    it('lets anonymous WRITE methods pass through (readsOnly)', async () => {
      const res = await request(app).post('/probe').send({});
      expect(res.status).toBe(200);
      expect(res.body.method).toBe('POST');
    });
  });
});
