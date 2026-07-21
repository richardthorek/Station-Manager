/**
 * Station Middleware
 *
 * Extracts stationId from HTTP headers or query parameters and attaches it to the request.
 * This middleware enables multi-station filtering across all API routes.
 *
 * Station ID Resolution Priority:
 * 1. X-Station-Id header or stationId query param, when it names a real,
 *    specific station (multi-station admin picking one, or a kiosk token
 *    locked to one by kioskModeMiddleware upstream).
 * 2. The caller's own organization's station, resolved from the JWT —
 *    auto-provisioned if the org doesn't have one yet (see
 *    resolveOrganizationStationId below). This is what makes the common
 *    case — one organization, one station — need zero station-picking.
 * 3. DEFAULT_STATION_ID constant (kiosk/demo/anonymous — no org context to
 *    resolve against).
 *
 * Usage:
 * - Apply to routes that need station filtering
 * - Access via req.stationId in route handlers
 * - Use with database methods that accept stationId parameter
 */

import { Request, Response, NextFunction } from 'express';
import { DEFAULT_STATION_ID, getEffectiveStationId } from '../constants/stations';
import { attachOrganization } from './entitlements';
import { ensureDatabase } from '../services/dbFactory';
import type { IDatabase } from '../services/dbFactory';
import { logger } from '../services/logger';
import type { Organization } from '../types';

// Extend Express Request type to include stationId and demo flag
declare global {
  namespace Express {
    interface Request {
      stationId?: string;
      isDemoMode?: boolean;
    }
  }
}

/**
 * Resolve the calling organization's own station, auto-provisioning one if
 * it doesn't have one yet.
 *
 * Found 2026-07-2X: organizations used to start with zero stations of their
 * own (nothing created one at signup) and silently fell back to the
 * globally-shared `default-station` bucket — any two such orgs, or an org
 * and the ambient demo/kiosk traffic, would see each other's members/events/
 * appliances there, since Appliance/Member/Event rows are scoped by
 * stationId alone with no organizationId cross-check.
 *
 * Most organizations have exactly one station, so this resolves invisibly —
 * no X-Station-Id needed, no station picker. An org with two or more
 * stations is a deliberate multi-station setup (separate vehicle rosters /
 * separate sign-in books per physical station) — which one to use can't be
 * guessed, so those callers keep needing an explicit X-Station-Id (frontend
 * station picker), unchanged from before this fix.
 */
export async function resolveOrganizationStationId(organization: Organization): Promise<string | undefined> {
  const db = await ensureDatabase();
  const ownStations = (await db.getAllStations()).filter((s) => s.organizationId === organization.id);

  if (ownStations.length === 1) {
    return ownStations[0].id;
  }
  if (ownStations.length > 1) {
    // Genuine multi-station org — can't guess which one, leave unresolved.
    return undefined;
  }
  return getOrCreateOrganizationStation(organization, db);
}

/**
 * Deterministic id (`${slug}-station`) so concurrent requests for the same
 * newly-signed-up org converge on one row instead of racing to create two —
 * a losing `createStation` (409) just re-fetches the winner's row.
 */
async function getOrCreateOrganizationStation(organization: Organization, db: IDatabase): Promise<string> {
  const stationId = `${organization.slug}-station`;
  try {
    const created = await db.createStation({
      id: stationId,
      name: organization.name,
      brigadeId: `${organization.slug}-brigade`,
      brigadeName: organization.name,
      hierarchy: {
        jurisdiction: organization.facilityState || '',
        area: '',
        district: '',
        brigade: organization.name,
        station: organization.name,
      },
      isActive: true,
      organizationId: organization.id,
    });
    logger.info('Auto-created station for organization with none', {
      organizationId: organization.id,
      stationId: created.id,
    });
    return created.id;
  } catch (error) {
    const existing = await db.getStationById(stationId);
    if (existing) {
      return existing.id;
    }
    logger.error('Failed to auto-create or find organization station', { error, organizationId: organization.id });
    throw error;
  }
}

/**
 * Middleware to extract and attach stationId to request
 *
 * Checks for stationId in the following order:
 * 1. X-Station-Id header / stationId query param, when it names a specific
 *    station other than the shared DEFAULT_STATION_ID (see module docblock).
 * 2. The caller's own organization's station (auto-resolved / provisioned).
 * 3. Falls back to whatever was explicitly requested (typically
 *    DEFAULT_STATION_ID, or undefined for anonymous/kiosk/demo traffic with
 *    no org context to resolve against).
 *
 * The extracted stationId is attached to req.stationId for use in route handlers.
 *
 * @example
 * // In route file:
 * router.get('/', stationMiddleware, async (req, res) => {
 *   const db = await ensureDatabase();
 *   const members = await db.getAllMembers(req.stationId);
 *   res.json(members);
 * });
 */
export async function stationMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const headerStationId = req.headers['x-station-id'] as string | undefined;
  const queryStationId = req.query.stationId as string | undefined;
  // req.stationId may already be set by kioskModeMiddleware upstream (a real,
  // specific station locked by a validated brigade token) — that always wins.
  const rawStationId = req.stationId || headerStationId || queryStationId;

  // A real, specific station was named — honour it exactly as before. Only
  // the literal shared-default sentinel (or nothing at all) triggers
  // org-based resolution below, since DEFAULT_STATION_ID never actually
  // means "this organization's station".
  if (rawStationId && rawStationId !== DEFAULT_STATION_ID) {
    req.stationId = rawStationId;
    req.isDemoMode = false;
    next();
    return;
  }

  // The station-management API itself (list/create/update/delete stations)
  // never reads req.stationId — it manages station rows directly — so
  // auto-provisioning one here would be a pure side effect, and for POST
  // specifically it would consume the org's maxStations quota out from under
  // the caller's own deliberate creation request. Skip org resolution and
  // keep the legacy header/query-only behaviour for this router.
  if (req.baseUrl === '/api/stations') {
    req.stationId = rawStationId;
    req.isDemoMode = !rawStationId;
    next();
    return;
  }

  try {
    if (!req.organization) {
      await attachOrganization(req, res, () => undefined);
    }
    if (req.organization) {
      const resolved = await resolveOrganizationStationId(req.organization);
      if (resolved) {
        req.stationId = resolved;
        req.isDemoMode = false;
        next();
        return;
      }
    }
  } catch (error) {
    logger.warn('stationMiddleware: organization station resolution failed, falling back to shared default', {
      error,
    });
  }

  // No org context (anonymous/kiosk/demo) or a genuine multi-station org
  // that hasn't picked one — unchanged legacy behaviour.
  req.stationId = rawStationId;
  req.isDemoMode = !rawStationId;

  next();
}

/**
 * Get station ID from request (helper function for routes)
 *
 * This is a convenience function that can be used in route handlers
 * to safely get the stationId, even if the middleware wasn't applied.
 *
 * @param req - Express request object
 * @returns The station ID from the request, or DEFAULT_STATION_ID if not set
 *
 * @example
 * const stationId = getStationIdFromRequest(req);
 * const members = await db.getAllMembers(stationId);
 */
export function getStationIdFromRequest(req: Request): string {
  return getEffectiveStationId(req.stationId);
}
