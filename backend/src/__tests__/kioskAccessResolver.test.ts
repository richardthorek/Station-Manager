/**
 * kioskAccessResolver tests (AC-5)
 *
 * Covers the "try Device, fall back to legacy BrigadeAccessToken" resolution
 * shared by kioskModeMiddleware, flexibleAuth's brigade-token path, and
 * POST /api/brigade-access/validate.
 */

import { resolveKioskAccess } from '../services/kioskAccessResolver';
import { ensureDeviceDatabase } from '../services/deviceDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { generateBrigadeAccessToken, clearAllTokens } from '../services/brigadeAccessService';

describe('resolveKioskAccess', () => {
  afterEach(async () => {
    await ensureDeviceDatabase().clear();
    clearAllTokens();
  });

  it('resolves via the new Device store and reports the station’s brigadeId', async () => {
    const mainDb = await ensureDatabase();
    const station = await mainDb.createStation({
      name: 'Resolver Station',
      brigadeId: 'resolver-brigade',
      brigadeName: 'Resolver Brigade',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Resolver Brigade', station: 'Resolver Station' },
      isActive: true,
    });
    const device = await ensureDeviceDatabase().create({
      organizationId: 'org-1',
      stationId: station.id,
      type: 'kiosk',
      name: 'Resolver Kiosk',
    });

    const resolved = await resolveKioskAccess(device.token);

    expect(resolved).toMatchObject({
      stationId: station.id,
      brigadeId: 'resolver-brigade',
      deviceId: device.id,
    });
  });

  it('touches the device’s lastSeenAt on resolution', async () => {
    const mainDb = await ensureDatabase();
    const station = await mainDb.createStation({
      name: 'Touch Station', brigadeId: 'touch-brigade', brigadeName: 'Touch Brigade',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Touch Brigade', station: 'Touch Station' },
      isActive: true,
    });
    const device = await ensureDeviceDatabase().create({ stationId: station.id, type: 'kiosk', name: 'Kiosk' });

    await resolveKioskAccess(device.token);

    const updated = await ensureDeviceDatabase().getById(device.id);
    expect(updated?.lastSeenAt).toBeInstanceOf(Date);
  });

  it('falls back to the legacy BrigadeAccessToken when no Device matches', async () => {
    const legacy = generateBrigadeAccessToken('legacy-brigade', 'legacy-station', 'Legacy Kiosk');

    const resolved = await resolveKioskAccess(legacy.token);

    expect(resolved).toMatchObject({
      stationId: 'legacy-station',
      brigadeId: 'legacy-brigade',
      description: 'Legacy Kiosk',
    });
    expect(resolved?.deviceId).toBeUndefined();
  });

  it('returns null for an unknown token', async () => {
    expect(await resolveKioskAccess('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('returns null for a revoked device token', async () => {
    const mainDb = await ensureDatabase();
    const station = await mainDb.createStation({
      name: 'Revoked Station', brigadeId: 'revoked-brigade', brigadeName: 'Revoked Brigade',
      hierarchy: { jurisdiction: 'NSW', area: 'Area', district: 'District', brigade: 'Revoked Brigade', station: 'Revoked Station' },
      isActive: true,
    });
    const device = await ensureDeviceDatabase().create({ stationId: station.id, type: 'kiosk', name: 'Kiosk' });
    await ensureDeviceDatabase().update(device.id, { status: 'revoked' });

    expect(await resolveKioskAccess(device.token)).toBeNull();
  });
});
