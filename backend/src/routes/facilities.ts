/**
 * Emergency-services facility lookup routes.
 *
 * - GET /api/facilities/lookup — PUBLIC (used by the signup flow before any
 *   account exists), rate-limited at the mount. Searches the bundled Digital
 *   Atlas Emergency Management Facilities snapshot across all service types
 *   and annotates each result with `claimed` (an Organization already holds
 *   its facilityKey). The claiming org's identity is deliberately NOT exposed.
 */

import { Router, Request, Response } from 'express';
import { getFacilitiesParser } from '../services/facilitiesParser';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { isFacilityServiceType } from '../types/facilities';
import { logger } from '../services/logger';

const router = Router();

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
const CLAIMED_KEYS_TTL_MS = 60_000;

let claimedKeysCache: { keys: Set<string>; fetchedAt: number } | null = null;

async function getClaimedKeys(): Promise<Set<string>> {
  const now = Date.now();
  if (claimedKeysCache && now - claimedKeysCache.fetchedAt < CLAIMED_KEYS_TTL_MS) {
    return claimedKeysCache.keys;
  }
  const orgDb = ensureOrganizationDatabase();
  const keys = await orgDb.getAllFacilityKeys();
  claimedKeysCache = { keys, fetchedAt: now };
  return keys;
}

/** Test hook: drop the claimed-keys cache so tests see fresh claims. */
export function clearClaimedKeysCache(): void {
  claimedKeysCache = null;
}

/**
 * GET /api/facilities/lookup?q=<text>&serviceType=<slug>&state=<abbr>&lat=&lon=&limit=
 * Requires q (min 2 chars) and/or lat+lon.
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const parser = getFacilitiesParser();
    await parser.loadData();
    if (!parser.isDataAvailable()) {
      return res.status(503).json({
        error: 'Facility lookup is temporarily unavailable',
        message: 'The emergency facilities dataset has not been loaded. Please try again later.',
      });
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const lat = typeof req.query.lat === 'string' ? parseFloat(req.query.lat) : NaN;
    const lon = typeof req.query.lon === 'string' ? parseFloat(req.query.lon) : NaN;
    const hasLocation = !isNaN(lat) && !isNaN(lon);

    if (q.length < 2 && !hasLocation) {
      return res.status(400).json({ error: 'Provide a search query (q, min 2 characters) or lat/lon' });
    }

    const serviceTypeRaw = req.query.serviceType;
    if (serviceTypeRaw !== undefined && !isFacilityServiceType(serviceTypeRaw)) {
      return res.status(400).json({ error: 'Invalid serviceType' });
    }
    const state = typeof req.query.state === 'string' && req.query.state.trim() ? req.query.state.trim() : undefined;

    let limit = DEFAULT_LIMIT;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!isNaN(parsed) && parsed > 0) limit = Math.min(parsed, MAX_LIMIT);
    }

    const results = parser.lookup(
      q.length >= 2 ? q : undefined,
      hasLocation ? lat : undefined,
      hasLocation ? lon : undefined,
      { serviceType: serviceTypeRaw, state, limit },
    );

    const claimedKeys = await getClaimedKeys();
    for (const result of results) {
      result.claimed = claimedKeys.has(result.facilityKey);
    }

    return res.json({ results, count: results.length });
  } catch (error) {
    logger.error('Error in facility lookup', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
