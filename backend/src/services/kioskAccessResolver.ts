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

import { validateBrigadeAccessToken } from './brigadeAccessService';
import { ensureDeviceDatabase } from './deviceDbFactory';
import { ensureDatabase } from './dbFactory';

export interface ResolvedKioskAccess {
  stationId: string;
  brigadeId?: string;
  deviceId?: string;
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
      brigadeId: station?.brigadeId,
      deviceId: device.id,
      description: device.description,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt,
    };
  }

  const legacy = validateBrigadeAccessToken(token);
  if (legacy) {
    return {
      stationId: legacy.stationId,
      brigadeId: legacy.brigadeId,
      description: legacy.description,
      createdAt: legacy.createdAt,
      expiresAt: legacy.expiresAt,
    };
  }

  return null;
}
