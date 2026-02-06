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
 * Security note: In production, these endpoints should be protected
 * with authentication to prevent unauthorized token generation.
 */

import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validationHandler';
import {
  generateBrigadeAccessToken,
  validateBrigadeAccessToken,
  revokeBrigadeAccessToken,
  getBrigadeAccessTokens,
  getStationAccessTokens,
  getActiveTokenCount,
  getAllBrigadeAccessTokens,
} from '../services/brigadeAccessService';
import { logger } from '../services/logger';

const router = Router();

/**
 * POST /api/brigade-access/generate
 * Generate a new brigade access token for kiosk mode
 * 
 * Body:
 * - brigadeId: string (required)
 * - stationId: string (required)
 * - description: string (optional)
 * - expiresInDays: number (optional, default: no expiration)
 */
router.post(
  '/generate',
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
      
      const accessToken = validateBrigadeAccessToken(token);
      
      if (!accessToken) {
        return res.status(404).json({
          valid: false,
          error: 'Token not found or expired',
        });
      }
      
      res.json({
        valid: true,
        brigadeId: accessToken.brigadeId,
        stationId: accessToken.stationId,
        description: accessToken.description,
        createdAt: accessToken.createdAt,
        expiresAt: accessToken.expiresAt,
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
 */
router.delete(
  '/:token',
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
      const { token } = req.params;
      
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
 */
router.get(
  '/brigade/:brigadeId',
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
      const { brigadeId } = req.params;
      
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
 */
router.get(
  '/station/:stationId',
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
      const { stationId } = req.params;
      
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
 */
router.get('/stats', async (req: Request, res: Response) => {
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
 */
router.get('/all-tokens', async (req: Request, res: Response) => {
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
    console.error('Error fetching all tokens:', error);
    res.status(500).json({
      error: 'Failed to fetch all tokens',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
