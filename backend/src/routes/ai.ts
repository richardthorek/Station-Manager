/**
 * AI Gateway Routes
 *
 * POST /api/ai/chat          — chat completion (live finding/metadata extraction)
 * POST /api/ai/report        — chat completion on the heavier report model
 * POST /api/ai/speech/token  — vend a short-lived Azure Speech token (session start)
 * GET  /api/ai/usage         — this org's monthly AI session usage vs allowance
 *
 * Credentials live server-side (see services/aiGateway.ts); the browser never
 * holds an Azure key. Every call routed through here is recorded as a
 * `UsageRecord` for metered billing and the monthly allowance check.
 *
 * Gating model:
 *  - When the request carries org context AND entitlements are enabled, the
 *    `aiEnabled` entitlement is required (403 otherwise).
 *  - The monthly allowance (`aiIncludedSessions`) is measured in *sessions* —
 *    one `speech` token vend == one session — and enforced at the speech-token
 *    endpoint (402 when exhausted). `chat`/`report` need `aiEnabled` but are not
 *    hard-gated, so analysis already in flight during a session is never cut off.
 *  - Requests with no org context (anonymous AAR, kiosk/demo, back-compat) pass
 *    the gate, consistent with the rest of the entitlement system; usage is only
 *    recorded when an org is known. Full AAR identity is tracked separately
 *    (docs/MASTER_PLAN.md roadmap item A2; design in
 *    docs/archive/CONSOLIDATION_REVIEW.md).
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { attachOrganization } from '../middleware/entitlements';
import {
  chatCompletion,
  issueSpeechToken,
  isOpenAiConfigured,
  isSpeechConfigured,
  GatewayError,
  type AiKind,
} from '../services/aiGateway';
import { ensureUsageDatabase } from '../services/usageDbFactory';
import { monthlyResetAt } from '../services/usageDatabase';
import { logger } from '../services/logger';
import type { Organization, UsageType } from '../types';

const router = Router();

// Populate req.organization (best-effort) for every AI route.
router.use(attachOrganization);

function entitlementsEnabled(): boolean {
  return process.env.ENABLE_ENTITLEMENTS !== 'false';
}

/**
 * Enforce the aiEnabled entitlement when an org is known and gating is on.
 * Returns false (and sends a 403) when blocked; true to proceed.
 */
function passesAiGate(org: Organization | undefined, res: Response): boolean {
  if (!org || !entitlementsEnabled()) return true;
  if (!org.entitlements.aiEnabled) {
    res.status(403).json({
      error: 'AI features are not available on your plan',
      feature: 'aiEnabled',
      planCode: org.planCode,
      upgradeRequired: true,
    });
    return false;
  }
  return true;
}

async function recordIfOrg(org: Organization | undefined, type: UsageType, sessionId?: string): Promise<void> {
  if (!org) return;
  try {
    await ensureUsageDatabase().recordUsage({ organizationId: org.id, type, sessionId });
  } catch (error) {
    // Metering must never break the user-facing AI call.
    logger.warn('Failed to record AI usage', { error, organizationId: org.id, type });
  }
}

async function handleChat(kind: AiKind, type: UsageType, req: Request, res: Response): Promise<void> {
  if (!isOpenAiConfigured()) {
    res.status(503).json({ error: 'AI chat is not configured on this server' });
    return;
  }
  if (!passesAiGate(req.organization, res)) return;

  const { messages, responseFormat, sessionId } = req.body ?? {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'messages must be an array' });
    return;
  }

  const result = await chatCompletion({ kind, messages, responseFormat });
  if (result.status >= 200 && result.status < 300) {
    await recordIfOrg(req.organization, type, sessionId);
  }
  res.status(result.status).json(result.body);
}

// ─── POST /api/ai/chat ───────────────────────────────────────────────────────
router.post('/chat', (req, res) => handleChat('chat', 'chat', req, res));

// ─── POST /api/ai/report ─────────────────────────────────────────────────────
router.post('/report', (req, res) => handleChat('report', 'report', req, res));

// ─── POST /api/ai/speech/token ───────────────────────────────────────────────
router.post('/speech/token', async (req: Request, res: Response) => {
  if (!isSpeechConfigured()) {
    res.status(503).json({ error: 'Speech is not configured on this server' });
    return;
  }
  if (!passesAiGate(req.organization, res)) return;

  const org = req.organization;
  // Allowance gate: a speech token == one AAR session.
  if (org && entitlementsEnabled()) {
    const used = await ensureUsageDatabase().countUsage(org.id, 'speech');
    const included = org.entitlements.aiIncludedSessions;
    if (used >= included) {
      res.status(402).json({
        error: 'AI session limit reached for this month',
        remaining: 0,
        included,
        used,
        resetAt: monthlyResetAt().toISOString(),
        upgradeRequired: true,
      });
      return;
    }
  }

  try {
    const { token, region } = await issueSpeechToken();
    await recordIfOrg(org, 'speech', req.body?.sessionId);
    res.json({ token, region });
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to issue speech token' });
  }
});

// ─── GET /api/ai/usage ───────────────────────────────────────────────────────
// Authenticated org view for the Organization screen's AI usage display.
router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId || !req.organization) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }
  const org = req.organization;
  const used = await ensureUsageDatabase().countUsage(org.id, 'speech');
  const included = org.entitlements.aiIncludedSessions;
  res.json({
    used,
    included,
    remaining: Math.max(0, included - used),
    resetAt: monthlyResetAt().toISOString(),
    aiEnabled: org.entitlements.aiEnabled,
  });
});

export default router;
