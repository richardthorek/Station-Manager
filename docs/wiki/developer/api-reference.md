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
tenant) and drives feature gating.

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
`santaRunEnabled`, `fireBreakEnabled`) used by sibling Bushie Tools apps. See
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
| `POST` | `/api/auth/signup` | none | Create a new organization (free Community plan) + its first owner; returns a JWT. |
| `POST` | `/api/auth/login` | none | Exchange username/password for a JWT. |
| `POST` | `/api/auth/logout` | none | Client-side logout (token discarded by client; logged for audit). |
| `GET` | `/api/auth/me` | Bearer | Current user + resolved organization + entitlements. |
| `GET` | `/api/auth/entitlements` | Bearer | Lightweight entitlements probe for sibling apps. |
| `GET` | `/api/auth/config` | none | Reports `{ requireAuth }` (whether `REQUIRE_AUTH=true`). |

### `POST /api/auth/signup`

**Request Body**:
```json
{
  "organizationName": "Bungendore RFS",
  "billingEmail": "captain@example.org",
  "username": "captain",
  "password": "min-8-chars"
}
```
**Response** (201 Created): `{ "token": "...", "user": { id, username, role, organizationId }, "organization": { ... } }`

**Errors**: `400` (missing fields / password < 8 chars), `409` (username taken).

### `POST /api/auth/login`

**Request Body**: `{ "username": "captain", "password": "..." }`

**Response** (200 OK): `{ "token": "...", "user": { id, username, role, organizationId, lastLoginAt } }`

**Errors**: `400` (missing fields), `401` (invalid credentials).

### `GET /api/auth/me`

**Auth**: Bearer JWT.
**Response** (200 OK): `{ id, username, role, organizationId, lastLoginAt, organization, entitlements }`
(`organization`/`entitlements` are `null` when the user has no org context.)

### `GET /api/auth/entitlements`

**Auth**: Bearer JWT.
**Response** (200 OK): `{ entitlements, planCode, status }`
(`entitlements`/`planCode` are `null` for users with no organization.) See
`docs/wiki/developer/suite-token-validation.md` for the full sibling-app contract.

---

## Organizations (SaaS Tenant Management)

Manage the organization (billing tenant), its plan/module toggles, and its
users. All endpoints require a Bearer JWT and use `sensitiveActionRateLimiter`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/organizations/current` | any member | Current org + entitlements + plan catalog. |
| `PUT` | `/api/organizations/current` | owner | Update name/email/plan and narrow module toggles. |
| `GET` | `/api/organizations/current/users` | admin/owner | List users in the org. |
| `POST` | `/api/organizations/current/users` | admin/owner | Create a user in the org. |

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
  }
}
```
Changing `planCode` resets entitlements to the plan defaults. `moduleToggles`
may only **disable** modules; values are clamped to the plan ceiling
(`clampEntitlements`). **Response**: `{ "organization": { ... } }`.
**Errors**: `400` (invalid `planCode`), `404` (org not found).

### `POST /api/organizations/current/users` (admin/owner)

**Request Body**: `{ "username": "...", "password": "min-8-chars", "role": "admin|viewer|owner" }`
Only an `owner` may create another `owner`. **Response** (201): `{ "user": { id, username, role, organizationId } }`.
**Errors**: `400` (missing fields / short password), `403` (non-owner creating owner), `409` (username taken).

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
