# Master Plan: Azure Static Web App Refactoring

**Project**: RFS Station Manager  
**Goal**: Refactor application for Azure Static Web Apps deployment  
**Date Started**: 2026-01-02  
**Status**: Planning Phase

---

## Executive Summary

This document tracks the refactoring of the RFS Station Manager to deploy as an Azure Static Web App. The application is a real-time digital sign-in system for NSW Rural Fire Service stations with member tracking, activity monitoring, and vehicle checks.

### Key Challenge Identified

**Critical Constraint**: Azure Static Web Apps' managed Functions backend **does NOT support WebSockets**. The current application heavily relies on Socket.io for real-time synchronization across devices, which is a core feature for the sign-in book functionality.

---

## Current Architecture Analysis

### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite 7
- **Backend**: Node.js 22 + Express 5 + Socket.io 4
- **Database**: Azure Cosmos DB (MongoDB API) / In-memory (dev)
- **Storage**: Azure Blob Storage (images)
- **Real-time**: Socket.io WebSocket connections

### Current Deployment Model
```
┌────────────────────────┐
│  Azure Static Web Apps │  ← React Frontend (Free tier)
│     OR App Service     │
└───────────┬────────────┘
            │ HTTP + WebSocket (WSS)
┌───────────▼────────────┐
│  Azure App Service     │  ← Express + Socket.io Backend
│   (bungrfsstation)     │    (WebSocket Enabled)
└───────────┬────────────┘
            │
┌───────────▼────────────┐
│  Azure Cosmos DB       │  ← MongoDB API
└────────────────────────┘
```

### Core Features Using Real-Time Sync

1. **Sign-In Book** (PRIMARY FOCUS)
   - Member check-in/check-out
   - Activity selection (Training, Maintenance, Meeting, Custom)
   - Event creation and management
   - Participant list updates
   - Real-time display across all devices (kiosks, mobile)

2. **Achievements System**
   - Milestone notifications
   - Badge unlocks

3. **Truck Checks** (Secondary, can come later)
   - Vehicle checklist status
   - Photo uploads
   - Multi-contributor workflows

### Real-Time Events Currently Used
- `checkin` - Member check-in/out
- `activity-change` - Activity selection update
- `member-added` - New member registered
- `event-created` - New event started
- `event-ended` - Event concluded
- `participant-change` - Participant added/removed from event

---

## Architecture Decision

### ✅ Chosen Approach: **Hybrid Architecture**

**Rationale:**
1. **Preserves Real-Time Functionality**: Socket.io continues to work on Azure App Service
2. **Minimal Code Changes**: Existing backend largely unchanged
3. **Cost-Effective**: Frontend on free Static Web Apps tier, backend on existing App Service
4. **Maintains User Experience**: No degradation of real-time sync features
5. **Faster Implementation**: Focus on configuration, not major refactoring

### Target Architecture
```
┌────────────────────────────────┐
│   Azure Static Web Apps        │  ← React Frontend (Free)
│   (Static Content + CDN)       │    - Built with Vite
│                                │    - Hosted from GitHub
└───────────┬────────────────────┘
            │
            │ CORS-enabled HTTP/HTTPS + WebSocket (WSS)
            │
┌───────────▼────────────────────┐
│   Azure App Service (B1)       │  ← Express + Socket.io Backend
│   (bungrfsstation)             │    - API endpoints
│   - WebSocket: ON              │    - Real-time WebSocket
│   - Always On: ON              │    - No changes to routes
│   - ARR Affinity: ON           │
└───────────┬────────────────────┘
            │
┌───────────▼────────────────────┐
│   Azure Cosmos DB              │  ← MongoDB API
│   (Document DB)                │    - Persistent storage
└────────────────────────────────┘
```

### Why NOT Pure Azure Functions?

**Azure Functions Limitations:**
1. ❌ No WebSocket support in managed Functions
2. ❌ Azure SignalR Service adds complexity and cost (~$50+/month)
3. ❌ Would require complete refactoring of real-time features
4. ❌ SignalR has different API than Socket.io
5. ❌ Migration risk for core functionality

**Azure App Service Benefits:**
1. ✅ WebSocket fully supported
2. ✅ Existing Express app works unchanged
3. ✅ Already deployed and tested
4. ✅ Cost-effective (~$13 AUD/month B1 tier)
5. ✅ Simple CORS configuration

---

## Implementation Plan

### Phase 1: Frontend Migration to Azure Static Web Apps ✓ Priority

**Goal**: Deploy React frontend as Azure Static Web App while keeping backend on App Service

#### Tasks

- [ ] **1.1 Frontend Build Configuration**
  - [ ] Verify Vite build outputs to `frontend/dist`
  - [ ] Ensure all routes work with SPA routing
  - [ ] Test production build locally
  - [ ] Optimize bundle size

- [ ] **1.2 Create Azure Static Web App Configuration**
  - [ ] Create `staticwebapp.config.json` at frontend root
  - [ ] Configure routes for SPA fallback
  - [ ] Set up MIME types for assets
  - [ ] Configure navigation fallback to `/index.html`

- [ ] **1.3 Environment Variable Management**
  - [ ] Document required frontend environment variables
  - [ ] Configure `VITE_API_URL` to point to App Service
  - [ ] Configure `VITE_SOCKET_URL` to point to App Service (WSS)
  - [ ] Test cross-origin WebSocket connections

- [ ] **1.4 CORS Configuration on Backend**
  - [ ] Update CORS settings in Express to allow Static Web App domain
  - [ ] Enable WebSocket CORS for Socket.io
  - [ ] Test CORS with production URLs
  - [ ] Document allowed origins

- [ ] **1.5 GitHub Actions Workflow (User will connect)**
  - [ ] Document workflow requirements
  - [ ] Prepare notes on build configuration
  - [ ] Document Azure Static Web App deployment token usage
  - [ ] Create deployment checklist for user

- [ ] **1.6 Local Development Setup**
  - [ ] Install Azure Static Web Apps CLI: `npm install -g @azure/static-web-apps-cli`
  - [ ] Create `swa-cli.config.json` for local testing
  - [ ] Test local development with: `swa start`
  - [ ] Verify API proxy to local backend works
  - [ ] Document local testing workflow

- [ ] **1.7 Testing**
  - [ ] Test sign-in book functionality locally
  - [ ] Verify WebSocket connections work cross-origin
  - [ ] Test real-time sync between multiple browser tabs
  - [ ] Verify member check-in/check-out
  - [ ] Test activity selection
  - [ ] Verify event creation and participation
  - [ ] Test on mobile devices
  - [ ] Screenshot testing of UI

#### Success Criteria
- Frontend builds successfully
- Frontend deployed to Azure Static Web Apps
- Backend remains on Azure App Service
- Real-time WebSocket sync works across devices
- Sign-in book fully functional
- No breaking changes to user experience

---

### Phase 2: Backend Optimization for Static Web App Integration

**Goal**: Optimize existing backend for better integration with Static Web App frontend

#### Tasks

- [ ] **2.1 API Documentation**
  - [ ] Document all API endpoints used by sign-in book
  - [ ] Document WebSocket events and payloads
  - [ ] Create API versioning strategy
  - [ ] Update API_DOCUMENTATION.md

- [ ] **2.2 Health Check Enhancements**
  - [ ] Add `/health` endpoint status for frontend
  - [ ] Include WebSocket readiness check
  - [ ] Add database connection status
  - [ ] Monitor endpoint response times

- [ ] **2.3 Error Handling**
  - [ ] Improve error messages for cross-origin issues
  - [ ] Add retry logic for database connections
  - [ ] Enhance WebSocket reconnection handling
  - [ ] Log CORS-related errors

- [ ] **2.4 Performance**
  - [ ] Review and optimize database queries
  - [ ] Add caching where appropriate
  - [ ] Optimize WebSocket broadcast logic
  - [ ] Monitor memory usage

- [ ] **2.5 Security**
  - [ ] Review CORS policy
  - [ ] Validate all input data
  - [ ] Rate limit API endpoints
  - [ ] Secure WebSocket connections (WSS only in prod)

---

### Phase 3: Documentation and Deployment

**Goal**: Comprehensive documentation for deployment and maintenance

#### Tasks

- [ ] **3.1 Update Documentation**
  - [ ] Update README.md with new architecture
  - [ ] Update AZURE_DEPLOYMENT.md with Static Web App steps
  - [ ] Create STATIC_WEB_APP_SETUP.md guide
  - [ ] Document environment variables
  - [ ] Update GETTING_STARTED.md for new setup

- [ ] **3.2 Deployment Checklist**
  - [ ] Create pre-deployment checklist
  - [ ] Document rollback procedure
  - [ ] Create troubleshooting guide
  - [ ] Document monitoring setup

- [ ] **3.3 Testing in Production**
  - [ ] Test sign-in book on deployed instance
  - [ ] Verify WebSocket connections from Static Web App
  - [ ] Load test with multiple concurrent users
  - [ ] Test on various devices and networks
  - [ ] Verify mobile responsiveness

- [ ] **3.4 Monitoring Setup**
  - [ ] Configure Application Insights (optional)
  - [ ] Set up error tracking
  - [ ] Monitor WebSocket connections
  - [ ] Track API response times

---

## Sign-In Book Functionality Analysis

### Core Features (MUST WORK)

1. **Member Management**
   - List all members (search, filter, sort)
   - View member details and QR codes
   - Add new members (self-registration)
   - Edit member information
   - Real-time member list updates

2. **Event System**
   - Create new events with activity type
   - View current/active event
   - View event participants in real-time
   - End events
   - Historical event log (infinite scroll)

3. **Check-In/Check-Out**
   - One-tap member check-in to current event
   - Undo check-in
   - QR code sign-in support
   - Location tracking (on-site/off-site)
   - Check-in method tracking (kiosk/mobile/QR)

4. **Activity Selection**
   - Select activity type (Training, Maintenance, Meeting)
   - Create custom activities
   - View current activity station-wide

5. **Real-Time Synchronization** (CRITICAL)
   - Instant updates across all devices
   - Member check-in appears on all screens immediately
   - Activity changes propagate instantly
   - Event updates visible to all users
   - Connection status indicator

### API Endpoints Used by Sign-In Book

```
GET    /api/status               - Database and system status
GET    /api/members              - All members
GET    /api/members/:id          - Single member
GET    /api/members/qr/:qrCode   - Member by QR code
POST   /api/members              - Create member
PUT    /api/members/:id          - Update member
DELETE /api/members/:id          - Delete member

GET    /api/activities           - All activities
POST   /api/activities           - Create custom activity
GET    /api/activities/active    - Current active activity
POST   /api/activities/active    - Set active activity

GET    /api/events               - List events (paginated)
GET    /api/events/current       - Current active event
POST   /api/events               - Create new event
PUT    /api/events/:id/end       - End event
GET    /api/events/:id/participants - Event participants
POST   /api/events/:id/participants - Add participant
DELETE /api/events/:id/participants/:memberId - Remove participant

GET    /api/checkins/active      - Active check-ins
POST   /api/checkins             - Check in member
POST   /api/checkins/:id/toggle  - Undo check-in

GET    /api/achievements/:memberId - Member achievements
```

### WebSocket Events Used

**Client → Server:**
```javascript
socket.emit('checkin', { memberId, eventId, ... })
socket.emit('activity-change', { activityId, ... })
socket.emit('event-created', { eventId, ... })
socket.emit('event-ended', { eventId, ... })
socket.emit('participant-change', { eventId, memberId, ... })
socket.emit('member-added', { memberId, ... })
```

**Server → Clients:**
```javascript
socket.broadcast.emit('checkin-update', data)
io.emit('activity-update', data)
io.emit('event-update', data)
io.emit('member-update', data)
```

---

## Configuration Files to Create

### 1. `staticwebapp.config.json` (Frontend root)

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,js,png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}"]
  },
  "routes": [
    {
      "route": "/",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "mimeTypes": {
    ".json": "application/json",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml"
  },
  "globalHeaders": {
    "Cache-Control": "public, max-age=31536000, immutable"
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  }
}
```

### 2. `swa-cli.config.json` (Root, for local testing)

```json
{
  "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  "configurations": {
    "app": {
      "appLocation": "frontend",
      "outputLocation": "dist",
      "appBuildCommand": "npm run build",
      "appDevserverUrl": "http://localhost:5173",
      "apiLocation": "",
      "apiDevserverUrl": "http://localhost:3000"
    }
  }
}
```

### 3. Environment Variables

**Frontend (Azure Static Web App Configuration):**
```
VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
```

**Backend (Azure App Service - bungrfsstation):**
```
PORT=8080
NODE_ENV=production
MONGODB_URI=<cosmos-db-connection-string>
FRONTEND_URL=https://<your-static-web-app>.azurestaticapps.net
```

---

## Testing Strategy

### Local Testing Workflow

1. **Start Backend** (Terminal 1)
   ```bash
   cd backend
   npm run dev
   # Runs on http://localhost:3000
   ```

2. **Start Frontend with SWA CLI** (Terminal 2)
   ```bash
   swa start frontend --api-location ""
   # Frontend runs on http://localhost:4280 (SWA CLI default)
   # API proxied to http://localhost:3000
   ```

3. **Test Sign-In Book**
   - Open http://localhost:4280/signin
   - Test member check-in/check-out
   - Verify real-time updates in multiple tabs
   - Test activity selection
   - Test event creation
   - Verify WebSocket connection status

### Production Testing Checklist

- [ ] Frontend loads from Static Web App URL
- [ ] API calls reach App Service backend
- [ ] WebSocket connection establishes (check browser console)
- [ ] Sign-in appears on all devices within 2 seconds
- [ ] Activity change propagates to all devices
- [ ] Event creation updates all screens
- [ ] QR code sign-in works
- [ ] Mobile devices work correctly
- [ ] Connection status indicator accurate
- [ ] No CORS errors in console
- [ ] SSL/TLS (HTTPS/WSS) working correctly

---

## Risks and Mitigations

### Risk 1: CORS Issues with WebSocket
**Impact**: High  
**Probability**: Medium  
**Mitigation**:
- Configure CORS in Express to allow Static Web App origin
- Configure Socket.io CORS settings explicitly
- Test cross-origin WebSocket connections thoroughly
- Document troubleshooting steps

### Risk 2: WebSocket Connection Failures
**Impact**: High  
**Probability**: Low  
**Mitigation**:
- Ensure "Web Sockets" enabled in App Service
- Enable "Always On" setting
- Implement reconnection logic in frontend
- Monitor connection health

### Risk 3: Cold Start Issues (Not applicable - using App Service)
**Impact**: Low  
**Probability**: Low  
**Mitigation**:
- "Always On" keeps App Service warm
- No cold start with App Service B1 tier

### Risk 4: Cost Overruns
**Impact**: Low  
**Probability**: Very Low  
**Mitigation**:
- Static Web App: Free tier (100GB bandwidth)
- App Service: Fixed B1 cost (~$13/month)
- Cosmos DB: Free tier or low usage
- Total: ~$13-20/month

---

## Subsequent Activities (Future Phases)

### Items Deferred for Later

1. **Truck Check Migration**
   - Lower priority than sign-in book
   - Can be tested separately after Phase 1 complete
   - Same real-time requirements apply
   - Will follow same architecture pattern

2. **Advanced Features**
   - Offline mode support
   - Progressive Web App (PWA) enhancements
   - Push notifications
   - Advanced analytics

3. **Performance Optimization**
   - CDN configuration for static assets
   - Image optimization pipeline
   - Database query optimization
   - WebSocket compression

4. **Monitoring and Alerting**
   - Application Insights integration
   - Custom dashboard for sign-in metrics
   - Automated alerts for downtime
   - Performance tracking

---

## Success Criteria

### Must Have (MVP)
- ✅ Frontend deployed on Azure Static Web Apps
- ✅ Backend remains on Azure App Service (existing)
- ✅ Sign-in book fully functional
- ✅ Real-time sync working across all devices
- ✅ All API endpoints working
- ✅ WebSocket connections stable
- ✅ No degradation in user experience
- ✅ Documentation complete
- ✅ Local testing workflow documented

### Nice to Have
- Application Insights monitoring
- Automated deployment pipeline
- Performance optimization
- Enhanced error handling
- Progressive Web App features

---

## Timeline

- **Phase 1**: Frontend Migration - 2-3 days
- **Phase 2**: Backend Optimization - 1-2 days
- **Phase 3**: Documentation - 1 day
- **Total**: 4-6 days estimated

---

## Notes and Decisions

### 2026-01-02: Initial Analysis
- Identified WebSocket constraint with Azure Functions
- Decided on Hybrid Architecture approach
- Focused on sign-in book as primary feature
- Deferred truck checks for later phase

### Key Decisions Made
1. **Architecture**: Hybrid (Static Web App + App Service)
2. **Backend**: Keep existing Express + Socket.io on App Service
3. **Frontend**: Deploy to Azure Static Web Apps
4. **Real-time**: Continue using Socket.io (no migration to SignalR)
5. **Database**: Keep Azure Cosmos DB (MongoDB API)

---

## Contact and Support

**Repository**: https://github.com/richardthorek/Station-Manager  
**Current Deployment**: bungrfsstation.azurewebsites.net  
**Documentation**: See `/docs` folder

---

## Appendix: Alternative Approaches Considered

### A. Pure Azure Functions + Azure SignalR Service
**Pros:**
- "Serverless" scalability
- Microsoft managed infrastructure
- Built-in authentication

**Cons:**
- Major code refactoring required (Express → Functions)
- Socket.io → SignalR migration (different API)
- Higher cost (~$50-80/month for SignalR + Functions)
- Migration risk for critical real-time features
- More complex development workflow

**Verdict**: ❌ Rejected - Too much complexity for marginal benefit

### B. Polling-Based Azure Functions (No WebSocket)
**Pros:**
- Simple Azure Functions
- No WebSocket complexity
- Lower cost

**Cons:**
- Degrades user experience significantly
- Higher latency (3-5 seconds vs < 1 second)
- More server load from polling
- Not aligned with real-time requirement

**Verdict**: ❌ Rejected - Violates core requirement

### C. Keep Current Architecture (App Service for Both)
**Pros:**
- Zero changes required
- Proven and working
- Simple deployment

**Cons:**
- Doesn't meet requirement for Static Web App
- Misses CDN benefits for static content
- Misses free hosting for frontend

**Verdict**: ❌ Rejected - Doesn't meet stated goal

### D. Hybrid Architecture (CHOSEN)
**Pros:**
- Meets Static Web App requirement for frontend
- Preserves real-time functionality
- Minimal code changes
- Cost-effective
- Low migration risk
- Best user experience

**Cons:**
- Two separate deployments (frontend + backend)
- CORS configuration needed
- Not "pure" serverless

**Verdict**: ✅ **SELECTED** - Best balance of requirements

---

**End of Master Plan**
