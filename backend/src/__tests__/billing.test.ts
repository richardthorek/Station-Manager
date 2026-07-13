/**
 * Billing route + stripeClient unit/integration tests.
 *
 * Tests cover all paths that do NOT require a live Stripe connection:
 * error-path returns (503, 400, 401), helper function behaviour,
 * and the billing status endpoint.
 *
 * Paths that call stripe.checkout.sessions.create / billingPortal / webhooks
 * with a real signature are exercised via end-to-end / manual test only.
 */

import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';
import organizationsRouter from '../routes/organizations';
import billingRouter from '../routes/billing';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureAdminUserDatabase, initializeAdminUserDatabase, getAdminDb } from '../services/adminUserDbFactory';
import { ensureBillingEventDatabase, initializeBillingEventDatabase } from '../services/billingEventDbFactory';

function buildApp() {
  const app = express();
  // Must be before express.json() — mirrors what index.ts does.
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/billing', billingRouter);
  return app;
}

describe('Billing', () => {
  let app: express.Express;

  beforeAll(async () => {
    await initializeOrganizationDatabase();
    await initializeBillingEventDatabase();
    ensureAdminUserDatabase();
    await initializeAdminUserDatabase();
  });

  beforeEach(async () => {
    await (ensureOrganizationDatabase() as unknown as { clear: () => Promise<void> }).clear();
    await (getAdminDb() as unknown as { clear: () => Promise<void> }).clear();
    await ensureBillingEventDatabase().clear();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
    delete process.env.STRIPE_PRICE_BASIC_ANNUAL;
    delete process.env.STRIPE_PRICE_AI_MONTHLY;
    delete process.env.STRIPE_PRICE_AI_ANNUAL;
    app = buildApp();
  });

  afterAll(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
    delete process.env.STRIPE_PRICE_BASIC_ANNUAL;
    delete process.env.STRIPE_PRICE_AI_MONTHLY;
    delete process.env.STRIPE_PRICE_AI_ANNUAL;
  });

  async function signup(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        organizationName: 'Billings RFS',
        billingEmail: 'billing@rfs.org',
        username: 'owner',
        password: 'supersecret1',
        email: 'billing@rfs.org',
        ...overrides,
      });
    return res.body.token as string;
  }

  // ── stripeClient helpers ───────────────────────────────────────────────────

  describe('stripeClient', () => {
    // Re-require to avoid cached module state from other test files.
    function loadStripeClient() {
      jest.resetModules();
      return require('../services/stripeClient');
    }

    it('isStripeConfigured() returns false when STRIPE_SECRET_KEY is absent', () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { isStripeConfigured } = loadStripeClient();
      expect(isStripeConfigured()).toBe(false);
    });

    it('isStripeConfigured() returns true when STRIPE_SECRET_KEY is set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
      const { isStripeConfigured } = loadStripeClient();
      expect(isStripeConfigured()).toBe(true);
    });

    it('resolvePriceId() returns undefined when env var not set', () => {
      delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
      const { resolvePriceId } = loadStripeClient();
      expect(resolvePriceId('basic', 'monthly')).toBeUndefined();
    });

    it('resolvePriceId() returns price ID when env var is set', () => {
      process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_test_123';
      const { resolvePriceId } = loadStripeClient();
      expect(resolvePriceId('basic', 'monthly')).toBe('price_test_123');
    });

    it('resolvePriceId() returns undefined for unknown plan/interval combo', () => {
      const { resolvePriceId } = loadStripeClient();
      expect(resolvePriceId('basic', 'quarterly' as never)).toBeUndefined();
    });

    it('getStripeClient() throws when STRIPE_SECRET_KEY is not set', () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripeClient } = loadStripeClient();
      expect(() => getStripeClient()).toThrow('STRIPE_SECRET_KEY is not configured');
    });
  });

  // ── GET /api/billing/status ────────────────────────────────────────────────

  describe('GET /api/billing/status', () => {
    it('returns billing summary for an authenticated org user', async () => {
      const token = await signup();
      const res = await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.planCode).toBe('community');
      expect(res.body.status).toBe('active');
      expect(res.body.trialEndsAt).toBeNull();
      expect(res.body.hasPaymentMethod).toBe(false);
      expect(res.body.stripeConfigured).toBe(false);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/billing/status');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/billing/checkout ─────────────────────────────────────────────

  describe('POST /api/billing/checkout', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app)
        .post('/api/billing/checkout')
        .send({ planCode: 'basic' });
      expect(res.status).toBe(401);
    });

    it('returns 503 when Stripe is not configured', async () => {
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'basic', billingInterval: 'monthly' });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/not configured/i);
    });

    it('returns 400 when planCode is missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ billingInterval: 'monthly' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when planCode is "community"', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'community', billingInterval: 'monthly' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when billingInterval is invalid', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'basic', billingInterval: 'weekly' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when price env var is not configured for the chosen plan', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'basic', billingInterval: 'monthly' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/STRIPE_PRICE_BASIC_MONTHLY/);
    });

    it('returns 400 for ai plan when annual env var missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      delete process.env.STRIPE_PRICE_AI_ANNUAL;
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ planCode: 'ai', billingInterval: 'annual' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/STRIPE_PRICE_AI_ANNUAL/);
    });
  });

  // ── POST /api/billing/portal ───────────────────────────────────────────────

  describe('POST /api/billing/portal', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).post('/api/billing/portal');
      expect(res.status).toBe(401);
    });

    it('returns 503 when Stripe is not configured', async () => {
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/portal')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(503);
    });

    it('returns 400 when org has no Stripe customer yet', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      const token = await signup();
      const res = await request(app)
        .post('/api/billing/portal')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/billing account/i);
    });
  });

  // ── GET /api/billing/events ────────────────────────────────────────────────

  describe('GET /api/billing/events', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/billing/events');
      expect(res.status).toBe(401);
    });

    it('returns the org-scoped audit trail for the owner, newest first', async () => {
      const token = await signup();
      const orgs = await ensureOrganizationDatabase().getAllOrganizations();
      const orgId = orgs[0].id;

      const db = ensureBillingEventDatabase();
      await db.record({
        organizationId: orgId,
        stripeEventId: 'evt_1',
        eventType: 'checkout.session.completed',
        payload: '{}',
      });
      await db.record({
        organizationId: orgId,
        stripeEventId: 'evt_2',
        eventType: 'invoice.paid',
        payload: '{}',
      });
      // An event for a different org must not leak into this org's trail.
      await db.record({
        organizationId: 'someone-else',
        stripeEventId: 'evt_other',
        eventType: 'invoice.paid',
        payload: '{}',
      });

      const res = await request(app)
        .get('/api/billing/events')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(2);
      const ids = res.body.events.map((e: { stripeEventId: string }) => e.stripeEventId);
      expect(ids).toContain('evt_1');
      expect(ids).toContain('evt_2');
      expect(ids).not.toContain('evt_other');
    });
  });

  // ── POST /api/billing/webhook ──────────────────────────────────────────────

  describe('POST /api/billing/webhook', () => {
    it('returns 503 when Stripe is not configured', async () => {
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send('{}');
      expect(res.status).toBe(503);
    });

    it('returns 500 when STRIPE_WEBHOOK_SECRET is missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 't=1234,v1=sig')
        .send('{}');
      expect(res.status).toBe(500);
    });

    it('returns 400 when Stripe-Signature header is missing', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send('{}');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);
    });

    it('returns 400 when Stripe-Signature is invalid', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_secret_here';
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 't=1234,v1=invalidsignaturehex')
        .send(Buffer.from('{}'));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);
    });
  });
});
