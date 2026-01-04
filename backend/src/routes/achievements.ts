/**
 * Achievement Routes
 * 
 * API endpoints for fetching member achievements and gamification data
 */

import { Router, Request, Response } from 'express';
import { AchievementService } from '../services/achievementService';
import type { IDatabase } from '../services/dbFactory';
import type { ITruckChecksDatabase } from '../services/truckChecksDbFactory';

export function createAchievementRoutes(
  db: IDatabase,
  truckChecksDb: ITruckChecksDatabase
): Router {
  const router = Router();
  const achievementService = new AchievementService(db, truckChecksDb);

  /**
   * GET /api/achievements/:memberId
   * Get achievements for a specific member
   */
  router.get('/:memberId', async (req: Request, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      
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
      console.error('Error fetching achievements:', error);
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
      console.error('Error fetching recent achievements:', error);
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
      console.error('Error fetching achievement progress:', error);
      res.status(500).json({ error: 'Failed to fetch achievement progress' });
    }
  });

  return router;
}
