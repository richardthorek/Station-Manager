/**
 * SaaS plan catalog.
 *
 * Plans are a small code-level catalog (not a DB table) that map a PlanCode to
 * its default Entitlements and display/price metadata. The (future) Stripe
 * Price IDs are configured via env so the catalog stays deployment-agnostic.
 *
 * Pricing rationale lives in docs/SAAS_COMMERCIALIZATION_DESIGN.md.
 */

import type { Entitlements, PlanCode } from '../types';

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** Display price in AUD per brigade/month. 0 for the free tier. */
  priceMonthlyAud: number;
  /** Env var holding the Stripe Price ID for this plan (resolved at billing time). */
  stripePriceEnvVar?: string;
  /** Default entitlements granted by this plan (the ceiling for owner toggles). */
  entitlements: Entitlements;
  description: string;
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  community: {
    code: 'community',
    name: 'Community',
    priceMonthlyAud: 0,
    entitlements: {
      signInEnabled: true,
      truckCheckEnabled: true,
      reportsEnabled: false,
      aiEnabled: false,
      maxStations: 1,
      maxDevices: 2,
      aiIncludedSessions: 0,
    },
    description: 'Free tier for a single station: sign-in book and basic truck checks.',
  },
  basic: {
    code: 'basic',
    name: 'Basic',
    priceMonthlyAud: 10,
    stripePriceEnvVar: 'STRIPE_PRICE_BASIC',
    entitlements: {
      signInEnabled: true,
      truckCheckEnabled: true,
      reportsEnabled: true,
      aiEnabled: false,
      maxStations: 5,
      maxDevices: 25,
      aiIncludedSessions: 0,
    },
    description: 'Full manual suite: sign-in, truck checks, reports, CSV export, unlimited members.',
  },
  ai: {
    code: 'ai',
    name: 'AI (Pro)',
    priceMonthlyAud: 19,
    stripePriceEnvVar: 'STRIPE_PRICE_AI',
    entitlements: {
      signInEnabled: true,
      truckCheckEnabled: true,
      reportsEnabled: true,
      aiEnabled: true,
      maxStations: 10,
      maxDevices: 50,
      aiIncludedSessions: 25, // fair-use allowance; overage handled via metering (future)
    },
    description: 'Everything in Basic plus the AI voice maintenance agent (fair-use metered).',
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
    aiIncludedSessions: Math.min(current.aiIncludedSessions, ceiling.aiIncludedSessions),
  };
}
