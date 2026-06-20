/**
 * Billing Routes — Stripe integration
 *
 * POST /api/billing/checkout — create Stripe Checkout session (owner-only)
 * POST /api/billing/portal  — create Stripe Customer Portal session (owner-only)
 * GET  /api/billing/status  — current billing status for the org
 * POST /api/billing/webhook — Stripe webhook (no auth, verified by signature)
 *
 * The webhook endpoint must receive a raw (un-parsed) request body.
 * Register express.raw({ type: 'application/json' }) for this path in index.ts
 * BEFORE the global express.json() middleware.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getStripeClient, isStripeConfigured, resolvePriceId } from '../services/stripeClient';
import { authMiddleware, requireOwner } from '../middleware/auth';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { getDefaultEntitlements, isPlanCode } from '../constants/plans';
import { logger } from '../services/logger';
import type Stripe from 'stripe';
import type { BillingEvent, PlanCode, OrganizationStatus } from '../types';

const router = Router();

// In-memory audit log — sufficient for dev/test; replace with Table Storage persistence
// in a follow-up once the BillingEventStore interface is wired to both DB backends.
const billingEventLog: BillingEvent[] = [];

function auditBillingEvent(partial: Omit<BillingEvent, 'id' | 'processedAt'>): void {
  billingEventLog.push({ id: uuidv4(), processedAt: new Date(), ...partial });
}

function appBaseUrl(): string {
  const urls = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173';
  return urls.split(',')[0].trim().replace(/\/$/, '');
}

// ─── POST /api/billing/checkout ──────────────────────────────────────────────

router.post('/checkout', authMiddleware, requireOwner, async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Billing is not configured on this server' });
  }

  const { planCode, billingInterval = 'monthly' } = req.body ?? {};

  if (!planCode || !isPlanCode(planCode) || planCode === 'community') {
    return res.status(400).json({ error: 'planCode must be "basic" or "ai"' });
  }
  if (billingInterval !== 'monthly' && billingInterval !== 'annual') {
    return res.status(400).json({ error: 'billingInterval must be "monthly" or "annual"' });
  }

  const priceId = resolvePriceId(planCode, billingInterval);
  if (!priceId) {
    return res.status(400).json({
      error: `No Stripe price configured for ${planCode}/${billingInterval}. Set STRIPE_PRICE_${planCode.toUpperCase()}_${billingInterval.toUpperCase()} env var.`,
    });
  }

  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.user!.organizationId!);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const stripe = getStripeClient();

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.billingEmail,
        name: org.name,
        metadata: { organizationId: org.id, slug: org.slug },
      });
      customerId = customer.id;
      await orgDb.updateOrganization(org.id, { stripeCustomerId: customerId });
    }

    const base = appBaseUrl();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { organizationId: org.id, planCode },
      },
      success_url: `${base}/admin/organization?billing=success`,
      cancel_url: `${base}/admin/organization?billing=cancelled`,
      metadata: { organizationId: org.id, planCode },
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: false },
    });

    logger.info('Stripe Checkout session created', {
      organizationId: org.id,
      planCode,
      interval: billingInterval,
      sessionId: session.id,
    });

    return res.json({ checkoutUrl: session.url });
  } catch (error) {
    logger.error('Error creating checkout session', { error });
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ─── POST /api/billing/portal ────────────────────────────────────────────────

router.post('/portal', authMiddleware, requireOwner, async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Billing is not configured on this server' });
  }

  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.user!.organizationId!);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!org.stripeCustomerId) {
      return res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' });
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appBaseUrl()}/admin/organization`,
    });

    logger.info('Stripe Customer Portal session created', { organizationId: org.id });
    return res.json({ portalUrl: session.url });
  } catch (error) {
    logger.error('Error creating portal session', { error });
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// ─── GET /api/billing/status ─────────────────────────────────────────────────

router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orgDb = ensureOrganizationDatabase();
    const org = await orgDb.getOrganizationById(req.user?.organizationId ?? '');
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    return res.json({
      planCode: org.planCode,
      status: org.status,
      trialEndsAt: org.trialEndsAt ?? null,
      hasPaymentMethod: Boolean(org.stripeCustomerId && org.stripeSubscriptionId),
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error) {
    logger.error('Error fetching billing status', { error });
    return res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// ─── POST /api/billing/webhook ───────────────────────────────────────────────
// req.body is a raw Buffer — register express.raw() for this path BEFORE
// express.json() in index.ts so the stream is not consumed by JSON parsing.

router.post('/webhook', async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Billing not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET env var is missing — cannot verify webhook');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  if (!sig) {
    return res.status(400).json({ error: 'Missing Stripe-Signature header' });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    logger.warn('Webhook signature verification failed', { error: err });
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  let processingError: string | undefined;
  try {
    await processStripeEvent(event);
  } catch (error) {
    processingError = error instanceof Error ? error.message : String(error);
    logger.error('Error processing Stripe webhook', { type: event.type, eventId: event.id, error });
  }

  auditBillingEvent({
    organizationId: extractOrgId(event),
    stripeEventId: event.id,
    eventType: event.type,
    payload: JSON.stringify(event.data.object),
    error: processingError,
  });

  // Always return 200 after audit — prevents Stripe from re-delivering.
  return res.json({ received: true });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractOrgId(event: Stripe.Event): string | undefined {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const meta = obj['metadata'] as Record<string, string> | undefined;
  if (meta?.['organizationId']) return meta['organizationId'];

  const subData = obj['subscription_data'] as Record<string, unknown> | undefined;
  const subMeta = subData?.['metadata'] as Record<string, string> | undefined;
  return subMeta?.['organizationId'];
}

function stripeStatusToOrgStatus(stripeStatus: string): OrganizationStatus {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'paused':
      return 'canceled';
    default:
      return 'active';
  }
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const orgDb = ensureOrganizationDatabase();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.['organizationId'];
      const planCode = session.metadata?.['planCode'] as PlanCode | undefined;
      if (!organizationId || !planCode || !isPlanCode(planCode)) {
        logger.warn('checkout.session.completed missing org/plan metadata', { sessionId: session.id });
        break;
      }
      await orgDb.updateOrganization(organizationId, {
        planCode,
        status: 'trialing',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
        entitlements: getDefaultEntitlements(planCode),
      });
      logger.info('Org upgraded via Checkout', { organizationId, planCode });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const organizationId = sub.metadata?.['organizationId'];
      if (!organizationId) {
        logger.warn('customer.subscription.updated missing organizationId metadata');
        break;
      }
      const planCode = sub.metadata?.['planCode'] as PlanCode | undefined;
      const updates: Parameters<typeof orgDb.updateOrganization>[1] = {
        status: stripeStatusToOrgStatus(sub.status),
        stripeSubscriptionId: sub.id,
      };
      if (planCode && isPlanCode(planCode)) {
        updates.planCode = planCode;
        updates.entitlements = getDefaultEntitlements(planCode);
      }
      if (sub.trial_end) {
        updates.trialEndsAt = new Date(sub.trial_end * 1000);
      }
      await orgDb.updateOrganization(organizationId, updates);
      logger.info('Subscription updated', { organizationId, status: sub.status });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const organizationId = sub.metadata?.['organizationId'];
      if (!organizationId) break;
      await orgDb.updateOrganization(organizationId, {
        planCode: 'community',
        status: 'canceled',
        entitlements: getDefaultEntitlements('community'),
        stripeSubscriptionId: undefined,
      });
      logger.info('Subscription cancelled — org reverted to Community', { organizationId });
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      if (!customerId) break;
      const orgs = await orgDb.getAllOrganizations();
      const org = orgs.find(o => o.stripeCustomerId === customerId);
      if (org && org.status === 'past_due') {
        await orgDb.updateOrganization(org.id, { status: 'active' });
        logger.info('Invoice paid — org restored to active', { organizationId: org.id });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      if (!customerId) break;
      const orgs = await orgDb.getAllOrganizations();
      const org = orgs.find(o => o.stripeCustomerId === customerId);
      if (org) {
        await orgDb.updateOrganization(org.id, { status: 'past_due' });
        logger.warn('Invoice payment failed — org marked past_due', { organizationId: org.id });
      }
      break;
    }

    default:
      logger.debug('Unhandled Stripe event', { type: event.type });
  }
}

export default router;
