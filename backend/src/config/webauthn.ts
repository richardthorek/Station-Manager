/**
 * WebAuthn (passkey) relying-party configuration.
 *
 * The RP ID is the shared parent domain — the same one COOKIE_DOMAIN uses for
 * the suite SSO cookie (e.g. `stationkit.com.au`, no leading dot). Because a
 * WebAuthn credential's RP ID may be any registrable-domain suffix of the
 * calling origin, a single RP ID here lets a passkey registered on Station
 * Manager be used to sign in directly from Fire Santa Run or Fire Break
 * Calculator's own login screens too — no redirect or iframe needed, each
 * app's page just runs the ceremony itself against this same RP ID.
 *
 * Expected origins reuse the suite's existing CORS allowlist
 * (utils/allowedOrigins.ts) — the exact set of origins already trusted to
 * call this API is also the exact set WebAuthn should accept ceremonies from.
 */

import type { Request } from 'express';
import { allowedOriginsList } from '../utils/allowedOrigins';

function configuredRpId(): string | null {
  const explicit = (process.env.WEBAUTHN_RP_ID || '').trim();
  if (explicit) return explicit;
  const cookieDomain = (process.env.COOKIE_DOMAIN || '').trim();
  if (cookieDomain) return cookieDomain.replace(/^\./, '');
  return null;
}

export const WEBAUTHN_RP_NAME = (process.env.WEBAUTHN_RP_NAME || 'StationKit').trim();

/**
 * Resolve the RP ID to use for a given request. Prefers the explicit
 * WEBAUTHN_RP_ID / COOKIE_DOMAIN config — required for cross-app passkey
 * sign-in, since it must be the shared parent domain rather than any one
 * app's own host (see docs/wiki/developer/authentication.md). When neither is
 * set, falls back to the request's own hostname (via Express's `req.hostname`,
 * which honours `X-Forwarded-Host` — trust proxy is enabled in index.ts) so a
 * deployment that hasn't configured either still gets working same-app
 * passkeys instead of a browser-side "RP ID 'localhost' is invalid for this
 * domain" failure on every non-localhost origin.
 */
export function resolveRpId(req: Request): string {
  return configuredRpId() || req.hostname || 'localhost';
}

/** Origins WebAuthn ceremonies are trusted to have run on. */
export function expectedOrigins(): string[] {
  return allowedOriginsList;
}
