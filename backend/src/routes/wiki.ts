/**
 * In-app wiki routes — mounted at /api/wiki.
 *
 * - /api/wiki/user-guide/**        PUBLIC — read by the help drawer and the
 *   public /wiki SPA route. No auth: kiosk, demo, and logged-out marketing
 *   visitors all get to read it.
 * - /api/wiki/platform-admin/**    Gated by authMiddleware + requirePlatformAdmin
 *   (same gate as /api/platform). Never linked outside the platform admin
 *   console — see frontend/src/features/admin/platform/PlatformAdminPage.tsx.
 *
 * Both read from docs/wiki/<section>/ via wikiContentService — see that file
 * for why docs/wiki/developer is intentionally unreachable here.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/platformAdmin';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { getWikiManifest, getWikiPage, getWikiImagePath, type WikiSection } from '../services/wikiContentService';
import { searchWiki } from '../services/wikiSearchService';

const router = Router();

function registerSectionRoutes(mountPath: string, section: WikiSection): void {
  router.get(mountPath, (_req: Request, res: Response) => {
    res.json(getWikiManifest(section));
  });

  router.get(`${mountPath}/pages/:slug`, (req: Request, res: Response) => {
    const page = getWikiPage(section, req.params.slug as string);
    if (!page) {
      res.status(404).json({ error: 'Wiki page not found' });
      return;
    }
    res.json(page);
  });

  router.get(`${mountPath}/images/:filename`, (req: Request, res: Response) => {
    const filePath = getWikiImagePath(section, req.params.filename as string);
    if (!filePath) {
      res.status(404).json({ error: 'Wiki image not found' });
      return;
    }
    res.sendFile(filePath, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        // Helmet's default same-origin CORP blocks the frontend dev server
        // (:5173) from loading images served by the backend dev server
        // (:3000) — harmless in prod (same origin there) but breaks local
        // dev, where WikiContent's <img> tags always cross that port gap.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  });

  // Grounded AI search — the tighter aiRateLimiter is stacked on top of the
  // apiRateLimiter already applied at the /api/wiki mount (see index.ts),
  // same reasoning as /api/ai: a paid, anonymous-reachable AI call needs a
  // tighter per-IP bound than ordinary reads.
  router.post(`${mountPath}/search`, aiRateLimiter, async (req: Request, res: Response) => {
    const { query } = req.body ?? {};
    if (typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: 'query is required' });
      return;
    }
    if (query.length > 500) {
      res.status(400).json({ error: 'query is too long (max 500 characters)' });
      return;
    }

    const outcome = await searchWiki(section, query.trim());
    if (!outcome.result) {
      res.status(outcome.status).json({ error: outcome.error || 'AI search failed' });
      return;
    }
    res.status(200).json(outcome.result);
  });
}

registerSectionRoutes('/user-guide', 'user-guide');

router.use('/platform-admin', authMiddleware, requirePlatformAdmin);
registerSectionRoutes('/platform-admin', 'platform-admin');

export default router;
