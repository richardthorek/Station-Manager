# API Documentation

This document provides detailed information about the RFS Station Manager REST API and WebSocket events.

## Base URL

**Development**: `http://localhost:3000`
**Production**: `https://your-app.azurewebsites.net`

All API endpoints are prefixed with `/api`.

## Authentication

The API uses **JWT bearer tokens** for authenticated operations. A token is
obtained from `POST /api/auth/login` (or `POST /api/auth/signup`) and presented
on subsequent requests via the `Authorization: Bearer <token>` header.

```http
Authorization: Bearer <JWT>
```

### What the token carries

JWTs are signed with `JWT_SECRET` and include the following claims: `userId`,
`username`, `role` (`owner | admin | viewer`) and `organizationId`. The
`organizationId` claim scopes the caller to a SaaS **organization** (the billing
tenant) and drives feature gating. `role` is the caller's role **within that
active org** — a user can belong to multiple organizations (`OrganizationMembership`
rows) with a different role in each; `POST /api/auth/switch-org` re-issues the
JWT for a different org the user belongs to. Legacy single-org users (only
`AdminUser.organizationId` + a global role, no membership row yet) are
supported transparently via lazy migration (`services/orgMembershipService.ts`).

### Auth modes (environment-driven)

- **`REQUIRE_AUTH`** — when `true`, admin/management endpoints require a valid
  token (and a default admin must be provisioned via `DEFAULT_ADMIN_USERNAME` /
  `DEFAULT_ADMIN_PASSWORD`). When unset/`false`, kiosk and single-tenant flows
  remain open for backward compatibility. `GET /api/auth/config` reports the
  current value to clients.
- **`ENABLE_ENTITLEMENTS`** — feature gating is **on by default**; set to
  `false` only for local dev/test. When enabled, the authenticated org's plan
  and module toggles decide which feature modules are reachable (see *Feature
  Entitlements & Gating* below). **Requests with no organization context**
  (kiosk, demo station, plain JWT with no `organizationId`) always pass the gate
  — those paths rely on the existing auth/data-protection layers instead.

### Roles

- `owner` — full control of the organization, including plan/billing and user
  management.
- `admin` — manage users within the organization.
- `viewer` — read-oriented access.

Kiosk devices authenticate with **brigade access tokens** rather than user
accounts (handled by `kioskModeMiddleware` / `brigadeAccess` routes), which is
why the JWT/brigade-token model is retained rather than an external IdP.

## Feature Entitlements & Gating

Organizations carry an `Entitlements` object derived from their plan
(`community | basic | ai`). Feature-gated route groups are wrapped with the
`requireFeature(<flag>)` middleware in `index.ts`; when entitlements are enabled
and the caller has org context, a missing flag returns **`403`** with
`{ error, feature, planCode, upgradeRequired: true }`.

| Route group | Required entitlement |
|---|---|
| `/api/checkins`, `/api/events` | `signInEnabled` |
| `/api/truck-checks` | `truckCheckEnabled` |
| `/api/reports`, `/api/export` | `reportsEnabled` |
| `/api/ai/*` | `aiEnabled` |

`/api/members`, `/api/activities`, `/api/stations`, `/api/brigade-access`,
`/api/achievements`, `/api/auth`, `/api/organizations` and `/api/billing` are
**not** feature-gated (auth/role checks apply where noted on individual
endpoints).

The `Entitlements` shape also includes limits (`maxStations`, `maxDevices`,
`aiIncludedSessions`) and per-app suite flags (`aarStudioEnabled`,
`santaRunEnabled`, `fireBreakEnabled`) used by sibling StationKit apps. See
`docs/wiki/developer/suite-token-validation.md` for the entitlements-probe contract.

## Input Validation and Security

All API endpoints implement comprehensive input validation and sanitization to protect against XSS attacks, injection attacks, and invalid data.

### Validation Features

- **HTML Escaping**: All text inputs are automatically escaped to prevent XSS attacks. HTML tags and special characters are converted to HTML entities (e.g., `<` becomes `&lt;`)
- **Type Validation**: Fields are validated for correct data types (string, boolean, number)
- **Length Validation**: Maximum and minimum length constraints are enforced
- **Pattern Validation**: Name fields accept only letters, spaces, hyphens, and apostrophes
- **Enum Validation**: Fields with predefined values are validated against allowed options
- **Whitespace Trimming**: Leading and trailing whitespace is automatically removed

### Error Response Format

When validation fails, the API returns a `400 Bad Request` response with detailed error information:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Name must be between 1 and 200 characters",
      "value": ""
    }
  ]
}
```

### Common Validation Rules

#### String Fields
- Must be valid strings (not numbers, objects, or arrays)
- Automatically trimmed and HTML-escaped
- Subject to length constraints (see specific endpoints)

#### Name Fields (firstName, lastName, preferredName)
- Pattern: Only letters, spaces, hyphens (-), and apostrophes (')
- Length: 1-100 characters
- Examples: `John`, `O'Brien`, `Mary-Jane`, `De La Cruz`

#### Method Fields
- Allowed values: `kiosk`, `mobile`, `qr`, `manual`
- Case-sensitive

#### Boolean Fields (isOffsite, etc.)
- Must be boolean type: `true` or `false`
- Strings like `"true"` or `"yes"` are NOT accepted

## REST API Endpoints

### Health Check

#### `GET /health`

Check if the server is running.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-11-14T12:00:00.000Z"
}
```

---

## Authentication & Account

JWT-based authentication and self-service SaaS sign-up. Tokens are signed with
`JWT_SECRET` and expire per `JWT_EXPIRY` (default `24h`). All requests are
rate-limited; login/signup additionally use `sensitiveActionRateLimiter`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/signup` | none | Create a new organization (free Community plan) + its first owner, claiming an emergency-services facility; returns a JWT. |
| `POST` | `/api/auth/login` | none | Exchange username/password for a JWT (resolves the default active org from memberships). |
| `POST` | `/api/auth/logout` | none | Client-side logout (token discarded by client; logged for audit). |
| `GET` | `/api/auth/me` | Bearer | Current user + resolved organization + entitlements + all active org memberships. |
| `GET` | `/api/auth/entitlements` | Bearer | Lightweight entitlements probe for sibling apps. |
| `PUT` | `/api/auth/profile` | Bearer | Update the caller's own email (legacy-account backfill). |
| `POST` | `/api/auth/switch-org` | Bearer | Re-issue the JWT scoped to a different org the caller belongs to (multi-org). |
| `GET` | `/api/auth/config` | none | Reports `{ requireAuth }` (whether `REQUIRE_AUTH=true`). |
| `GET` | `/api/auth/session` | `sk_session` cookie | Suite SSO bootstrap — same shape as `/me` plus a fresh `token`. See `suite-token-validation.md` §1a. |
| `POST` | `/api/auth/passkey/register/options` | Bearer | Start a passkey registration ceremony (account settings only). |
| `POST` | `/api/auth/passkey/register/verify` | Bearer | Verify the attestation and store the new passkey. |
| `POST` | `/api/auth/passkey/login/options` | none | Start a passwordless sign-in ceremony; usable from any suite app. |
| `POST` | `/api/auth/passkey/login/verify` | none | Verify the assertion; on success behaves exactly like `/login` (token + `sk_session` cookie). |
| `GET` | `/api/auth/passkey/credentials` | Bearer | List the caller's own registered passkeys. |
| `DELETE` | `/api/auth/passkey/credentials/:id` | Bearer | Remove one of the caller's own passkeys. |

### `POST /api/auth/signup`

**Request Body** — `email` and `facility` are required by the frontend (a
`facility`-less request is tolerated for back-compat API callers and creates
an unlinked/custom org):
```json
{
  "organizationName": "Bungendore RFS",
  "billingEmail": "captain@example.org",
  "username": "captain",
  "password": "min-8-chars",
  "email": "captain@example.org",
  "facility": { "facilityKey": "rural-fire:4711" }
}
```
`facility` is either `{ "facilityKey": "<serviceType>:<objectid>" }` — claims a
Digital Atlas of Australia emergency-services facility, **first-come-first-served**
— or `{ "custom": { "name", "serviceType", "suburb"?, "state"?, "postcode"? } }`
for an unlisted unit (no review needed).

**Response** (201 Created): `{ "token": "...", "user": { id, username, role, organizationId, email }, "organization": { ..., facilityKey, facilityName, facilityCustom } }`

**Errors**: `400` (missing/invalid fields, unknown `facilityKey`, missing custom
facility details), `409` (username taken, **or** `code: "FACILITY_ALREADY_CLAIMED"`
when the facility is already claimed — a `ClaimConflict` is recorded for the
platform admin and the message is the exact copy the frontend renders: *"This
facility has already been claimed by another organisation. Discuss with your
brigade members to get an invite link, or contact support — we've flagged this
for review."*), `503` (facility dataset snapshot not loaded).

### `POST /api/auth/login`

**Request Body**: `{ "username": "captain", "password": "..." }`

**Response** (200 OK): `{ "token": "...", "user": { id, username, role, organizationId, email, lastLoginAt } }`
— `role`/`organizationId` reflect the user's default active org (their
`AdminUser.organizationId` if still a member, else their first active
membership).

**Errors**: `400` (missing fields), `401` (invalid credentials).

### `GET /api/auth/me`

**Auth**: Bearer JWT.
**Response** (200 OK): `{ id, username, role, organizationId, email, lastLoginAt, organization, entitlements, memberships, isPlatformAdmin }`
(`organization`/`entitlements` are `null` when the user has no org context;
`email` is `null` for legacy accounts.) `memberships` is
`[{ organizationId, organizationName, role }]` for every org the user actively
belongs to (multi-org). **This is a suite contract** — Fire Break Calculator
reads `id`/`username`/`organizationId`/`organization.planCode`/`entitlements.fireBreakEnabled`;
all additions here are additive and must stay that way.

### `GET /api/auth/entitlements`

**Auth**: Bearer JWT.
**Response** (200 OK): `{ entitlements, planCode, status }`
(`entitlements`/`planCode` are `null` for users with no organization.) See
`docs/wiki/developer/suite-token-validation.md` for the full sibling-app contract.

### `PUT /api/auth/profile`

**Auth**: Bearer JWT. **Request Body**: `{ "email": "you@example.com" }`.
**Response** (200 OK): `{ "user": { id, username, role, organizationId, email } }`.
**Errors**: `400` (invalid email).

### `POST /api/auth/switch-org`

**Auth**: Bearer JWT. **Request Body**: `{ "organizationId": "..." }`.
Verifies an active membership in the target org, then re-issues the JWT with
that org + the membership's role — `attachOrganization` and every suite
consumer keep reading the same claim shape.
**Response** (200 OK): `{ "token": "...", "user": { ... }, "organization": { ... } }`.
**Errors**: `403` (not a member of that org), `404` (org not found).

### `GET /api/auth/session`

**Auth**: `sk_session` httpOnly cookie (no `Authorization` header). Called by
sibling apps with `credentials: 'include'` to silently resume a Station
Manager sign-in. **Response** (200 OK): identical shape to `GET /api/auth/me`
plus a freshly-issued `token`. **Errors**: `401` (no cookie, or invalid/expired
— cleared server-side in the latter case), `404` (user not found). Full
contract: `suite-token-validation.md` §1a.

### Passkeys (WebAuthn)

Additive to username/password — never a replacement. Registration is
Station-Manager-only (account settings); **sign-in is usable from any suite
app's own login screen**, because the Relying Party ID is the shared parent
domain the SSO cookie uses. Full contract, including why a sibling app can run
the ceremony on its own page: `suite-token-validation.md` §1b.

#### `POST /api/auth/passkey/register/options`

**Auth**: Bearer JWT. Returns a WebAuthn `PublicKeyCredentialCreationOptionsJSON`
(rp = `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`, `excludeCredentials` = the caller's
existing passkeys) and stores the challenge server-side keyed by the caller's
user id.

#### `POST /api/auth/passkey/register/verify`

**Auth**: Bearer JWT. **Request Body**: `{ "response": RegistrationResponseJSON, "name"?: "My Laptop" }`.
Verifies the attestation against the stored challenge and, on success, saves
the new passkey. **Response** (201 Created): `{ "verified": true }`.
**Errors**: `400` (registration session expired, or attestation not verified).

#### `POST /api/auth/passkey/login/options`

**Auth**: none (public). No `allowCredentials` is set — the browser's own
picker shows every passkey it holds for `WEBAUTHN_RP_ID`, no username needed.
**Response** (200 OK): `{ "flowId": "...", "options": PublicKeyCredentialRequestOptionsJSON }`.

#### `POST /api/auth/passkey/login/verify`

**Auth**: none (public). **Request Body**: `{ "flowId": "...", "response": AuthenticationResponseJSON }`.
Verifies the assertion, resolves the credential's owning user, bumps its
signature counter, and completes sign-in exactly like `POST /api/auth/login`.
**Response** (200 OK): `{ "token": "...", "user": { ... } }` (also sets the
`sk_session` cookie). **Errors**: `400` (missing fields, or the sign-in
session expired/was already used — the challenge is single-use), `401`
(credential not recognised, verification failed, or the account is inactive).

#### `GET /api/auth/passkey/credentials`

**Auth**: Bearer JWT. **Response** (200 OK): `[{ id, name, deviceType, createdAt, lastUsedAt }]` — never the public key.

#### `DELETE /api/auth/passkey/credentials/:id`

**Auth**: Bearer JWT. Scoped to the caller. **Response**: `204`. **Errors**:
`404` (not found, or owned by a different user — deliberately not `403`, so as
not to confirm which ids exist).

---

## Organizations (SaaS Tenant Management)

Manage the organization (billing tenant), its plan/module toggles, its users,
invite links, and multi-org memberships. All endpoints require a Bearer JWT.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/organizations/current` | any member | Current org + entitlements + plan catalog. |
| `PUT` | `/api/organizations/current` | owner | Update name/email/plan/module toggles/branding (agency name + logo). |
| `GET` | `/api/organizations/current/users` | admin/owner | List users in the org (legacy; superseded by `.../members`). |
| `POST` | `/api/organizations/current/users` | admin/owner | Create a user directly in the org (now accepts `email`). |
| `POST` | `/api/organizations/current/invites` | admin/owner | Create a multi-use invite link (default 7-day expiry). |
| `GET` | `/api/organizations/current/invites` | admin/owner | List invite links for the org. |
| `DELETE` | `/api/organizations/current/invites/:id` | admin/owner | Revoke an invite link. |
| `GET` | `/api/organizations/current/members` | admin/owner | List members with their per-org role (multi-org). |
| `PUT` | `/api/organizations/current/members/:userId` | any | Change a member's role (rules-gated; last owner protected). |
| `DELETE` | `/api/organizations/current/members/:userId` | any | Remove a member, or leave (rules-gated; last owner protected). |

### `GET /api/organizations/current`

**Response** (200 OK): `{ "organization": { ... }, "plans": [PlanDefinition, ...] }`
**Errors**: `400` (no org on account), `404` (org not found).

### `PUT /api/organizations/current` (owner)

**Request Body** (all optional):
```json
{
  "name": "New Name",
  "billingEmail": "billing@example.org",
  "planCode": "basic",
  "moduleToggles": {
    "signInEnabled": true,
    "truckCheckEnabled": true,
    "reportsEnabled": false,
    "aiEnabled": false
  },
  "agencyName": "NSW Rural Fire Service",
  "agencyLogoUrl": "https://example.org/logo.png"
}
```
Changing `planCode` resets entitlements to the plan defaults. `moduleToggles`
may only **disable** modules; values are clamped to the plan ceiling
(`clampEntitlements`). `agencyName`/`agencyLogoUrl` are admin-configurable
branding shown on exported reports in place of the generic "Station Manager"
name — defaulted at signup from the claimed facility's service type (see
`FACILITY_SERVICE_TYPE_LABELS`), editable any time from Admin → Organization;
an empty string clears the override. Both are capped at 100/500 chars
respectively. **Response**: `{ "organization": { ... } }`.
**Errors**: `400` (invalid `planCode`, or `agencyName`/`agencyLogoUrl` not a
string within the length limit), `404` (org not found).

### `POST /api/organizations/current/users` (admin/owner)

**Request Body**: `{ "username": "...", "password": "min-8-chars", "role": "admin|viewer|owner", "email"?: "..." }`
Only an `owner` may create another `owner`. Also writes an `OrganizationMembership`
row. **Response** (201): `{ "user": { id, username, role, organizationId, email } }`.
**Errors**: `400` (missing fields / short password), `403` (non-owner creating owner), `409` (username taken).

### `POST /api/organizations/current/invites` (admin/owner)

**Request Body**: `{ "role"?: "owner"|"admin"|"viewer", "email"?: "...", "expiresInDays"?: 1-30 }`
(default role `viewer`, default expiry 7 days). Role limits: owner may mint any
role; admin may mint admin/viewer; viewer cannot invite.
**Response** (201): `{ "invite": { ... }, "inviteUrl": "https://.../invite/<token>" }`.
**Errors**: `400` (`expiresInDays` out of range), `403` (role not permitted for the inviter).

### `GET` / `DELETE /api/organizations/current/invites` (admin/owner)

`GET` lists invites (each with a live `inviteUrl`); `DELETE /:id` revokes one.
Invite links are **multi-use** until expiry or revocation — meant to be pasted
into a brigade group chat.

### `GET /api/organizations/current/members` (admin/owner)

**Response** (200 OK): `{ "members": [{ userId, username, email, role, status, lastLoginAt, createdAt }] }`.
Legacy users (pre-dating the membership model) are lazily materialized into a
membership row on first read.

### `PUT` / `DELETE /api/organizations/current/members/:userId`

Change role or remove/leave. Enforced by `orgMembershipRules` (`canChangeRole`,
`canRemoveMember`, `violatesLastOwner`) — **an organization must always retain
at least one active owner**.
**Errors**: `403` (actor lacks permission, or the change would remove the last owner), `404` (member not in this org).

---

## Public Org-Invite Acceptance (`/api/org-invites`)

Mounted before any session gate — the invite link itself is the credential.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/org-invites/:token` | none | Preview: `{ organizationName, role, expiresAt }`. |
| `POST` | `/api/org-invites/:token/accept` | Bearer | Existing signed-in user joins the org. |
| `POST` | `/api/org-invites/:token/signup` | none | New account created directly into the org with the invite's role. |

`GET`/`accept` return `404` for an unknown token and `410` once expired/revoked;
`accept` returns `409` if already an active member. `signup` has the same
response shape as `POST /api/auth/signup` (`{ token, user, organization }`).

---

## Facility Lookup (`/api/facilities`)

Public, rate-limited — powers the signup facility-claim step. Backed by a
bundled snapshot of the Digital Atlas of Australia / Geoscience Australia
"Emergency Management Facilities" dataset (rural/country fire, metro fire,
SES, ambulance, police, other).

### `GET /api/facilities/lookup`

**Query params**: `q` (min 2 chars) and/or `lat`+`lon`; optional `serviceType`
(`rural-fire|metro-fire|ses|ambulance|police|other`), `state`, `limit` (max 50).
**Response** (200 OK): `{ "results": [{ facilityKey, serviceType, name, suburb, state, postcode, claimed, distance? }], "count" }`.
`claimed` is `true` when an Organization already holds that `facilityKey` — the
claiming org's identity is **never** exposed publicly.
**Errors**: `400` (no query/location, or invalid `serviceType`), `503`
(dataset snapshot not loaded — see `backend/src/scripts/README.md` for the
`facilities:fetch`/`facilities:upload` ops steps).

---

## Platform Administration (`/api/platform`)

Not per-org — this is for the operator of the whole deployment, gated by the
`PLATFORM_ADMIN_USERNAMES` env allowlist (comma-separated usernames), not org
role. Currently: facility claim-conflict review.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/platform/claim-conflicts?status=open\|resolved` | List claim conflicts. |
| `POST` | `/api/platform/claim-conflicts/:id/resolve` | Dismiss, mark contacted, or reassign the facility to another org. |

**Resolve body**: `{ "resolution": "dismissed"|"contacted"|"reassigned", "notes"?, "reassignToOrganizationId"? }`
(`reassignToOrganizationId` required for `reassigned` — clears the facility
link from the current holder, which becomes a custom/unlinked org, and sets it
on the target).
**Errors**: `403` (not a platform admin), `404` (conflict/target not found), `409` (already resolved).

---

## AI Gateway (`/api/ai`)

Server-side proxy for AI features so the browser never holds Azure credentials.
Gated behind the **`aiEnabled`** entitlement when org context is present and
entitlements are enabled (`403` otherwise). The monthly AI **session** allowance
(`aiIncludedSessions`) is enforced at the speech-token endpoint — one speech
token == one AAR session. Usage is recorded as `UsageRecord` rows for metered
billing; requests with no org context pass through but are not metered.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/ai/chat` | org context (gated `aiEnabled`) | Chat completion (live finding/metadata extraction). |
| `POST` | `/api/ai/report` | org context (gated `aiEnabled`) | Chat completion on the heavier report model. |
| `POST` | `/api/ai/speech/token` | org context (gated `aiEnabled` + allowance) | Vend a short-lived Azure Speech token (starts a session). |
| `GET` | `/api/ai/usage` | Bearer | This org's monthly AI session usage vs allowance. |

### `POST /api/ai/chat` and `POST /api/ai/report`

**Request Body**: `{ "messages": [ { "role": "...", "content": "..." } ], "responseFormat"?: {...}, "sessionId"?: "..." }`
**Response**: the Azure OpenAI chat-completion body, forwarded verbatim with the provider's status.
**Errors**: `400` (`messages` not an array), `403` (`aiEnabled` not on plan), `503` (AI not configured), `502` (provider unreachable).

### `POST /api/ai/speech/token`

**Response** (200 OK): `{ "token": "...", "region": "..." }`
**Errors**: `402` (monthly session allowance exhausted — includes `included`, `used`, `remaining`, `resetAt`, `upgradeRequired`), `403` (`aiEnabled` not on plan), `503` (Speech not configured).

### `GET /api/ai/usage`

**Auth**: Bearer JWT.
**Response** (200 OK): `{ used, included, remaining, resetAt, aiEnabled }`
**Errors**: `404` (no organization).

---

## Billing (`/api/billing`) — Stripe

Stripe subscription management. Configured via `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` and per-plan price env vars; endpoints return `503` when
Stripe is not configured. The webhook receives a **raw** request body
(`express.raw()` is registered for this path before `express.json()`).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/billing/checkout` | owner | Create a Stripe Checkout session for a plan upgrade. |
| `POST` | `/api/billing/portal` | owner | Create a Stripe Customer Portal session. |
| `GET` | `/api/billing/status` | Bearer | Current billing status for the org. |
| `POST` | `/api/billing/webhook` | none (Stripe signature) | Receive and process Stripe subscription/invoice events. |

### `POST /api/billing/checkout` (owner)

**Request Body**: `{ "planCode": "basic" | "ai", "billingInterval": "monthly" | "annual" }`
**Response** (200 OK): `{ "checkoutUrl": "https://checkout.stripe.com/..." }` (14-day trial applied).
**Errors**: `400` (invalid `planCode`/interval or no price configured), `404` (org not found), `503` (billing not configured).

### `POST /api/billing/portal` (owner)

**Response** (200 OK): `{ "portalUrl": "..." }`
**Errors**: `400` (no billing account yet), `404` (org not found), `503` (not configured).

### `GET /api/billing/status`

**Response** (200 OK): `{ planCode, status, trialEndsAt, hasPaymentMethod, stripeConfigured }`

### `POST /api/billing/webhook`

Verified by the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`.
Handles `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` —
updating the org's `planCode`/`status`/entitlements accordingly. Always returns
`{ "received": true }` after auditing, to prevent re-delivery. `400` on a failed
signature check.

---

## Members

### Get All Members

#### `GET /api/members`

Retrieve a list of all registered members, sorted alphabetically by name.

**Response** (200 OK):
```json
[
  {
    "id": "uuid-here",
    "name": "John Smith",
    "qrCode": "unique-qr-code",
    "createdAt": "2024-11-14T10:00:00.000Z",
    "updatedAt": "2024-11-14T10:00:00.000Z"
  }
]
```

### Get Member by ID

#### `GET /api/members/:id`

Retrieve a specific member by their ID.

**Parameters**:
- `id` (path): Member UUID

**Response** (200 OK):
```json
{
  "id": "uuid-here",
  "name": "John Smith",
  "qrCode": "unique-qr-code",
  "createdAt": "2024-11-14T10:00:00.000Z",
  "updatedAt": "2024-11-14T10:00:00.000Z"
}
```

**Errors**:
- `404`: Member not found

### Get Member by QR Code

#### `GET /api/members/qr/:qrCode`

Retrieve a member by their QR code.

**Parameters**:
- `qrCode` (path): Unique QR code string

**Response** (200 OK):
```json
{
  "id": "uuid-here",
  "name": "John Smith",
  "qrCode": "unique-qr-code",
  "createdAt": "2024-11-14T10:00:00.000Z",
  "updatedAt": "2024-11-14T10:00:00.000Z"
}
```

**Errors**:
- `404`: Member not found

### Create Member

#### `POST /api/members`

Register a new member. Automatically generates a unique QR code.

**Request Body**:
```json
{
  "name": "Jane Doe",
  "firstName": "Jane",  // optional
  "lastName": "Doe",    // optional
  "preferredName": "J", // optional
  "rank": "Captain",    // optional, max 100 chars
  "memberNumber": "12345" // optional, max 50 chars
}
```

**Validation Rules**:
- At least one of `name`, `firstName`, `preferredName`, or `lastName` must be provided
- `name`: 1-200 characters, string type, HTML-escaped
- `firstName`, `lastName`, `preferredName`: 1-100 characters, letters/spaces/hyphens/apostrophes only
- `rank`: max 100 characters, string type, HTML-escaped
- `memberNumber`: max 50 characters, string type, HTML-escaped
- All string fields are trimmed of leading/trailing whitespace

**Response** (201 Created):
```json
{
  "id": "new-uuid",
  "name": "Jane Doe",
  "firstName": "Jane",
  "lastName": "Doe",
  "preferredName": "J",
  "rank": "Captain",
  "memberNumber": "12345",
  "qrCode": "generated-qr-code",
  "createdAt": "2024-11-14T12:00:00.000Z",
  "updatedAt": "2024-11-14T12:00:00.000Z"
}
```

**Errors**:
- `400`: Validation failed - see error response format in Input Validation section

---

## Activities

### Get All Activities

#### `GET /api/activities`

Retrieve all activities, sorted with default activities first, then custom activities alphabetically.

**Response** (200 OK):
```json
[
  {
    "id": "uuid-here",
    "name": "Training",
    "isCustom": false,
    "createdAt": "2024-11-14T10:00:00.000Z"
  },
  {
    "id": "uuid-here",
    "name": "Equipment Check",
    "isCustom": true,
    "createdBy": "member-uuid",
    "createdAt": "2024-11-14T11:00:00.000Z"
  }
]
```

### Get Active Activity

#### `GET /api/activities/active`

Retrieve the currently active activity for the station.

**Response** (200 OK):
```json
{
  "id": "active-activity-uuid",
  "activityId": "activity-uuid",
  "setAt": "2024-11-14T12:00:00.000Z",
  "setBy": "member-uuid",
  "activity": {
    "id": "activity-uuid",
    "name": "Training",
    "isCustom": false,
    "createdAt": "2024-11-14T10:00:00.000Z"
  }
}
```

**Errors**:
- `404`: No active activity set

### Set Active Activity

#### `POST /api/activities/active`

Change the active activity for the station.

**Request Body**:
```json
{
  "activityId": "activity-uuid",
  "setBy": "member-uuid"  // optional
}
```

**Response** (200 OK):
```json
{
  "id": "new-active-activity-uuid",
  "activityId": "activity-uuid",
  "setAt": "2024-11-14T12:00:00.000Z",
  "setBy": "member-uuid",
  "activity": {
    "id": "activity-uuid",
    "name": "Maintenance",
    "isCustom": false,
    "createdAt": "2024-11-14T10:00:00.000Z"
  }
}
```

**Errors**:
- `400`: Missing activity ID
- `404`: Activity not found

### Create Custom Activity

#### `POST /api/activities`

Create a new custom activity.

**Request Body**:
```json
{
  "name": "Equipment Inspection",
  "createdBy": "member-uuid"  // optional
}
```

**Response** (201 Created):
```json
{
  "id": "new-uuid",
  "name": "Equipment Inspection",
  "isCustom": true,
  "createdBy": "member-uuid",
  "createdAt": "2024-11-14T12:00:00.000Z"
}
```

**Errors**:
- `400`: Invalid or missing name

---

## Check-Ins

### Get Active Check-Ins

#### `GET /api/checkins/active`

Retrieve all currently active check-ins with member and activity details.

**Response** (200 OK):
```json
[
  {
    "id": "checkin-uuid",
    "memberId": "member-uuid",
    "activityId": "activity-uuid",
    "checkInTime": "2024-11-14T12:00:00.000Z",
    "checkInMethod": "mobile",
    "location": "Station",
    "isOffsite": false,
    "isActive": true,
    "createdAt": "2024-11-14T12:00:00.000Z",
    "updatedAt": "2024-11-14T12:00:00.000Z",
    "memberName": "John Smith",
    "activityName": "Training"
  }
]
```

### Check In / Toggle Check-In

#### `POST /api/checkins`

Check in a member or undo their existing check-in. If the member is not checked in, creates a new check-in. If already checked in, deactivates the existing check-in.

**Request Body**:
```json
{
  "memberId": "member-uuid",
  "method": "mobile",  // "kiosk", "mobile", "qr", or "manual"
  "activityId": "activity-uuid",  // optional, uses active activity if not provided
  "location": "Station",  // optional
  "isOffsite": false  // optional, default false
}
```

**Validation Rules**:
- `memberId` (required): Valid UUID string, max 100 chars, HTML-escaped
- `method` (optional): Must be one of: `kiosk`, `mobile`, `qr`, `manual` (case-sensitive)
- `activityId` (optional): Valid UUID string, max 100 chars, HTML-escaped
- `location` (optional): String, max 500 chars, HTML-escaped
- `isOffsite` (optional): Boolean type only (true/false, not strings)

**Response - Check In** (201 Created):
```json
{
  "action": "checked-in",
  "checkIn": {
    "id": "checkin-uuid",
    "memberId": "member-uuid",
    "activityId": "activity-uuid",
    "checkInTime": "2024-11-14T12:00:00.000Z",
    "checkInMethod": "mobile",
    "location": "Station",
    "isOffsite": false,
    "isActive": true,
    "createdAt": "2024-11-14T12:00:00.000Z",
    "updatedAt": "2024-11-14T12:00:00.000Z"
  }
}
```

**Response - Undo** (200 OK):
```json
{
  "action": "undone",
  "checkIn": {
    "id": "checkin-uuid",
    "memberId": "member-uuid",
    "activityId": "activity-uuid",
    "checkInTime": "2024-11-14T12:00:00.000Z",
    "checkInMethod": "mobile",
    "isActive": false,
    "updatedAt": "2024-11-14T12:30:00.000Z"
  }
}
```

**Errors**:
- `400`: Validation failed (see Input Validation section) or no active activity set
- `404`: Member or activity not found

### Undo Check-In

#### `DELETE /api/checkins/:memberId`

Alternative endpoint to explicitly undo a check-in.

**Parameters**:
- `memberId` (path): Member UUID

**Response** (200 OK):
```json
{
  "message": "Check-in undone successfully"
}
```

**Errors**:
- `404`: No active check-in found for member

### URL Check-In

#### `POST /api/checkins/url-checkin`

Check in a member via a shared sign-in link or QR code.

**Request Body**:
```json
{
  "identifier": "member-uuid",
  "stationId": "default-station"  // optional; overrides header
}
```

**Rules**:
- `identifier` (required): Member ID (UUID). Legacy name values are still accepted for older QR codes/links, but IDs are the primary identifier.
- `stationId` (optional): Explicit station for the link; falls back to `X-Station-Id` header, then `default-station`.
- Member must belong to the resolved station; otherwise a 404 is returned.
- Uses the station's active activity; returns 400 if none is set.
- Special characters are supported (HTML escaping removed for identifiers).

**Responses**:
- `201`: `{ "action": "checked-in", "member": "...", "checkIn": { ... } }`
- `200`: `{ "action": "already-checked-in", "member": "...", "checkIn": { ... } }` (when the member is already checked in)
- `400`: Invalid identifier or no active activity
- `404`: Member not found in station
- `500`: Server error

**Example**:
```bash
curl -X POST http://localhost:3000/api/checkins/url-checkin \
  -H "Content-Type: application/json" \
  -d '{"identifier":"6e8b876b-9cfb-499a-970c-deca9cf58aed","stationId":"default-station"}'
```

---

## WebSocket Events

The application uses Socket.io for real-time communication.

### Connection

Connect to the WebSocket server:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});
```

### Client → Server Events

#### `checkin`

Notify other clients of a check-in action.

**Payload**:
```json
{
  "action": "checked-in",
  "checkIn": { /* check-in object */ }
}
```

#### `activity-change`

Notify all clients of an activity change.

**Payload**:
```json
{
  "id": "active-activity-uuid",
  "activityId": "activity-uuid",
  "activity": { /* activity object */ }
}
```

#### `member-added`

Notify other clients of a new member.

**Payload**:
```json
{
  "id": "member-uuid",
  "name": "New Member",
  "qrCode": "qr-code"
}
```

### Server → Client Events

#### `checkin-update`

Broadcasted when a check-in occurs.

**Payload**: Same as `checkin` event

**Action**: Refresh active check-ins list

#### `activity-update`

Broadcasted when the active activity changes.

**Payload**: Same as `activity-change` event

**Action**: Update UI to show new active activity

#### `member-update`

Broadcasted when a new member is added.

**Payload**: Same as `member-added` event

**Action**: Refresh members list

#### `connect`

Emitted when successfully connected to the server.

#### `disconnect`

Emitted when disconnected from the server.

---

## Data Types

### Member

```typescript
interface Member {
  id: string;              // UUID
  name: string;            // Member name
  qrCode: string;          // Unique QR code
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last update timestamp
}
```

### Activity

```typescript
interface Activity {
  id: string;              // UUID
  name: string;            // Activity name
  isCustom: boolean;       // true if custom, false if default
  createdBy?: string;      // Member UUID (only for custom)
  createdAt: Date;         // Creation timestamp
}
```

### CheckIn

```typescript
interface CheckIn {
  id: string;              // UUID
  memberId: string;        // Member UUID
  activityId: string;      // Activity UUID
  checkInTime: Date;       // Check-in timestamp
  checkInMethod: 'kiosk' | 'mobile' | 'qr';
  location?: string;       // Optional location string
  isOffsite: boolean;      // true if off-site check-in
  isActive: boolean;       // true if currently checked in
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last update timestamp
}
```

### CheckInWithDetails

Extends `CheckIn` with additional fields:

```typescript
interface CheckInWithDetails extends CheckIn {
  memberName: string;      // Resolved member name
  activityName: string;    // Resolved activity name
}
```

### ActiveActivity

```typescript
interface ActiveActivity {
  id: string;              // UUID
  activityId: string;      // Activity UUID
  setAt: Date;             // When activity was set
  setBy?: string;          // Member UUID who set it
  activity?: Activity;     // Resolved activity object
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limiting

Rate limiting is enforced via `express-rate-limit` (the app trusts the first
proxy for correct client IPs behind Azure App Service):

- **`apiRateLimiter`** — applied to all `/api/*` routes.
- **`spaRateLimiter`** — applied to the SPA fallback route.
- **`sensitiveActionRateLimiter`** — applied to sensitive auth/organization
  actions (login, signup, organization/user management).

---

## CORS

The backend builds a single allowed-origins list from `FRONTEND_URLS`
(comma-separated; falls back to the legacy `FRONTEND_URL`, then
`http://localhost:5173`). The same list is shared by Express and Socket.io.
Unknown origins are denied **without throwing** (`callback(null, false)`) so
that same-origin asset requests are never turned into 500s. Allowed request
headers include `Content-Type`, `Authorization`, `X-Station-Id` and
`X-Request-ID`.

---

## Future API Enhancements

Planned for future versions:
- Pagination for large member lists
- Filtering and sorting options
- Historical check-in data endpoints
- QR code generation endpoint
- Persisted billing-event audit log (currently in-memory)
- Stripe metered-usage overage billing (reporter is wired but gated behind config)

---

## Example Usage

### JavaScript/TypeScript

```typescript
// Check in a member
const response = await fetch('http://localhost:3000/api/checkins', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    memberId: 'member-uuid',
    method: 'mobile'
  })
});

const data = await response.json();
console.log(data.action); // "checked-in" or "undone"
```

### cURL

```bash
# Get all members
curl http://localhost:3000/api/members

# Create a new member
curl -X POST http://localhost:3000/api/members \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe"}'

# Check in a member
curl -X POST http://localhost:3000/api/checkins \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "member-uuid",
    "method": "mobile"
  }'
```

---

## Events

The event system manages discrete activity instances with their own lifecycles and participant lists.

### Get Events

#### `GET /api/events`

Retrieve events with pagination support.

**Query Parameters**:
- `limit` (optional, default 50, max 100): Maximum number of events to return
- `offset` (optional, default 0): Number of events to skip

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "activityId": "uuid",
    "activityName": "Training",
    "startTime": "2024-11-15T12:44:00.000Z",
    "endTime": null,
    "isActive": true,
    "createdBy": "system",
    "createdAt": "2024-11-15T12:44:00.000Z",
    "updatedAt": "2024-11-15T12:44:00.000Z",
    "participants": [
      {
        "id": "uuid",
        "eventId": "uuid",
        "memberId": "uuid",
        "memberName": "John Smith",
        "checkInTime": "2024-11-15T12:44:30.000Z",
        "checkInMethod": "mobile",
        "isOffsite": false,
        "createdAt": "2024-11-15T12:44:30.000Z"
      }
    ],
    "participantCount": 1
  }
]
```

### Get Active Events

#### `GET /api/events/active`

Retrieve all currently active (not ended) events.

**Response** (200 OK):
Same format as GET /api/events

### Get Specific Event

#### `GET /api/events/:eventId`

Retrieve a specific event with all participants.

**Parameters**:
- `eventId` (path): Event UUID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "activityId": "uuid",
  "activityName": "Training",
  "startTime": "2024-11-15T12:44:00.000Z",
  "endTime": null,
  "isActive": true,
  "participants": [...],
  "participantCount": 3
}
```

**Errors**:
- `404`: Event not found

### Create Event

#### `POST /api/events`

Start a new event from an activity type.

**Request Body**:
```json
{
  "activityId": "activity-uuid",
  "createdBy": "username"
}
```

**Response** (201 Created):
Same format as GET /api/events/:eventId

**Errors**:
- `400`: Invalid activity ID
- `404`: Activity not found

### End Event

#### `PUT /api/events/:eventId/end`

End an event (sets end time and marks as inactive).

**Parameters**:
- `eventId` (path): Event UUID

**Response** (200 OK):
Same format as GET /api/events/:eventId

**Errors**:
- `404`: Event not found

### Add Event Participant

#### `POST /api/events/:eventId/participants`

Add a participant to an event. If the participant is already in the event, they are removed (toggle behavior).

**Parameters**:
- `eventId` (path): Event UUID

**Request Body**:
```json
{
  "memberId": "member-uuid",
  "method": "mobile",
  "location": "Station",
  "isOffsite": false
}
```

**Response** (201 Created):
```json
{
  "action": "added",
  "participant": {
    "id": "uuid",
    "eventId": "uuid",
    "memberId": "uuid",
    "memberName": "John Smith",
    "checkInTime": "2024-11-15T12:44:30.000Z",
    "checkInMethod": "mobile",
    "isOffsite": false,
    "createdAt": "2024-11-15T12:44:30.000Z"
  }
}
```

Or if removing:
```json
{
  "action": "removed",
  "participant": { ... }
}
```

**Errors**:
- `400`: Invalid member ID or event is ended
- `404`: Event or member not found

### Add Event Visitor (AC-2)

#### `POST /api/events/:eventId/visitors`

Sign in an ephemeral visitor by typed name. Unlike `addEventParticipant`, the
visitor is **never persisted as a Member** — no history, no member-cap impact,
no tap-to-repeat tile in the member grid — and there is **no toggle**: every
call adds a new `EventParticipant` row (`isVisitor: true`, synthetic
`memberId: "visitor-<uuid>"`), even for a repeated name.

**Parameters**:
- `eventId` (path): Event UUID

**Request Body**:
```json
{
  "name": "Jane Visitor",
  "method": "kiosk",
  "location": "Station",
  "isOffsite": false
}
```

**Response** (201 Created):
```json
{
  "action": "added",
  "participant": {
    "id": "uuid",
    "eventId": "uuid",
    "memberId": "visitor-uuid",
    "memberName": "Jane Visitor",
    "memberRank": "Visitor",
    "checkInTime": "2024-11-15T12:44:30.000Z",
    "checkInMethod": "kiosk",
    "isOffsite": false,
    "isVisitor": true,
    "createdAt": "2024-11-15T12:44:30.000Z"
  }
}
```

**Errors**:
- `400`: Missing/blank `name` or event is ended
- `404`: Event not found

### Remove Event Participant

#### `DELETE /api/events/:eventId/participants/:participantId`

Remove a participant from an event.

**Parameters**:
- `eventId` (path): Event UUID
- `participantId` (path): Participant UUID

**Response** (200 OK):
```json
{
  "message": "Participant removed successfully"
}
```

**Errors**:
- `404`: Participant not found

---

## Example Usage - Event System

```bash
# Start a new training event
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "training-activity-uuid"
  }'

# Add a participant to the event
curl -X POST http://localhost:3000/api/events/event-uuid/participants \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "member-uuid",
    "method": "mobile"
  }'

# Get all active events
curl http://localhost:3000/api/events/active

# End an event
curl -X PUT http://localhost:3000/api/events/event-uuid/end
```

---

## Data Export Endpoints

### Export Members
Export all members to CSV format.

**Endpoint**: `GET /api/export/members`

**Headers**:
- `X-Station-Id`: Station identifier (optional, defaults to 'default-station')

**Response**:
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="members-YYYY-MM-DD.csv"`
- Body: CSV file with member data

**Fields**:
- ID, Name, First Name, Last Name, Rank, Member Number, QR Code, Station ID, Created At, Updated At

**Example**:
```bash
curl -X GET http://localhost:3000/api/export/members \
  -H "X-Station-Id: station-123" \
  -o members.csv
```

---

### Export Check-Ins
Export check-ins with optional date range filtering.

**Endpoint**: `GET /api/export/checkins`

**Headers**:
- `X-Station-Id`: Station identifier (optional)

**Query Parameters**:
- `startDate` (optional): Start date for filtering (ISO 8601 format: YYYY-MM-DD)
- `endDate` (optional): End date for filtering (ISO 8601 format: YYYY-MM-DD)

**Response**:
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="checkins-[date-range]-YYYY-MM-DD.csv"`
- Body: CSV file with check-in data

**Fields**:
- ID, Member ID, Member Name, Activity ID, Activity Name, Station ID, Check-In Time, Check-In Method, Location, Is Offsite, Is Active, Created At

**Example**:
```bash
# Export all check-ins
curl -X GET http://localhost:3000/api/export/checkins -o checkins.csv

# Export check-ins for January 2024
curl -X GET "http://localhost:3000/api/export/checkins?startDate=2024-01-01&endDate=2024-01-31" \
  -o checkins-jan-2024.csv
```

**Errors**:
- `400`: Invalid date format

---

### Export Events
Export events with participants and optional date range filtering.

**Endpoint**: `GET /api/export/events`

**Headers**:
- `X-Station-Id`: Station identifier (optional)

**Query Parameters**:
- `startDate` (optional): Start date for filtering (ISO 8601 format: YYYY-MM-DD)
- `endDate` (optional): End date for filtering (ISO 8601 format: YYYY-MM-DD)

**Response**:
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="events-[date-range]-YYYY-MM-DD.csv"`
- Body: CSV file with event data (flattened: one row per participant)

**Fields**:
- Event ID, Activity Name, Activity ID, Station ID, Start Time, End Time, Is Active, Created By, Participant Count
- Participant ID, Participant Member ID, Participant Member Name, Participant Rank, Participant Check-In Time, Participant Check-In Method, Participant Location, Participant Is Offsite

**Example**:
```bash
# Export all events
curl -X GET http://localhost:3000/api/export/events -o events.csv

# Export events for a specific date range
curl -X GET "http://localhost:3000/api/export/events?startDate=2024-01-01&endDate=2024-12-31" \
  -o events-2024.csv
```

**Errors**:
- `400`: Invalid date format

---

### Export Truck Check Results
Export truck check results with optional date range filtering.

**Endpoint**: `GET /api/export/truckcheck-results`

**Headers**:
- `X-Station-Id`: Station identifier (optional)

**Query Parameters**:
- `startDate` (optional): Start date for filtering (ISO 8601 format: YYYY-MM-DD)
- `endDate` (optional): End date for filtering (ISO 8601 format: YYYY-MM-DD)

**Response**:
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="truckcheck-results-[date-range]-YYYY-MM-DD.csv"`
- Body: CSV file with truck check data (flattened: one row per check result)

**Fields**:
- Run ID, Appliance ID, Appliance Name, Station ID, Start Time, End Time, Completed By, Completed By Name, Contributors, Additional Comments, Run Status, Has Issues
- Result ID, Item ID, Item Name, Item Description, Result Status, Result Comment, Result Photo URL, Result Completed By

**Example**:
```bash
# Export all truck check results
curl -X GET http://localhost:3000/api/export/truckcheck-results -o truckcheck-results.csv

# Export truck checks for last 3 months
curl -X GET "http://localhost:3000/api/export/truckcheck-results?startDate=2024-01-01&endDate=2024-03-31" \
  -o truckcheck-q1-2024.csv
```

**Errors**:
- `400`: Invalid date format

---

## Example Usage - Data Export

```bash
# Export all members for a specific station
curl -X GET http://localhost:3000/api/export/members \
  -H "X-Station-Id: bungendore-north" \
  -o members.csv

# Export check-ins for the current month
START_DATE=$(date +%Y-%m-01)
END_DATE=$(date +%Y-%m-%d)
curl -X GET "http://localhost:3000/api/export/checkins?startDate=$START_DATE&endDate=$END_DATE" \
  -o checkins-current-month.csv

# Export all events from 2024
curl -X GET "http://localhost:3000/api/export/events?startDate=2024-01-01&endDate=2024-12-31" \
  -o events-2024.csv

# Export truck checks with issues from last quarter
curl -X GET "http://localhost:3000/api/export/truckcheck-results?startDate=2024-01-01&endDate=2024-03-31" \
  -o truckcheck-q1-2024.csv
```

## Wiki Endpoints

In-app wiki (help drawer, public `/wiki` page, platform-admin help tab). Full schema: `docs/registers/api_register.json` → `endpoints.wiki`. Source: `backend/src/routes/wiki.ts` + `services/wikiContentService.ts`.

- `GET /api/wiki/user-guide` — table of contents (public). `{ sections: [{ heading, pages: [{ slug, title, description }] }] }`, derived by parsing `docs/wiki/user-guide/README.md`'s `###` headings and markdown link tables.
- `GET /api/wiki/user-guide/pages/:slug` — `{ slug, title, markdown }` for one page. `slug` must be in the manifest; arbitrary filenames aren't reachable.
- `GET /api/wiki/user-guide/images/:filename` — an image from `docs/wiki/user-guide/images/`. Sent with `Cross-Origin-Resource-Policy: cross-origin` (needed so the `:5173` dev frontend can load images from the `:3000` dev backend — Helmet's default same-origin CORP would otherwise block it; harmless in prod, same origin there).
- `GET /api/wiki/platform-admin`, `.../pages/:slug`, `.../images/:filename` — same shape, reading `docs/wiki/platform-admin/` instead. Gated by `authMiddleware` + `requirePlatformAdmin` (same allowlist as `/api/platform`). Only ever linked from `PlatformAdminPage`'s Help tab — never surfaced to regular users or org admins.
- `POST /api/wiki/user-guide/search` / `POST /api/wiki/platform-admin/search` — grounded AI search (`{ query }` → `{ answer, covered, sources }`), source: `services/wikiSearchService.ts`. Full-context, not vector RAG: every page's markdown in the section goes straight into the prompt (the corpus is a handful of short pages, so this is simpler and more accurate than retrieval). Uses the `chat` AI Gateway deployment (the fast/cheap one, not `report`). The model is instructed to answer only from the supplied docs and set `covered: false` when a question isn't addressed; every `sources` slug is re-validated server-side against the real manifest before being returned, so a hallucinated citation is dropped rather than trusted. Public (rate-limited via `aiRateLimiter`, stacked on top of the mount's `apiRateLimiter`) for user-guide; gated identically to the rest of `/api/wiki/platform-admin` for that section. 503s cleanly when `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_KEY` aren't configured.
