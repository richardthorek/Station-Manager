# API Documentation

This document provides detailed information about the RFS Station Manager REST API and WebSocket events.

## Base URL

**Development**: `http://localhost:3000`
**Production**: `https://your-app.azurewebsites.net`

All API endpoints are prefixed with `/api`.

## Authentication

Currently, the API does not require authentication. This is by design for kiosk access. Future versions may add optional authentication for administrative functions.

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

Currently, there are no rate limits. For production, consider implementing:
- 100 requests per minute per IP
- 1000 requests per hour per IP

---

## CORS

The backend allows requests from:
- Development: `http://localhost:5173`
- Production: Configured via `FRONTEND_URL` environment variable

---

## Future API Enhancements

Planned for future versions:
- Pagination for large member lists
- Filtering and sorting options
- Historical check-in data endpoints
- Export data to CSV/JSON
- QR code generation endpoint
- Authentication endpoints (optional)
- Admin-only endpoints

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
