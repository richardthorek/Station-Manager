# RFS Station Manager - Function Register

**Document Version:** 1.1  
**Last Updated:** 2026-06-20  
**Purpose:** Comprehensive register of all backend functions, routes, and services

> **Authentication note:** The API uses JWT bearer tokens for authenticated
> operations and SaaS organization scoping (`organizationId` JWT claim). Feature
> modules are gated per-organization via `requireFeature(...)` entitlements
> (on by default; `ENABLE_ENTITLEMENTS=false` disables). Routes marked
> "Authentication: None" below are the open kiosk/data routes; see the Auth,
> Organizations, AI Gateway, and Billing sections for authenticated routes.

---

## Table of Contents

1. [REST API Routes](#rest-api-routes)
2. [Database Service Methods](#database-service-methods)
3. [Service Layer Functions](#service-layer-functions)
4. [Socket.io Events](#socketio-events)
5. [Utility Functions](#utility-functions)

---

## REST API Routes

### Health Check Routes

#### `GET /health`
**File:** `backend/src/index.ts:68`  
**Purpose:** Check server health and status  
**Authentication:** None  
**Parameters:** None  
**Returns:**
```json
{
  "status": "ok" | "error" | "initializing",
  "timestamp": "ISO 8601 string",
  "database": "table-storage" | "in-memory",
  "environment": "development" | "production",
  "version": "version info object"
}
```
**Status Codes:** 200, 500

---

### Auth Routes (`/api/auth`)

**File:** `backend/src/routes/auth.ts` — JWT signed with `JWT_SECRET`, expiry `JWT_EXPIRY` (default `24h`). Login/signup use `sensitiveActionRateLimiter`.

#### `POST /api/auth/signup`
**Purpose:** Create a new Organization (free Community plan) + first owner user; returns a JWT  
**Authentication:** None  
**Request Body:** `{ organizationName, billingEmail, username, password }`  
**Returns:** `{ token, user, organization }`  
**Status Codes:** 201, 400, 409, 500

#### `POST /api/auth/login`
**Purpose:** Authenticate and return a JWT (includes `organizationId` claim)  
**Authentication:** None  
**Request Body:** `{ username, password }`  
**Returns:** `{ token, user }`  
**Status Codes:** 200, 400, 401, 500

#### `POST /api/auth/logout`
**Purpose:** Client-side logout (audit log only)  
**Authentication:** None  
**Status Codes:** 200

#### `GET /api/auth/me`
**Purpose:** Current user + resolved organization + entitlements  
**Authentication:** Bearer JWT (`authMiddleware`)  
**Returns:** `{ id, username, role, organizationId, lastLoginAt, organization, entitlements }`  
**Status Codes:** 200, 401, 404, 500

#### `GET /api/auth/entitlements`
**Purpose:** Lightweight entitlements probe for sibling Bushie Tools apps  
**Authentication:** Bearer JWT (`authMiddleware`)  
**Returns:** `{ entitlements, planCode, status }` (nulls when no org)  
**Status Codes:** 200, 401, 500

#### `GET /api/auth/config`
**Purpose:** Report whether auth is required (`REQUIRE_AUTH`)  
**Authentication:** None  
**Returns:** `{ requireAuth: boolean }`  
**Status Codes:** 200

---

### Organizations Routes (`/api/organizations`)

**File:** `backend/src/routes/organizations.ts` — SaaS tenant + plan management. All require Bearer JWT; `sensitiveActionRateLimiter`.

#### `GET /api/organizations/current`
**Purpose:** Current org + entitlements + plan catalog  
**Authentication:** Bearer JWT (any member)  
**Returns:** `{ organization, plans }`  
**Status Codes:** 200, 400, 404

#### `PUT /api/organizations/current`
**Purpose:** Update name/email/plan and narrow module toggles (clamped to plan ceiling)  
**Authentication:** Bearer JWT + `requireOwner`  
**Request Body:** `{ name?, billingEmail?, planCode?, moduleToggles? }`  
**Returns:** `{ organization }`  
**Status Codes:** 200, 400, 404

#### `GET /api/organizations/current/users`
**Purpose:** List users in the org  
**Authentication:** Bearer JWT + `requireAdmin`  
**Returns:** `{ users }`  
**Status Codes:** 200, 400

#### `POST /api/organizations/current/users`
**Purpose:** Create a user in the org (only owners may mint owners)  
**Authentication:** Bearer JWT + `requireAdmin`  
**Request Body:** `{ username, password, role }`  
**Returns:** `{ user }`  
**Status Codes:** 201, 400, 403, 409, 500

---

### AI Gateway Routes (`/api/ai`)

**File:** `backend/src/routes/ai.ts` — server-side AI proxy (credentials never reach the browser). `attachOrganization` runs on every route; gated by `aiEnabled` when org context present and entitlements enabled. Usage recorded as `UsageRecord` rows.

#### `POST /api/ai/chat`
**Purpose:** Chat completion (live finding/metadata extraction)  
**Authentication:** Org context (gated `aiEnabled`)  
**Request Body:** `{ messages[], responseFormat?, sessionId? }`  
**Returns:** Azure OpenAI chat-completion body (forwarded verbatim)  
**Status Codes:** 200, 400, 403, 502, 503

#### `POST /api/ai/report`
**Purpose:** Chat completion on the heavier report model  
**Authentication:** Org context (gated `aiEnabled`)  
**Request Body:** `{ messages[], responseFormat?, sessionId? }`  
**Status Codes:** 200, 400, 403, 502, 503

#### `POST /api/ai/speech/token`
**Purpose:** Vend a short-lived Azure Speech token (one token == one AAR session)  
**Authentication:** Org context (gated `aiEnabled` + monthly allowance)  
**Returns:** `{ token, region }`  
**Status Codes:** 200, 402 (allowance exhausted), 403, 503

#### `GET /api/ai/usage`
**Purpose:** This org's monthly AI session usage vs allowance  
**Authentication:** Bearer JWT (`authMiddleware`)  
**Returns:** `{ used, included, remaining, resetAt, aiEnabled }`  
**Status Codes:** 200, 404

---

### Billing Routes (`/api/billing`) — Stripe

**File:** `backend/src/routes/billing.ts` — return `503` when Stripe is not configured. The webhook receives a raw body (`express.raw()` registered before `express.json()` in `index.ts`).

#### `POST /api/billing/checkout`
**Purpose:** Create a Stripe Checkout session for a plan upgrade (14-day trial)  
**Authentication:** Bearer JWT + `requireOwner`  
**Request Body:** `{ planCode: "basic"|"ai", billingInterval: "monthly"|"annual" }`  
**Returns:** `{ checkoutUrl }`  
**Status Codes:** 200, 400, 404, 503

#### `POST /api/billing/portal`
**Purpose:** Create a Stripe Customer Portal session  
**Authentication:** Bearer JWT + `requireOwner`  
**Returns:** `{ portalUrl }`  
**Status Codes:** 200, 400, 404, 503

#### `GET /api/billing/status`
**Purpose:** Current billing status for the org  
**Authentication:** Bearer JWT  
**Returns:** `{ planCode, status, trialEndsAt, hasPaymentMethod, stripeConfigured }`  
**Status Codes:** 200, 404

#### `POST /api/billing/webhook`
**Purpose:** Process Stripe subscription/invoice events; updates plan/status/entitlements  
**Authentication:** None — verified by `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET`  
**Handles:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`  
**Returns:** `{ received: true }` (always, after audit)  
**Status Codes:** 200, 400, 500, 503

---

### Members Routes (`/api/members`)

#### `GET /api/members`
**File:** `backend/src/routes/members.ts:18`  
**Purpose:** Get all registered members  
**Authentication:** None  
**Parameters:** None  
**Sorting:** By check-in activity (last 6 months), then alphabetically  
**Returns:** `Member[]`  
**Status Codes:** 200, 500

#### `GET /api/members/:id`
**File:** `backend/src/routes/members.ts:30`  
**Purpose:** Get specific member by ID  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Member UUID
**Returns:** `Member`  
**Status Codes:** 200, 404, 500

#### `GET /api/members/qr/:qrCode`
**File:** `backend/src/routes/members.ts:45`  
**Purpose:** Get member by QR code  
**Authentication:** None  
**Parameters:**
- `qrCode` (path, string) - Unique QR identifier
**Returns:** `Member`  
**Status Codes:** 200, 404, 500

#### `POST /api/members`
**File:** `backend/src/routes/members.ts:60`  
**Purpose:** Create new member  
**Authentication:** None  
**Request Body:**
```json
{
  "name": "string (required)"
}
```
**Returns:** `Member` (with auto-generated ID and QR code)  
**Status Codes:** 201, 400, 500

#### `PUT /api/members/:id`
**File:** `backend/src/routes/members.ts:76`  
**Purpose:** Update member information  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Member UUID
**Request Body:**
```json
{
  "name": "string (required)",
  "rank": "string (optional)"
}
```
**Returns:** `Member`  
**Status Codes:** 200, 400, 404, 500

#### `GET /api/members/:id/history`
**File:** `backend/src/routes/members.ts:95`  
**Purpose:** Get member's check-in history  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Member UUID
**Returns:** `CheckIn[]`  
**Status Codes:** 200, 404, 500

---

### Activities Routes (`/api/activities`)

#### `GET /api/activities`
**File:** `backend/src/routes/activities.ts:18`  
**Purpose:** Get all activities (default + custom)  
**Authentication:** None  
**Parameters:** None  
**Sorting:** Default activities first, then custom alphabetically  
**Returns:** `Activity[]`  
**Status Codes:** 200, 500

#### `POST /api/activities`
**File:** `backend/src/routes/activities.ts:30`  
**Purpose:** Create custom activity  
**Authentication:** None  
**Request Body:**
```json
{
  "name": "string (required)",
  "createdBy": "string (optional, member ID)"
}
```
**Returns:** `Activity` (with isCustom: true)  
**Status Codes:** 201, 400, 500

#### `GET /api/activities/active`
**File:** `backend/src/routes/activities.ts:48`  
**Purpose:** Get currently active activity for station  
**Authentication:** None  
**Parameters:** None  
**Returns:** `ActiveActivity` (includes nested activity details)  
**Status Codes:** 200, 404, 500

#### `POST /api/activities/active`
**File:** `backend/src/routes/activities.ts:68`  
**Purpose:** Set active activity  
**Authentication:** None  
**Request Body:**
```json
{
  "activityId": "string (required)",
  "setBy": "string (optional, member ID)"
}
```
**Returns:** `ActiveActivity`  
**Status Codes:** 200, 400, 404, 500

---

### Check-ins Routes (`/api/checkins`)

#### `GET /api/checkins/active`
**File:** `backend/src/routes/checkins.ts:18`  
**Purpose:** Get all currently active check-ins  
**Authentication:** None  
**Parameters:** None  
**Returns:** `CheckInWithDetails[]` (includes member and activity names)  
**Status Codes:** 200, 500

#### `POST /api/checkins`
**File:** `backend/src/routes/checkins.ts:30`  
**Purpose:** Check in member or undo existing check-in (toggle)  
**Authentication:** None  
**Request Body:**
```json
{
  "memberId": "string (required)",
  "activityId": "string (optional, uses active activity if not provided)",
  "method": "kiosk" | "mobile" | "qr" (optional, default: mobile)",
  "location": "string (optional)",
  "isOffsite": "boolean (optional, default: false)"
}
```
**Returns:**
- If checking in: `{ action: "checked-in", checkIn: CheckIn }` (201)
- If undoing: `{ action: "undone", checkIn: CheckIn }` (200)
**Status Codes:** 200, 201, 400, 404, 500

#### `DELETE /api/checkins/:memberId`
**File:** `backend/src/routes/checkins.ts:93`  
**Purpose:** Undo check-in for specific member (alternative endpoint)  
**Authentication:** None  
**Parameters:**
- `memberId` (path, string) - Member UUID
**Returns:** `{ message: string }`  
**Status Codes:** 200, 404, 500

#### `POST /api/checkins/url-checkin`
**File:** `backend/src/routes/checkins.ts:111`  
**Purpose:** Check in via URL parameter (QR code or name)  
**Authentication:** None  
**Request Body:**
```json
{
  "identifier": "string (required, member name or QR code)"
}
```
**Returns:** `{ action: "checked-in" | "undone", checkIn: CheckIn }`  
**Status Codes:** 200, 201, 400, 404, 500

---

### Events Routes (`/api/events`)

#### `GET /api/events`
**File:** `backend/src/routes/events.ts:18`  
**Purpose:** Get all events (active and historical)  
**Authentication:** None  
**Parameters:** None  
**Sorting:** Most recent first  
**Returns:** `Event[]`  
**Status Codes:** 200, 500

#### `GET /api/events/active`
**File:** `backend/src/routes/events.ts:30`  
**Purpose:** Get currently active events  
**Authentication:** None  
**Parameters:** None  
**Returns:** `Event[]`  
**Status Codes:** 200, 500

#### `GET /api/events/:id`
**File:** `backend/src/routes/events.ts:42`  
**Purpose:** Get event with participants  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Event UUID
**Returns:** `EventWithParticipants`  
**Status Codes:** 200, 404, 500

#### `POST /api/events`
**File:** `backend/src/routes/events.ts:58`  
**Purpose:** Create new event  
**Authentication:** None  
**Request Body:**
```json
{
  "name": "string (required)",
  "type": "incident" | "training" | "meeting" | "maintenance" | "other" (required)",
  "location": "string (optional)",
  "description": "string (optional)"
}
```
**Returns:** `Event`  
**Status Codes:** 201, 400, 500

#### `PUT /api/events/:id/end`
**File:** `backend/src/routes/events.ts:81`  
**Purpose:** End an active event  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Event UUID
**Returns:** `Event` (with endTime and isActive: false)  
**Status Codes:** 200, 404, 500

#### `POST /api/events/:id/participants`
**File:** `backend/src/routes/events.ts:99`  
**Purpose:** Add participant to event  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Event UUID
**Request Body:**
```json
{
  "memberId": "string (required)",
  "role": "string (optional)"
}
```
**Returns:** `EventParticipant`  
**Status Codes:** 201, 400, 404, 500

#### `DELETE /api/events/:id/participants/:participantId`
**File:** `backend/src/routes/events.ts:125`  
**Purpose:** Remove participant from event (check out)  
**Authentication:** None  
**Parameters:**
- `id` (path, string) - Event UUID
- `participantId` (path, string) - Participant UUID
**Returns:** `EventParticipant` (with checkOutTime)  
**Status Codes:** 200, 404, 500

---

### Truck Checks Routes (`/api/truck-checks`)

#### Appliances

**`GET /api/truck-checks/appliances`**  
**Purpose:** Get all appliances  
**Returns:** `Appliance[]`

**`POST /api/truck-checks/appliances`**  
**Purpose:** Create new appliance  
**Request Body:** `{ name, callSign, type, registrationNumber, photoUrl }`

**`PUT /api/truck-checks/appliances/:id`**  
**Purpose:** Update appliance  

**`DELETE /api/truck-checks/appliances/:id`**  
**Purpose:** Deactivate appliance

#### Templates

**`GET /api/truck-checks/templates`**  
**Purpose:** Get all templates

**`GET /api/truck-checks/templates/:id`**  
**Purpose:** Get specific template with items

**`POST /api/truck-checks/templates`**  
**Purpose:** Create new template

**`PUT /api/truck-checks/templates/:id`**  
**Purpose:** Update template

**`DELETE /api/truck-checks/templates/:id`**  
**Purpose:** Delete template

#### Check Runs

**`GET /api/truck-checks/check-runs`**  
**Purpose:** Get all check runs

**`GET /api/truck-checks/check-runs/:id`**  
**Purpose:** Get check run with results

**`POST /api/truck-checks/check-runs`**  
**Purpose:** Start new check run

**`PUT /api/truck-checks/check-runs/:id/complete`**  
**Purpose:** Complete check run

#### Check Results

**`POST /api/truck-checks/check-results`**  
**Purpose:** Record check result for item

**`POST /api/truck-checks/check-results/photo`**  
**Purpose:** Upload photo for check result

---

### Achievements Routes (`/api/achievements`)

#### `GET /api/achievements/member/:memberId`
**File:** `backend/src/routes/achievements.ts`  
**Purpose:** Get achievements for specific member  
**Authentication:** None  
**Parameters:**
- `memberId` (path, string) - Member UUID
**Returns:** `Achievement[]`  
**Status Codes:** 200, 404, 500

#### `GET /api/achievements/recent`
**File:** `backend/src/routes/achievements.ts`  
**Purpose:** Get recently unlocked achievements (all members)  
**Authentication:** None  
**Parameters:**
- `limit` (query, number, optional) - Max achievements to return (default: 10)
**Returns:** `Achievement[]` (sorted by unlock time, descending)  
**Status Codes:** 200, 500

---

## Database Service Methods

### In-Memory Database Service
**File:** `backend/src/services/database.ts`

#### Member Methods

**`getAllMembers(): Member[]`**  
**Line:** 184  
**Purpose:** Get all members sorted by activity level  
**Logic:** Counts check-ins in last 6 months, sorts by count (desc), then by name  

**`getMemberById(id: string): Member | undefined`**  
**Line:** 211  
**Purpose:** Find member by UUID  

**`getMemberByQRCode(qrCode: string): Member | undefined`**  
**Line:** 215  
**Purpose:** Find member by QR code  

**`createMember(name: string): Member`**  
**Line:** 219  
**Purpose:** Create new member with auto-generated UUID and QR code  

**`updateMember(id: string, name: string, rank: string | null): Member | undefined`**  
**Line:** 230  
**Purpose:** Update member name and rank  

**`getCheckInsByMember(memberId: string): CheckIn[]`**  
**Line:** 243  
**Purpose:** Get all historical check-ins for member  

#### Activity Methods

**`getAllActivities(): Activity[]`**  
**Line:** 247  
**Purpose:** Get all activities (default first, custom alphabetically)  

**`getActivityById(id: string): Activity | undefined`**  
**Line:** 257  
**Purpose:** Find activity by UUID  

**`createActivity(name: string, createdBy?: string): Activity`**  
**Line:** 261  
**Purpose:** Create custom activity  

**`getActiveActivity(): ActiveActivity | null`**  
**Line:** 270  
**Purpose:** Get current active activity with full activity details  

**`setActiveActivity(activityId: string, setBy?: string): ActiveActivity`**  
**Line:** 282  
**Purpose:** Set new active activity  

#### Check-in Methods

**`getActiveCheckIns(): CheckInWithDetails[]`**  
**Line:** 291  
**Purpose:** Get all active check-ins with member/activity details  

**`getCheckInByMember(memberId: string): CheckIn | undefined`**  
**Line:** 307  
**Purpose:** Find active check-in for member  

**`createCheckIn(memberId, activityId, method, location, isOffsite): CheckIn`**  
**Line:** 314  
**Purpose:** Create new check-in record  

**`deactivateCheckIn(checkInId: string): CheckIn | undefined`**  
**Line:** 331  
**Purpose:** Mark check-in as inactive (check out)  

**`deactivateCheckInByMember(memberId: string): boolean`**  
**Line:** 341  
**Purpose:** Deactivate check-in by member ID  

#### Event Methods

**`getAllEvents(): Event[]`**  
**Line:** 350  
**Purpose:** Get all events sorted by start time (desc)  

**`getActiveEvents(): Event[]`**  
**Line:** 354  
**Purpose:** Get only active events  

**`getEventById(id: string): Event | undefined`**  
**Line:** 358  
**Purpose:** Find event by UUID  

**`getEventWithParticipants(id: string): EventWithParticipants | undefined`**  
**Line:** 362  
**Purpose:** Get event with all participants  

**`createEvent(name, type, location, description): Event`**  
**Line:** 375  
**Purpose:** Create new event  

**`endEvent(id: string): Event | undefined`**  
**Line:** 391  
**Purpose:** End active event  

**`addParticipant(eventId, memberId, role): EventParticipant`**  
**Line:** 401  
**Purpose:** Add member to event  

**`removeParticipant(eventId, participantId): EventParticipant | undefined`**  
**Line:** 418  
**Purpose:** Remove participant from event (check out)  

**`getEventParticipants(eventId: string): EventParticipant[]`**  
**Line:** 432  
**Purpose:** Get all participants for event  

### Azure Table Storage Database Service
**File:** `backend/src/services/tableStorageDatabase.ts`

Same method surface as the in-memory service, implemented against Azure Table
Storage (async). Selected by `dbFactory` in production. A schema/method change
usually needs editing both this twin and the in-memory service plus the shared type.

### Truck Checks Database Services
**Files:**
- `backend/src/services/truckChecksDatabase.ts` (in-memory)
- `backend/src/services/tableStorageTruckChecksDatabase.ts` (Azure Table Storage)

Methods for appliances, templates, check runs, and check results management.

---

## Service Layer Functions

### Achievement Service
**File:** `backend/src/services/achievementService.ts`

**`calculateAchievements(memberId: string, db: DatabaseService): Achievement[]`**  
**Purpose:** Calculate all achievements for a member  
**Logic:** Checks various milestones (sign-ins, hours, streaks, events)  
**Returns:** Array of Achievement objects with unlock status  

**Achievement Types:**
- First Sign-In (1 sign-in)
- Regular Attendee (10 sign-ins)
- Dedicated Member (50 sign-ins)
- Veteran (100 sign-ins)
- First Event (1 event)
- Event Regular (10 events)
- Event Veteran (50 events)
- Team Player (5 truck checks)
- Safety Champion (20 truck checks)
- Equipment Expert (50 truck checks)

### Azure Storage Service
**File:** `backend/src/services/azureStorage.ts`

**`uploadPhoto(file: Buffer, filename: string): Promise<string>`**  
**Purpose:** Upload photo to Azure Blob Storage  
**Returns:** Public URL of uploaded file  

**`deletePhoto(url: string): Promise<void>`**  
**Purpose:** Delete photo from Azure Blob Storage  

### Database Factory
**File:** `backend/src/services/dbFactory.ts`

**`ensureDatabase(): Promise<DatabaseService>`**  
**Purpose:** Get database instance (singleton pattern)  
**Logic:** Returns in-memory DB for development, Azure Table Storage for production  

**`initializeDatabase(): Promise<DatabaseService>`**  
**Purpose:** Initialize database connection  
**Logic:** Selects Azure Table Storage when `AZURE_STORAGE_CONNECTION_STRING` is set (and `USE_TABLE_STORAGE !== 'false'`), otherwise the in-memory store

### Entitlement / Feature-Gating Middleware
**File:** `backend/src/middleware/entitlements.ts`

**`attachOrganization(req, res, next): Promise<void>`**  
**Purpose:** Best-effort-load the caller's `Organization` onto `req.organization` (from `req.user.organizationId` or a soft-decoded Bearer token). No-op when no org context.

**`requireFeature(feature: EntitlementFeature)`**  
**Purpose:** Express middleware gating a route group behind an entitlement flag. No-op when `ENABLE_ENTITLEMENTS=false` or no org context; otherwise `403` (`{ error, feature, planCode, upgradeRequired }`) when the flag is off.  
**Used by:** `/api/checkins` & `/api/events` (`signInEnabled`), `/api/truck-checks` (`truckCheckEnabled`), `/api/reports` & `/api/export` (`reportsEnabled`), `/api/ai/*` (`aiEnabled`).

**`enforceStationLimit()`**  
**Purpose:** Middleware enforcing `maxStations` on station creation (`403` when exceeded). Excludes the built-in default/demo stations from the count.

### Plan Catalog
**File:** `backend/src/constants/plans.ts`

**`PLANS: Record<PlanCode, PlanDefinition>`** — code catalog mapping `community | basic | ai` to default entitlements + price metadata.

**`getDefaultEntitlements(planCode): Entitlements`** — fresh copy of a plan's default entitlements.

**`clampEntitlements(planCode, desired): Entitlements`** — clamp a desired entitlement set to the plan ceiling (owners may disable modules but never enable beyond the plan).

**`isPlanCode(value): value is PlanCode`** — type guard for incoming plan codes.

### AI Gateway Service
**File:** `backend/src/services/aiGateway.ts`

**`chatCompletion(req: ChatRequest): Promise<ChatResult>`** — proxy a chat completion to Azure OpenAI; returns provider status + body verbatim (+ token usage).

**`issueSpeechToken(fetchImpl?): Promise<SpeechToken>`** — vend a short-lived (~10 min) region-scoped Azure Speech token.

**`isOpenAiConfigured()` / `isSpeechConfigured()` / `isAiConfigured()`** — env-driven capability checks.

**`chatCompletionAnthropic(req)`** — stubbed adapter (capability-routing seam; returns `501`).

**`GatewayError`** — error class carrying an HTTP status for the route layer to forward.

### Usage Database & Factory
**Files:** `backend/src/services/usageDatabase.ts` (in-memory `UsageDatabase`), `backend/src/services/tableStorageUsageDatabase.ts` (Table Storage twin), `backend/src/services/usageDbFactory.ts`

`IUsageDatabase` methods: **`recordUsage(input)`**, **`countUsage(orgId, type, since?)`**, **`listUsage(orgId, since?)`**, **`listUnreported()`**, **`markReported(ids)`**, **`clear()`**.

Helpers: **`monthlyResetAt(from?)`**, **`monthStart(from?)`** — UTC calendar-month boundaries for the allowance window.

Factory: **`ensureUsageDatabase(): IUsageDatabase`**, **`initializeUsageDatabase(): Promise<void>`**, **`getUsageDb()`**.

### Metered Usage Reporter
**File:** `backend/src/services/meteredUsageReporter.ts`

**`startMeteredUsageReporter()`** — start the hourly batch reporter (no-op in tests / when metered billing unconfigured).

**`reportMeteredUsageOnce(): Promise<number>`** — report one batch of unreported `speech` usage to Stripe metered billing; returns rows reported.

**`stopMeteredUsageReporter()`** — stop the timer (graceful shutdown / tests).

### Stripe Client Service
**File:** `backend/src/services/stripeClient.ts`

**`getStripeClient(): Stripe`** — Stripe SDK singleton (throws if `STRIPE_SECRET_KEY` missing).

**`isStripeConfigured(): boolean`** — true when `STRIPE_SECRET_KEY` is present.

**`resolvePriceId(planCode, interval): string | undefined`** — resolve a Stripe Price ID from env (`STRIPE_PRICE_<PLAN>_<INTERVAL>`).

### Organization Database & Factory
**Files:** `backend/src/services/organizationDatabase.ts` (in-memory), `backend/src/services/tableStorageOrganizationDatabase.ts` (Table Storage twin), `backend/src/services/organizationDbFactory.ts`

Methods: **`createOrganization(input)`**, **`getOrganizationById(id)`**, **`getOrganizationBySlug(slug)`**, **`updateOrganization(id, updates)`**, **`getAllOrganizations()`**.

Factory: **`ensureOrganizationDatabase()`**, **`initializeOrganizationDatabase()`**.

### AAR Collaboration Relay
**File:** `backend/src/services/aarCollab.ts`

**`registerAarCollabHandlers(io, socket): void`** — register the ephemeral (non-persisted) Socket.io relay for live AAR session notes. Rooms are `aar-<CODE>`; events: `aar:host`, `aar:join`, `aar:note` (server-stamped + fanned out).

Helpers: **`isValidCode`**, **`normalizeCode`**, **`sanitizeLabel`**, **`buildNote`**.

---

## Socket.io Events

### Server → Client Events

**Event:** `member-added`  
**Emitted From:** Members routes  
**Payload:** `{ member: Member }`  
**Trigger:** New member created

**Event:** `member-updated`  
**Emitted From:** Members routes  
**Payload:** `{ member: Member }`  
**Trigger:** Member updated

**Event:** `checkin`  
**Emitted From:** Check-ins routes  
**Payload:** `{ checkIn: CheckIn }`  
**Trigger:** Member checked in

**Event:** `checkout`  
**Emitted From:** Check-ins routes  
**Payload:** `{ checkIn: CheckIn }`  
**Trigger:** Member checked out

**Event:** `activity-change`  
**Emitted From:** Activities routes  
**Payload:** `{ activeActivity: ActiveActivity }`  
**Trigger:** Active activity changed

**Event:** `event-created`  
**Emitted From:** Events routes  
**Payload:** `{ event: Event }`  
**Trigger:** New event created

**Event:** `event-ended`  
**Emitted From:** Events routes  
**Payload:** `{ event: Event }`  
**Trigger:** Event ended

**Event:** `participant-added`  
**Emitted From:** Events routes  
**Payload:** `{ participant: EventParticipant }`  
**Trigger:** Participant added to event

**Event:** `participant-removed`  
**Emitted From:** Events routes  
**Payload:** `{ participantId: string }`  
**Trigger:** Participant removed from event

**Event:** `achievement-unlocked`  
**Emitted From:** Achievements routes  
**Payload:** `{ achievement: Achievement }`  
**Trigger:** Member unlocks new achievement

### AAR Studio Collaboration Events (room `aar-<CODE>`)
**Registered by:** `registerAarCollabHandlers` (`backend/src/services/aarCollab.ts`)

**Client → Server:** `aar:host` `{ code }`, `aar:join` `{ code, label? }`, `aar:note` `{ code, text, label?, clientTs?, offsetSec? }` (all with optional ack callback).

**Server → Client:** `aar:participant-joined` `{ label }`, `aar:note` `{ id, text, label, serverTs, clientTs?, offsetSec? }` (server-stamped, fanned out to the room).

---

## Utility Functions

### UUID Generation
**Function:** `uuidv4()`  
**Package:** `uuid`  
**Purpose:** Generate unique identifiers  
**Used for:** All entity IDs, QR codes

### Date/Time Utilities
**Functions:** JavaScript built-in `Date` object  
**Purpose:** Timestamp creation and manipulation  
**Format:** ISO 8601 strings in responses

### String Utilities
**Function:** `String.prototype.trim()`  
**Purpose:** Input sanitization  
**Used for:** All text inputs (names, descriptions)

**Function:** `String.prototype.localeCompare()`  
**Purpose:** Alphabetical sorting  
**Used for:** Member and activity sorting

---

## Function Count Summary

| Category | Count |
|----------|-------|
| REST API Routes | 55+ |
| Database Methods (per implementation) | 30+ |
| Service Functions | 20+ |
| Socket.io Events | 12+ |
| **Total Functions** | **110+** |

---

## Notes

- Most database methods have both in-memory and Azure Table Storage implementations (selected at runtime by the `*DbFactory` services)
- API routes are JWT-authenticated where noted and feature-gated per-organization via `requireFeature(...)` entitlements
- All API routes include error handling with appropriate status codes
- Station-scoped Socket.io events are broadcast to clients in the same station room; AAR collab events to the `aar-<CODE>` room
- Input validation is performed at the route level (express-validator)
- Business logic is in service layer, not routes

---

**End of Function Register**
