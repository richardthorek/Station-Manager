// Entitlement gate for AAR Studio (/aar).
//
// AAR Studio is local-first and works fully signed-out, but it is a paid suite
// app: a signed-in user whose Station Manager org is NOT on a plan that includes
// AAR Studio (entitlement `aarStudioEnabled`) should see an honest upgrade
// prompt rather than an app whose cloud-sync and AI features silently 503/403.
//
// The backend already gates `/api/aar-sessions` and `/api/ai/*` behind
// `requireFeature('aarStudioEnabled')`, so this is a UX gate, not the security
// boundary. It is deliberately fail-OPEN: a signed-out visitor, a missing org,
// or a failed/transient probe all allow local use — we only block when we have a
// positive signal that the signed-in org lacks the entitlement.
//
// Pure decision logic + injectable fetch/token so it loads and tests under node.

import { getAuthToken } from './serverSync.js';

const ENTITLEMENTS_URL = '/api/auth/entitlements';

/**
 * Probe the SM entitlements endpoint. Returns the parsed
 * `{ entitlements, planCode, status }` body, or null on signed-out / any error
 * (so callers fail open).
 */
export async function fetchEntitlements({ fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  if (!token) return null;
  try {
    const res = await fetchImpl(ENTITLEMENTS_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Pure access decision. Returns { allowed, reason }.
 *
 * - No token .................. allowed (signed-out local-first use)
 * - No entitlements probe ..... allowed (transient/probe failure → fail open)
 * - entitlements === null ..... allowed (no org context / single-tenant)
 * - aarStudioEnabled !== false  allowed
 * - aarStudioEnabled === false  BLOCKED ('not-entitled')
 */
export function decideAccess({ token, entitlementResponse }) {
  if (!token) return { allowed: true, reason: 'signed-out' };
  if (!entitlementResponse) return { allowed: true, reason: 'no-probe' };
  const ent = entitlementResponse.entitlements;
  if (ent == null) return { allowed: true, reason: 'no-org' };
  if (ent.aarStudioEnabled === false) {
    return { allowed: false, reason: 'not-entitled', planCode: entitlementResponse.planCode ?? null };
  }
  return { allowed: true, reason: 'entitled' };
}

/**
 * Convenience wrapper: probe + decide. Resolves to the decision object.
 */
export async function checkAccess({ fetchImpl = globalThis.fetch, token = getAuthToken() } = {}) {
  const entitlementResponse = await fetchEntitlements({ fetchImpl, token });
  return decideAccess({ token, entitlementResponse });
}
