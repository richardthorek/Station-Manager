# Multi-Domain Hosting Analysis for Station Manager

**Document Version:** 1.0  
**Created:** February 2026  
**Status:** Analysis Complete  
**Purpose:** Comprehensive analysis of hosting Station Manager at different URLs and domains

---

## Executive Summary

Station Manager is **well-architected for multi-domain deployment** with minimal changes required. The existing token-based brigade access system, multi-station architecture, and JWT authentication provide a solid foundation for flexible hosting scenarios.

### Key Findings

✅ **Ready for Multi-Domain Deployment**
- Token-based kiosk mode supports cross-domain brigade access
- Multi-station architecture provides data isolation
- JWT authentication is domain-agnostic
- Configuration-driven CORS allows flexible domain setup

⚠️ **Considerations Required**
- CORS configuration must be updated for additional domains
- Cookie domain settings need review for session persistence
- WebSocket connections need CORS alignment
- Documentation and deployment guides need updates

---

## Table of Contents

1. [Deployment Scenarios](#deployment-scenarios)
2. [Technical Analysis](#technical-analysis)
3. [Authentication & Session Management](#authentication--session-management)
4. [Data Isolation & Multi-Tenancy](#data-isolation--multi-tenancy)
5. [CORS & Cross-Domain Considerations](#cors--cross-domain-considerations)
6. [Browser Storage Implications](#browser-storage-implications)
7. [URL Changes & Existing Links](#url-changes--existing-links)
8. [Token-Based Brigade Access](#token-based-brigade-access)
9. [Infrastructure & Deployment](#infrastructure--deployment)
10. [Recommendations & Action Items](#recommendations--action-items)
11. [Risk Assessment](#risk-assessment)

---

## Deployment Scenarios

### Scenario 1: Subdomain Migration
**Move from `bungendorerfs.org` to `station-manager.bungendorerfs.org`**

#### Benefits
- Clear separation of services
- Dedicated subdomain for application
- Maintains same top-level domain (simplified cookie management)
- Professional URL structure

#### Technical Requirements
- ✅ Minimal code changes (environment variables only)
- ✅ Update DNS A/CNAME records
- ✅ Update SSL certificates (wildcard cert or subdomain cert)
- ✅ Update CORS configuration
- ⚠️ Redirect old URLs to new subdomain
- ⚠️ Update all documentation links

#### Impact Level: **LOW** 🟢
- Same domain cookies work across subdomains
- No changes to authentication flow
- LocalStorage isolated but manageable
- Existing tokens remain valid

---

### Scenario 2: Token-Based Multi-Brigade Access
**Enable brigades to link from their own domains (e.g., `brigade1.org`, `brigade2.org`)**

#### Benefits
- Each brigade can link from their own website
- Maintains Station Manager as centralized service
- Brigade-specific branding and entry points
- Data isolation via existing multi-station architecture

#### Technical Requirements
- ✅ Already implemented via brigade access tokens
- ✅ Tokens provide station identification
- ✅ CORS configuration supports multiple origins
- ⚠️ Each brigade domain needs CORS whitelist entry
- ⚠️ Documentation for brigade-specific setup

#### Impact Level: **VERY LOW** 🟢
- **Already Supported** - Token system designed for this
- No changes to backend logic required
- CORS configuration is the only requirement
- Brigade tokens provide secure cross-domain access

---

### Scenario 3: Full Multi-Domain Deployment
**Deploy separate instances per brigade (e.g., `brigade1.stationmanager.org`, `brigade2.stationmanager.org`)**

#### Benefits
- Complete isolation per brigade
- Custom branding per subdomain
- Simplified CORS (same origin)
- Brigade-specific configuration

#### Technical Requirements
- ⚠️ Multiple Azure App Service instances (higher cost)
- ⚠️ Shared database with station isolation
- ⚠️ Brigade-specific environment variables
- ⚠️ CDN or reverse proxy for routing

#### Impact Level: **MEDIUM** 🟡
- Higher infrastructure costs
- More complex deployment process
- Requires multi-instance orchestration
- Better suited for large-scale adoption

---

## Technical Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (React SPA)                                     │
│ - Currently: bungendorerfs.org                          │
│ - Proposed: station-manager.bungendorerfs.org           │
│                                                          │
│ Configuration:                                           │
│ - VITE_API_URL: Backend API URL                         │
│ - VITE_SOCKET_URL: WebSocket URL                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP/HTTPS + WebSocket (WSS)
                 │
┌────────────────▼────────────────────────────────────────┐
│ Backend (Node.js + Express + Socket.io)                 │
│ - Currently: bungendorerfs.org/api                      │
│ - Proposed: station-manager.bungendorerfs.org/api       │
│                                                          │
│ Configuration:                                           │
│ - FRONTEND_URL: For CORS (single origin)                │
│ - PORT: Server port                                      │
│                                                          │
│ CORS Configuration:                                      │
│   app.use(cors());  // Currently allows all origins     │
│   io.cors.origin: process.env.FRONTEND_URL             │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Azure Table Storage / Cosmos DB
                 │
┌────────────────▼────────────────────────────────────────┐
│ Database Layer                                           │
│ - Azure Table Storage (Production)                       │
│ - Multi-station data isolation via stationId            │
│ - Brigade access tokens for cross-domain access         │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Strengths

1. **Environment-Driven Configuration**
   - Frontend: `VITE_API_URL`, `VITE_SOCKET_URL`
   - Backend: `FRONTEND_URL`, `PORT`
   - ✅ Domain changes require only env var updates

2. **Token-Based Station Access**
   - Brigade access tokens (UUID v4)
   - Station identification via `X-Station-Id` header or query param
   - ✅ Cross-domain station access already supported

3. **Multi-Station Architecture**
   - Data isolation by `stationId`
   - Station middleware on all routes
   - ✅ Ready for multi-tenant deployment

4. **JWT Authentication**
   - Domain-agnostic JWT tokens
   - LocalStorage-based token persistence
   - ✅ Works across domain changes

---

## Authentication & Session Management

### Current Authentication System

**Type:** JWT (JSON Web Tokens)  
**Storage:** Browser localStorage  
**Scope:** Domain-specific (localStorage is origin-bound)

```typescript
// Frontend: src/contexts/AuthContext.tsx
const TOKEN_KEY = 'station-manager-auth-token';
const USER_KEY = 'station-manager-user';

// Stored in localStorage (origin-bound)
localStorage.setItem(TOKEN_KEY, data.token);
localStorage.setItem(USER_KEY, JSON.stringify(data.user));
```

**Backend:** JWT verification with configurable secret
```typescript
// Backend: src/routes/auth.ts
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
```

### Domain Change Implications

#### Scenario 1: Subdomain Migration
**From:** `bungendorerfs.org` → **To:** `station-manager.bungendorerfs.org`

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| **JWT Tokens** | ✅ Work across domains | No action needed - tokens are domain-agnostic |
| **localStorage** | ⚠️ New origin = empty storage | Users must re-login once |
| **Session Persistence** | ⚠️ Lost on domain change | One-time re-login required |
| **Existing Tokens** | ✅ Valid if not expired | Can be reused if users have them |

**User Impact:** One-time re-login after domain change

#### Scenario 2: Multi-Brigade Domains
**Example:** Brigade sites linking to Station Manager at `station-manager.bungendorerfs.org`

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| **JWT Tokens** | ✅ Brigades don't need auth tokens | Kiosk mode uses brigade tokens instead |
| **localStorage** | ✅ All brigades use same origin | No cross-domain issues |
| **Brigade Tokens** | ✅ Already implemented | Token in URL provides station access |
| **Session Persistence** | ✅ Works as expected | No changes needed |

**User Impact:** None - already supported

### Authentication Configuration

The system supports **optional authentication** via `REQUIRE_AUTH` environment variable:

```bash
# backend/.env
REQUIRE_AUTH=true  # Recommended for production
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=24h
```

**Authentication Modes:**
- **Open Access** (`REQUIRE_AUTH=false`): All users access all stations
- **Authenticated** (`REQUIRE_AUTH=true`): Only authenticated users access real stations; unauthenticated users see demo station only

**Protected Endpoints** (when `REQUIRE_AUTH=true`):
- Station management (`GET /api/stations`, `POST /api/stations`, etc.)
- Brigade access token management
- Station lookup

**Public Endpoints** (always accessible):
- Demo station (`GET /api/stations/demo`)
- Token validation (`POST /api/brigade-access/validate`)
- Login (`POST /api/auth/login`)

---

## Data Isolation & Multi-Tenancy

### Current Multi-Station Architecture

**Status:** ✅ Fully Implemented (Fixed: February 2026)

The system provides **complete data isolation** between stations:

```typescript
// All API requests include stationId
// Priority: Header → Query Parameter → Default

// Via header (primary method)
X-Station-Id: bungeendore-north

// Via query parameter (fallback)
?stationId=bungeendore-north

// Default
stationId = 'default-station'
```

### Station Middleware

```typescript
// backend/src/middleware/stationMiddleware.ts
export function stationMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerStationId = req.headers['x-station-id'];
  const queryStationId = req.query.stationId;
  const rawStationId = headerStationId || queryStationId;
  req.stationId = getEffectiveStationId(rawStationId);
  next();
}
```

### Data Isolation Guarantee

**All database queries filter by `stationId`:**
- ✅ Members
- ✅ Activities
- ✅ Check-ins
- ✅ Events
- ✅ Event Participants
- ✅ Appliances
- ✅ Checklist Templates
- ✅ Check Runs
- ✅ Check Results

**Recent Fix (February 2026):** Fixed critical bug where `getAllMembers()` in Azure Table Storage implementation was not filtering by `stationId`, causing data leakage between brigades.

### Multi-Brigade Deployment Readiness

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Data Isolation** | ✅ Complete | All queries filtered by stationId |
| **Station Identification** | ✅ Complete | Header/query parameter support |
| **Brigade Tokens** | ✅ Complete | UUID v4 tokens for kiosk mode |
| **Token Validation** | ✅ Complete | Server-side validation |
| **Cross-Brigade Protection** | ✅ Complete | Cannot access other brigade data |
| **Audit Logging** | ✅ Complete | Event audit logs track all changes |

**Conclusion:** System is **production-ready** for multi-brigade deployment

---

## CORS & Cross-Domain Considerations

### Current CORS Configuration

**Backend:** `backend/src/index.ts`

```typescript
// Express CORS middleware
app.use(cors());  // Currently allows ALL origins

// Socket.io CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});
```

### Issue: Permissive CORS Configuration

**Current State:** `app.use(cors())` without options **allows all origins**

**Security Risk:** ⚠️ **MEDIUM**
- Any website can make requests to the API
- CSRF protection relies on authentication only
- WebSocket CORS is properly restricted

**Recommendation:** Update Express CORS to match Socket.io configuration

### Proposed CORS Configuration

#### Option 1: Single Origin (Current Deployment)
```typescript
// backend/.env
FRONTEND_URL=https://station-manager.bungendorerfs.org

// backend/src/index.ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Station-Id', 'X-Request-ID'],
}));
```

#### Option 2: Multiple Origins (Multi-Brigade Support)
```typescript
// backend/.env
FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://brigade1.org,https://brigade2.org

// backend/src/index.ts
const allowedOrigins = (process.env.FRONTEND_URLS || 'http://localhost:5173').split(',');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Station-Id', 'X-Request-ID'],
}));
```

#### Option 3: Wildcard Subdomain (Same Domain)
```typescript
// For *.bungendorerfs.org
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^https?:\/\/([a-z0-9-]+\.)?bungendorerfs\.org$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Station-Id', 'X-Request-ID'],
}));
```

### WebSocket CORS

**Socket.io configuration must match Express CORS:**

```typescript
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,  // Same as Express CORS
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
```

### Content Security Policy (CSP)

**Current CSP:** `backend/src/index.ts`

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.clarity.ms", "https://scripts.clarity.ms"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://www.clarity.ms", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
    },
  },
}));
```

**Impact of Domain Change:**
- ✅ `"'self'"` directive automatically adjusts to new domain
- ✅ External domains (Clarity, Google Fonts) remain valid
- ✅ WebSocket directives (`ws:`, `wss:`) support any domain
- ⚠️ If API and frontend on different domains, add API domain to `connectSrc`

**Example for Separate API Domain:**
```typescript
connectSrc: [
  "'self'",
  "https://api.station-manager.bungendorerfs.org",  // Add API domain
  "ws:", "wss:",
  "https://www.clarity.ms",
  "https://fonts.googleapis.com"
]
```

---

## Browser Storage Implications

### Current Browser Storage Usage

#### 1. localStorage (Domain-Specific)
**Location:** `frontend/src/contexts/`

```typescript
// Authentication (AuthContext.tsx)
localStorage.setItem('station-manager-auth-token', token);
localStorage.setItem('station-manager-user', JSON.stringify(user));

// Station Selection (StationContext.tsx)
localStorage.setItem('selectedStationId', stationId);

// UI Preferences (MemberList.tsx, CollapsibleSection.tsx)
localStorage.setItem('memberList-filter', filter);
localStorage.setItem('memberList-sort', sort);

// PWA Install Prompt (InstallPrompt.tsx)
localStorage.setItem('install-prompt-dismissed', timestamp);

// Demo Mode Prompt (DemoLandingPrompt.tsx)
localStorage.setItem('hasSeenDemoPrompt', 'true');
```

#### 2. sessionStorage (Not Currently Used)
**Status:** ✅ No usage detected

#### 3. Cookies (Not Currently Used)
**Status:** ✅ No usage detected  
**Note:** JWT tokens stored in localStorage, not cookies

#### 4. IndexedDB (Service Worker Only)
**Status:** ✅ Used by service worker for offline caching  
**Impact:** Service worker cache is origin-specific

### Domain Change Impact on Browser Storage

| Storage Type | Isolation Level | Impact on Domain Change | Mitigation |
|--------------|----------------|------------------------|------------|
| **localStorage** | Per-origin | ⚠️ Lost on domain change | Users re-login, re-select station |
| **sessionStorage** | Per-origin, per-tab | ✅ Not used | No impact |
| **Cookies** | Per-domain (configurable) | ✅ Not used | No impact |
| **IndexedDB** | Per-origin | ⚠️ Service worker cache cleared | Re-downloads assets on first visit |

### Cookie Considerations (If Implemented in Future)

**Current State:** No cookies used  
**Future Consideration:** If cookies are added for session management:

```typescript
// Subdomain cookie (works across *.bungendorerfs.org)
res.cookie('session', token, {
  domain: '.bungendorerfs.org',  // Note the leading dot
  secure: true,  // HTTPS only
  httpOnly: true,  // Prevent XSS
  sameSite: 'lax',  // CSRF protection
});

// Specific domain cookie
res.cookie('session', token, {
  domain: 'station-manager.bungendorerfs.org',
  secure: true,
  httpOnly: true,
  sameSite: 'lax',
});
```

**Cross-Domain Cookies:**
- ⚠️ Cookies cannot be shared between different top-level domains
- Example: `bungendorerfs.org` and `brigade1.org` cannot share cookies
- Solution: Use token-based authentication (already implemented)

### Migration Strategy for Domain Change

**Step 1: Pre-Migration Communication**
```
Subject: Station Manager URL Update - Action Required

Dear Station Managers,

On [DATE], Station Manager will move to a new URL:
- OLD: https://bungendorerfs.org
- NEW: https://station-manager.bungendorerfs.org

IMPORTANT: You will need to log in again after the change.
Please bookmark the new URL.

Kiosk devices with saved tokens will continue to work.
```

**Step 2: Migration Day**
```bash
# Update environment variables
VITE_API_URL=https://station-manager.bungendorerfs.org/api
VITE_SOCKET_URL=https://station-manager.bungendorerfs.org
FRONTEND_URL=https://station-manager.bungendorerfs.org

# Deploy updated application
npm run build
# ... deployment steps ...
```

**Step 3: DNS Redirect (Optional)**
```
# .htaccess or web.config
Redirect 301 /signin https://station-manager.bungendorerfs.org/signin
Redirect 301 /profile https://station-manager.bungendorerfs.org/profile
Redirect 301 /admin https://station-manager.bungendorerfs.org/admin
```

**Step 4: Post-Migration**
- Update all documentation links
- Update QR codes (if static)
- Update brigade access token kiosk URLs (if stored)
- Monitor error logs for CORS issues

---

## URL Changes & Existing Links

### Current URL Structure

```
Application Pages:
├── / (Landing page)
├── /signin (Sign-in system)
├── /profile/:memberId (Member profiles)
├── /admin (Admin portal - protected)
├── /truckcheck/* (Coming in v1.1)
└── /reports/* (Coming in v1.1)

API Endpoints:
├── /api/auth/* (Authentication)
├── /api/members/* (Member management)
├── /api/activities/* (Activity tracking)
├── /api/checkins/* (Check-in history)
├── /api/events/* (Event management)
├── /api/stations/* (Station management)
├── /api/brigade-access/* (Brigade tokens)
└── /api/truckChecks/* (Vehicle checks)

WebSocket:
└── / (Socket.io connection)
```

### Impact of URL Changes

#### User-Facing Links

| Link Type | Impact | Mitigation |
|-----------|--------|------------|
| **Bookmarks** | ⚠️ Users must update | Redirect old domain to new |
| **QR Codes (Static)** | ⚠️ Must regenerate | QR codes for profiles, etc. |
| **Brigade Tokens** | ⚠️ URLs contain domain | Regenerate tokens with new domain |
| **Email Links** | ⚠️ Old emails broken | Use relative URLs in emails |
| **Social Media Shares** | ⚠️ Old shares broken | Redirect old URLs |

#### API Integrations

| Integration | Impact | Mitigation |
|-------------|--------|------------|
| **Third-Party Scripts** | ⚠️ Must update API_URL | Environment variable change |
| **Webhooks** | ⚠️ Update webhook URLs | Update webhook configurations |
| **Automated Reports** | ⚠️ Update API endpoints | Update report script configs |

#### SEO Considerations

**Domain Change SEO Impact:**
- ⚠️ Search engine rankings reset
- ⚠️ Indexed pages become 404s (if no redirect)
- ⚠️ Domain authority starts from zero

**Mitigation:**
```html
<!-- Old domain: Canonical and redirect -->
<link rel="canonical" href="https://station-manager.bungendorerfs.org/" />
<meta http-equiv="refresh" content="0; url=https://station-manager.bungendorerfs.org/" />

<!-- New domain: Submit sitemap -->
<sitemap>
  <loc>https://station-manager.bungendorerfs.org/sitemap.xml</loc>
</sitemap>
```

**301 Redirects (Preserve SEO):**
```
# Redirect all old URLs to new domain
https://bungendorerfs.org/* → https://station-manager.bungendorerfs.org/*
```

### Brigade Token URLs

**Current Format:**
```
https://bungendorerfs.org/signin?brigade=a3d5e8f2-1234-4abc-8def-9876543210ab
```

**After Subdomain Migration:**
```
https://station-manager.bungendorerfs.org/signin?brigade=a3d5e8f2-1234-4abc-8def-9876543210ab
```

**Impact:**
- ⚠️ Existing kiosk URLs broken (domain changed)
- ✅ Tokens remain valid (only URL changed)
- ⚠️ Admin must regenerate kiosk URLs

**Auto-Generation of New URLs:**
```typescript
// backend/src/routes/brigadeAccess.ts
kioskUrl: `${req.protocol}://${req.get('host')}/signin?brigade=${accessToken.token}`
```

✅ **Good News:** URLs auto-generate with correct domain based on request host

**Migration Plan for Kiosk Devices:**
1. Admin exports all brigade tokens
2. Migration occurs
3. Admin accesses new domain
4. Re-generates kiosk URLs (tokens unchanged, just URL domain)
5. Updates kiosk device bookmarks

---

## Token-Based Brigade Access

### Current Implementation

**Status:** ✅ Fully Implemented  
**Purpose:** Allow brigades to access their station data via unique URL tokens

**Token System:**
- **Type:** UUID v4 (128-bit random)
- **Format:** `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- **Security:** Cryptographically secure, unguessable
- **Validation:** Server-side database lookup
- **Expiration:** Optional (configurable per token)

### Token Flow

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Admin Generates Token                           │
│                                                          │
│ POST /api/brigade-access/generate                       │
│ {                                                        │
│   "brigadeId": "bungeendore-north",                     │
│   "stationId": "bungeendore-north",                     │
│   "description": "Main Kiosk iPad",                     │
│   "expiresInDays": 365                                  │
│ }                                                        │
│                                                          │
│ Response: { token: "a3d5e8f2-...", ... }                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Admin Embeds Token in Kiosk URL                 │
│                                                          │
│ https://station-manager.bungendorerfs.org/signin?brigade=a3d5e8f2-...
│                                                          │
│ - URL bookmarked on kiosk iPad                          │
│ - Or shared via QR code                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: User Opens Kiosk URL                            │
│                                                          │
│ Frontend detects "?brigade=TOKEN" parameter             │
│ POST /api/brigade-access/validate { token }             │
│                                                          │
│ Backend validates token and returns stationId           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: Frontend Locks to Station (Kiosk Mode)          │
│                                                          │
│ - Station selector disabled                             │
│ - "Kiosk Mode" badge displayed                          │
│ - All requests include X-Station-Id header              │
│ - Session-based persistence                             │
└──────────────────────────────────────────────────────────┘
```

### Cross-Domain Brigade Access

**Scenario:** Brigade 1 wants to link from `brigade1.org` to Station Manager

**Current Support:** ✅ **Already Works**

**Implementation:**
1. Brigade 1 admin generates token for their station
2. Brigade 1 website includes link:
   ```html
   <a href="https://station-manager.bungendorerfs.org/signin?brigade=TOKEN">
     Sign In to Station Manager
   </a>
   ```
3. Users click link from `brigade1.org`
4. Browser navigates to `station-manager.bungendorerfs.org` with token
5. Token validates, locks to Brigade 1 station
6. User signs in, session persists

**CORS Requirement:**
- ⚠️ If Brigade 1 wants to embed Station Manager in iframe: Requires CORS + CSP update
- ✅ If Brigade 1 just links to Station Manager: No CORS requirement (simple navigation)

**Recommended Approach:** Direct linking (not iframe embedding)

### Token Management API

**Generate Token:**
```bash
POST /api/brigade-access/generate
Authorization: Bearer <JWT>  # If REQUIRE_AUTH=true

{
  "brigadeId": "brigade-id",
  "stationId": "station-id",
  "description": "Main Kiosk iPad",
  "expiresInDays": 365
}
```

**Validate Token:**
```bash
POST /api/brigade-access/validate
# Public endpoint, no auth required

{
  "token": "a3d5e8f2-1234-4abc-8def-9876543210ab"
}

Response:
{
  "valid": true,
  "brigadeId": "brigade-id",
  "stationId": "station-id"
}
```

**Revoke Token:**
```bash
DELETE /api/brigade-access/:token
Authorization: Bearer <JWT>  # If REQUIRE_AUTH=true
```

**List Tokens:**
```bash
GET /api/brigade-access/brigade/:brigadeId
Authorization: Bearer <JWT>  # If REQUIRE_AUTH=true
```

---

## Infrastructure & Deployment

### Current Deployment

**Frontend:**
- Azure Static Web Apps (Free Tier) OR served from backend
- React SPA built with Vite
- Service worker for offline support

**Backend:**
- Azure App Service (B1 Tier - $13 AUD/month)
- Node.js 22 + Express
- WebSocket support (Socket.io)
- Always-on enabled

**Database:**
- Production: Azure Table Storage ($0.10-2/month)
- Alternative: Cosmos DB Serverless ($0.50-3/month)
- Development: In-memory database

**Storage:**
- Azure Blob Storage for appliance photos

**Monitoring:**
- Azure Application Insights (Optional, 1-day retention)

**Total Cost:** ~$13-15 AUD/month

### Domain Configuration

#### Subdomain Setup

**DNS Configuration:**
```
# A Record (if using IP)
station-manager.bungendorerfs.org   A   <AZURE_APP_IP>

# CNAME Record (if using Azure domain)
station-manager.bungendorerfs.org   CNAME   bungrfsstation.azurewebsites.net
```

**SSL Certificate:**
- Option 1: Azure App Service Managed Certificate (Free)
- Option 2: Let's Encrypt wildcard cert (*.bungendorerfs.org)
- Option 3: Commercial SSL certificate

**Azure App Service Custom Domain:**
```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name bungrfsstation \
  --resource-group rg-station-manager \
  --hostname station-manager.bungendorerfs.org

# Enable HTTPS
az webapp update \
  --name bungrfsstation \
  --resource-group rg-station-manager \
  --https-only true
```

#### Multi-Brigade Configuration

**Option 1: Single Instance, Multiple Origins (Recommended)**
```bash
# backend/.env
FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://brigade1.org,https://brigade2.org
```

**Option 2: Multiple Instances, Brigade-Specific Subdomains**
```
brigade1.stationmanager.org   CNAME   bungrfsstation-brigade1.azurewebsites.net
brigade2.stationmanager.org   CNAME   bungrfsstation-brigade2.azurewebsites.net
```

**Cost Comparison:**

| Configuration | Infrastructure | Monthly Cost | Complexity |
|--------------|----------------|--------------|------------|
| Single Instance | 1 App Service + 1 Database | $13-15 | Low |
| Multi-Instance | N App Services + 1 Database | $13-15 × N | High |
| CDN + Reverse Proxy | 1 App Service + CDN + Database | $15-25 | Medium |

**Recommendation:** Single instance with multiple origins (CORS configuration)

### Environment Variables Update

**Frontend `.env` (Production):**
```bash
VITE_API_URL=https://station-manager.bungendorerfs.org/api
VITE_SOCKET_URL=https://station-manager.bungendorerfs.org
```

**Backend `.env` (Production):**
```bash
# Domain Configuration
FRONTEND_URLS=https://station-manager.bungendorerfs.org

# Or for multi-brigade support:
# FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://brigade1.org,https://brigade2.org

# Server Configuration
PORT=3000
NODE_ENV=production

# Authentication
REQUIRE_AUTH=true
JWT_SECRET=<secure-production-secret>
JWT_EXPIRY=24h

# Database
USE_TABLE_STORAGE=true
AZURE_STORAGE_CONNECTION_STRING=<connection-string>

# Event Auto-Expiry
EVENT_EXPIRY_HOURS=12

# Monitoring
AZURE_APP_INSIGHTS_CONNECTION_STRING=<connection-string>
```

### Deployment Checklist

- [ ] Update DNS records for new subdomain
- [ ] Configure SSL certificate
- [ ] Update environment variables (frontend + backend)
- [ ] Update CORS configuration in code
- [ ] Update CSP if API on different domain
- [ ] Build and deploy frontend with new API URLs
- [ ] Deploy backend with new CORS settings
- [ ] Test CORS from allowed origins
- [ ] Test WebSocket connections
- [ ] Test brigade token validation
- [ ] Update documentation links
- [ ] Set up 301 redirects from old URLs
- [ ] Regenerate kiosk URLs for brigades
- [ ] Update QR codes
- [ ] Notify station managers of URL change
- [ ] Monitor error logs for 24-48 hours

---

## Recommendations & Action Items

### Immediate Actions (Pre-Migration)

#### 1. Fix CORS Configuration ⚠️ **HIGH PRIORITY**

**Issue:** `app.use(cors())` allows all origins

**Fix:**
```typescript
// backend/src/index.ts
const allowedOrigins = (process.env.FRONTEND_URLS || 'http://localhost:5173').split(',').map(url => url.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS request blocked', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Station-Id', 'X-Request-ID'],
}));

// Update Socket.io CORS to match
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
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

**Environment Variable:**
```bash
# Single origin
FRONTEND_URLS=https://station-manager.bungendorerfs.org

# Multiple origins
FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://brigade1.org,https://brigade2.org
```

**Testing:**
```bash
# Test CORS from allowed origin
curl -H "Origin: https://station-manager.bungendorerfs.org" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Station-Id" \
     -X OPTIONS \
     https://station-manager.bungendorerfs.org/api/members

# Test CORS from blocked origin
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://station-manager.bungendorerfs.org/api/members
```

#### 2. Add Environment Variable Documentation

**Update:** `backend/.env.example`

```bash
# CORS Configuration
# Single origin for single deployment
FRONTEND_URLS=http://localhost:5173

# Multiple origins for multi-brigade support (comma-separated)
# FRONTEND_URLS=https://station-manager.bungendorerfs.org,https://brigade1.org,https://brigade2.org

# For wildcard subdomain support, use CORS origin function in code
```

#### 3. Document Brigade Linking Setup

**Create:** `docs/BRIGADE_LINKING_GUIDE.md`

**Contents:**
- How brigades link from their website
- CORS whitelist request process
- Token generation for brigades
- Example HTML embedding code
- Security considerations

### Migration Actions (When Changing Domain)

#### 1. Pre-Migration (1 Week Before)

- [ ] Announce URL change to all station managers
- [ ] Export all brigade access tokens
- [ ] Document all external integrations
- [ ] Update DNS records (subdomain)
- [ ] Configure SSL certificate
- [ ] Test new domain in staging environment

#### 2. Migration Day

- [ ] Update environment variables
- [ ] Deploy backend with new CORS settings
- [ ] Deploy frontend with new API URLs
- [ ] Configure 301 redirects on old domain
- [ ] Update Azure App Service custom domain
- [ ] Test all functionality on new domain
- [ ] Regenerate kiosk URLs with new domain
- [ ] Update station kiosk bookmarks

#### 3. Post-Migration (1 Week After)

- [ ] Monitor error logs for CORS issues
- [ ] Monitor user login success rates
- [ ] Update all documentation links
- [ ] Update QR codes (if static)
- [ ] Update social media links
- [ ] Submit new sitemap to search engines
- [ ] Verify all brigade tokens working

### Long-Term Actions

#### 1. Brigade Onboarding Process

**Create:** Standardized process for new brigades

- Token generation workflow
- CORS whitelist request form
- Setup documentation
- Testing checklist
- Support contact

#### 2. Multi-Brigade Monitoring

**Implement:** Brigade-specific monitoring

- Token usage analytics
- Brigade-specific error tracking
- Performance metrics per brigade
- Cost allocation tracking

#### 3. Documentation Updates

- [ ] Update `MASTER_PLAN.md` with multi-domain strategy
- [ ] Update `AS_BUILT.md` with CORS configuration
- [ ] Create `BRIGADE_LINKING_GUIDE.md`
- [ ] Update `AZURE_DEPLOYMENT.md` with domain setup
- [ ] Update `AUTHENTICATION_CONFIGURATION.md` with cross-domain notes

---

## Risk Assessment

### Security Risks

| Risk | Severity | Likelihood | Mitigation | Status |
|------|----------|-----------|------------|--------|
| **Permissive CORS** | High | Certain | Update CORS configuration | ⚠️ Action Required |
| **CSRF Attacks** | Medium | Low | JWT + SameSite cookies | ✅ Mitigated (JWT) |
| **Token Leakage** | Medium | Low | Token revocation API | ✅ Implemented |
| **Cross-Brigade Access** | High | Very Low | Station middleware filtering | ✅ Mitigated |
| **XSS via Domains** | Medium | Very Low | CSP headers | ✅ Mitigated |

### Operational Risks

| Risk | Severity | Likelihood | Mitigation | Status |
|------|----------|-----------|------------|--------|
| **User Re-Login Required** | Low | Certain (domain change) | Communication plan | ⚠️ Plan Needed |
| **Broken Kiosk URLs** | High | Certain (domain change) | URL regeneration process | ⚠️ Plan Needed |
| **SEO Loss** | Low | High (domain change) | 301 redirects | ⚠️ Plan Needed |
| **Broken Bookmarks** | Medium | High (domain change) | Redirect + communication | ⚠️ Plan Needed |
| **Third-Party Integration Break** | Medium | Medium | Integration audit | ⚠️ Audit Needed |

### Technical Risks

| Risk | Severity | Likelihood | Mitigation | Status |
|------|----------|-----------|------------|--------|
| **CORS Misconfiguration** | High | Medium | Testing checklist | ⚠️ Test Plan Needed |
| **WebSocket Connection Failure** | High | Low | CORS alignment | ⚠️ Testing Needed |
| **Certificate Issues** | Medium | Low | Azure managed certs | ✅ Mitigated |
| **DNS Propagation Delay** | Low | High | TTL reduction pre-migration | ⚠️ Plan Needed |
| **Performance Impact** | Low | Very Low | CORS check minimal | ✅ Mitigated |

### Cost Risks

| Risk | Severity | Likelihood | Mitigation | Status |
|------|----------|-----------|------------|--------|
| **Multi-Instance Cost** | Medium | Low | Single instance recommended | ✅ Documented |
| **Bandwidth Increase** | Low | Low | Compression enabled | ✅ Mitigated |
| **Support Overhead** | Medium | Medium | Documentation + automation | ⚠️ Plan Needed |

---

## Conclusion

### Summary

Station Manager is **well-positioned** for multi-domain deployment with minimal technical changes required. The existing architecture provides:

✅ **Strong Foundation**
- Token-based brigade access (already supports cross-domain linking)
- Multi-station data isolation (production-ready)
- JWT authentication (domain-agnostic)
- Environment-driven configuration (flexible deployment)

⚠️ **Required Changes**
- CORS configuration update (high priority security fix)
- Environment variable documentation
- Migration communication plan
- URL regeneration process

### Recommended Deployment Strategy

**For Subdomain Migration** (`bungendorerfs.org` → `station-manager.bungendorerfs.org`):
1. Update CORS configuration (security fix)
2. Update environment variables
3. Configure DNS and SSL
4. Deploy with redirects
5. Regenerate kiosk URLs
6. Communicate to users

**For Multi-Brigade Support** (brigades linking from their domains):
1. Update CORS to allow multiple origins
2. Document brigade onboarding process
3. Provide token generation workflow
4. Test cross-domain linking
5. Monitor per-brigade usage

**Infrastructure Recommendation:** Single Azure App Service instance with multi-origin CORS support

### Next Steps

1. ✅ Review this analysis with stakeholders
2. ⚠️ Implement CORS security fix (regardless of migration plans)
3. ⚠️ Decide on domain migration timeline
4. ⚠️ Create migration communication plan
5. ⚠️ Update documentation (MASTER_PLAN.md, AS_BUILT.md)
6. ⚠️ Develop brigade onboarding guide

---

## Appendix

### Related Documentation

- **Master Plan:** `docs/MASTER_PLAN.md`
- **As-Built:** `docs/AS_BUILT.md`
- **Authentication:** `docs/AUTHENTICATION_CONFIGURATION.md`
- **Kiosk Mode:** `docs/implementation-notes/KIOSK_MODE_SETUP.md`
- **Azure Deployment:** `docs/AZURE_DEPLOYMENT.md`
- **API Documentation:** `docs/API_DOCUMENTATION.md`

### Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-11 | 1.0 | Copilot | Initial analysis document created |

---

**Document Status:** ✅ Complete  
**Review Status:** ⏳ Pending Stakeholder Review  
**Action Required:** Review and approve recommendations
