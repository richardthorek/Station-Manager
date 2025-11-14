# API Documentation

This document provides detailed information about the RFS Station Manager REST API and WebSocket events.

## Base URL

**Development**: `http://localhost:3000`
**Production**: `https://your-app.azurewebsites.net`

All API endpoints are prefixed with `/api`.

## Authentication

Currently, the API does not require authentication. This is by design for kiosk access. Future versions may add optional authentication for administrative functions.

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
  "name": "Jane Doe"
}
```

**Response** (201 Created):
```json
{
  "id": "new-uuid",
  "name": "Jane Doe",
  "qrCode": "generated-qr-code",
  "createdAt": "2024-11-14T12:00:00.000Z",
  "updatedAt": "2024-11-14T12:00:00.000Z"
}
```

**Errors**:
- `400`: Invalid or missing name

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
  "method": "mobile",  // "kiosk", "mobile", or "qr"
  "activityId": "activity-uuid",  // optional, uses active activity if not provided
  "location": "Station",  // optional
  "isOffsite": false  // optional, default false
}
```

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
- `400`: Missing member ID or no active activity set
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
