/**
 * CORS allowed-headers list, shared by the Express CORS config in index.ts.
 *
 * Kept in its own module so the list is unit-testable without needing the
 * whole app (index.ts self-executes `httpServer.listen()` at import time).
 * Must include every custom header `frontend/src/services/api.ts`'s
 * `getHeaders()` sends: Authorization (JWT), X-Station-Id, X-Brigade-Token
 * (kiosk/device credential), X-Member-Session (AC-1). Missing one here is
 * invisible in prod (single origin, no preflight) but silently breaks any
 * cross-origin caller using that credential — found while verifying AC-3's
 * share-link flow against a cross-origin dev setup.
 */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Station-Id',
  'X-Request-ID',
  'X-Brigade-Token',
  'X-Member-Session',
];
