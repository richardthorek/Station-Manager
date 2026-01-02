# RFS Station Manager - Function Register

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Purpose:** Comprehensive register of all backend functions, routes, and services

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
  "status": "ok" | "error",
  "timestamp": "ISO 8601 string",
  "database": "mongodb" | "in-memory",
  "environment": "development" | "production"
}
```
**Status Codes:** 200, 500

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

### MongoDB Database Service
**File:** `backend/src/services/mongoDatabase.ts`

Similar methods as in-memory, but with async/await and MongoDB operations.

### Truck Checks Database Services
**Files:**
- `backend/src/services/truckChecksDatabase.ts` (in-memory)
- `backend/src/services/mongoTruckChecksDatabase.ts` (MongoDB)

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
**Logic:** Returns in-memory DB for development, MongoDB for production  

**`initializeDatabase(): Promise<DatabaseService>`**  
**Purpose:** Initialize database connection  
**Logic:** Checks environment and MONGODB_URI to determine DB type  

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
| REST API Routes | 35+ |
| Database Methods (per implementation) | 30+ |
| Service Functions | 5+ |
| Socket.io Events | 10 |
| **Total Functions** | **80+** |

---

## Notes

- All database methods have both in-memory and MongoDB implementations
- All API routes include error handling with appropriate status codes
- Socket.io events are broadcast to all connected clients
- Input validation is performed at the route level
- Business logic is in service layer, not routes

---

**End of Function Register**
