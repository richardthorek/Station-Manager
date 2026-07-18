# StationKit — Suite Token Validation Protocol (Phase 1 + Phase 2 SSO)

**Status:** Implemented — Phase 1 federation (issue #556) plus the Phase 2
cross-subdomain SSO cookie (§1a/§3a below), landed together with Fire Santa
Run's migration off Microsoft Entra External ID onto this contract. See the
Consolidation & Standardisation Roadmap (Suite convergence track) in
`docs/MASTER_PLAN.md`; design history in `docs/wiki/developer/history/archive/SUITE_INTEGRATION_PLAN.md`
(Option A / Phase 1).

This document is the contract sibling StationKit apps (Fire Santa Run, Fire
Break Calculator, and the AAR Studio sub-app) follow to authenticate a user and
read their entitlements against Station Manager, which acts as the canonical
**Subscription / Licensing service** for the suite.

The model: **Station Manager's JWT is the suite identity provider (IdP).** A
single sign-in mints a token; every app validates that same token and reads the
same entitlements. (Microsoft Entra External ID was considered for authN — see
`archive/SUITE_INTEGRATION_PLAN.md` §5 — but SM JWT is retained because kiosk/station
iPad devices authenticate with brigade access tokens rather than user accounts,
a scenario the existing JWT/brigade-token model already supports without an
external IdP. Fire Santa Run originally used Entra External ID independently;
it now speaks this same contract instead — see its own repo's changelog for
that migration.)

**Phase 2 adds cross-subdomain single sign-on.** Phase 1's token lives in
per-origin `localStorage` (`auth_token`), which cannot cross the
`*.stationkit.com.au` subdomains each sibling app is deployed to. Phase 2
layers a shared parent-domain cookie on top — described in §1a/§3a — so signing
in on one StationKit app signs a user in on every sibling app with no redirect.
The Phase 1 bearer-token contract (§1–§4 below) is unchanged and still does all
the actual authorisation; the cookie only ever bootstraps a session.

---

## 1. Endpoints

All endpoints are served by the Station Manager backend under `/api`.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | none | Exchange username/password for a JWT. Also sets the `sk_session` SSO cookie (§1a). |
| `GET /api/auth/me` | Bearer JWT | Full identity + organization + entitlements payload. |
| `GET /api/auth/entitlements` | Bearer JWT | **Lightweight** entitlements probe for sibling apps. |
| `GET /api/auth/session` | `sk_session` cookie | **Phase 2 SSO bootstrap.** Same payload as `/me` plus a fresh bearer token — see §1a. |

Sibling apps that only need to gate features should call
`GET /api/auth/entitlements` — it returns just what authorization needs and
avoids coupling to the larger `/auth/me` user shape.

### `GET /api/auth/entitlements`

**Request**

```http
GET /api/auth/entitlements
Authorization: Bearer <SM-issued JWT>
```

**Response `200`**

```json
{
  "entitlements": {
    "signInEnabled": true,
    "truckCheckEnabled": true,
    "reportsEnabled": true,
    "aiEnabled": true,
    "aarStudioEnabled": true,
    "santaRunEnabled": false,
    "fireBreakEnabled": false,
    "maxStations": 20,
    "maxDevices": 25,
    "aiIncludedSessions": 25
  },
  "planCode": "ai",
  "status": "active"
}
```

`entitlements` and `planCode` are `null` when the authenticated user has no
associated organization (single-tenant / kiosk / back-compat). A sibling app
should treat a `null` entitlements payload according to its own policy — for a
public tool like Fire Break Calculator, "no org" can still mean "allowed".

**Response `401`** — missing, malformed, or expired token.

---

## 1a. Cross-subdomain SSO — `GET /api/auth/session`

Every StationKit app lives on its own `*.stationkit.com.au` subdomain, so
Phase 1's `auth_token` (per-origin `localStorage`) can't carry a session
between them. Phase 2 adds an httpOnly cookie scoped to the **parent** domain:

1. `POST /api/auth/{login,signup,switch-org}` set an `sk_session` cookie —
   `Domain=.stationkit.com.au; HttpOnly; Secure; SameSite=Lax` — in addition to
   returning the JWT in the response body (unchanged, Phase 1 callers are
   unaffected). `POST /api/auth/logout` clears it.
2. A sibling app calls `GET /api/auth/session` once on load with
   `credentials: 'include'`. If the cookie is present and its JWT still
   verifies, the response is the same identity/organization/entitlements shape
   as `GET /api/auth/me`, **plus a freshly-issued `token`** field:

   ```http
   GET /api/auth/session
   Cookie: sk_session=<JWT>
   ```

   ```json
   {
     "id": "u_123", "username": "cap.smith", "role": "owner",
     "organizationId": "org_abc",
     "organization": { "...": "..." },
     "entitlements": { "santaRunEnabled": true, "...": "..." },
     "memberships": [ /* ... */ ],
     "token": "<fresh JWT>"
   }
   ```

   `401` when there's no cookie, or it's invalid/expired (the cookie is
   cleared server-side in the latter case).
3. The sibling app holds the returned `token` in memory (or its own storage
   convention — see below) and sends `Authorization: Bearer <token>` on every
   subsequent API/WS call, exactly as in Phase 1. **The cookie itself never
   authorises a mutation** — it only ever bootstraps a `GET` that hands back a
   bearer token — so this needs no separate CSRF-token machinery; a
   cross-site attacker cannot forge the `Authorization` header a mutating
   request requires.

Local dev note: cookies don't cleanly cross `localhost:5173` ↔ `:3000`
(different ports on the same host, and `COOKIE_DOMAIN` is normally unset in
dev), so `VITE_DEV_MODE`'s existing auth bypass remains the dev-loop path —
Phase 2 SSO is a production/staging concern.

---

## 2. The per-app entitlement flags

Each suite app is gated by a dedicated boolean on `Entitlements`
(`backend/src/types/index.ts`, mirrored in `frontend/src/contexts/AuthContext.tsx`):

| Flag | App | Default plan that grants it |
|---|---|---|
| `aarStudioEnabled` | AAR Studio (`/aar`) | AI Pro |
| `santaRunEnabled` | Fire Santa Run | Basic and AI Pro (bundled); Community orgs can buy it standalone — `POST /api/billing/santa-addon/checkout`, see `services/santaAddonService.ts` |
| `fireBreakEnabled` | Fire Break Calculator | Basic and AI Pro |

Plan → entitlement mapping lives in `backend/src/constants/plans.ts`.
`clampEntitlements()` guarantees an owner override can never enable a flag the
plan does not include. When a new suite plan/tier is introduced, set these flags
there — sibling apps need no change.

---

## 3. How a sibling app validates a token

A sibling app does **not** need the JWT signing secret. It validates by calling
the entitlements endpoint and trusting the result:

```ts
async function loadEntitlements(token: string) {
  const res = await fetch('https://<station-manager-host>/api/auth/entitlements', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;          // not signed in / expired
  if (!res.ok) throw new Error('entitlements unavailable');
  return res.json();                            // { entitlements, planCode, status }
}
```

Then gate on the app's own flag:

```ts
const data = await loadEntitlements(token);
if (!data?.entitlements?.santaRunEnabled) {
  // show an upgrade prompt / redirect to the suite portal
}
```

**Offline / strict-verification variant.** An app that must verify the token
without a network round-trip (e.g. an Azure Function gating a write) can verify
the JWT signature directly using the shared `JWT_SECRET` and read the
`organizationId` claim, then resolve entitlements from its own cache. Phase 1
apps should prefer the endpoint call; signature verification is an optimization,
not the contract.

### Token storage convention

The SM frontend stores the JWT in `localStorage` under the key **`auth_token`**.
Same-origin sub-apps (AAR Studio at `/aar`) read it directly — this is exactly
how the AAR Studio AI gateway authenticates (`aar-studio/js/lib/llm.js`
`gatewayAuthHeader()`). Cross-origin sibling apps get the token via the SSO
cookie bootstrap (§1a) instead of a redirect — call `GET /api/auth/session`
with `credentials: 'include'` on load and hold the returned `token` for the
session (in memory, or the same `auth_token` key for consistency); either way,
falling back to a stored Phase 1 token when the cookie bootstrap 401s (e.g. the
cookie hasn't propagated yet, or local dev) keeps both phases working
side-by-side.

---

## 4. CORS

In Phase 1 the same-origin sub-app (`/aar`) needs no extra CORS configuration —
it shares Station Manager's origin. Cross-origin sibling apps on their own
domains must have those origins present in the backend's `FRONTEND_URLS`
environment variable, which feeds the single `allowedOriginsList` used by both
Express and Socket.io (`backend/src/index.ts`). The origin callback denies
unknown origins without throwing (`callback(null, false)`) so same-origin asset
requests are never 500'd — see the CORS seam note in `CLAUDE.md`.

When onboarding a sibling app domain:

1. Add the domain to `FRONTEND_URLS` (App Service / Bicep setting).
2. Confirm the app sends `Authorization: Bearer <token>` for all API/WS calls
   (Phase 1, unchanged) so most requests are simple credential-less CORS
   requests.
3. **Phase 2 only:** the `GET /api/auth/session` call needs
   `credentials: 'include'` (to send the cookie) — CORS already allows this,
   since `cors()` is configured with `credentials: true` against the same
   explicit origin allow-list (never `*`, which the `credentials: true` +
   cookie combination forbids browsers from accepting anyway). Also set
   `COOKIE_DOMAIN=.stationkit.com.au` (or the deployment's parent domain) so
   the `sk_session` cookie is actually visible to the new subdomain — an
   unset `COOKIE_DOMAIN` scopes the cookie to the exact issuing host only.

---

## 5. Sequence

**Phase 1 — bearer token carried explicitly:**

```
User ──login──▶ Station Manager  ──JWT──▶ User (stored as auth_token)
                                   │
Sibling app ◀──token─────────────┘
   │
   └─ GET /api/auth/entitlements (Bearer token)
        └─▶ SM verifies JWT, resolves Organization, returns entitlements
   │
   └─ gate UI on entitlements.<appFlag>
```

**Phase 2 — cross-subdomain SSO, no manual token hand-off:**

```
User ──login──▶ stationkit.com.au (IdP)
                    │
                    └─ Set-Cookie: sk_session=<JWT>; Domain=.stationkit.com.au;
                       HttpOnly; Secure; SameSite=Lax
                    (visible to every *.stationkit.com.au app from here on)

User ──opens──▶ santa.stationkit.com.au
                    │
                    └─ GET /api/auth/session (credentials: 'include')
                         └─▶ stationkit.com.au verifies the cookie's JWT,
                             returns { user, organization, entitlements, token }
                    │
                    └─ gate UI on entitlements.santaRunEnabled
                    └─ hold `token`; send Authorization: Bearer <token> on
                       every subsequent API/WS call (Phase 1 contract, unchanged)
```

---

## 6. Related

- `docs/MASTER_PLAN.md` — the single plan (Consolidation & Standardisation Roadmap).
- `docs/wiki/developer/history/archive/SUITE_INTEGRATION_PLAN.md` — full options analysis (design history).
- `docs/wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md` — Organization / plan / Stripe model (design history).
- `backend/src/routes/auth.ts` — `GET /api/auth/{me,entitlements,session}` implementation.
- `backend/src/utils/sessionCookie.ts` — the `sk_session` cookie (set/clear/read).
- `backend/src/constants/plans.ts` — plan → entitlement mapping.
- `backend/src/services/santaAddonService.ts` — standalone Santa Run add-on → effective entitlements.
- `backend/src/routes/billing.ts` — `POST /api/billing/santa-addon/checkout` + its webhook handling.
- `frontend/src/config/suiteApps.ts` — the launcher's sibling-app catalog.
