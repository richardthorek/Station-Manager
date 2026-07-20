/**
 * Brigade Access Token Routes
 *
 * API endpoints for managing brigade access tokens for kiosk mode.
 * These endpoints allow administrators to:
 * - Generate new kiosk access tokens
 * - List tokens for a brigade or station
 * - Revoke tokens
 * - Validate tokens
 *
 * Authentication:
 * - All admin operations (generate/revoke/list/stats) require an
 *   authenticated admin/owner unconditionally — see MASTER_PLAN Q29 / review
 *   F5. `optionalAuth` only enforced auth when REQUIRE_AUTH=true, so an
 *   unset env var let anyone mint or enumerate kiosk credentials for any
 *   station.
 * - `/validate` stays public — it's called by the kiosk itself when it
 *   loads `/signin?brigade=<token>`.
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validationHandler';
import {
  generateBrigadeAccessToken,
  revokeBrigadeAccessToken,
  getBrigadeAccessTokens,
  getStationAccessTokens,
  getActiveTokenCount,
  getAllBrigadeAccessTokens,
} from '../services/brigadeAccessService';
import { resolveKioskAccess } from '../services/kioskAccessResolver';
import { logger } from '../services/logger';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const router = Router();

// All brigade-access admin operations require an authenticated org admin.
const brigadeAccessAdminAuth = [authMiddleware, requireAdmin];

/**
 * POST /api/brigade-access/generate
 * Generate a new brigade access token for kiosk mode
 * Protected by authMiddleware + requireAdmin
 *
 * Body:
 * - brigadeId: string (required)
 * - stationId: string (required)
 * - description: string (optional)
 * - expiresInDays: number (optional, default: no expiration)
 */
router.post(
  '/generate',
  brigadeAccessAdminAuth,
  [
    body('brigadeId')
      .trim()
      .notEmpty()
      .withMessage('Brigade ID is required')
      .isLength({ max: 100 })
      .withMessage('Brigade ID is too long'),
    body('stationId')
      .trim()
      .notEmpty()
      .withMessage('Station ID is required')
      .isLength({ max: 100 })
      .withMessage('Station ID is too long'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description is too long'),
    body('expiresInDays')
      .optional()
      .isInt({ min: 1, max: 3650 })
      .withMessage('Expiration must be between 1 and 3650 days'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { brigadeId, stationId, description, expiresInDays } = req.body;
      
      // Calculate expiration date if provided
      let expiresAt: Date | undefined;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }
      
      const accessToken = generateBrigadeAccessToken(
        brigadeId,
        stationId,
        description,
        expiresAt
      );
      
      res.status(201).json({
        success: true,
        token: accessToken.token,
        brigadeId: accessToken.brigadeId,
        stationId: accessToken.stationId,
        description: accessToken.description,
        createdAt: accessToken.createdAt,
        expiresAt: accessToken.expiresAt,
        kioskUrl: `${req.protocol}://${req.get('host')}/signin?brigade=${accessToken.token}`,
      });
    } catch (error) {
      logger.error('Error generating brigade access token:', error);
      res.status(500).json({
        error: 'Failed to generate brigade access token',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/brigade-access/validate
 * Validate a brigade access token
 * 
 * Body:
 * - token: string (required)
 */
router.post(
  '/validate',
  [
    body('token')
      .trim()
      .notEmpty()
      .withMessage('Token is required')
      .isUUID()
      .withMessage('Token must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      // AC-5: resolves against the new Device store first, falling back to
      // this legacy in-memory token store — so a kiosk URL generated either
      // way keeps working through this one endpoint.
      const resolved = await resolveKioskAccess(token);

      if (!resolved) {
        return res.status(404).json({
          valid: false,
          error: 'Token not found or expired',
        });
      }

      res.json({
        valid: true,
        brigadeId: resolved.brigadeId,
        stationId: resolved.stationId,
        stationName: resolved.stationName,
        name: resolved.name,
        type: resolved.type,
        description: resolved.description,
        createdAt: resolved.createdAt,
        expiresAt: resolved.expiresAt,
      });
    } catch (error) {
      logger.error('Error validating brigade access token:', error);
      res.status(500).json({
        error: 'Failed to validate brigade access token',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/brigade-access/:token
 * Revoke a brigade access token
 * Protected by authMiddleware + requireAdmin
 */
router.delete(
  '/:token',
  brigadeAccessAdminAuth,
  [
    param('token')
      .trim()
      .notEmpty()
      .withMessage('Token is required')
      .isUUID()
      .withMessage('Token must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const token = req.params.token as string;
      
      const revoked = revokeBrigadeAccessToken(token);
      
      if (!revoked) {
        return res.status(404).json({
          error: 'Token not found',
        });
      }
      
      res.json({
        success: true,
        message: 'Token revoked successfully',
        token,
      });
    } catch (error) {
      logger.error('Error revoking brigade access token:', error);
      res.status(500).json({
        error: 'Failed to revoke brigade access token',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/brigade-access/brigade/:brigadeId
 * Get all active tokens for a brigade
 * Protected by authMiddleware + requireAdmin
 */
router.get(
  '/brigade/:brigadeId',
  brigadeAccessAdminAuth,
  [
    param('brigadeId')
      .trim()
      .notEmpty()
      .withMessage('Brigade ID is required')
      .isLength({ max: 100 })
      .withMessage('Brigade ID is too long'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const brigadeId = req.params.brigadeId as string;
      
      const tokens = getBrigadeAccessTokens(brigadeId);
      
      res.json({
        brigadeId,
        tokens: tokens.map(t => ({
          token: t.token,
          stationId: t.stationId,
          description: t.description,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
        })),
        count: tokens.length,
      });
    } catch (error) {
      logger.error('Error fetching brigade tokens:', error);
      res.status(500).json({
        error: 'Failed to fetch brigade tokens',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/brigade-access/station/:stationId
 * Get all active tokens for a station
 * Protected by authMiddleware + requireAdmin
 */
router.get(
  '/station/:stationId',
  brigadeAccessAdminAuth,
  [
    param('stationId')
      .trim()
      .notEmpty()
      .withMessage('Station ID is required')
      .isLength({ max: 100 })
      .withMessage('Station ID is too long'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const stationId = req.params.stationId as string;
      
      const tokens = getStationAccessTokens(stationId);
      
      res.json({
        stationId,
        tokens: tokens.map(t => ({
          token: t.token,
          brigadeId: t.brigadeId,
          description: t.description,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
        })),
        count: tokens.length,
      });
    } catch (error) {
      logger.error('Error fetching station tokens:', error);
      res.status(500).json({
        error: 'Failed to fetch station tokens',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/brigade-access/stats
 * Get statistics about active tokens
 * Protected by authMiddleware + requireAdmin
 */
router.get('/stats', brigadeAccessAdminAuth, async (req: Request, res: Response) => {
  try {
    const totalTokens = getActiveTokenCount();
    
    res.json({
      totalActiveTokens: totalTokens,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching token stats:', error);
    res.status(500).json({
      error: 'Failed to fetch token stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/brigade-access/all-tokens
 * Get all active tokens across all stations (for admin utility)
 * Returns a map of tokens with their associated station info
 * Protected by authMiddleware + requireAdmin
 */
router.get('/all-tokens', brigadeAccessAdminAuth, async (req: Request, res: Response) => {
  try {
    const allTokens = getAllBrigadeAccessTokens();
    
    // Format tokens with full kiosk URLs
    const tokensWithUrls = allTokens.map(t => ({
      token: t.token,
      brigadeId: t.brigadeId,
      stationId: t.stationId,
      description: t.description,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      kioskUrl: `${req.protocol}://${req.get('host')}/signin?brigade=${t.token}`,
    }));
    
    res.json({
      tokens: tokensWithUrls,
      count: tokensWithUrls.length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching all tokens', { error });
    res.status(500).json({
      error: 'Failed to fetch all tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
