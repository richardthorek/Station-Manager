/**
 * Entitlement / feature-gating middleware.
 *
 * Backward-compatible and opt-in, matching the project's REQUIRE_AUTH /
 * ENABLE_DATA_PROTECTION conventions:
 *   - When ENABLE_ENTITLEMENTS !== 'true', gating is a no-op (existing
 *     single-tenant deployments and the demo keep working unchanged).
 *   - When enabled, an authenticated user's Organization is loaded and the
 *     requested feature is checked against its entitlements. Requests with no
 *     organization context (e.g. kiosk/demo) are allowed through — those paths
 *     are governed by the existing auth/data-protection layers instead.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import type { EntitlementFeature } from '../types';

function entitlementsEnabled(): boolean {
  return process.env.ENABLE_ENTITLEMENTS === 'true';
}

/**
 * Load the authenticated user's Organization onto req.organization (best-effort).
 * Safe to use everywhere; does nothing when there is no authenticated org user.
 */
export async function attachOrganization(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user?.organizationId && !req.organization) {
      const db = ensureOrganizationDatabase();
      const org = await db.getOrganizationById(req.user.organizationId);
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
