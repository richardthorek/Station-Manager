/**
 * AAR Session Routes — server-side persistence for AAR Studio reviews.
 *
 * GET    /api/aar-sessions       — list this org's saved reviews (summaries)
 * GET    /api/aar-sessions/:id   — fetch one saved review (full payload)
 * PUT    /api/aar-sessions/:id   — create or replace a review (client owns the id)
 * DELETE /api/aar-sessions/:id   — delete a review
 *
 * Every review is scoped to the caller's Organization (from the SM JWT), so a
 * review survives device loss and is visible brigade-wide instead of living only
 * in one facilitator's localStorage. AAR Studio is a no-build vanilla app that
 * owns its own session schema, so the body is stored as an opaque JSON blob with
 * a few fields lifted out for listing.
 *
 * Mounted behind `requireFeature('aarStudioEnabled')` in index.ts; auth is
 * required here because persistence is inherently org-scoped (no anonymous
 * server storage — anonymous AAR still works fully against localStorage).
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ensureAarSessionDatabase } from '../services/aarSessionDbFactory';
import { AarSessionConflictError } from '../services/aarSessionDatabase';
import { logger } from '../services/logger';

const router = Router();

// Reject payloads that would not fit a Table Storage entity (~1 MiB total).
const MAX_PAYLOAD_CHARS = 900_000;
const MAX_TITLE_CHARS = 300;

/** Resolve the caller's organization id, or send a 403 and return null. */
function requireOrgId(req: Request, res: Response): string | null {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    res.status(403).json({
      error: 'An organization account is required to save reviews to the cloud',
    });
    return null;
  }
  return organizationId;
}

// All routes require a valid SM JWT.
router.use(authMiddleware);

// ─── GET /api/aar-sessions ────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const organizationId = requireOrgId(req, res);
  if (!organizationId) return;
  try {
    const sessions = await ensureAarSessionDatabase().listByOrganization(organizationId);
    res.json({ sessions });
  } catch (error) {
    logger.error('Failed to list AAR sessions', { error, organizationId });
    res.status(500).json({ error: 'Failed to list reviews' });
  }
});

// ─── GET /api/aar-sessions/:id ────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const organizationId = requireOrgId(req, res);
  if (!organizationId) return;
  try {
    const session = await ensureAarSessionDatabase().getById(organizationId, req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json({ session });
  } catch (error) {
    logger.error('Failed to fetch AAR session', { error, organizationId, id: req.params.id });
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// ─── PUT /api/aar-sessions/:id ────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  const organizationId = requireOrgId(req, res);
  if (!organizationId) return;

  const { title, incidentDate, schemaVersion, payload, stationId, clientUpdatedAt } = req.body ?? {};

  if (typeof payload !== 'string' || !payload.trim()) {
    res.status(400).json({ error: 'payload (JSON string) is required' });
    return;
  }
  if (payload.length > MAX_PAYLOAD_CHARS) {
    res.status(413).json({ error: 'Review is too large to save to the cloud' });
    return;
  }
  if (typeof schemaVersion !== 'number') {
    res.status(400).json({ error: 'schemaVersion (number) is required' });
    return;
  }

  try {
    const session = await ensureAarSessionDatabase().upsert({
      id: req.params.id,
      organizationId,
      stationId: typeof stationId === 'string' ? stationId : undefined,
      title: typeof title === 'string' && title.trim() ? title.slice(0, MAX_TITLE_CHARS) : 'Untitled review',
      incidentDate: typeof incidentDate === 'string' ? incidentDate : undefined,
      schemaVersion,
      payload,
      clientUpdatedAt: typeof clientUpdatedAt === 'string' ? clientUpdatedAt : undefined,
      createdBy: req.user?.userId,
      createdByName: req.user?.username,
    });
    res.json({ session });
  } catch (error) {
    if (error instanceof AarSessionConflictError) {
      // The server copy was edited more recently on another device.
      const { payload: _payload, ...current } = error.current;
      res.status(409).json({ error: 'This review was updated more recently on another device', current });
      return;
    }
    logger.error('Failed to save AAR session', { error, organizationId, id: req.params.id });
    res.status(500).json({ error: 'Failed to save review' });
  }
});

// ─── DELETE /api/aar-sessions/:id ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const organizationId = requireOrgId(req, res);
  if (!organizationId) return;
  try {
    const deleted = await ensureAarSessionDatabase().delete(organizationId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete AAR session', { error, organizationId, id: req.params.id });
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;
