/**
 * SaaS plan catalog.
 *
 * Plans are a small code-level catalog (not a DB table) that map a PlanCode to
 * its default Entitlements and display/price metadata. The (future) Stripe
 * Price IDs are configured via env so the catalog stays deployment-agnostic.
 *
 * Pricing rationale lives in docs/MASTER_PLAN.md (Pricing & plans reference);
 * the full design analysis is docs/wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md.
 */

import type { Entitlements, PlanCode } from '../types';

/**
 * Sentinel for an "effectively unlimited" numeric entitlement. A large finite
 * value keeps the clamp/compare arithmetic (Math.min, `count >= limit`) simple
 * and serialises cleanly to JSON / Table Storage. The UI treats any limit at or
 * above this as "Unlimited".
 */
export const UNLIMITED = 100_000;

/**
 * D1 pricing decision (2026-07-17): a new paid-plan trial runs 14 days before
 * requiring a payment method. Shared by the Stripe Checkout trial
 * (`subscription_data.trial_period_days`) and the self-serve plan-change path
 * (`PUT /api/organizations/current`, which has no Stripe subscription to
 * carry a trial itself while billing isn't configured).
 */
export const TRIAL_PERIOD_DAYS = 14;

/** A Date `TRIAL_PERIOD_DAYS` from now — the trial deadline for a newly-started paid plan. */
export function trialEndDate(): Date {
  return new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** Display price in AUD per brigade/month. 0 for the free tier. */
  priceMonthlyAud: number;
  /** Display price in AUD per brigade/year (2 months free). 0 for the free tier. */
  priceAnnualAud: number;
  /** Env var for the Stripe Price ID used for monthly billing. */
  stripePriceMonthlyEnvVar?: string;
  /** Env var for the Stripe Price ID used for annual billing. */
  stripePriceAnnualEnvVar?: string;
  /** Default entitlements granted by this plan (the ceiling for owner toggles). */
  entitlements: Entitlements;
  description: string;
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  community: {
    code: 'community',
    name: 'Community',
    priceMonthlyAud: 0,
    priceAnnualAud: 0,
    entitlements: {
      signInEnabled: true,
      truckCheckEnabled: true,
      reportsEnabled: false,
      aiEnabled: false,
      maxStations: 1,
      maxDevices: 2,
      maxMembers: 10,
      maxVehicles: 1,
      aiIncludedSessions: 0,
      aarStudioEnabled: false,
      santaRunEnabled: false,
      fireBreakEnabled: false,
    },
    description: 'Free for any crew. Sign-in book (up to 10 members) and a vehicle check for 1 vehicle. Single-station setup.',
  },
  basic: {
    code: 'basic',
    name: 'Basic',
    priceMonthlyAud: 10,
    priceAnnualAud: 100,
    stripePriceMonthlyEnvVar: 'STRIPE_PRICE_BASIC_MONTHLY',
    stripePriceAnnualEnvVar: 'STRIPE_PRICE_BASIC_ANNUAL',
    entitlements: {
      signInEnabled: true,
      truckCheckEnabled: true,
      reportsEnabled: true,
      aiEnabled: false,
      maxStations: 20,
      maxDevices: 10,
      maxMembers: UNLIMITED,
      maxVehicles: UNLIMITED,
      aiIncludedSessions: 0,
      aarStudioEnabled: false,
      santaRunEnabled: false,
      fireBreakEnabled: true,
    },
    description: 'Full manual suite: sign-in, truck checks, reports & CSV export, plus the Fire Break Calculator. Unlimited members & vehicles, multiple stations.',
  },
  ai: {
    code: 'ai',
    name: 'AI Pro',
    priceMonthlyAud: 19,
    priceAnnualAud: 190,
    stripePriceMonthlyEnvVar: 'STRIPE_PRICE_AI_MONTHLY',
    stripePriceAnnualEnvVar: 'STRIPE_PRICE_AI_ANNUAL',
    entitlements: {
      signInEnabled: true,
      truckCheckEnabled: true,
      reportsEnabled: true,
      aiEnabled: true,
      maxStations: 20,
      maxDevices: 25,
      maxMembers: UNLIMITED,
      maxVehicles: UNLIMITED,
      aiIncludedSessions: 25, // fair-use allowance; overage metering is a future enhancement
      aarStudioEnabled: true,
      santaRunEnabled: false,
      fireBreakEnabled: true,
    },
    description: 'Everything in Basic plus AI-powered After Action Reviews via AAR Studio. ~25 sessions/month included.',
  },
};

/** Returns a fresh copy of the default entitlements for a plan. */
export function getDefaultEntitlements(planCode: PlanCode): Entitlements {
  return { ...PLANS[planCode].entitlements };
}

/** Type guard for incoming plan codes. */
export function isPlanCode(value: unknown): value is PlanCode {
  return value === 'community' || value === 'basic' || value === 'ai';
}

/**
 * Clamp a desired entitlement set to what the plan permits. Owners may DISABLE
 * modules (e.g. hide the sign-in book) but may never enable a feature, or
 * exceed a limit, beyond the plan ceiling.
 */
export function clampEntitlements(planCode: PlanCode, desired: Partial<Entitlements>): Entitlements {
  const ceiling = PLANS[planCode].entitlements;
  const current = { ...ceiling, ...desired };
  return {
    signInEnabled: current.signInEnabled && ceiling.signInEnabled,
    truckCheckEnabled: current.truckCheckEnabled && ceiling.truckCheckEnabled,
    reportsEnabled: current.reportsEnabled && ceiling.reportsEnabled,
    aiEnabled: current.aiEnabled && ceiling.aiEnabled,
    maxStations: Math.min(current.maxStations, ceiling.maxStations),
    maxDevices: Math.min(current.maxDevices, ceiling.maxDevices),
    maxMembers: Math.min(current.maxMembers, ceiling.maxMembers),
    maxVehicles: Math.min(current.maxVehicles, ceiling.maxVehicles),
    aiIncludedSessions: Math.min(current.aiIncludedSessions, ceiling.aiIncludedSessions),
    aarStudioEnabled: current.aarStudioEnabled && ceiling.aarStudioEnabled,
    santaRunEnabled: current.santaRunEnabled && ceiling.santaRunEnabled,
    fireBreakEnabled: current.fireBreakEnabled && ceiling.fireBreakEnabled,
  };
}
