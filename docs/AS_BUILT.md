# RFS Station Manager - As-Built Documentation

**Document Version:** 1.0  
**Last Updated:** January 2026  
**System Version:** 1.0.0  
**Status:** Production Ready

---

## Document Control

### As-Built Documentation Principle
This document is the **SINGLE SOURCE OF TRUTH** for the current implementation state, architecture, and technical details of the RFS Station Manager system. It must always reflect the actual deployed system - never create dated copies or "v2" versions.

### Related Documentation
- **Planning & Roadmap**: `docs/MASTER_PLAN.md` - Strategic planning, enhancement backlog, and future features
- **AI Development Guidelines**: `.github/copilot-instructions.md` - Repository conventions and development standards
- **Machine-Readable Registries**:
  - `docs/api_register.json` - REST API endpoints and WebSocket events (programmatic access)
  - `docs/function_register.json` - Backend functions and service methods (programmatic access)
- **Feature Documentation**:
  - `docs/API_DOCUMENTATION.md` - Human-readable API reference
  - `docs/FUNCTION_REGISTER.md` - Human-readable function reference
  - `docs/FEATURE_DEVELOPMENT_GUIDE.md` - Adding new features

### Update Requirements
This document MUST be updated when:
- Architecture or system design changes
- API endpoints are added, modified, or removed
- Database schema changes
- Deployment configuration changes
- Major components are added or removed
- Technology stack versions are updated

When updating this document, also update:
- `docs/api_register.json` if APIs changed
- `docs/function_register.json` if backend functions changed
- `docs/MASTER_PLAN.md` if strategic direction affected

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Design](#database-design)
5. [Application Components](#application-components)
6. [National Fire Service Facilities Dataset](#national-fire-service-facilities-dataset)
7. [Multi-Station Architecture](#multi-station-architecture)
8. [API Endpoints](#api-endpoints)
9. [Real-Time Communication](#real-time-communication)
10. [Security & Authentication](#security--authentication)
11. [Deployment Architecture](#deployment-architecture)
12. [Performance Characteristics](#performance-characteristics)
13. [Testing Coverage](#testing-coverage)
14. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Executive Summary

The RFS Station Manager is a modern, real-time digital sign-in system designed for NSW Rural Fire Service (RFS) volunteer stations. The system provides:

- **Real-time member presence tracking** across multiple devices
- **Activity and event management** for organizing station operations
- **Vehicle maintenance tracking** (truck checks)
- **Achievement system** for volunteer recognition
- **Multi-device synchronization** using WebSocket technology
- **Kiosk-friendly interface** optimized for station use

### Key Metrics
- **Total Lines of Code:** ~8,500 lines
- **Backend Code:** ~5,600 lines (TypeScript)
- **Frontend Code:** ~2,900 lines (TypeScript/React)
- **Test Coverage:** 67 API tests (100% pass rate: 45 backend general + 11 backend reports + 11 frontend reports)
- **API Endpoints:** 42+ REST endpoints (includes event auto-expiry management and reporting)
- **Real-time Events:** 10+ Socket.io event types

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Kiosk      │  │   Mobile     │  │   Desktop    │      │
│  │   Browser    │  │   Browser    │  │   Browser    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼───────────────────┼───────────────────┼───────────┘
          │                   │                   │
          │ HTTP/HTTPS        │ WebSocket (WSS)   │
          │                   │                   │
┌─────────▼───────────────────▼───────────────────▼───────────┐
│               Application Server Layer                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Node.js/Express Backend                       │ │
│  │  ┌─────────────┐        ┌──────────────┐             │ │
│  │  │  REST API   │        │  Socket.io   │             │ │
│  │  │  Routes     │        │  Server      │             │ │
│  │  └─────────────┘        └──────────────┘             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Business Logic Services                       │ │
│  │  • Member Management    • Event Management            │ │
│  │  • Activity Tracking    • Truck Checks                │ │
│  │  • Check-in Logic       • Achievements                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Azure Table Storage SDK
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  Data Layer                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Production: Azure Table Storage                      │ │
│  │  Development: In-Memory Database                       │ │
│  │                                                        │ │
│  │  Tables:                                               │ │
│  │  • members              • events                       │ │
│  │  • activities           • event_participants           │ │
│  │  • checkins            • appliances                    │ │
│  │  • active_activities   • templates                     │ │
│  │  • check_runs          • check_results                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  Storage Layer (Optional)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Azure Blob Storage                                    │ │
│  │  • Appliance photos                                    │ │
│  │  • Check result images                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Application Flow

1. **User Access**: Users access via browser (kiosk, mobile, desktop)
2. **Page Load**: Static frontend served from Express server
3. **Initial Connection**: REST API calls fetch initial data
4. **WebSocket Handshake**: Socket.io establishes real-time connection
5. **User Actions**: Button clicks trigger API calls
6. **Data Updates**: Backend updates database
7. **Broadcast**: Changes broadcast via Socket.io to all connected clients
8. **UI Update**: All clients receive updates and refresh displays

---

## Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | ~5.9.3 | Type-safe development |
| Vite | ^7.2.2 | Build tool and dev server |
| React Router DOM | ^7.9.6 | Client-side routing |
| Socket.io Client | ^4.8.1 | Real-time WebSocket communication |
| Framer Motion | ^12.23.24 | Animations and transitions |
| QRCode.react | ^4.2.0 | QR code generation |
| ESLint | ^9.39.1 | Code quality and linting |

### Backend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22.x | Runtime environment |
| Express | ^5.1.0 | Web framework |
| TypeScript | ^5.9.3 | Type-safe development |
| Socket.io | ^4.8.1 | Real-time bidirectional communication |
| **@azure/data-tables** | **^13.x** | **Azure Table Storage SDK (production database)** |
| Azure Storage Blob | ^12.29.1 | Cloud file storage |
| Multer | ^2.0.2 | File upload handling |
| CORS | ^2.8.5 | Cross-origin resource sharing |
| dotenv | ^17.2.3 | Environment configuration |
| Express Rate Limit | ^8.2.1 | API rate limiting |
| Jest | ^30.2.0 | Testing framework |
| Supertest | ^7.1.4 | HTTP testing |

### Development Tools

| Tool | Purpose |
|------|---------|
| nodemon | Auto-restart dev server |
| ts-node | TypeScript execution |
| ts-jest | TypeScript Jest support |
| ESLint | Code quality checks |
| TypeScript ESLint | TypeScript-specific linting |

---

## Database Design

### Database Architecture

**Current Status:** ✅ Azure Table Storage (Completed Q1 2026)

The system uses a factory pattern to support two database backends:

1. **Azure Table Storage** (Production)
   - Cost: $0.01-0.20/month per station (70-95% savings vs previous solution)
   - Connection: `AZURE_STORAGE_CONNECTION_STRING`
   - Enable: `USE_TABLE_STORAGE=true` (default in development)
   - Implementation: `backend/src/services/tableStorageDatabase.ts`

2. **In-Memory Database** (Development Only)
   - No persistence (data lost on restart)
   - Auto-selected when `NODE_ENV=development` and no Azure connection string
   - Implementation: `backend/src/services/database.ts`

**Selection Priority:**
```
USE_TABLE_STORAGE=true + AZURE_STORAGE_CONNECTION_STRING
  ↓ (if not available)
In-memory database (development fallback)
```

### Table Storage Partition Strategy

Efficient query patterns through strategic partitioning:

| Table | Partition Key | Row Key | Purpose |
|-------|--------------|---------|---------|
| Members | `'Member'` | `memberId` | All members in single partition |
| Activities | `'Activity'` | `activityId` | All activities together |
| Events | `'Event_YYYY-MM'` | `eventId` | Partitioned by month |
| EventParticipants | `eventId` | `participantId` | Co-located with event |
| ActiveActivity | `'ActiveActivity'` | `activityId` | Singleton current activity |
| CheckIns | `'CheckIn'` | `checkInId` | Legacy support |
| Appliances | `'Appliance'` | `applianceId` | Truck check appliances |
| ChecklistTemplates | `'Template'` | `templateId` | Checklist definitions |
| CheckRuns | `'CheckRun_YYYY-MM'` | `runId` | Partitioned by month |
| CheckResults | `runId` | `resultId` | Co-located with check run |

**Design Benefits:**
- Single-partition queries for members and activities (fast)
- Month-based partitioning for time-series data (events, check runs)
- Co-location pattern for related entities (participants with events)
- Efficient range queries on time-based data

### Collections Overview

#### 1. **members**
Stores registered station members.

```typescript
interface Member {
  id: string;              // UUID
  name: string;            // Full name
  qrCode: string;          // Unique QR identifier
  rank?: string;           // Optional rank (Captain, Deputy, etc.)
  memberNumber?: string;   // Optional member number
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- Primary: `id`
- Unique: `qrCode`
- Index: `name` (for search)

#### 2. **activities**
Predefined and custom activities.

```typescript
interface Activity {
  id: string;              // UUID
  name: string;            // Activity name
  isCustom: boolean;       // true if user-created
  createdBy?: string;      // Member ID who created it
  createdAt: Date;
}
```

**Default Activities:**
- Training
- Maintenance
- Meeting

#### 3. **checkins**
Historical check-in records (event-based).

```typescript
interface CheckIn {
  id: string;
  memberId: string;
  activityId: string;
  checkInTime: Date;
  checkOutTime?: Date;
  checkInMethod: 'kiosk' | 'mobile' | 'qr';
  location?: string;
  isOffsite: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4. **active_activities**
Current active activity for the station.

```typescript
interface ActiveActivity {
  id: string;
  activityId: string;      // Reference to activity
  setAt: Date;
  setBy?: string;          // Member who set it
}
```

#### 5. **events**
Discrete event instances.

```typescript
interface Event {
  id: string;
  name: string;
  type: 'incident' | 'training' | 'meeting' | 'maintenance' | 'other';
  startTime: Date;
  endTime?: Date;
  location?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 6. **event_participants**
Members participating in events.

```typescript
interface EventParticipant {
  id: string;
  eventId: string;
  memberId: string;
  checkInTime: Date;
  checkOutTime?: Date;
  role?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 7. **appliances**
Station vehicles/appliances.

```typescript
interface Appliance {
  id: string;
  name: string;
  callSign: string;
  type: 'tanker' | 'cat1' | 'cat7' | 'rescue' | 'trailer' | 'other';
  registrationNumber?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 8. **templates**
Checklist templates for truck checks.

```typescript
interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  items: ChecklistItem[];
  applianceTypes: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ChecklistItem {
  id: string;
  text: string;
  category?: string;
  requiresPhoto: boolean;
  order: number;
}
```

#### 9. **check_runs**
Truck check execution instances.

```typescript
interface CheckRun {
  id: string;
  applianceId: string;
  templateId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'in-progress' | 'completed' | 'failed';
  completedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 10. **check_results**
Individual check item results.

```typescript
interface CheckResult {
  id: string;
  checkRunId: string;
  itemId: string;
  status: 'done' | 'issue' | 'skipped';
  notes?: string;
  photoUrl?: string;
  checkedBy: string;
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Application Components

### Frontend Feature Structure

The application follows a feature-based architecture:

```
frontend/src/
├── features/
│   ├── landing/               # Home page
│   │   ├── LandingPage.tsx
│   │   └── LandingPage.css
│   ├── signin/                # Sign-in system
│   │   ├── SignInPage.tsx
│   │   ├── SignInLinkPage.tsx
│   │   ├── ActivitySelector.tsx
│   │   └── [styles]
│   ├── profile/               # Member profiles
│   │   ├── ProfilePage.tsx
│   │   └── ProfilePage.css
│   ├── truckcheck/            # Vehicle checks
│   │   ├── TruckCheckPage.tsx
│   │   ├── CheckWorkflowPage.tsx
│   │   ├── AdminDashboardPage.tsx
│   │   └── [styles]
│   └── reports/               # Reports & Analytics
│       ├── ReportsPage.tsx
│       └── ReportsPage.css
├── components/                # Shared components
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── [other shared]
├── hooks/                     # Custom React hooks
│   └── useSocket.ts
├── services/                  # API services
│   └── api.ts
└── types/                     # TypeScript definitions
    └── index.ts
```

### Backend Service Structure and Function Registry

**Machine-Readable Function Registry**: [`docs/function_register.json`](function_register.json) - Complete registry of all backend functions, service methods, and business logic

The function register contains:
- Service method signatures with parameter types
- Database operation functions
- Business logic implementations
- Utility functions
- Implementation file locations and line numbers
- Complexity analysis and side effects documentation

**Human-Readable Documentation**: [FUNCTION_REGISTER.md](FUNCTION_REGISTER.md) for detailed function reference.

```
backend/src/
├── routes/                    # Express route handlers
│   ├── members.ts
│   ├── activities.ts
│   ├── checkins.ts
│   ├── events.ts
│   ├── truckChecks.ts
│   └── achievements.ts
├── services/                  # Business logic
│   ├── database.ts           # In-memory DB service
│   ├── tableStorageDatabase.ts # Table Storage service (production)
│   ├── dbFactory.ts          # DB factory
│   ├── truckChecksDatabase.ts
│   ├── tableStorageTruckChecksDatabase.ts # Table Storage truck checks (production)
│   ├── truckChecksDbFactory.ts
│   ├── achievementService.ts
│   ├── rolloverService.ts    # Event auto-expiry service
│   ├── azureStorage.ts       # File storage
│   └── rfsFacilitiesParser.ts # National station lookup (CSV from blob storage)
├── types/                     # Type definitions
│   ├── index.ts
│   └── achievements.ts
└── __tests__/                 # Test suites
    ├── members.test.ts
    ├── activities.test.ts
    ├── checkins.test.ts
    └── setup.ts
```

---

## National Fire Service Facilities Dataset

### Overview

**Status:** ✅ Implemented with Azure Blob Storage integration (February 2026)

The system includes a national fire service facilities lookup feature that provides:
- **4,487 fire service facilities** across all Australian states and territories
- **Full-text search** by station name, suburb, or brigade
- **Geolocation-based sorting** for finding nearest stations
- **Multi-state support** (NSW RFS, VIC CFA, QLD QFES, etc.)

### Data Source

**Source:** Australian Digital Atlas of Emergency Services  
**Dataset:** Rural Fire Service and CFA Facilities  
**Format:** CSV (rfs-facilities.csv)  
**Size:** ~2.2MB  
**Records:** 4,487 facilities  

### Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Development Environment                                │
│  CSV stored locally at: backend/src/data/               │
│  Gitignored due to size (2.2MB)                         │
└─────────────────────────────────────────────────────────┘
                              │
                              │ Upload (one-time)
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Azure Blob Storage (Production)                        │
│  Container: data-files                                  │
│  Blob: rfs-facilities.csv                               │
│  Access: Public read                                     │
└─────────────────────────────────────────────────────────┘
                              │
                              │ Download at startup
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Azure App Service (Runtime)                            │
│  Path: /home/site/wwwroot/backend/dist/data/            │
│  Cached locally for subsequent restarts                 │
└─────────────────────────────────────────────────────────┘
```

### Implementation Details

**Service:** `backend/src/services/rfsFacilitiesParser.ts`  
**Upload Script:** `backend/src/scripts/uploadCsvToBlobStorage.ts`  
**Routes:** `backend/src/routes/stations.ts` (`/api/stations/lookup`, `/api/stations/count`)

**Key Features:**
- ✅ Automatic download from Azure Blob Storage if CSV not present locally
- ✅ Graceful degradation (app starts even if CSV unavailable)
- ✅ Efficient in-memory caching for fast lookups
- ✅ Station lookup returns 503 when data unavailable
- ✅ Singleton pattern for single instance per app

**Setup Process:**
1. Download CSV from atlas.gov.au (one-time)
2. Upload to Azure Blob Storage: `npm run upload:csv`
3. Deploy application - CSV auto-downloads at startup

**Documentation:** `docs/CSV_SETUP_AZURE.md` - Comprehensive setup guide

### API Endpoints

**GET /api/stations/lookup**
- Search and locate fire service stations nationally
- Supports text search and geolocation-based sorting
- Returns StationHierarchy objects with full facility details

**GET /api/stations/count**
- Get count of loaded facilities (for monitoring)
- Returns `{ count: number, available: boolean }`

### CSV Data Fields

Parsed fields from atlas.gov.au dataset:
- **Location**: Longitude (X), Latitude (Y), Address, Suburb, Postcode
- **Naming**: Facility Name, Brigade Name (1:1 mapping)
- **Hierarchy**: State, Area, District, Zone, Region
- **Status**: Operational Status
- **Type**: RFS Station, CFA Station, QFES Station

### Performance

- **Load Time:** ~100-200ms to parse CSV (4,487 records)
- **Memory Usage:** ~5-10MB for in-memory storage
- **Search Performance:** Sub-millisecond for text/location queries
- **Caching:** Singleton instance reused across all requests

### Graceful Degradation

If CSV data is unavailable:
- ✅ Application starts normally
- ✅ Station lookup endpoints return 503 with helpful message
- ✅ Other features (members, events, truck checks) unaffected
- ✅ Logs warning with instructions for enabling feature

---

## Multi-Station Architecture

### Overview

**Status:** ✅ Implemented (January 2026) - **Fixed:** Brigade membership isolation bug (February 2026)

The system supports multi-tenant operation where each RFS station's data (members, activities, events, truck checks) is isolated by `stationId`. This enables:
- **Single deployment serving multiple stations** - Cost-effective shared infrastructure
- **Data isolation** - Stations cannot access each other's data
- **Brigade-level visibility** - Future support for brigades with multiple stations
- **Backward compatibility** - Existing single-station deployments unaffected

**Recent Fix (February 2026):** Fixed critical bug in Azure Table Storage implementation where `getAllMembers()` was not filtering by `stationId`, causing new brigades to incorrectly show all members from other stations. The fix ensures proper data isolation across all database implementations.

### Station Identification

Stations are identified using the `X-Station-Id` HTTP header or `stationId` query parameter:

```http
# Via header (primary method)
GET /api/members
X-Station-Id: bungeendore-north

# Via query parameter (fallback for GET requests)
GET /api/members?stationId=bungeendore-north

# Without stationId (defaults to 'default-station')
GET /api/members
```

**Priority:** Header → Query Parameter → `DEFAULT_STATION_ID` (`'default-station'`)

### Station Middleware

All API routes use `stationMiddleware` to extract and attach `stationId` to requests:

```typescript
// backend/src/middleware/stationMiddleware.ts
export function stationMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerStationId = req.headers['x-station-id'];
  const queryStationId = req.query.stationId;
  const rawStationId = headerStationId || queryStationId;
  req.stationId = getEffectiveStationId(rawStationId); // Defaults to DEFAULT_STATION_ID
  next();
}
```

### Station Filtering Behavior

#### GET Endpoints (Read Operations)
All GET endpoints filter results by `stationId`:

| Endpoint | Filtering Behavior |
|----------|-------------------|
| `GET /api/members` | Returns only members belonging to specified station |
| `GET /api/activities` | Returns station-specific + shared activities |
| `GET /api/checkins` | Returns check-ins for specified station |
| `GET /api/events` | Returns events for specified station |
| `GET /api/truck-checks/appliances` | Returns appliances for specified station |
| `GET /api/reports/*` | All reports filtered by station |

#### POST Endpoints (Write Operations)
All POST endpoints assign `stationId` to newly created entities:

| Endpoint | Assignment Behavior |
|----------|-------------------|
| `POST /api/members` | New member assigned to station from header/query |
| `POST /api/activities` | New activity assigned to station |
| `POST /api/checkins` | Check-in assigned to station |
| `POST /api/events` | Event assigned to station |
| `POST /api/events/:id/participants` | Participant inherits event's stationId |
| `POST /api/truck-checks/appliances` | Appliance assigned to station |

### Database Schema Updates

All entities now include optional `stationId` field:

```typescript
interface Member {
  id: string;
  name: string;
  stationId?: string; // Defaults to 'default-station'
  // ... other fields
}

interface Activity {
  id: string;
  name: string;
  stationId?: string; // Shared activities use 'default-station'
  // ... other fields
}

// Similar for CheckIn, Event, CheckRun, etc.
```

#### Database Implementation Notes

**In-Memory Database (`database.ts`):**
- ✅ Correctly filters by `stationId` in `getAllMembers(stationId?: string)`
- ✅ Stores `stationId` in member entities
- ✅ Uses `getEffectiveStationId()` for default handling

**Table Storage Database (`tableStorageDatabase.ts`):**
- ✅ Fixed (Feb 2026): Now filters by `stationId` in `getAllMembers(stationId?: string)`
- ✅ Stores `stationId` in member table entities
- ✅ Validates `stationId` format to prevent injection attacks (alphanumeric, dash, underscore only)
- ✅ Consistent with in-memory database behavior

### Shared vs Station-Specific Data

**Station-Specific Data:**
- Members (always belong to one station)
- Check-ins (tied to member's station)
- Events (tied to specific station)
- Event participants (inherit event's stationId)
- Truck check runs (belong to station)
- Custom activities (created by station)

**Shared Data:**
- Default activities (Training, Maintenance, Meeting) - visible to all stations
- Station registry (defines available stations)

### Testing

Station filtering is validated with 32+ automated tests in `backend/src/__tests__/stationFiltering.test.ts`:

- ✅ Middleware extraction (header, query, default)
- ✅ Members filtering by station
- ✅ Activities filtering by station
- ✅ Check-ins filtering by station
- ✅ Events filtering by station
- ✅ Reports filtering by station
- ✅ Data isolation (no cross-station leakage)
- ✅ Backward compatibility (no stationId = default)

### Performance Impact

Station filtering has minimal performance impact:
- **Index-based filtering:** Table Storage queries use partition keys efficiently
- **In-memory filtering:** O(n) scan but small datasets (<1000 members per station)
- **No degradation:** Existing tests show no performance regression

### Migration Path

For existing deployments:
1. **No action required** - System defaults to `DEFAULT_STATION_ID` for backward compatibility
2. **Optional:** Assign existing data to appropriate `stationId` using migration scripts
3. **Enable multi-station:** Start passing `X-Station-Id` header in API calls

---

## API Endpoints

### Machine-Readable API Registry

**Primary Source**: [`docs/api_register.json`](api_register.json) - Complete machine-readable REST API and WebSocket event registry

The API register contains:
- Full endpoint definitions with request/response schemas
- Parameter types and validation rules
- WebSocket event payloads
- Implementation file locations
- Status codes and error responses

**Human-Readable Documentation**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for detailed endpoint reference.

### Endpoint Summary by Category

**Members (6 endpoints)**
- `GET /api/members` - List all members
- `GET /api/members/:id` - Get member details
- `GET /api/members/qr/:qrCode` - Get member by QR code
- `POST /api/members` - Create new member
- `PUT /api/members/:id` - Update member
- `GET /api/members/:id/history` - Get member check-in history

**Activities (4 endpoints)**
- `GET /api/activities` - List all activities
- `POST /api/activities` - Create custom activity
- `GET /api/activities/active` - Get current active activity
- `POST /api/activities/active` - Set active activity

**Check-ins (3 endpoints)**
- `GET /api/checkins/active` - Get active check-ins
- `POST /api/checkins` - Check in/out (toggle)
- `POST /api/checkins/url-checkin` - URL-based check-in

**Events (8 endpoints)**
- `GET /api/events` - List events (all, including inactive)
- `POST /api/events` - Create event
- `GET /api/events/active` - Get active events (excludes expired)
- `PUT /api/events/:id/end` - End event (mark inactive)
- `PUT /api/events/:id/reactivate` - Reactivate ended/expired event
- `POST /api/events/admin/rollover` - Manual expiry check trigger
- `POST /api/events/:id/participants` - Add participant
- `DELETE /api/events/:id/participants/:participantId` - Remove participant

**Truck Checks (10+ endpoints)**
- Appliance management
- Template management
- Check run execution
- Check result tracking

**Achievements (2 endpoints)**
- `GET /api/achievements/member/:memberId` - Get member achievements
- `GET /api/achievements/recent` - Get recent unlocks

**Reports & Analytics (5 endpoints)**
- `GET /api/reports/attendance-summary` - Monthly attendance statistics
- `GET /api/reports/member-participation` - Top members by participation
- `GET /api/reports/activity-breakdown` - Activity category breakdown
- `GET /api/reports/event-statistics` - Event statistics (count, duration, etc.)
- `GET /api/reports/truckcheck-compliance` - Truck check compliance metrics

**Health Check**
- `GET /health` - Server health status

---

## Real-Time Communication

### Socket.io Events

**Client → Server Events:**
None currently (server-initiated broadcasts only)

**Server → Client Events:**

| Event | Payload | Purpose |
|-------|---------|---------|
| `member-added` | `{ member: Member }` | New member registered |
| `member-updated` | `{ member: Member }` | Member details changed |
| `checkin` | `{ checkIn: CheckIn }` | New check-in created |
| `checkout` | `{ checkIn: CheckIn }` | Member checked out |
| `activity-change` | `{ activeActivity: ActiveActivity }` | Active activity changed |
| `event-created` | `{ event: Event }` | New event started |
| `event-ended` | `{ event: Event }` | Event completed |
| `participant-added` | `{ participant: EventParticipant }` | Member joined event |
| `participant-removed` | `{ participantId: string }` | Member left event |
| `achievement-unlocked` | `{ achievement: Achievement }` | Member unlocked achievement |

### Connection Management

- **Auto-reconnect**: Client automatically reconnects on disconnect
- **Heartbeat**: Socket.io built-in heartbeat mechanism
- **Namespace**: Default namespace (`/`)
- **Transport**: WebSocket preferred, falls back to polling

---

## Event Auto-Expiry System

### Overview

Events automatically become inactive after a configurable time period (default: 12 hours from start time). This eliminates the need for manual daily management while keeping expired events visible in the UI.

### Key Features

1. **Time-Based Expiry**
   - Events expire exactly 12 hours after `startTime` (configurable via `EVENT_EXPIRY_HOURS`)
   - Flexible timing - events can start at any time, not just midnight
   - No scheduled jobs required - expiry checked dynamically

2. **Visibility Behavior**
   - Expired events remain visible in event lists
   - Marked as `isActive: false` with `endTime` set
   - UI shows "inactive" tag instead of "active" tag
   - Cannot modify inactive events without reactivating first

3. **Manual Controls**
   - `PUT /api/events/:id/end` - Manually mark event as inactive
   - `PUT /api/events/:id/reactivate` - Reactivate ended/expired event
   - `POST /api/events/admin/rollover` - Trigger manual expiry check

### Implementation

**Service:** `backend/src/services/rolloverService.ts`

```typescript
// Check if event has exceeded expiry time
isEventExpired(event: Event, expiryHours?: number): boolean

// Mark expired events as inactive (called by getActiveEvents)
autoExpireEvents(events: Event[], db: IDatabase): Promise<string[]>

// Manual rollover trigger
deactivateExpiredEvents(db: IDatabase): Promise<string[]>
```

**Database Methods:**
- `getActiveEvents()` - Automatically expires old events before returning
- `reactivateEvent(id)` - Clears endTime and sets isActive=true

**Configuration:**
```bash
EVENT_EXPIRY_HOURS=12  # Default: 12 hours after event start
```

### Behavior Examples

| Event Start Time | Current Time | Status | Notes |
|------------------|--------------|--------|-------|
| Today 08:00 | Today 14:00 | Active | 6 hours elapsed |
| Today 08:00 | Today 20:00 | Active | 12 hours exactly (not yet expired) |
| Today 08:00 | Today 20:01 | Inactive | Auto-expired (>12 hours) |
| Yesterday 14:00 | Today 10:00 | Inactive | Auto-expired (20 hours) |

### Testing

- 15 comprehensive tests in `backend/src/__tests__/rollover.test.ts`
- Tests cover: expiry detection, auto-expiry, reactivation, visibility
- All 174 backend tests passing

---

## Station Selection Feature

### Overview

Comprehensive frontend station selection system enabling users to select and switch between RFS stations. Provides context management, UI components, API integration, and full test coverage.

**Status:** ✅ COMPLETED (January 2026)  
**Dependencies:** Station Management API (Issue #19c) ✅

### Components

#### 1. StationContext (`frontend/src/contexts/StationContext.tsx`)
Centralized state management for station selection.

**Features:**
- Loads stations from API on initialization
- Persists selection to localStorage (key: `selectedStationId`)
- Syncs across browser tabs via storage events
- Provides helper methods (selectStation, clearStation, isDemoStation, etc.)

**API Integration:**
- `getStations()` - Load all stations
- `getStation(id)` - Load single station
- Auto-selects default station on first load

#### 2. StationSelector Component (`frontend/src/components/StationSelector.tsx`)
Dropdown UI for station selection.

**Features:**
- Search/filter by name, brigade, district, area
- Keyboard navigation (arrows, enter, escape)
- Visual hierarchy display (area › district)
- Demo station highlighting with amber badge
- Responsive design (mobile, tablet, desktop)
- ARIA accessibility (labels, roles, keyboard support)
- Large touch targets (60px minimum)

**Styling:**
- RFS brand colors and design system
- Responsive breakpoints for all screen sizes
- High contrast mode support
- Reduced motion support
- Special demo station styling

#### 3. Header Component Integration
Station selector positioned prominently in header:
- **Desktop:** Center position, max-width 400px
- **Tablet/Mobile:** Full width below logo

### API Header Injection

All API requests now include `X-Station-Id` header:

```typescript
// Automatic header injection in ApiService
private getHeaders(additionalHeaders?: HeadersInit): HeadersInit {
  return {
    'X-Station-Id': getCurrentStationId(),
    ...additionalHeaders,
  };
}
```

**Fallback:** Uses `DEFAULT_STATION_ID` when no station selected.

### Testing

**Total Tests:** 136 (18 new station-related tests)

#### StationContext Tests (12 tests)
- Initialization and loading
- API integration and error handling
- Station selection and persistence
- localStorage integration
- Cross-tab synchronization
- Helper methods validation

#### StationSelector Tests (15 tests)
- Rendering and display
- Dropdown behavior
- Search and filtering
- Station selection
- Keyboard navigation
- ARIA accessibility
- Demo station badging

**Coverage:** All tests passing ✅

### Architecture Decisions

1. **Context API:** Chosen over Redux for simplicity
2. **localStorage:** Browser persistence for cross-session memory
3. **Header Injection:** Centralized in ApiService for consistency
4. **Auto-Selection:** Default station selected on first load for graceful UX

### Files

**New (5 files):**
- `frontend/src/contexts/StationContext.tsx`
- `frontend/src/contexts/StationContext.test.tsx`
- `frontend/src/components/StationSelector.tsx`
- `frontend/src/components/StationSelector.css`
- `frontend/src/components/StationSelector.test.tsx`

**Modified (5 files):**
- `frontend/src/App.tsx` - Added StationProvider
- `frontend/src/components/Header.tsx` - Added StationSelector
- `frontend/src/components/Header.css` - Updated layout
- `frontend/src/services/api.ts` - Added header injection
- `frontend/src/types/index.ts` - Added Station types

### Future Enhancements

Potential improvements (not in current scope):
- Station favorites
- Recent selections history
- Geolocation-based auto-selection
- Multi-station comparison view
- Station grouping by region

**Documentation:** See `docs/STATION_SELECTION_IMPLEMENTATION.md` for detailed implementation notes.

---

## Security & Authentication

### Current Security Measures

1. **CORS Configuration**
   - Configured for specific frontend URL
   - Methods restricted to GET, POST
   - Credentials not required

2. **Rate Limiting**
   - **API Routes:** 100 requests per 15 minutes per IP (configurable via `RATE_LIMIT_API_MAX`)
   - **Auth Routes:** 5 requests per 15 minutes per IP (configurable via `RATE_LIMIT_AUTH_MAX`) - Reserved for future auth endpoints
   - **SPA Fallback:** 100 requests per 15 minutes per IP
   - **Protected Endpoints:** All `/api/*` routes
   - **Headers:** Returns standard `RateLimit-*` headers (Limit, Remaining, Reset)
   - **Custom Error Messages:** Clear 429 responses with retry information
   - **Logging:** Rate limit violations logged for monitoring
   - **Configuration:** Adjustable via environment variables (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX`)

3. **Input Validation & Sanitization** ✅ ENHANCED (2026-01-04)
   - **express-validator** integrated on all POST/PUT/DELETE endpoints
   - **XSS Protection**: HTML entity escaping (< > & ' " characters)
   - **Type Validation**: String, boolean, enum validation
   - **Length Validation**: Min/max character limits enforced
   - **Pattern Validation**: Name fields (letters, spaces, hyphens, apostrophes only)
   - **Whitespace**: Automatic trimming
   - **Error Handling**: Field-level validation errors with clear messages
   - **Middleware Structure**:
     - `backend/src/middleware/validationHandler.ts` - Error handler
     - `backend/src/middleware/memberValidation.ts` - Members endpoints
     - `backend/src/middleware/activityValidation.ts` - Activities endpoints
     - `backend/src/middleware/eventValidation.ts` - Events endpoints
     - `backend/src/middleware/checkinValidation.ts` - Check-ins endpoints
     - `backend/src/middleware/truckCheckValidation.ts` - Truck checks endpoints
   - **Test Coverage**: 25 dedicated validation tests (147 total tests passing)

4. **HTTPS/WSS**
   - Production uses HTTPS for HTTP traffic
   - WSS (WebSocket Secure) for Socket.io

5. **Environment Variables**
   - Sensitive data in environment variables
   - Not committed to version control
   - Azure App Service application settings

### Authentication Status

**Current:** No authentication required (by design for kiosk access)

**Future Considerations:**
- Optional admin authentication for:
  - Member deletion
  - System settings
  - Historical data export
  - Template management

---

## Deployment Architecture

### Production Environment (Azure)

```
┌─────────────────────────────────────────────────────────┐
│  Azure Resource Group: rg-station-manager              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐│
│  │ Azure App Service (B1 tier)                        ││
│  │ Name: bungrfsstation                                ││
│  │ Runtime: Node.js 22.x                              ││
│  │ OS: Linux                                           ││
│  │ Serves: Backend API + Frontend SPA                  ││
│  └────────────────────────────────────────────────────┘│
│                                                          │
│  ┌────────────────────────────────────────────────────┐│
│  │ Azure Storage Account ⭐ PRIMARY                    ││
│  │ Service: Table Storage                              ││
│  │ Cost: $0.01-0.20/month per station                 ││
│  │ Region: Australia East                              ││
│  │ Tables: Members, Activities, Events, etc.          ││
│  │ + Blob Storage:                                    ││
│  │   - Container: reference-photos (checklist images) ││
│  │   - Container: result-photos (check result photos) ││
│  │   - Container: data-files (rfs-facilities.csv)    ││
│  │ Connection: AZURE_STORAGE_CONNECTION_STRING         ││
│  │ Enable: USE_TABLE_STORAGE=true                     ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Migration Completed (Q1 2026):**
- ✅ Table Storage services implemented
- ✅ Database factory updated with priority selection
- ✅ Testing and validation completed
- ✅ Production deployment successful
- ✅ Previous database solution decommissioned

### CI/CD Pipeline

**Primary Workflow:** `.github/workflows/ci-cd.yml`  
**Failure Handler:** `.github/workflows/create-issue-on-failure.yml`  
**Documentation:** `docs/ci_pipeline.md`

**Pipeline Stages:**

1. **Quality Checks (Parallel Execution)**
   - Frontend linting (ESLint) - Zero errors/warnings required
   - Backend type checking (TypeScript strict mode)
   - Frontend type checking (TypeScript strict mode)
   - Backend testing (Jest) - 45+ tests, 15%+ baseline coverage threshold

2. **Build (Runs if all quality checks pass)**
   - Install dependencies with npm caching
   - Build backend (TypeScript → JavaScript)
   - Build frontend (Vite production bundle)
   - Prune dev dependencies
   - Create deployment package (ZIP artifact)

3. **Deploy (Runs only on main branch after successful build)**
   - Download build artifact
   - Login to Azure (OIDC federated credentials)
   - Deploy to Azure App Service
   - Display deployment summary

4. **Post-Deployment Tests (NEW - Runs after deployment)**
   - Wait 30 seconds for deployment stabilization
   - Login to Azure using OIDC (identity-driven, no secrets)
   - Run 8 smoke tests against live deployment
   - Test with TABLE_STORAGE_TABLE_SUFFIX=Test (isolated test data)
   - Validate health check, API endpoints, and frontend
   - Generate test summary and fail pipeline if tests fail

**Quality Gates:**
- ✅ All linting must pass (zero errors, zero warnings)
- ✅ All type checks must pass (TypeScript strict mode)
- ✅ All tests must pass (45+ tests)
- ✅ Code coverage must meet 15%+ baseline threshold
- ✅ Build must succeed
- ✅ Deployment only on `main` branch merges
- ✅ Post-deployment smoke tests must pass (NEW)

**Optimizations:**
- Parallel job execution for independent tasks
- npm dependency caching (saves ~30-60 seconds per run)
- Concurrency control (cancels outdated PR runs)
- In-memory database for tests (no Azure dependencies)

**Failure Handling:**
- Automatic GitHub issue creation on pipeline failure
- Detailed error logs and job links included in issue
- Duplicate issue prevention
- Troubleshooting steps and resources provided

**Typical Execution Time:**
- Quality checks: ~2-3 minutes (parallel)
- Build: ~2-3 minutes
- Deploy: ~3-5 minutes
- **Total:** ~7-11 minutes (successful run)

**Trigger:** Push to `main` branch, pull requests to `main`, or manual dispatch

---

## Performance Characteristics

### Response Times (Target vs Actual)

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| Page Load (3G) | < 2s | ~1.5s | First contentful paint |
| API Response | < 500ms | ~100-300ms | Most endpoints |
| Real-time Sync | < 2s | ~500ms-1s | Socket.io broadcast |
| Database Query | < 100ms | ~50ms | In-memory dev mode |
| Database Query (Table Storage) | < 200ms | ~80-150ms | Single-partition queries (production) |
| Database Query (Table Storage) | < 500ms | ~200-400ms | Multi-partition queries (production) |

### Scalability

**Concurrent Users:**
- **Tested:** Up to 20 simultaneous connections
- **Designed for:** 50+ concurrent users
- **Bottleneck:** WebSocket connections (App Service tier dependent)

**Data Limits:**
- **Members:** No practical limit (tested with 100)
- **Check-ins:** Historical data accumulates (recommend archival after 12 months)
- **Events:** No limit (paginate in future for large datasets)

### Resource Usage

**Backend Memory:** ~150-250 MB (Node.js process)  
**Frontend Bundle:** ~500 KB (gzipped)  
**Database Size:** ~50 MB per year (estimated)

---

## Testing Coverage

### Backend API Tests

**Test Framework:** Jest + Supertest  
**Total Tests:** 45  
**Pass Rate:** 100%  
**Coverage Target:** 15%+ baseline (branches, functions, lines, statements)  
**Current Coverage:** ~16% (covers core APIs: members, activities, check-ins)  
**Future Goal:** Expand test coverage to 70%+ by adding tests for achievements, events, truck checks, and service layers

**Test Suites:**
1. **Members API** (16 tests)
   - CRUD operations
   - QR code lookup
   - Input validation
   - History retrieval

2. **Activities API** (16 tests)
   - List activities
   - Create custom activities
   - Active activity management
   - Integration tests

3. **Check-ins API** (13 tests)
   - Check-in/out toggle
   - Active check-ins
   - Multiple check-in methods
   - Location tracking

**Running Tests:**
```bash
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run test:post-deploy # Post-deployment smoke tests (requires APP_URL)
```

**Test Files:**
- `backend/src/__tests__/members.test.ts` - Members API tests
- `backend/src/__tests__/activities.test.ts` - Activities API tests
- `backend/src/__tests__/checkins.test.ts` - Check-ins API tests
- `backend/src/__tests__/achievements.test.ts` - Achievements API tests (basic)
- `backend/src/__tests__/events.test.ts` - Events API tests (basic)
- `backend/src/__tests__/truckChecks.test.ts` - Truck Checks API tests (basic)

### Post-Deployment Smoke Tests (NEW)

**Test Script:** `backend/src/scripts/postDeploymentTests.ts`  
**Documentation:** `docs/POST_DEPLOYMENT_TESTING.md`  
**Total Tests:** 8 smoke tests  
**Execution:** Automated in CI/CD after deployment

**Test Suite:**
1. Health check endpoint validation
2. API status endpoint validation
3. Activities API functionality
4. Members API functionality
5. Check-ins API functionality
6. Frontend SPA loading
7. CORS configuration check
8. Rate limiting configuration check

**Key Features:**
- **Identity-Driven:** Uses Azure OIDC (no connection strings)
- **Test Isolation:** TABLE_STORAGE_TABLE_SUFFIX=Test keeps test data separate
- **Retry Logic:** 3 attempts with 5-second delays
- **Configurable:** Timeout, retries, target URL via environment variables
- **Fast:** < 2 minutes total execution time

**Running Locally:**
```bash
cd backend
APP_URL=https://bungrfsstation.azurewebsites.net \
TABLE_STORAGE_TABLE_SUFFIX=Test \
npm run test:post-deploy
```

### Frontend Tests

**Status:** ✅ Implemented  
**Framework:** Vitest + React Testing Library  
**Coverage:** 93%+ code coverage

**Test Command:**
```bash
cd frontend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Test Statistics:**
- **Total Tests:** 136 tests across 12 test files
- **Test Files:** 10 component tests, 2 hook tests
- **Coverage:** 93%+ statements, 91%+ branches

**Test Files:**
- `src/components/ActiveCheckIns.test.tsx` (10 tests)
- `src/components/ActivitySelector.test.tsx` (12 tests)
- `src/components/CurrentEventParticipants.test.tsx` (16 tests)
- `src/components/EventCard.test.tsx` (13 tests)
- `src/components/Header.test.tsx` (6 tests)
- `src/components/MemberList.test.tsx` (17 tests)
- `src/components/StationSelector.test.tsx` (15 tests) ✨ NEW
- `src/contexts/StationContext.test.tsx` (12 tests) ✨ NEW
- `src/features/landing/LandingPage.test.tsx` (5 tests)
- `src/features/reports/ReportsPage.test.tsx` (11 tests)
- `src/hooks/useSocket.test.ts` (9 tests)
- `src/hooks/useTheme.test.ts` (9 tests)

**Test Infrastructure:**
- Mock utilities in `src/test/mocks/` (socket.ts, api.ts)
- Test utilities in `src/test/utils/test-utils.tsx`
- Test setup in `src/test/setup.ts` (jsdom, jest-dom matchers)

---

## Monitoring & Maintenance

### Health Monitoring

**Health Endpoint:** `GET /health`

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-01-02T12:00:00.000Z",
  "database": "table-storage",
  "environment": "production"
}
```

**Monitoring Recommendations:**
- Set up Azure Application Insights
- Monitor health endpoint (uptime checks)
- Alert on 5xx errors
- Track WebSocket connection count
- Monitor Azure Table Storage transaction metrics

### Logging

**Current Logging:**
- Console logging for errors
- Express request logging (minimal)
- Socket.io connection events

**Recommended Enhancements:**
- Structured logging (Winston or Pino)
- Log levels (info, warn, error)
- Log aggregation service (Azure Log Analytics)
- Request ID tracing

### Backup & Recovery

**Database Backups:**
- Azure Table Storage: Automatic geo-redundant storage (GRS)
- Point-in-time restore available through Azure support
- Data replicated across multiple Azure regions

**Code Backups:**
- Version control in GitHub
- Tagged releases for stable versions

**Disaster Recovery:**
- Azure App Service: Can redeploy from GitHub Actions
- Database: Restore from Azure Table Storage geo-redundant backups
- Recovery Time Objective (RTO): < 1 hour
- Recovery Point Objective (RPO): < 5 minutes

---

## Appendices

### A. Environment Variables

**Backend Required:**
```
MONGODB_URI=<cosmos-db-connection-string>
FRONTEND_URL=http://localhost:5173
```

**Backend Optional:**
```
PORT=3000
NODE_ENV=production|development
AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>
```

**Frontend:**
```
VITE_API_URL=http://localhost:3000
```

### B. Browser Compatibility

**Tested and Supported:**
- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Required Features:**
- WebSocket support
- ES6+ JavaScript
- CSS Grid and Flexbox

### C. Network Requirements

**Minimum Bandwidth:** 1 Mbps  
**Recommended Bandwidth:** 5+ Mbps  
**Protocols:** HTTPS (443), WSS (443)  
**Latency Tolerance:** < 500ms

### D. Related Documentation

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Complete API reference
- [GETTING_STARTED.md](GETTING_STARTED.md) - Development setup
- [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) - Deployment guide
- [TRUCK_CHECKS_IMPLEMENTATION.md](TRUCK_CHECKS_IMPLEMENTATION.md) - Truck checks feature
- [ACHIEVEMENTS.md](ACHIEVEMENTS.md) - Achievement system
- [EVENT_MANAGEMENT.md](EVENT_MANAGEMENT.md) - Event system

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | GitHub Copilot | Initial as-built documentation |

---

**End of As-Built Documentation**
