/**
 * Single source of truth for the JWT signing secret.
 *
 * In production, boots refuse to start without a real `JWT_SECRET` — see the
 * fail-fast check in `index.ts`. The dev fallback below only ever runs in
 * non-production environments (local dev, tests).
 */

const DEV_FALLBACK_SECRET = 'dev-secret-change-in-production';

export const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

export function isJwtSecretUnconfigured(): boolean {
  return !process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_FALLBACK_SECRET;
}
