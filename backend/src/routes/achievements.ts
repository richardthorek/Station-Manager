/**
 * Achievement Routes
 * 
 * API endpoints for fetching member achievements and gamification data
 * Supports demo mode via req.isDemoMode flag
 * 
 * Multi-Station Support:
 * - Achievements are filtered by member, and members are already station-filtered
 * - Middleware applied for consistency with other routes
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import { AchievementService } from '../services/achievementService';
import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { stationMiddleware } from '../middleware/stationMiddleware';
import { logger } from '../services/logger';

export function createAchievementRoutes(): Router {
  const router = Router();

  // Apply station middleware to all routes
  router.use(stationMiddleware);

  /**
   * GET /api/achievements/:memberId
   * Get achievements for a specific member
   */
  router.get('/:memberId', async (req: Request, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      
      // Get database instances based on demo mode
      const db = await ensureDatabase(req.isDemoMode);
      const truckChecksDb = await ensureTruckChecksDatabase(req.isDemoMode);
      const achievementService = new AchievementService(db, truckChecksDb);
      
      // Get member to validate they exist
      const member = await db.getMemberById(memberId);
      if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      // Calculate and return achievements
      const summary = await achievementService.calculateAchievements(memberId, member.name);
      
      res.json(summary);
    } catch (error) {
      logger.error('Error fetching achievements:', { error, requestId: req.id }, error);
      res.status(500).json({ error: 'Failed to fetch achievements' });
    }
  });

  /**
   * GET /api/achievements/:memberId/recent
   * Get recently earned achievements for a member
   */
  router.get('/:memberId/recent', async (req: Request, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      
      const db = await ensureDatabase(req.isDemoMode);
      const truckChecksDb = await ensureTruckChecksDatabase(req.isDemoMode);
      const achievementService = new AchievementService(db, truckChecksDb);
      
      const member = await db.getMemberById(memberId);
      if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      const summary = await achievementService.calculateAchievements(memberId, member.name);
      
      res.json({
        recentlyEarned: summary.recentlyEarned,
        totalNew: summary.recentlyEarned.length,
      });
    } catch (error) {
      logger.error('Error fetching recent achievements:', { error, requestId: req.id }, error);
      res.status(500).json({ error: 'Failed to fetch recent achievements' });
    }
  });

  /**
   * GET /api/achievements/:memberId/progress
   * Get progress toward unearned achievements
   */
  router.get('/:memberId/progress', async (req: Request, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      
      const db = await ensureDatabase(req.isDemoMode);
      const truckChecksDb = await ensureTruckChecksDatabase(req.isDemoMode);
      const achievementService = new AchievementService(db, truckChecksDb);
      
      const member = await db.getMemberById(memberId);
      if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      const summary = await achievementService.calculateAchievements(memberId, member.name);
      
      res.json({
        progress: summary.progress,
        activeStreaks: summary.activeStreaks,
      });
    } catch (error) {
      logger.error('Error fetching achievement progress:', { error, requestId: req.id }, error);
      res.status(500).json({ error: 'Failed to fetch achievement progress' });
    }
  });

  return router;
}
