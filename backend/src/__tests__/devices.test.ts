/**
 * Device Routes (AC-5) API Tests
 *
 * Covers CRUD (owner/admin, org-scoped) and the public validate endpoint.
 */

// Mock the index module to avoid starting the server
jest.mock('../index');

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import devicesRouter from '../routes/devices';
import { ensureDeviceDatabase } from '../services/deviceDbFactory';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
function adminToken(organizationId: string, userId = 'u-' + organizationId): string {
  return jwt.sign({ userId, username: userId, role: 'admin', organizationId }, JWT_SECRET);
}

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/devices', devicesRouter);
});

afterEach(async () => {
  await ensureDeviceDatabase().clear();
});

describe('Device Routes', () => {
  describe('POST /api/devices', () => {
    it('creates a device and returns a kiosk URL', async () => {
      const response = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Main shed kiosk' })
        .expect(201);

      expect(response.body.device).toMatchObject({
        stationId: 'station-1',
        type: 'kiosk',
        name: 'Main shed kiosk',
        status: 'active',
        organizationId: 'org-1',
      });
      expect(response.body.device.token).toBeTruthy();
      expect(response.body.kioskUrl).toContain(`/signin?brigade=${response.body.device.token}`);
    });

    it('rejects an invalid device type', async () => {
      await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'toaster', name: 'Nope' })
        .expect(400);
    });

    it('requires admin auth', async () => {
      await request(app)
        .post('/api/devices')
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Kiosk' })
        .expect(401);
    });
  });

  describe('GET /api/devices', () => {
    it('lists only the caller org’s devices', async () => {
      await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Org1 Kiosk' }).expect(201);
      await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-2')}`)
        .send({ stationId: 'station-2', type: 'kiosk', name: 'Org2 Kiosk' }).expect(201);

      const response = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .expect(200);

      expect(response.body.devices).toHaveLength(1);
      expect(response.body.devices[0].name).toBe('Org1 Kiosk');
    });
  });

  describe('PATCH /api/devices/:id', () => {
    it('renames and revokes a device the org owns', async () => {
      const created = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'phone', name: 'Old name' }).expect(201);

      const response = await request(app)
        .patch(`/api/devices/${created.body.device.id}`)
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ name: 'New name', status: 'revoked' })
        .expect(200);

      expect(response.body.name).toBe('New name');
      expect(response.body.status).toBe('revoked');
    });

    it('403s renaming a device a different org owns', async () => {
      const created = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Kiosk' }).expect(201);

      await request(app)
        .patch(`/api/devices/${created.body.device.id}`)
        .set('Authorization', `Bearer ${adminToken('org-2')}`)
        .send({ name: 'Hijacked' })
        .expect(403);
    });

    it('404s an unknown device', async () => {
      await request(app)
        .patch('/api/devices/does-not-exist')
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ name: 'X' })
        .expect(404);
    });
  });

  describe('DELETE /api/devices/:id', () => {
    it('removes a device the org owns', async () => {
      const created = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Kiosk' }).expect(201);

      await request(app)
        .delete(`/api/devices/${created.body.device.id}`)
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .expect(204);

      await request(app)
        .patch(`/api/devices/${created.body.device.id}`)
        .set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ name: 'X' })
        .expect(404);
    });
  });

  describe('POST /api/devices/validate', () => {
    it('resolves an active device token and updates lastSeenAt', async () => {
      const created = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Kiosk' }).expect(201);

      const response = await request(app)
        .post('/api/devices/validate')
        .send({ token: created.body.device.token })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: true,
        deviceId: created.body.device.id,
        deviceName: 'Kiosk',
        deviceType: 'kiosk',
        stationId: 'station-1',
      });

      const device = await ensureDeviceDatabase().getById(created.body.device.id);
      expect(device?.lastSeenAt).toBeInstanceOf(Date);
    });

    it('404s a revoked device token', async () => {
      const created = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ stationId: 'station-1', type: 'kiosk', name: 'Kiosk' }).expect(201);
      await request(app).patch(`/api/devices/${created.body.device.id}`).set('Authorization', `Bearer ${adminToken('org-1')}`)
        .send({ status: 'revoked' }).expect(200);

      await request(app)
        .post('/api/devices/validate')
        .send({ token: created.body.device.token })
        .expect(404);
    });

    it('400s a non-UUID token', async () => {
      await request(app).post('/api/devices/validate').send({ token: 'not-a-uuid' }).expect(400);
    });
  });
});
