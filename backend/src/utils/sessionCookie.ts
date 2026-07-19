/**
 * Suite-wide SSO session cookie.
 *
 * Station Manager is the suite identity provider: signing in here sets an
 * httpOnly cookie scoped to the parent domain (COOKIE_DOMAIN, e.g.
 * `.stationkit.com.au`) so every *.stationkit.com.au sibling app (Fire Santa
 * Run, Fire Break Calculator) sees the same signed-in session without a
 * redirect. The cookie only ever carries a caller to GET /api/auth/session,
 * which hands back identity/entitlements + a fresh bearer token — mutating
 * requests still authorise with `Authorization: Bearer <token>`, never the
 * cookie, so this needs no separate CSRF-token machinery. See
 * docs/wiki/developer/suite-token-validation.md.
 *
 * No cookie-parser dependency: Express's `res.cookie()`/`res.clearCookie()`
 * are built in, and reading back the one cookie this app cares about is a
 * few lines of manual parsing.
 */

import type { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'sk_session';

/** 24h — mirrors routes/auth.ts's default JWT_EXPIRY. */
const SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Parent domain the cookie is scoped to (e.g. `.stationkit.com.au`). Unset in local dev, where the cookie defaults to the exact request host. */
function cookieDomain(): string | undefined {
  const domain = (process.env.COOKIE_DOMAIN || '').trim();
  return domain || undefined;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    domain: cookieDomain(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    domain: cookieDomain(),
    path: '/',
  });
}

/** Read the session cookie's raw value from the request, if present. */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== SESSION_COOKIE_NAME) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}
