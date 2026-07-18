/**
 * StationKit suite catalog.
 *
 * The logged-in landing page doubles as the suite app-launcher: it shows every
 * StationKit app and unlocks the ones the org's entitlements grant. Sibling
 * apps (Fire Santa Run, Fire Break Calculator) live in their own repos and
 * deployments today (suite Phase 1 — federation), so they are reached via an
 * absolute URL configured at build time. The URL falls back to a sensible
 * default so the launcher still renders in local dev.
 *
 * The fallback hrefs below point at the sibling apps' stationkit.com.au
 * subdomains — those are separate repos/deployments this repo doesn't
 * control. Override with VITE_SANTA_RUN_URL/VITE_FIREBREAK_URL for local
 * dev or while a sibling app's own domain move is still in flight.
 *
 * Each sibling app validates the same SM-issued JWT and reads the same
 * entitlements via GET /api/auth/entitlements — see
 * docs/wiki/developer/suite-token-validation.md.
 */

import type { EntitlementFeature } from '../contexts/AuthContext';

export interface SuiteApp {
  /** Stable id (for keys/analytics). */
  id: string;
  /** Display name on the launcher card. */
  name: string;
  /** One-line description. */
  description: string;
  /** Emoji used as the card icon. */
  icon: string;
  /** Absolute URL to the app (sibling apps are separate deployments). */
  href: string;
  /** Entitlement that unlocks this app, or null for an always-available app. */
  feature: EntitlementFeature | null;
  /** Seasonal apps render a "Seasonal" hint and are only surfaced when unlocked. */
  seasonal?: boolean;
}

/**
 * Sibling apps reached by absolute URL. (Station Manager's own modules —
 * sign-in, truck check, reports, AAR Studio — are rendered directly by the
 * LandingPage with in-app router links.)
 */
export const SUITE_SIBLING_APPS: SuiteApp[] = [
  {
    id: 'santa-run',
    name: 'Fire Santa Run',
    description: 'Plan the brigade Santa run and share a live public GPS tracking map with the community.',
    icon: '🎅',
    href: import.meta.env.VITE_SANTA_RUN_URL || 'https://santa.stationkit.com.au',
    feature: 'santaRunEnabled',
    seasonal: true,
  },
  {
    id: 'fire-break',
    name: 'Fire Break Calculator',
    description: 'Draw a containment line and get time, cost and resource estimates for your fire-break plan.',
    icon: '🔥',
    href: import.meta.env.VITE_FIREBREAK_URL || 'https://firebreak.stationkit.com.au',
    feature: 'fireBreakEnabled',
  },
];
