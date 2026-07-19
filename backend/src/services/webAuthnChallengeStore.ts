/**
 * Short-lived, single-use challenge storage for WebAuthn ceremonies.
 *
 * A registration or authentication ceremony is two round-trips: the server
 * hands out a random challenge (`.../options`), the browser signs it with the
 * authenticator, and the server verifies the signature matches (`.../verify`).
 * The challenge has to be held server-side between those two calls — this is
 * a plain in-memory Map with a short TTL, which is fine for a single-instance
 * deployment (Station Manager runs on one Azure App Service instance, not a
 * pool) and matches the suite's existing in-memory caching pattern (e.g.
 * suiteAuthService's 60s token cache in the sibling apps).
 *
 * Registration ceremonies are keyed by the authenticated user's id (only one
 * can be in flight at a time). Login ceremonies have no authenticated user
 * yet, so they're keyed by an opaque, randomly-generated flow id that the
 * client round-trips.
 */

import { randomUUID } from 'crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
}

const registrationChallenges = new Map<string, ChallengeEntry>();
const loginChallenges = new Map<string, ChallengeEntry>();

function prune(store: Map<string, ChallengeEntry>): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function storeRegistrationChallenge(userId: string, challenge: string): void {
  prune(registrationChallenges);
  registrationChallenges.set(userId, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

/** Consumes (deletes) the challenge so it can't be replayed. */
export function takeRegistrationChallenge(userId: string): string | null {
  const entry = registrationChallenges.get(userId);
  registrationChallenges.delete(userId);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.challenge;
}

/** Returns a new opaque flow id the client must send back with the assertion. */
export function storeLoginChallenge(challenge: string): string {
  prune(loginChallenges);
  const flowId = randomUUID();
  loginChallenges.set(flowId, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return flowId;
}

/** Consumes (deletes) the challenge so it can't be replayed. */
export function takeLoginChallenge(flowId: string): string | null {
  const entry = loginChallenges.get(flowId);
  loginChallenges.delete(flowId);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.challenge;
}

/** Test seam: clear all in-flight challenges. */
export function _clearWebAuthnChallenges(): void {
  registrationChallenges.clear();
  loginChallenges.clear();
}
