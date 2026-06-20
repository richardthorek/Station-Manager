/**
 * Stripe SDK singleton and plan price ID resolution.
 *
 * Price IDs are read from environment variables so the same code works
 * across test-mode (dev/CI) and live-mode (production) Stripe accounts.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          — Stripe secret key (sk_test_... or sk_live_...)
 *   STRIPE_WEBHOOK_SECRET      — Webhook endpoint signing secret (whsec_...)
 *   STRIPE_PRICE_BASIC_MONTHLY — price_... for Basic plan, monthly billing
 *   STRIPE_PRICE_BASIC_ANNUAL  — price_... for Basic plan, annual billing
 *   STRIPE_PRICE_AI_MONTHLY    — price_... for AI plan, monthly billing
 *   STRIPE_PRICE_AI_ANNUAL     — price_... for AI plan, annual billing
 */

import Stripe from 'stripe';
import { logger } from './logger';

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  stripeInstance = new Stripe(key);
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.debug('Stripe not configured: STRIPE_SECRET_KEY missing');
    return false;
  }
  return true;
}

export type BillingInterval = 'monthly' | 'annual';

const PRICE_ENV_VARS: Record<string, string> = {
  'basic:monthly': 'STRIPE_PRICE_BASIC_MONTHLY',
  'basic:annual': 'STRIPE_PRICE_BASIC_ANNUAL',
  'ai:monthly': 'STRIPE_PRICE_AI_MONTHLY',
  'ai:annual': 'STRIPE_PRICE_AI_ANNUAL',
};

/** Resolve a Stripe Price ID from the environment. Returns undefined if not configured. */
export function resolvePriceId(planCode: 'basic' | 'ai', interval: BillingInterval): string | undefined {
  const envVar = PRICE_ENV_VARS[`${planCode}:${interval}`];
  return envVar ? process.env[envVar] : undefined;
}
