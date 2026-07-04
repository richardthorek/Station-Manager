/**
 * Unit tests for the in-memory DeviceDatabase (the twin used in dev/test).
 * Covers creation, token resolution, revocation/expiry, and org/station scoping.
 */

import { DeviceDatabase, isDeviceLive } from '../services/deviceDatabase';
import type { Device } from '../types';

describe('DeviceDatabase', () => {
  let db: DeviceDatabase;

  beforeEach(() => {
    db = new DeviceDatabase();
  });

  it('creates a device with a generated token and active status', async () => {
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'Main shed kiosk' });
    expect(device.id).toBeTruthy();
    expect(device.token).toBeTruthy();
    expect(device.status).toBe('active');
    expect(device.type).toBe('kiosk');
  });

  it('getByToken resolves an active device', async () => {
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'tablet', name: 'Captain tablet' });
    const found = await db.getByToken(device.token);
    expect(found?.id).toBe(device.id);
  });

  it('getByToken returns null for an unknown token', async () => {
    expect(await db.getByToken('nope')).toBeNull();
  });

  it('getByToken returns null for a revoked device', async () => {
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'Kiosk' });
    await db.update(device.id, { status: 'revoked' });
    expect(await db.getByToken(device.token)).toBeNull();
  });

  it('getByToken returns null for an expired device', async () => {
    const past = new Date(Date.now() - 1000);
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'Kiosk', expiresAt: past });
    expect(await db.getByToken(device.token)).toBeNull();
  });

  it('touchLastSeen updates lastSeenAt', async () => {
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'phone', name: 'Phone' });
    expect(device.lastSeenAt).toBeUndefined();
    await db.touchLastSeen(device.id);
    const updated = await db.getById(device.id);
    expect(updated?.lastSeenAt).toBeInstanceOf(Date);
  });

  it('update renames and revokes', async () => {
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'Old name' });
    const updated = await db.update(device.id, { name: 'New name', status: 'revoked' });
    expect(updated?.name).toBe('New name');
    expect(updated?.status).toBe('revoked');
  });

  it('delete removes a device', async () => {
    const device = await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'Kiosk' });
    expect(await db.delete(device.id)).toBe(true);
    expect(await db.getById(device.id)).toBeNull();
  });

  it('listForOrganization scopes to one org', async () => {
    await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'A' });
    await db.create({ organizationId: 'org-2', stationId: 'station-2', type: 'kiosk', name: 'B' });
    const forOrg1 = await db.listForOrganization('org-1');
    expect(forOrg1.map((d) => d.name)).toEqual(['A']);
  });

  it('listForStation scopes to one station', async () => {
    await db.create({ organizationId: 'org-1', stationId: 'station-1', type: 'kiosk', name: 'A' });
    await db.create({ organizationId: 'org-1', stationId: 'station-2', type: 'kiosk', name: 'B' });
    const forStation1 = await db.listForStation('station-1');
    expect(forStation1.map((d) => d.name)).toEqual(['A']);
  });

  describe('isDeviceLive', () => {
    const base: Device = {
      id: '1', stationId: 's1', type: 'kiosk', name: 'X', token: 't',
      status: 'active', createdAt: new Date(), updatedAt: new Date(),
    };

    it('is live when active and unexpired', () => {
      expect(isDeviceLive(base)).toBe(true);
    });

    it('is not live when revoked', () => {
      expect(isDeviceLive({ ...base, status: 'revoked' })).toBe(false);
    });

    it('is not live when past its expiry', () => {
      expect(isDeviceLive({ ...base, expiresAt: new Date(Date.now() - 1000) })).toBe(false);
    });
  });
});
