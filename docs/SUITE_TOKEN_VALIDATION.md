# Bushie Tools — Suite Token Validation Protocol (Phase 1)

**Status:** Implemented (suite Phase 1 — federation). See issue #556 and the
Consolidation & Standardisation Roadmap (Suite convergence track) in
`docs/MASTER_PLAN.md`; design history in `docs/archive/SUITE_INTEGRATION_PLAN.md`
(Option A / Phase 1).

This document is the contract sibling Bushie Tools apps (Fire Santa Run, Fire
Break Calculator, and the AAR Studio sub-app) follow to authenticate a user and
read their entitlements against Station Manager, which acts as the canonical
**Subscription / Licensing service** for the suite.

The model: **Station Manager's JWT is the suite identity provider (IdP).** A
single sign-in mints a token; every app validates that same token and reads the
same entitlements. (Microsoft Entra External ID was considered for authN — see
`archive/SUITE_INTEGRATION_PLAN.md` §5 — but SM JWT is retained because kiosk/station
iPad devices authenticate with brigade access tokens rather than user accounts,
a scenario the existing JWT/brigade-token model already supports without an
external IdP.)

---

## 1. Endpoints

All endpoints are served by the Station Manager backend under `/api`.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | none | Exchange username/password for a JWT. |
| `GET /api/auth/me` | Bearer JWT | Full identity + organization + entitlements payload. |
| `GET /api/auth/entitlements` | Bearer JWT | **Lightweight** entitlements probe for sibling apps. |

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

## 2. The per-app entitlement flags

Each suite app is gated by a dedicated boolean on `Entitlements`
(`backend/src/types/index.ts`, mirrored in `frontend/src/contexts/AuthContext.tsx`):

| Flag | App | Default plan that grants it |
|---|---|---|
| `aarStudioEnabled` | AAR Studio (`/aar`) | AI Pro |
| `santaRunEnabled` | Fire Santa Run | reserved (no plan grants it yet) |
| `fireBreakEnabled` | Fire Break Calculator | reserved (no plan grants it yet) |

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
`gatewayAuthHeader()`). Cross-origin sibling apps obtain the token through the
SSO redirect flow (Phase 2) and store it under the same key for consistency.

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
2. Confirm the app sends `Authorization: Bearer <token>` (not cookies) so the
   request is a simple credential-less CORS request.

---

## 5. Sequence

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

---

## 6. Related

- `docs/MASTER_PLAN.md` — the single plan (Consolidation & Standardisation Roadmap).
- `docs/archive/SUITE_INTEGRATION_PLAN.md` — full options analysis (design history).
- `docs/archive/SAAS_COMMERCIALIZATION_DESIGN.md` — Organization / plan / Stripe model (design history).
- `backend/src/routes/auth.ts` — `GET /api/auth/entitlements` implementation.
- `backend/src/constants/plans.ts` — plan → entitlement mapping.
- `frontend/src/config/suiteApps.ts` — the launcher's sibling-app catalog.
