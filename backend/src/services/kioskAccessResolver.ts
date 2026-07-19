/**
 * Kiosk Access Resolver (AC-5)
 *
 * A `/signin?brigade=<token>` kiosk URL's token may now come from either
 * source:
 *  - the new first-class `Device` account (preferred going forward — named,
 *    typed, revocable, with a lastSeenAt audit trail), or
 *  - the legacy anonymous `BrigadeAccessToken` (kept working unchanged for
 *    any URLs already handed out).
 *
 * Both `kioskModeMiddleware` and `POST /api/brigade-access/validate` need the
 * same "try Device, fall back to legacy" resolution — this is the one place
 * that logic lives, so the two token stores never drift out of sync.
 */

import type { DeviceType } from '../types';
import { validateBrigadeAccessToken } from './brigadeAccessService';
import { ensureDeviceDatabase } from './deviceDbFactory';
import { ensureDatabase } from './dbFactory';

export interface ResolvedKioskAccess {
  stationId: string;
  stationName?: string;
  brigadeId?: string;
  deviceId?: string;
  /** Device account name (e.g. "Main shed kiosk") — undefined for a legacy anonymous token. */
  name?: string;
  /** Device account type — undefined for a legacy anonymous token. */
  type?: DeviceType;
  description?: string;
  createdAt?: Date;
  expiresAt?: Date;
}

/**
 * Resolve a kiosk token to its station (and brigade, where known), touching
 * the device's lastSeenAt audit trail when it resolves via the new Device
 * store. Returns null when the token is unknown, revoked, or expired.
 */
export async function resolveKioskAccess(token: string): Promise<ResolvedKioskAccess | null> {
  const device = await ensureDeviceDatabase().getByToken(token);
  if (device) {
    await ensureDeviceDatabase().touchLastSeen(device.id);
    const mainDb = await ensureDatabase();
    const station = await mainDb.getStationById(device.stationId);
    return {
      stationId: device.stationId,
      stationName: station?.name,
      brigadeId: station?.brigadeId,
      deviceId: device.id,
      name: device.name,
      type: device.type,
      description: device.description,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt,
    };
  }

  const legacy = validateBrigadeAccessToken(token);
  if (legacy) {
    const mainDb = await ensureDatabase();
    const station = await mainDb.getStationById(legacy.stationId);
    return {
      stationId: legacy.stationId,
      stationName: station?.name,
      brigadeId: legacy.brigadeId,
      description: legacy.description,
      createdAt: legacy.createdAt,
      expiresAt: legacy.expiresAt,
    };
  }

  return null;
}
