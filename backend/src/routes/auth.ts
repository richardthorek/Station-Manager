/**
 * Authentication Routes
 * 
 * Handles JWT-based authentication for admin operations:
 * - POST /api/auth/login - Authenticate and get JWT token
 * - POST /api/auth/logout - Invalidate token (client-side)
 * - GET /api/auth/me - Get current user info
 * 
 * Features:
 * - JWT tokens with configurable expiration
 * - Password validation with bcrypt
 * - Optional authentication via REQUIRE_AUTH env var
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getAdminDb } from '../services/adminUserDbFactory';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureOrgAccessDatabase } from '../services/orgAccessDbFactory';
import { resolveMemberships, resolveActiveRole } from '../services/orgMembershipService';
import { getFacilitiesParser } from '../services/facilitiesParser';
import { isFacilityServiceType } from '../types/facilities';
import { isPlatformAdmin } from '../middleware/platformAdmin';
import { logger } from '../services/logger';
import { authMiddleware } from '../middleware/auth';
import { sensitiveActionRateLimiter } from '../middleware/rateLimiter';
import { isValidEmail } from '../utils/emailValidation';
import type { AdminUser, FacilityServiceType } from '../types';
import type { CreateOrganizationInput } from '../services/organizationDatabase';
import { JWT_SECRET } from '../config/jwtSecret';

const router = Router();

// JWT Configuration
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/** Canonical blocked-claim message — the frontend renders this verbatim. */
export const FACILITY_ALREADY_CLAIMED_MESSAGE =
  "This facility has already been claimed by another organisation. Discuss with your brigade members to get an invite link, or contact support — we've flagged this for review.";

/** Build a signed JWT for a user, including SaaS tenancy claims. */
export function signToken(user: Pick<AdminUser, 'id' | 'username' | 'role' | 'organizationId'>): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY } as jwt.SignOptions
  );
}

/**
 * POST /api/auth/signup
 * Self-service sign-up: creates an Organization (free Community plan) and its
 * first owner account, then returns a JWT. The new-frontend flow anchors the
 * org to a Digital Atlas emergency-services facility (`facility.facilityKey`)
 * with first-come-first-served claiming, or records a custom/unlisted unit
 * (`facility.custom`). A missing `facility` keeps the legacy API shape working
 * and creates an unlinked (custom) org. Billing/upgrade happens later via the
 * organization management screens.
 */
router.post('/signup', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const { organizationName, billingEmail, username, password, email, facility } = req.body ?? {};

    if (!organizationName || !billingEmail || !username || !password || !email) {
      return res.status(400).json({
        error: 'organizationName, billingEmail, username, password and email are required',
      });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const adminDb = getAdminDb();
    const existing = await adminDb.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const orgDb = ensureOrganizationDatabase();
    const orgAccessDb = ensureOrgAccessDatabase();

    // Resolve the facility selection into org fields. Default (legacy callers
    // sending no facility): an unlinked custom org.
    let facilityFields: Partial<CreateOrganizationInput> = { facilityCustom: true };
    if (facility !== undefined && facility !== null) {
      if (typeof facility !== 'object') {
        return res.status(400).json({ error: 'facility must be an object' });
      }
      const facilityKey = (facility as { facilityKey?: unknown }).facilityKey;
      const custom = (facility as { custom?: unknown }).custom;

      if (typeof facilityKey === 'string' && facilityKey.trim()) {
        const parser = getFacilitiesParser();
        await parser.loadData();
        if (!parser.isDataAvailable()) {
          return res.status(503).json({
            error: 'Facility lookup is temporarily unavailable — please try again later or choose "My unit isn\'t listed"',
          });
        }
        const known = parser.getByKey(facilityKey.trim());
        if (!known) {
          return res.status(400).json({ error: 'Unknown facility' });
        }

        // First-come-first-served claim check.
        const holders = await orgDb.getOrganizationsByFacilityKey(known.facilityKey);
        if (holders.length > 0) {
          try {
            await orgAccessDb.createClaimConflict({
              facilityKey: known.facilityKey,
              facilityName: known.name,
              existingOrganizationId: holders[0].id,
              attemptedOrgName: String(organizationName),
              attemptedByUsername: String(username),
              attemptedByEmail: email,
            });
          } catch (conflictError) {
            logger.error('Failed to record claim conflict', { error: conflictError, facilityKey: known.facilityKey });
          }
          logger.warn('Blocked signup for already-claimed facility', {
            facilityKey: known.facilityKey,
            attemptedByUsername: username,
          });
          return res.status(409).json({
            error: FACILITY_ALREADY_CLAIMED_MESSAGE,
            code: 'FACILITY_ALREADY_CLAIMED',
          });
        }

        facilityFields = {
          facilityKey: known.facilityKey,
          facilityObjectId: known.objectid,
          facilityServiceType: known.serviceType,
          facilityName: known.name,
          facilityState: known.state,
          facilityCustom: false,
          claimedAt: new Date(),
        };
      } else if (custom && typeof custom === 'object') {
        const { name, serviceType, state } = custom as { name?: unknown; serviceType?: unknown; state?: unknown };
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'Custom facility name is required' });
        }
        if (!isFacilityServiceType(serviceType)) {
          return res.status(400).json({ error: 'Custom facility serviceType is required' });
        }
        facilityFields = {
          facilityCustom: true,
          facilityName: name.trim(),
          facilityServiceType: serviceType as FacilityServiceType,
          facilityState: typeof state === 'string' && state.trim() ? state.trim() : undefined,
        };
      } else {
        return res.status(400).json({ error: 'facility must include a facilityKey or custom details' });
      }
    }

    // Create the organization (Community/free by default) then the owner user.
    const organization = await orgDb.createOrganization({
      name: organizationName,
      billingEmail,
      planCode: 'community',
      ...facilityFields,
    });

    const owner = await adminDb.createAdminUser(username, password, 'owner', organization.id, { email });

    if (facilityFields.facilityKey) {
      await orgDb.updateOrganization(organization.id, { claimedByUserId: owner.id });

      // FCFS race window: claim-check → create isn't transactional across
      // tables. Re-check; if two orgs now hold the key, the later-created one
      // (us, if so) drops its link and a conflict is recorded for the platform
      // admin — recoverable, never silent.
      const holders = await orgDb.getOrganizationsByFacilityKey(facilityFields.facilityKey);
      if (holders.length > 1) {
        const earliest = holders
          .slice()
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        if (earliest.id !== organization.id) {
          await orgDb.updateOrganization(organization.id, {
            facilityKey: undefined,
            facilityObjectId: undefined,
            facilityCustom: true,
            claimedAt: undefined,
            claimedByUserId: undefined,
          });
          try {
            await orgAccessDb.createClaimConflict({
              facilityKey: facilityFields.facilityKey,
              facilityName: facilityFields.facilityName ?? '',
              existingOrganizationId: earliest.id,
              attemptedOrgName: String(organizationName),
              attemptedByUsername: String(username),
              attemptedByEmail: email,
            });
          } catch (conflictError) {
            logger.error('Failed to record race-window claim conflict', { error: conflictError });
          }
          logger.warn('Facility claim race detected; later org unlinked', {
            facilityKey: facilityFields.facilityKey,
            organizationId: organization.id,
          });
        }
      }
    }

    // Founder membership row (multi-org source of truth).
    try {
      await orgAccessDb.createMembership({ userId: owner.id, organizationId: organization.id, role: 'owner' });
    } catch (membershipError) {
      logger.warn('Failed to create founder membership row (legacy fallback still applies)', {
        error: membershipError,
        userId: owner.id,
      });
    }

    const token = signToken(owner);
    const finalOrganization = (await orgDb.getOrganizationById(organization.id)) ?? organization;
    logger.info('Organization signed up', {
      organizationId: organization.id,
      slug: organization.slug,
      facilityKey: finalOrganization.facilityKey,
      facilityCustom: finalOrganization.facilityCustom,
    });

    return res.status(201).json({
      token,
      user: {
        id: owner.id,
        username: owner.username,
        role: owner.role,
        organizationId: owner.organizationId,
        email: owner.email,
      },
      organization: finalOrganization,
    });
  } catch (error) {
    logger.error('Error during signup', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const adminDb = getAdminDb();
    const user = await adminDb.verifyCredentials(username, password);

    if (!user) {
      // Only check if users exist when credential verification fails
      const allUsers = await adminDb.getAllUsers();
      
      if (allUsers.length === 0) {
        logger.error('Login failed: No admin accounts exist. DEFAULT_ADMIN_PASSWORD may not be configured.', { 
          username, 
          ip: req.ip 
        });
        return res.status(401).json({ 
          error: 'Invalid username or password',
          // Include hint in development mode
          ...(process.env.NODE_ENV === 'development' && {
            hint: 'No admin accounts configured. Set DEFAULT_ADMIN_PASSWORD environment variable.'
          })
        });
      }
      
      logger.warn('Failed login attempt', { username, ip: req.ip, totalAdminAccounts: allUsers.length });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Resolve the default active org from membership rows (multi-org): the
    // user's stored default when still a member there, else their first
    // active membership; role in the token = role within that org.
    let activeOrganizationId = user.organizationId;
    let activeRole = user.role;
    try {
      const memberships = (await resolveMemberships(user)).filter((m) => m.status === 'active');
      const preferred =
        memberships.find((m) => m.organizationId === user.organizationId) ?? memberships[0];
      if (preferred) {
        activeOrganizationId = preferred.organizationId;
        activeRole = preferred.role;
      }
    } catch (membershipError) {
      logger.warn('Failed to resolve memberships at login; using AdminUser fields', {
        error: membershipError,
        userId: user.id,
      });
    }

    // Generate JWT token (includes organizationId for SaaS tenancy)
    const token = signToken({
      id: user.id,
      username: user.username,
      role: activeRole,
      organizationId: activeOrganizationId,
    });

    logger.info('User logged in', { username: user.username, userId: user.id });

    // Return token and user info (without password hash)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: activeRole,
        organizationId: activeOrganizationId,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    logger.error('Error during login', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side logout (token invalidation happens on client)
 */
router.post('/logout', (req: Request, res: Response) => {
  // With JWT, logout is primarily client-side (remove token from storage)
  // We can log the event for audit purposes
  logger.info('User logged out', { userId: req.user?.userId });
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 * Requires authentication middleware
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const adminDb = getAdminDb();
    const user = await adminDb.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // The ACTIVE org comes from the JWT (set at login / switch-org); fall back
    // to the user's stored default for older tokens.
    const activeOrganizationId = req.user.organizationId ?? user.organizationId;

    // Resolve organization + entitlements for the client to gate features.
    const orgDb = ensureOrganizationDatabase();
    let organization = null;
    if (activeOrganizationId) {
      organization = await orgDb.getOrganizationById(activeOrganizationId);
    }

    // All memberships (multi-org), with org names for the switcher UI.
    const membershipRows = (await resolveMemberships(user)).filter((m) => m.status === 'active');
    const memberships = await Promise.all(
      membershipRows.map(async (m) => {
        const org =
          m.organizationId === organization?.id
            ? organization
            : await orgDb.getOrganizationById(m.organizationId);
        return {
          organizationId: m.organizationId,
          organizationName: org?.name ?? 'Unknown organisation',
          role: m.role,
        };
      }),
    );

    // Return user info (without password hash) + org context.
    // Contract note: id/username/role/organizationId/organization/entitlements
    // are consumed by suite siblings (Fire Break Calculator) — additions here
    // must stay additive.
    res.json({
      id: user.id,
      username: user.username,
      role: req.user.role ?? user.role,
      organizationId: activeOrganizationId,
      email: user.email ?? null,
      lastLoginAt: user.lastLoginAt,
      organization,
      entitlements: organization?.entitlements ?? null,
      memberships,
      isPlatformAdmin: isPlatformAdmin(user.username),
    });
  } catch (error) {
    logger.error('Error fetching user info', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/profile
 * Update the caller's own profile (currently just email — used by legacy
 * accounts created before email was collected at signup).
 */
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { email } = req.body ?? {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const adminDb = getAdminDb();
    const updated = await adminDb.updateUser(req.user.userId, { email });
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({
      user: {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        organizationId: updated.organizationId,
        email: updated.email,
      },
    });
  } catch (error) {
    logger.error('Error updating profile', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/switch-org
 * Switch the caller's active organization (multi-org membership). Verifies an
 * active membership in the target org, persists it as the user's default, and
 * re-issues the JWT with the target org + per-org role — attachOrganization
 * and the suite apps all read the claim, so nothing else changes.
 */
router.post('/switch-org', sensitiveActionRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { organizationId } = req.body ?? {};
    if (typeof organizationId !== 'string' || !organizationId.trim()) {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    const adminDb = getAdminDb();
    const user = await adminDb.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await resolveActiveRole(user, organizationId);
    if (!role) {
      return res.status(403).json({ error: 'You are not a member of that organisation' });
    }

    const orgDb = ensureOrganizationDatabase();
    const organization = await orgDb.getOrganizationById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Persist as the user's default org so future logins land here.
    await adminDb.updateUser(user.id, { organizationId });

    const token = signToken({ id: user.id, username: user.username, role, organizationId });
    logger.info('User switched active organization', { userId: user.id, organizationId });

    return res.json({
      token,
      user: { id: user.id, username: user.username, role, organizationId, email: user.email },
      organization,
    });
  } catch (error) {
    logger.error('Error switching organization', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/entitlements
 * Lightweight entitlement probe for sibling apps (e.g. AAR Studio at /aar).
 * Verifies the SM JWT and returns the org's current entitlements + plan code.
 * Same-origin so no extra CORS headers are needed; the standard allowed-origins
 * list in index.ts covers any cross-origin sibling app scenario.
 */
router.get('/entitlements', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.user.organizationId) {
      return res.json({ entitlements: null, planCode: null });
    }

    const orgDb = ensureOrganizationDatabase();
    const organization = await orgDb.getOrganizationById(req.user.organizationId);

    if (!organization) {
      return res.json({ entitlements: null, planCode: null });
    }

    return res.json({
      entitlements: organization.entitlements,
      planCode: organization.planCode,
      status: organization.status,
    });
  } catch (error) {
    logger.error('Error fetching entitlements', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/config
 * Get authentication configuration (whether auth is required)
 */
router.get('/config', (req: Request, res: Response) => {
  const requireAuth = process.env.REQUIRE_AUTH === 'true';
  res.json({ requireAuth });
});

export default router;