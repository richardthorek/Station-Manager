# RFS Station Manager - As-Built Documentation

**Document Version:** 1.0  
**Last Updated:** February 2026  
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
- **Test Coverage:** 481 backend tests (100% pass rate) + 214 frontend tests
- **API Endpoints:** 52+ REST endpoints (includes audit logging for event membership changes)
- **Database Tables:** 11 tables (includes EventAuditLogs for compliance)
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
| Vite | ^7.3.1 | Build tool and dev server |
| React Router DOM | ^7.12.0 | Client-side routing |
| Socket.io Client | ^4.8.1 | Real-time WebSocket communication |
| **Framer Motion** | **^12.33.0** | **Animations, transitions, and micro-interactions** |
| QRCode.react | ^4.2.0 | QR code generation |
| **vite-plugin-pwa** | **^1.2.0** | **PWA service worker generation** |
| **workbox-window** | **Latest** | **Service worker runtime library** |
| **idb** | **Latest** | **IndexedDB wrapper for offline storage** |
| ESLint | ^9.39.1 | Code quality and linting |
| Vitest | ^4.0.16 | Testing framework |

### Progressive Web App (PWA) Features

**Status**: ✅ Implemented (February 2026)

The application is a fully-featured Progressive Web App with:

1. **Service Worker** - Automatic caching and offline support
   - Cache-first strategy for static assets (JS, CSS, images, fonts)
   - Network-first strategy for API calls (10s timeout, then cache fallback)
   - Automatic background updates
   - Cache cleanup and versioning
   
2. **Offline Queue System**
   - IndexedDB-based persistent storage
   - Automatic sync when connection restored
   - Retry logic with exponential backoff (up to 3 attempts)
   - Support for check-ins, member creation, events, and more
   
3. **Installability**
   - Install prompt with feature highlights
   - Add to Home Screen on iOS and Android
   - Standalone display mode
   - Appropriate icons (192x192, 512x512)
   
4. **Offline Indicator**
   - Real-time connection status banner
   - Queued actions display with details
   - Manual sync trigger
   - Visual feedback for sync progress

**Implementation Files**:
- `frontend/vite.config.ts` - PWA plugin configuration
- `frontend/src/services/offlineStorage.ts` - IndexedDB wrapper (225 lines)
- `frontend/src/services/offlineQueue.ts` - Queue manager (188 lines)
- `frontend/src/services/offlineSupport.ts` - Helper utilities (216 lines)
- `frontend/src/components/OfflineIndicator.tsx` - Status UI (221 lines)
- `frontend/src/components/InstallPrompt.tsx` - Install prompt (159 lines)

**Caching Strategy**:
- Static assets: Cache-first, 30-day expiration
- API responses: Network-first with 10s timeout, 24-hour cache
- Images: Cache-first, 30-day expiration, max 50 entries
- Google Fonts: Cache-first, 1-year expiration

### Animations & Page Transitions

**Status**: ✅ Implemented (February 2026)

The application features smooth, GPU-accelerated animations using Framer Motion:

1. **Page Transitions** - Smooth route changes
   - AnimatePresence wrapper with `mode="wait"` for clean transitions
   - 300ms transition duration with easing curve `[0.4, 0, 0.2, 1]`
   - Variants: fade, slideFromBottom, slideFromRight, scale
   - All 14 route pages include PageTransition wrapper

2. **Staggered Animations** - Sequential entrance effects
   - Landing page cards stagger in with 100ms delay between items
   - Container/item pattern for coordinated animations
   - Configurable delay and stagger timing

3. **Micro-Interactions** - Button and element feedback
   - AnimatedButton component with hover/tap animations
   - Scale transformations (1.02-1.1 on hover, 0.9-0.98 on tap)
   - Smooth transitions (200ms fast, 300ms standard, 400ms slow)

4. **Performance Optimization**
   - GPU acceleration using `transform` and `opacity` only (60fps target)
   - Hardware acceleration hints (`will-change`, `backface-visibility`)
   - Reduced-motion support via `prefers-reduced-motion` media query
   - Graceful degradation to instant transitions for accessibility

5. **Accessibility**
   - `useReducedMotion()` hook detects user preference
   - Animations simplified to opacity-only when reduced motion enabled
   - Smooth scrolling disabled for reduced-motion users
   - All animations respect user's accessibility settings

**Implementation Files**:
- `frontend/src/utils/animations.ts` - Animation variants and utilities (230 lines)
- `frontend/src/components/PageTransition.tsx` - Route transition wrapper (45 lines)
- `frontend/src/components/AnimatedButton.tsx` - Button micro-interactions (60 lines)
- `frontend/src/animations.css` - Global animation styles and keyframes (180 lines)
- `frontend/src/App.tsx` - AnimatePresence integration with React Router

**Animation Variants**:
```typescript
pageTransitions: {
  fade: { opacity: 0 → 1 },
  slideFromBottom: { opacity: 0, y: 20 → opacity: 1, y: 0 },
  slideFromRight: { opacity: 0, x: 20 → opacity: 1, x: 0 },
  scale: { opacity: 0, scale: 0.95 → opacity: 1, scale: 1 }
}

buttonVariants: {
  standard: hover: scale 1.02, tap: scale 0.98,
  primary: hover: scale 1.05, tap: scale 0.95,
  icon: hover: scale 1.1, tap: scale 0.9
}
```

**Performance Metrics**:
- Consistent 60fps during animations
- No layout shifts during page transitions
- ~2KB additional gzipped JS for animation utilities
- Zero performance impact when reduced-motion enabled


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
| Compression | ^1.7.5 | Response compression (gzip) |
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
| EventAuditLogs | `eventId` | `auditLogId` | Audit trail co-located with event |
| ActiveActivity | `'ActiveActivity'` | `activityId` | Singleton current activity |
| CheckIns | `'CheckIn'` | `checkInId` | Legacy support |
| Appliances | `'Appliance'` | `applianceId` | Truck check appliances |
| ChecklistTemplates | `'Template'` | `templateId` | Checklist definitions |
| CheckRuns | `'CheckRun_YYYY-MM'` | `runId` | Partitioned by month |
| CheckResults | `runId` | `resultId` | Co-located with check run |

**Design Benefits:**
- Single-partition queries for members and activities (fast)
- Month-based partitioning for time-series data (events, check runs)
- Co-location pattern for related entities (participants with events, audit logs with events)
- Efficient range queries on time-based data
- Complete audit trail for compliance and traceability

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

#### 7. **event_audit_logs** ✨ NEW
Comprehensive audit trail for event membership changes. Provides complete traceability of who added/removed whom, when, where, and from what device.

```typescript
interface EventAuditLog {
  id: string;                              // UUID
  eventId: string;                         // Event being audited
  action: 'participant-added' | 'participant-removed'; // Action type
  timestamp: Date;                         // When action occurred
  
  // Who performed the action
  performedBy?: string;                    // User/member who performed action
  
  // Who was affected
  memberId: string;                        // Member added/removed
  memberName: string;                      // Member name (snapshot)
  memberRank?: string;                     // Member rank (snapshot)
  
  // Participant details
  participantId: string;                   // EventParticipant record ID
  checkInMethod: 'kiosk' | 'mobile' | 'qr' | 'manual';
  
  // Device and location traceability
  deviceInfo?: {
    type?: string;                         // Device type (mobile, tablet, desktop, kiosk)
    model?: string;                        // Device model
    deviceId?: string;                     // Device identifier (e.g., kiosk token)
    userAgent?: string;                    // Browser user agent
    ip?: string;                           // IP address
  };
  locationInfo?: {
    latitude?: number;                     // GPS latitude
    longitude?: number;                    // GPS longitude
    accuracy?: number;                     // GPS accuracy (meters)
    address?: string;                      // Human-readable address
    ipLocation?: string;                   // IP-based location estimate
  };
  
  // Additional context
  stationId?: string;                      // Station where action occurred
  requestId?: string;                      // Request correlation ID
  notes?: string;                          // Optional reason/notes (max 500 chars)
  
  createdAt: Date;
}
```

**Purpose:**
- **Compliance**: Complete audit trail for suspicious activity review
- **Traceability**: Track off-site sign-ins and post-event modifications
- **Accountability**: Record who made changes and why
- **Security**: Detect unauthorized access patterns

**Privacy & Security:**
- Device IDs and location data sanitized and anonymized where appropriate
- Notes limited to 500 characters with control character stripping
- IP addresses captured for security monitoring only
- Compliant with privacy policies for volunteer organizations

#### 8. **appliances**
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
│   │   ├── CheckWorkflowPage.tsx      # Enhanced with progress bar, swipe gestures, icons
│   │   ├── CheckSummaryPage.tsx       # Enhanced with QR code, photo grid
│   │   ├── AdminDashboardPage.tsx
│   │   ├── TemplateEditorPage.tsx
│   │   ├── TemplateSelectionPage.tsx
│   │   ├── VehicleManagement.tsx
│   │   └── [styles]
│   ├── reports/               # Reports & Analytics
│   │   ├── ReportsPage.tsx
│   │   ├── ReportsPageEnhanced.tsx
│   │   ├── AdvancedReportsPage.tsx
│   │   ├── CrossStationReportsPage.tsx
│   │   └── ReportsPage.css
│   └── admin/                 # Admin features
│       ├── stations/          # Station management
│       │   ├── StationManagementPage.tsx
│       │   └── [styles]
│       └── brigade-access/    # Brigade access token management
│           ├── BrigadeAccessPage.tsx
│           ├── StationTokenCard.tsx
│           └── BrigadeAccessPage.css
├── components/                # Shared components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Lightbox.tsx           # NEW: Photo lightbox modal with keyboard support
│   ├── Confetti.tsx           # NEW: Celebration confetti animation
│   └── [other shared]
├── hooks/                     # Custom React hooks
│   └── useSocket.ts
├── services/                  # API services
│   └── api.ts
└── types/                     # TypeScript definitions
    └── index.ts
```

### Frontend Theming
- Global CSS variables in `frontend/src/index.css` carry the NSW RFS palette and theme surfaces for light/dark modes.
- February 2026 update: added contrast-safe status tokens (`--surface-error/warning/info/success`, `--text-error-strong`, `--text-warning-strong`, `--text-info-strong`, `--text-success-strong`, `--text-on-amber`) and applied them to admin alerts/badges to meet WCAG AA in both themes.

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
│   ├── achievements.ts
│   ├── stations.ts
│   ├── brigadeAccess.ts      # Kiosk mode token management
│   └── reports.ts
├── services/                  # Business logic
│   ├── database.ts           # In-memory DB service
│   ├── tableStorageDatabase.ts # Table Storage service (production)
│   ├── dbFactory.ts          # DB factory
│   ├── truckChecksDatabase.ts
│   ├── tableStorageTruckChecksDatabase.ts # Table Storage truck checks (production)
│   ├── truckChecksDbFactory.ts
│   ├── achievementService.ts
│   ├── brigadeAccessService.ts # Brigade access token service
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

### Station Creation & Duplicate Prevention

**Status:** ✅ Implemented (February 2026)

To prevent duplicate station creation and improve station lookup usability:

#### Duplicate Prevention
- **Brigade ID Uniqueness:** Each station must have a unique `brigadeId`
- **Real-time Validation:** Frontend checks for duplicates with 500ms debounce as user types
- **Backend Enforcement:** `POST /api/stations` returns 409 Conflict if brigade ID already exists
- **UI Feedback:** Clear indicators show when brigade ID is available or already in use
- **Blocked Submission:** Create button disabled if duplicate detected

#### Search Prioritization
- **Text-First Results:** When typing in search field, text matches prioritize over location-based results
- **Location Fallback:** If no search query, shows 10 closest stations by geolocation
- **User Feedback:** Clear messaging indicates whether showing search results or location-based results
- **National Dataset:** Searches across all Australian fire service facilities (NSW, VIC, QLD, etc.)

#### Implementation Details
- **Check Endpoint:** `GET /api/stations/check-brigade/:brigadeId` - Returns existing station if found
- **Lookup Logic:** Modified `rfsFacilitiesParser.lookup()` to prioritize search query over location
- **CreateStationModal:** Uses `useEffect` hook with debouncing for duplicate checking
- **Visual Feedback:** Shows "Checking availability...", "✓ Brigade ID is available", or error message

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

### Kiosk Mode & Brigade Access Tokens

**Status:** ✅ Implemented (February 2026)

Kiosk mode provides strict brigade/station locking for shared devices (iPads, tablets) to prevent cross-brigade data access.

#### Purpose

- **Data Isolation:** Ensures kiosk devices can only access their assigned brigade's data
- **Unattended Operation:** Prevents users from switching stations on shared devices
- **Security:** Cryptographically secure tokens (UUID v4, 128-bit) prevent unauthorized access

#### How It Works

1. **Token Generation:** Administrator generates a brigade access token for each device
2. **URL-Based Activation:** Device accesses station manager via special URL with token: `?brigade=<uuid-token>`
3. **Session Locking:** Token validated on load, station locked for browser session
4. **UI Indication:** Lock icon 🔒 and "Kiosk Mode" badge displayed

#### Architecture

**Backend Components:**
- `services/brigadeAccessService.ts` - Token lifecycle management (create, validate, revoke, query)
- `middleware/kioskModeMiddleware.ts` - Validates brigade tokens from URL query parameters
- `routes/brigadeAccess.ts` - REST API for token management (6 endpoints)

**Frontend Components:**
- `utils/kioskMode.ts` - Kiosk mode detection and management
- `contexts/StationContext.tsx` - Validates tokens on initialization, locks station selection
- `components/StationSelector.tsx` - Shows locked UI in kiosk mode, disables dropdown

#### Token Security

```typescript
interface BrigadeAccessToken {
  token: string;          // UUID v4 (128-bit random)
  brigadeId: string;      // Brigade this token grants access to
  stationId: string;      // Station to lock to
  createdAt: Date;
  expiresAt?: Date;       // Optional expiration for rotation
  description?: string;   // Device identification (e.g., "Main Kiosk iPad")
}
```

**Security Properties:**
- Tokens are UUID v4 (2^128 possible values = statistically unguessable)
- Generated using Node.js `crypto.randomUUID()` (cryptographically secure PRNG)
- Server-side validation on every request via middleware
- Optional expiration dates enforce regular token rotation
- Stored in sessionStorage (cleared on browser close) not localStorage

#### API Endpoints

**Brigade Access Management:**
- `POST /api/brigade-access/generate` - Generate new kiosk token (returns kioskUrl)
- `POST /api/brigade-access/validate` - Validate token and get station info
- `DELETE /api/brigade-access/:token` - Revoke token immediately
- `GET /api/brigade-access/brigade/:brigadeId` - List all tokens for brigade
- `GET /api/brigade-access/station/:stationId` - List all tokens for station
- `GET /api/brigade-access/stats` - Get active token statistics

#### Usage Example

```bash
# Generate token for a kiosk device
curl -X POST /api/brigade-access/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brigadeId": "main-brigade",
    "stationId": "main-station-1",
    "description": "Main Entrance Kiosk iPad",
    "expiresInDays": 365
  }'

# Response
{
  "success": true,
  "token": "a3d5e8f2-1234-4abc-8def-9876543210ab",
  "brigadeId": "main-brigade",
  "stationId": "main-station-1",
  "description": "Main Entrance Kiosk iPad",
  "createdAt": "2026-02-06T00:00:00.000Z",
  "expiresAt": "2027-02-06T00:00:00.000Z",
  "kioskUrl": "https://stationmanager.com/signin?brigade=a3d5e8f2-1234-4abc-8def-9876543210ab"
}
```

#### Testing

Comprehensive test coverage with 38 new tests:
- **brigadeAccessService.test.ts** - 20 tests covering:
  - Token generation (with/without expiration, description)
  - Token validation (valid, invalid, expired)
  - Token revocation
  - Brigade/station token queries
  - Token expiration and cleanup
  
- **brigadeAccessRoutes.test.ts** - 18 integration tests covering:
  - All 6 API endpoints
  - Request validation (400 errors)
  - Token not found (404 errors)
  - Success responses (200/201)
  - UUID format validation

**Result:** All 358 backend tests passing (includes 38 new kiosk mode tests)

#### Documentation

- **Administrator Guide:** `docs/KIOSK_MODE_SETUP.md` - Complete setup and troubleshooting guide
- **Security Model:** Token best practices, rotation policies, physical security recommendations
- **API Reference:** Full curl examples for all endpoints

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
- `POST /api/checkins/url-checkin` - URL-based check-in (member ID in `user` query param is preferred; falls back to name for legacy links; enforces stationId to prevent cross-station check-ins)

**Events (9 endpoints)** ✨ NEW: Audit logging
- `GET /api/events` - List events (all, including inactive)
- `POST /api/events` - Create event
- `GET /api/events/active` - Get active events (excludes expired)
- `GET /api/events/:eventId/audit` - Get audit log for event (NEW)
- `PUT /api/events/:id/end` - End event (mark inactive)
- `PUT /api/events/:id/reactivate` - Reactivate ended/expired event
- `POST /api/events/admin/rollover` - Manual expiry check trigger
- `POST /api/events/:id/participants` - Add participant (with audit logging)
- `DELETE /api/events/:id/participants/:participantId` - Remove participant (with audit logging)

**Truck Checks (10+ endpoints)**
- Appliance management
- Template management
- Check run execution
- Check result tracking

**Achievements (2 endpoints)**
- `GET /api/achievements/member/:memberId` - Get member achievements
- `GET /api/achievements/recent` - Get recent unlocks

**Reports & Analytics (9 endpoints)**
- `GET /api/reports/attendance-summary` - Monthly attendance statistics
- `GET /api/reports/member-participation` - Top members by participation
- `GET /api/reports/activity-breakdown` - Activity category breakdown
- `GET /api/reports/event-statistics` - Event statistics (count, duration, etc.)
- `GET /api/reports/truckcheck-compliance` - Truck check compliance metrics
- `GET /api/reports/advanced/trend-analysis` - Advanced trend analysis (MoM/YoY growth)
- `GET /api/reports/advanced/heat-map` - Activity heat map by day/hour
- `GET /api/reports/advanced/funnel` - Member funnel analysis (conversion through stages)
- `GET /api/reports/advanced/cohort` - Cohort analysis (member retention by registration month)

**Health Check**
- `GET /health` - Server health status

**Stations (8 endpoints)**
- `GET /api/stations` - List all stations with filtering
- `GET /api/stations/:id` - Get station by ID
- `GET /api/stations/brigade/:brigadeId` - Get stations by brigade
- `GET /api/stations/check-brigade/:brigadeId` - Check if brigade ID exists (duplicate prevention)
- `GET /api/stations/lookup` - Search national fire service facilities dataset
- `GET /api/stations/count` - Get count of loaded facilities
- `POST /api/stations` - Create new station (with duplicate prevention)
- `POST /api/stations/demo/reset` - Reset demo station data
- `PUT /api/stations/:id` - Update station
- `DELETE /api/stations/:id` - Soft delete station

**Brigade Access (7 endpoints)**
- `POST /api/brigade-access/generate` - Generate kiosk token
- `POST /api/brigade-access/validate` - Validate token
- `DELETE /api/brigade-access/:token` - Revoke token
- `GET /api/brigade-access/brigade/:brigadeId` - List brigade tokens
- `GET /api/brigade-access/station/:stationId` - List station tokens
- `GET /api/brigade-access/stats` - Token statistics
- `GET /api/brigade-access/all-tokens` - List all tokens (admin utility)

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

**Documentation:** See `docs/archive/STATION_SELECTION_IMPLEMENTATION.md` for historical implementation notes.

---

## Truck Check Visual Enhancements

### Overview

Comprehensive visual and UX enhancements to the truck check workflow, providing clear visual guidance, prominent issue highlighting, and interactive photo management.

**Status:** ✅ COMPLETED (February 2026)  
**GitHub Issue:** richardthorek/Station-Manager#34

### New Components

#### 1. Lightbox (`frontend/src/components/Lightbox.tsx`)
Modal image viewer for full-screen photo viewing.

**Features:**
- Full-screen modal with Framer Motion animations
- Keyboard navigation (Escape key to close)
- Click outside to close
- Prevents body scroll when open
- Accessible with ARIA labels (role="dialog", aria-modal="true")
- Image scaling with smooth transitions

**Test Coverage:**
- 8 comprehensive tests in `Lightbox.test.tsx`
- Tests cover: rendering, interaction, keyboard, ARIA, body scroll

**Styling:**
- Dark overlay (90% opacity black)
- Centered image with max 90vh/90vw
- Close button (top-right, 50px touch target)
- Smooth fade/scale animations

#### 2. Confetti (`frontend/src/components/Confetti.tsx`)
Animated celebration for check completion.

**Features:**
- 50 confetti pieces with random positioning
- NSW RFS brand colors (#e5281B red, #cbdb2a lime, #fbb034 amber, #215e9e blue, #008550 green, #4CAF50 success)
- Configurable duration (default 3 seconds)
- Auto-cleanup after animation
- Respects `prefers-reduced-motion`
- Decorative with `aria-hidden="true"`

**Test Coverage:**
- 6 comprehensive tests in `Confetti.test.tsx`
- Tests cover: rendering, duration, cleanup, colors, positioning

**Animation:**
- Framer Motion for smooth physics-based falling
- Random delays (0-500ms) for natural effect
- Random durations (2-3 seconds)
- 360° rotation during fall

### Enhanced Pages

#### CheckWorkflowPage Enhancements

**Horizontal Progress Bar:**
- Animated gradient progress bar at top of header
- Shows completion percentage (e.g., "5 of 10 items completed (50%)")
- Smooth width animation with Framer Motion
- Lime green gradient fill (#cbdb2a to #a8c920)
- Prominent with subtle glow effect

**Checklist Item Cards:**
- Color-coded status badges (done, issue, skipped)
- **Contextual Icons:** Smart assignment based on item name:
  - 🛢️ Oil/fluid items
  - 🛞 Tire/wheel items
  - 💡 Light/beacon items
  - 🚿 Hose/water items
  - 📻 Radio/communication items
  - ⛽ Fuel/tank items
  - 🔋 Battery items
  - 🧯 Extinguisher/fire items
  - 🔧 Tool/equipment items
  - 🏥 First aid/medical items
  - 🪜 Ladder items
  - ⚙️ Pump items
  - ✓ Default checkmark
- Icon in circular background with lime accent
- Framer Motion card animations (fade-in, scale)

**Issue Highlighting:**
- Cards with `has-issue` class get prominent styling:
  - 3px solid amber border (#fbb034)
  - Enhanced box-shadow with amber glow
  - Special background tint (rgba(251, 176, 52, 0.08))
- Issue comment boxes with amber left border
- High visibility for safety-critical issues

**Swipe Gestures:**
- Touch event handlers (onTouchStart, onTouchMove, onTouchEnd)
- Left swipe = Next item
- Right swipe = Previous item
- Minimum threshold: 50px
- Natural navigation for tablet/mobile users

**Photo Integration:**
- Reference photos and result photos clickable
- Hover overlay with zoom icon (🔍)
- Opens Lightbox on click
- Smooth transition animations

**Completion Celebration:**
- Confetti animation triggers when all items complete
- Spring-animated completion card (scale, fade)
- Large emoji (🎉) with bounce animation
- Call-to-action button to summary

#### CheckSummaryPage Enhancements

**QR Code Generation:**
- Uses `qrcode.react` library
- Generates shareable QR code with URL to check summary
- Toggle button to show/hide QR section
- QR code in white container for scanability
- Size: 200x200px with high error correction (level H)

**Photo Grid:**
- Thumbnail grid for all result photos
- Clickable thumbnails (150px height)
- Hover effects with zoom icon overlay
- Opens Lightbox for full-screen viewing
- Accessible with proper ARIA labels

**Enhanced Result Display:**
- Photos inline with each result item
- Issue comments prominently highlighted
- Status badges color-coded (done/issue/skipped)
- Cleaner visual hierarchy

### CSS Architecture

**CheckWorkflow.css Additions:**
- `.horizontal-progress-bar` - Progress indicator container
- `.progress-bar-track` - Progress bar background
- `.progress-bar-fill` - Animated gradient fill
- `.check-item-card.has-issue` - Issue card styling
- `.item-header` & `.item-icon` - Icon display
- `.photo-button` & `.photo-overlay` - Photo hover effects
- `.result-comment-box` - Issue comment styling

**CheckSummary.css Additions:**
- `.result-photo-thumbnail` - Photo grid styling
- `.photo-thumbnail-button` - Clickable thumbnails
- `.qr-code-section` - QR code container
- `.qr-code-container` - White background for QR
- `.btn-secondary` - Secondary button styling

**Lightbox.css:**
- Full-screen overlay (z-index: 9999)
- Close button positioning
- Image centering and sizing
- Mobile responsive styling

**Confetti.css:**
- Fixed positioning (z-index: 9998)
- Confetti piece styling (10x10px)
- Respects prefers-reduced-motion

### Accessibility

**WCAG AA Compliance:**
- All color contrast ratios ≥ 4.5:1
- Touch targets ≥ 48px (60px for critical actions)
- Keyboard navigation supported
- Proper ARIA labels throughout
- Screen reader friendly

**Keyboard Support:**
- Escape key closes lightbox
- Tab navigation for all interactive elements
- Focus indicators visible
- Logical focus order

**Reduced Motion:**
- Confetti animation disabled if `prefers-reduced-motion: reduce`
- Framer Motion respects user preferences
- Fallback to static states

### Performance

**Optimizations:**
- Hardware-accelerated animations (transform, opacity)
- Efficient re-renders with React.memo where applicable
- Confetti auto-cleanup prevents memory leaks
- Lightbox prevents body scroll for better UX
- Image lazy loading for reference photos

**Bundle Impact:**
- New components add ~15KB to bundle (minified + gzipped)
- Framer Motion already included (no new dependency)
- qrcode.react: ~8KB (new dependency)

### Testing

**Test Statistics:**
- 14 new tests added (8 Lightbox + 6 Confetti)
- 100% test pass rate
- Coverage includes: rendering, interaction, keyboard, accessibility, animations

**Test Files:**
- `frontend/src/components/Lightbox.test.tsx`
- `frontend/src/components/Confetti.test.tsx`

**Linting:**
- 0 new ESLint errors
- All code follows project conventions
- TypeScript strict mode compliance

### Implementation Files

**New Files (6):**
- `frontend/src/components/Lightbox.tsx`
- `frontend/src/components/Lightbox.css`
- `frontend/src/components/Lightbox.test.tsx`
- `frontend/src/components/Confetti.tsx`
- `frontend/src/components/Confetti.css`
- `frontend/src/components/Confetti.test.tsx`

**Modified Files (4):**
- `frontend/src/features/truckcheck/CheckWorkflowPage.tsx`
- `frontend/src/features/truckcheck/CheckWorkflow.css`
- `frontend/src/features/truckcheck/CheckSummaryPage.tsx`
- `frontend/src/features/truckcheck/CheckSummary.css`

### User Experience Improvements

1. **Clear Progress Tracking:** Visual progress bar shows exactly where you are
2. **Smart Icons:** Contextual icons help identify item types at a glance
3. **Issue Prominence:** Problems stand out immediately with amber highlighting
4. **Photo Management:** Easy to view and compare reference/result photos
5. **Celebration Feedback:** Positive reinforcement on completion
6. **Shareable Results:** QR codes enable easy result sharing
7. **Touch-Friendly:** Swipe gestures feel natural on tablets

### Future Enhancements

Potential improvements (not in current scope):
- Image compression on upload (reduce storage costs)
- Photo annotation tools (draw on photos to highlight issues)
- Photo comparison slider (before/after)
- Offline photo caching
- PDF export of check with photos
- Email/SMS notifications with QR code

---

## Security & Authentication

### Current Security Measures

1. **Security Headers (Helmet)** ✅ IMPLEMENTED (2026-02-06)
   - **Helmet Middleware**: Industry-standard security headers via helmet 8.1.0
   - **Content-Security-Policy (CSP)**: Protects against XSS and injection attacks
     - `default-src 'self'` - Only allow resources from same origin by default
     - `script-src 'self' https://www.clarity.ms https://scripts.clarity.ms` - JavaScript from same origin + Microsoft Clarity analytics (both domains)
     - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` - Styles from same origin + inline (React) + Google Fonts
     - `font-src 'self' data: https://fonts.gstatic.com` - Fonts from same origin, data URIs, and Google Fonts
     - `img-src 'self' data: blob: https:` - Images from same origin, data URIs, blobs, and HTTPS
     - `connect-src 'self' ws: wss: https://www.clarity.ms https://fonts.googleapis.com` - WebSocket (Socket.io), Clarity analytics, Google Fonts CSS fetch
     - `object-src 'none'` - Block object/embed/applet elements
     - `media-src 'self'` - Media only from same origin
     - `frame-src 'none'` - Block all iframe embedding of external content
   - **X-Frame-Options: DENY** - Prevents clickjacking by blocking iframe embedding
   - **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing attacks
   - **Referrer-Policy: strict-origin-when-cross-origin** - Privacy-focused referrer control
   - **Permissions-Policy** - Restricts browser features:
     - `camera=()` - Blocks camera access
     - `microphone=()` - Blocks microphone access
     - `geolocation=()` - Blocks location access
     - `payment=()` - Blocks payment APIs
   - **Strict-Transport-Security (HSTS)** - Enforces HTTPS (max-age: 1 year, includeSubDomains)
   - **X-Powered-By** - Header hidden to avoid revealing server technology
   - **Test Coverage**: 33 dedicated security header tests (100% pass rate)
   - **Implementation**: Applied before other middleware in `backend/src/index.ts`
   - **CSP Rationale**:
     - **Google Fonts**: Whitelisted specific domains (`fonts.googleapis.com` for CSS and Fetch API calls, `fonts.gstatic.com` for font files) for brand compliance with NSW RFS style guide
     - **Microsoft Clarity**: Analytics script sources whitelisted (`www.clarity.ms` for tag loader, `scripts.clarity.ms` for actual script files) for user behavior tracking
     - **Inline Styles**: `'unsafe-inline'` required for React's CSS-in-JS and Framer Motion animations
     - **No Inline Scripts**: All scripts externalized to separate files for better CSP security

2. **CORS Configuration**
   - Configured for specific frontend URL
   - Methods restricted to GET, POST
   - Credentials not required

3. **Rate Limiting**
  - **API Routes:** ≈1,000 requests per hour per IP (configurable via `RATE_LIMIT_API_MAX`, default ≈84 per 5-minute window)
  - **Auth Routes:** 5 requests per 15 minutes per IP (configurable via `RATE_LIMIT_AUTH_MAX`) - Reserved for future auth endpoints
  - **SPA Fallback:** ≈1,000 requests per hour per IP (aligns with API limiter)
   - **Protected Endpoints:** All `/api/*` routes
   - **Headers:** Returns standard `RateLimit-*` headers (Limit, Remaining, Reset)
   - **Custom Error Messages:** Clear 429 responses with retry information
   - **Logging:** Rate limit violations logged for monitoring
   - **Configuration:** Adjustable via environment variables (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX`)
   - **Trust Proxy:** Enabled (`trust proxy` set to `1`) for Azure App Service deployment to correctly identify client IPs from `X-Forwarded-For` header

4. **Input Validation & Sanitization** ✅ ENHANCED (2026-01-04)
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

5. **HTTPS/WSS**
   - Production uses HTTPS for HTTP traffic
   - WSS (WebSocket Secure) for Socket.io

6. **Environment Variables**
   - Sensitive data in environment variables
   - Not committed to version control
   - Azure App Service application settings

### Authentication & Access Control

**Status:** ✅ **IMPLEMENTED** (2026-02-09) - Optional JWT Authentication

#### Configuration

Authentication is **optional** and controlled via the `REQUIRE_AUTH` environment variable:

```bash
# Enable authentication (recommended for production)
REQUIRE_AUTH=true

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=24h
```

#### Authentication Modes

**1. Open Access Mode (REQUIRE_AUTH=false or not set)**
- Default behavior for development and single-station deployments
- All stations accessible without authentication
- Station management features fully accessible
- Suitable for trusted network environments

**2. Authenticated Mode (REQUIRE_AUTH=true)**
- Recommended for production and multi-station deployments
- Public users restricted to demo station only
- Real brigade/station data requires valid JWT token
- Station management requires authentication

#### Access Control Tiers

**Unauthenticated Users (when REQUIRE_AUTH=true):**
- ✅ Access demo station with sample data via `GET /api/stations/demo`
- ✅ Use all features (sign-in, truck checks, reports) with demo data
- ❌ Cannot list or access real stations
- ❌ Cannot access station management features
- ❌ Cannot switch stations
- ❌ Cannot access brigade token management

**Authenticated Users:**
- ✅ Full access to all stations via `GET /api/stations`
- ✅ Can switch between stations
- ✅ Access to station management features
- ✅ Can generate/manage brigade access tokens (kiosk mode)
- ✅ All CRUD operations on stations

**Kiosk Mode (Brigade Token Access):**
- ✅ Access via URL parameter: `?brigade=UUID-TOKEN`
- ✅ Locked to specific station (no switching)
- ✅ Full features for assigned station
- ✅ No authentication required (token-based access)
- ❌ Cannot access station management

#### Protected Endpoints

When `REQUIRE_AUTH=true`, the following endpoints require JWT authentication:

**Station Endpoints:**
- `GET /api/stations` - List all stations
- `GET /api/stations/:id` - Get specific station
- `GET /api/stations/lookup` - Search stations
- `GET /api/stations/check-brigade/:brigadeId` - Check brigade existence
- `GET /api/stations/brigade/:brigadeId` - Get stations by brigade
- `POST /api/stations` - Create station
- `PUT /api/stations/:id` - Update station
- `DELETE /api/stations/:id` - Delete station

**Brigade Access Endpoints:**
- `GET /api/brigade-access/brigade/:brigadeId` - List brigade tokens
- `GET /api/brigade-access/station/:stationId` - List station tokens
- `GET /api/brigade-access/stats` - Token statistics
- `GET /api/brigade-access/all-tokens` - All tokens (admin)
- `POST /api/brigade-access/generate` - Generate token
- `DELETE /api/brigade-access/:token` - Revoke token

#### Public Endpoints (Always Accessible)

**Demo Station Access:**
- `GET /api/stations/demo` - Get demo station (sample data)

**Kiosk Token Validation:**
- `POST /api/brigade-access/validate` - Validate kiosk token

**Authentication Endpoints:**
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/auth/config` - Get auth configuration

#### User Roles

**Admin Role:**
- Full CRUD access to all resources
- Can generate/revoke brigade tokens
- Can manage stations
- Can perform all authenticated operations

**Viewer Role (Future):**
- Read-only access to authenticated endpoints
- Cannot modify stations or generate tokens
- Reserved for future implementation

#### JWT Token Format

```typescript
{
  "userId": "string",
  "username": "string",
  "role": "admin" | "viewer",
  "iat": number,  // Issued at
  "exp": number   // Expiry timestamp
}
```

**Token Transmission:**
- Header: `Authorization: Bearer <jwt-token>`
- Frontend: Stored in localStorage (`auth_token` key)
- Backend: Verified via `optionalAuth` middleware

#### Security Features

1. **JWT Verification**: Cryptographically signed tokens (HS256)
2. **Token Expiry**: Configurable expiration (default 24 hours)
3. **Secure Storage**: Tokens cleared on logout
4. **401 Handling**: Automatic logout on token expiration
5. **Brigade Tokens**: UUID v4 tokens for kiosk mode (separate from JWT)

#### Frontend Implementation

**StationContext Behavior:**
```typescript
// Unauthenticated users (REQUIRE_AUTH=true)
const stations = await api.getDemoStation();  // Single demo station

// Authenticated users
const stations = await api.getStations();     // All stations
```

**LandingPage Conditional UI:**
- Station management links hidden for unauthenticated users
- "Authentication required" message displayed when applicable
- Login/logout buttons shown based on `requireAuth` config

#### Migration Guide

**Enabling Authentication on Existing Deployment:**

1. Set `REQUIRE_AUTH=true` in backend `.env`
2. Set `JWT_SECRET` to secure random value
3. Restart backend service
4. Existing kiosk devices continue to work (token-based)
5. Users must log in to access real station data

**Disabling Authentication:**

1. Remove `REQUIRE_AUTH` or set to `false`
2. Restart backend service
3. All stations accessible without login
4. Station management features immediately available

#### Related Documentation

- **Configuration Guide**: `docs/AUTHENTICATION_CONFIGURATION.md`
- **API Registry**: `docs/api_register.json` (v1.3.0+)
- **Master Plan**: `docs/MASTER_PLAN.md` (Phase 3 security enhancement)

---

## Deployment Architecture

### Multi-Domain Hosting Support

**Status:** ✅ Fully Supported (February 2026)  
**Documentation:** `docs/MULTI_DOMAIN_HOSTING_ANALYSIS.md`

The system supports flexible deployment across multiple domains and hosting scenarios:

#### Supported Deployment Scenarios

1. **Subdomain Migration**
   - Move from `bungendorerfs.org` to `station-manager.bungendorerfs.org`
   - Requires only environment variable updates
   - Same-domain cookies work across subdomains
   - Impact: LOW (one-time user re-login)

2. **Token-Based Multi-Brigade Access** ✅ Recommended
   - Brigades link from their own domains (e.g., `brigade1.org`, `brigade2.org`)
   - Station Manager hosted on central domain
   - Brigade access tokens provide secure cross-domain access
   - Already implemented and working
   - Cost-effective: Single infrastructure serves all brigades

3. **Multi-Domain Deployment**
   - Separate instances per brigade subdomain
   - Complete isolation per brigade
   - Higher infrastructure costs
   - Suited for large-scale adoption

#### CORS Configuration

**Security Fix (February 2026):** Fixed permissive CORS configuration that allowed all origins.

**Current Implementation:**
```typescript
// backend/src/index.ts
// Parse allowed origins from comma-separated list
const allowedOriginsList = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim())
  .filter(url => url.length > 0);

// Express CORS with origin allowlist
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOriginsList.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked', { origin, allowedOrigins: allowedOriginsList });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Station-Id', 'X-Request-ID'],
}));

// Socket.io CORS (matches Express CORS)
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOriginsList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
```

**Environment Variables:**
```bash
# Single origin (backward compatible)
FRONTEND_URL=https://station-manager.bungendorerfs.org

# Multiple origins for multi-brigade support
FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://brigade1.org,https://brigade2.org
```

**Benefits:**
- ✅ Secure origin allowlist (replaces permissive `cors()`)
- ✅ Supports single or multiple origins
- ✅ Backward compatible with existing deployments
- ✅ Logged blocked requests for security monitoring
- ✅ Aligned Express and Socket.io CORS configuration

#### Cross-Domain Brigade Access

Brigade access tokens enable secure cross-domain linking:

**Flow:**
1. Admin generates brigade token via `/api/brigade-access/generate`
2. Token embedded in URL: `https://station-manager.bungendorerfs.org/signin?brigade=TOKEN`
3. Brigade website links to this URL from their domain
4. User clicks link, navigates to Station Manager
5. Token validates, locks to brigade station (kiosk mode)
6. User signs in, session persists

**Requirements:**
- Brigade domain must be in CORS allowlist (if embedding iframe)
- Direct linking (recommended) requires no CORS configuration
- Token provides station identification and access control

**See Also:** `docs/MULTI_DOMAIN_HOSTING_ANALYSIS.md` for comprehensive analysis

---

## Deployment Architecture (Continued)

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

1. **Quality & Tests (Single-Runner, Sequential)**
   - Checkout + install backend dependencies (npm caching)
   - Backend type checking (TypeScript strict mode) then backend testing (Jest, 45+ tests, 15%+ baseline coverage)
   - Install frontend dependencies
   - Frontend linting (ESLint) - Zero errors/warnings required
   - Frontend type checking (TypeScript strict mode)
   - Frontend testing (Vitest) - Coverage summary uploaded

2. **Build (Runs if all quality gates pass)**
   - Build backend (TypeScript → JavaScript)
   - Build frontend (Vite production bundle)
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
- Single-runner sequential flow (one dependency install, fail-fast)
- npm dependency caching (saves ~30-60 seconds per run)
- Concurrency control (cancels outdated PR runs)
- In-memory database for tests (no Azure dependencies)
- **Code splitting and lazy loading** (56% reduction in initial bundle size)
- **Bundle analyzer** integrated for ongoing size monitoring

**Failure Handling:**
- Automatic GitHub issue creation on pipeline failure
- Detailed error logs and job links included in issue
- Duplicate issue prevention
- Troubleshooting steps and resources provided

**Typical Execution Time:**
- Quality + tests: ~6-8 minutes (sequential on one runner)
- Build: ~1-2 minutes
- Deploy: ~3-4 minutes
- **Total:** ~10-13 minutes (successful run)

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
**Frontend Bundle:** 
- Initial load: ~120 KB (gzipped) - 56% reduction from code splitting
- Total (all chunks): ~250 KB (gzipped)
- Route-based lazy loading implemented for all 14 feature pages
- Bundle analyzer integrated for ongoing monitoring
**Database Size:** ~50 MB per year (estimated)

### Response Compression

**Middleware:** compression (gzip level 6)  
**Threshold:** 1KB minimum response size  
**Compression Ratios:**
- JSON responses: 90-93% reduction
- HTML content: 90-92% reduction
- CSS/JavaScript: 70-85% reduction
- Overall bandwidth savings: 70-93% on text content

**Performance Impact:**
- Compression overhead: ~1.4ms average per request
- Bandwidth reduction: Significantly improved load times on slow connections
- Ideal for rural areas with limited network connectivity

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
  - Soft delete endpoint (`DELETE /api/members/:id`) hides members while retaining records; responses include `isActive`/`isDeleted` flags

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
- `backend/src/__tests__/compression.test.ts` - Response compression tests (14 tests)

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
- [archive/TRUCK_CHECKS_IMPLEMENTATION.md](archive/TRUCK_CHECKS_IMPLEMENTATION.md) - Truck checks feature (archived)
- [ACHIEVEMENTS.md](ACHIEVEMENTS.md) - Achievement system
- [implementation-notes/EVENT_MANAGEMENT.md](implementation-notes/EVENT_MANAGEMENT.md) - Event system

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | GitHub Copilot | Initial as-built documentation |

---

**End of As-Built Documentation**
