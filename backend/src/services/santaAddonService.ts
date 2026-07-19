/**
 * Fire Santa Run add-on entitlement resolution.
 *
 * Basic and AI Pro orgs get `entitlements.santaRunEnabled` from the plan
 * (see constants/plans.ts). A Community org can instead buy the Santa add-on
 * standalone (routes/billing.ts `POST /santa-addon/checkout`) — this module
 * combines the two into the effective entitlement a caller (the SM frontend,
 * or a federated sibling app via GET /api/auth/session|me|entitlements)
 * should see, without mutating the org's persisted plan-derived entitlements.
 */

import type { Entitlements, Organization } from '../types';

/** Whether the org's standalone Santa add-on subscription currently grants access. */
export function isSantaAddonEntitled(org: Pick<Organization, 'santaAddon'>): boolean {
  const status = org.santaAddon?.status;
  // 'past_due' keeps access during Stripe's payment-retry grace window, matching
  // how the main plan subscription is treated elsewhere in this codebase.
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/**
 * The entitlements a caller should see: the org's plan-derived entitlements,
 * with `santaRunEnabled` OR'd in when a standalone add-on is active. Never
 * mutates `org.entitlements` — the addon is a separate purchase layered on
 * top, not a change to the plan ceiling.
 */
export function resolveEffectiveEntitlements(org: Pick<Organization, 'entitlements' | 'santaAddon'>): Entitlements {
  if (org.entitlements.santaRunEnabled || !isSantaAddonEntitled(org)) {
    return org.entitlements;
  }
  return { ...org.entitlements, santaRunEnabled: true };
}
