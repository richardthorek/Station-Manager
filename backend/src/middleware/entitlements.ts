/**
 * Entitlement / feature-gating middleware.
 *
 * On by default. Set ENABLE_ENTITLEMENTS=false to disable (dev/test only).
 * Requests with no organization context (kiosk/demo/backward-compat) are
 * always allowed through — those paths are governed by the existing auth/
 * data-protection layers instead.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../services/logger';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { getDefaultEntitlements } from '../constants/plans';
import { DEFAULT_STATION_ID, DEMO_STATION_ID } from '../constants/stations';
import type { EntitlementFeature } from '../types';
import { JWT_SECRET } from '../config/jwtSecret';

export function entitlementsEnabled(): boolean {
  return process.env.ENABLE_ENTITLEMENTS !== 'false';
}

/**
 * Load the authenticated user's Organization onto req.organization (best-effort).
 * Safe to use everywhere; does nothing when there is no authenticated org user.
 */
export async function attachOrganization(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Prefer organizationId from req.user (set by authMiddleware upstream).
    // Fall back to soft-decoding the Authorization header so routes without an
    // explicit auth middleware (e.g. /api/export) can still be org-gated.
    let organizationId = req.user?.organizationId;
    if (!organizationId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { organizationId?: string };
          organizationId = decoded.organizationId ?? undefined;
        } catch {
          // Missing/invalid/expired token — not an error here, gate will pass through.
        }
      }
    }

    if (organizationId && !req.organization) {
      const db = ensureOrganizationDatabase();
      const org = await db.getOrganizationById(organizationId);
      if (org) {
        req.organization = org;
      }
    }
  } catch (error) {
    logger.warn('attachOrganization failed (continuing without org context)', { error });
  }
  next();
}

/**
 * Gate a route behind a feature entitlement.
 *
 * @example router.use('/api/truck-checks', requireFeature('truckCheckEnabled'), router)
 */
export function requireFeature(feature: EntitlementFeature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!entitlementsEnabled()) {
      next();
      return;
    }

    await attachOrganization(req, res, () => undefined);

    // No org context → defer to other auth layers (kiosk/demo/back-compat).
    if (!req.organization) {
      next();
      return;
    }

    if (!req.organization.entitlements[feature]) {
      logger.info('Feature blocked by entitlements', {
        feature,
        organizationId: req.organization.id,
        planCode: req.organization.planCode,
      });
      res.status(403).json({
        error: 'This feature is not available on your plan',
        feature,
        planCode: req.organization.planCode,
        upgradeRequired: true,
      });
      return;
    }

    next();
  };
}

/**
 * Enforce the maxStations entitlement on station creation.
 * Place on POST /api/stations before the route handler.
 */
export function enforceStationLimit() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!entitlementsEnabled()) {
      next();
      return;
    }

    await attachOrganization(req, res, () => undefined);

    if (!req.organization) {
      next();
      return;
    }

    const { maxStations } = req.organization.entitlements;
    try {
      const db = await ensureDatabase(req.isDemoMode);
      const all = await db.getAllStations();
      // Exclude the built-in default/demo stations from the org's quota count.
      // Once stations carry organizationId this filter can be org-scoped instead.
      const SYSTEM_IDS = new Set([DEFAULT_STATION_ID, DEMO_STATION_ID]);
      const activeCount = all.filter((s) => s.isActive && !SYSTEM_IDS.has(s.id)).length;
      if (activeCount >= maxStations) {
        logger.info('Station limit reached', {
          organizationId: req.organization.id,
          planCode: req.organization.planCode,
          maxStations,
          activeCount,
        });
        res.status(403).json({
          error: 'Station limit reached for your plan',
          upgradeRequired: true,
          planCode: req.organization.planCode,
          limit: maxStations,
          current: activeCount,
        });
        return;
      }
    } catch (error) {
      logger.warn('enforceStationLimit: station count check failed (continuing)', { error });
    }

    next();
  };
}

/**
 * Shared count-based limit gate. No-op when entitlements are disabled or there
 * is no org context (kiosk/demo/back-compat). Falls back to the plan default
 * when a persisted org predates the limit field, so existing free orgs still
 * get the cap without needing their entitlements re-saved.
 */
function enforceCountLimit(opts: {
  limitKey: 'maxMembers' | 'maxVehicles';
  errorMessage: string;
  label: string;
  count: (req: Request) => Promise<number>;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!entitlementsEnabled()) {
      next();
      return;
    }

    await attachOrganization(req, res, () => undefined);

    if (!req.organization) {
      next();
      return;
    }

    const entitlements = req.organization.entitlements;
    const limit =
      (entitlements[opts.limitKey] as number | undefined) ??
      getDefaultEntitlements(req.organization.planCode)[opts.limitKey];

    try {
      const current = await opts.count(req);
      if (current >= limit) {
        logger.info(`${opts.label} limit reached`, {
          organizationId: req.organization.id,
          planCode: req.organization.planCode,
          limit,
          current,
        });
        res.status(403).json({
          error: opts.errorMessage,
          upgradeRequired: true,
          planCode: req.organization.planCode,
          limit,
          current,
        });
        return;
      }
    } catch (error) {
      logger.warn(`enforce ${opts.limitKey}: count check failed (continuing)`, { error });
    }

    next();
  };
}

/**
 * Enforce the maxMembers entitlement on member creation.
 * Place on POST /api/members before the route handler.
 */
export function enforceMemberLimit() {
  return enforceCountLimit({
    limitKey: 'maxMembers',
    errorMessage: 'Member limit reached for your plan',
    label: 'Member',
    count: async (req) => {
      const db = await ensureDatabase(req.isDemoMode);
      const members = await db.getAllMembers();
      return members.length;
    },
  });
}

/**
 * Enforce the maxVehicles entitlement on appliance (vehicle) creation.
 * Place on POST /api/truck-checks/appliances before the route handler.
 */
export function enforceVehicleLimit() {
  return enforceCountLimit({
    limitKey: 'maxVehicles',
    errorMessage: 'Vehicle limit reached for your plan',
    label: 'Vehicle',
    count: async (req) => {
      const db = await ensureTruckChecksDatabase(req.isDemoMode);
      const appliances = await db.getAllAppliances();
      return appliances.length;
    },
  });
}
