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

import { allowedOriginsList } from '../utils/allowedOrigins';

function deriveDefaultRpId(): string {
  const cookieDomain = (process.env.COOKIE_DOMAIN || '').trim();
  if (cookieDomain) return cookieDomain.replace(/^\./, '');
  return 'localhost';
}

export const WEBAUTHN_RP_ID = (process.env.WEBAUTHN_RP_ID || deriveDefaultRpId()).trim();
export const WEBAUTHN_RP_NAME = (process.env.WEBAUTHN_RP_NAME || 'StationKit').trim();

/** Origins WebAuthn ceremonies are trusted to have run on. */
export function expectedOrigins(): string[] {
  return allowedOriginsList;
}
