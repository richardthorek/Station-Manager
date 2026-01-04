# RFS Station Manager - Master Plan

**Document Version:** 2.0  
**Last Updated:** January 2026  
**Status:** Living Document  
**Purpose:** Single source of truth for planning, roadmap, architecture guidance, and issue tracking

---

## Document Control

### Single Source of Truth
This document is the **SINGLE SOURCE OF TRUTH** for all planning, roadmap, architecture guidance, and future work tracking for the RFS Station Manager project. All planning must be consolidated here - no duplicate planning documents are permitted.

### Related Documentation
- **AI Development Guidelines**: `.github/copilot-instructions.md` - Repository conventions, coding standards, and AI-assisted development rules
- **Implementation Details**: `docs/AS_BUILT.md` - Current system architecture and implementation state
- **API Definitions**: `docs/api_register.json` - Machine-readable REST API and WebSocket event registry
- **Function Registry**: `docs/function_register.json` - Machine-readable backend function and service method registry
- **API Documentation**: `docs/API_DOCUMENTATION.md` - Human-readable API reference
- **Feature Guides**: `docs/FEATURE_DEVELOPMENT_GUIDE.md`, `docs/GETTING_STARTED.md`

### Update Requirements
When making changes that affect this document:
1. Update this master plan to reflect new priorities, completed work, or strategic changes
2. Update `docs/AS_BUILT.md` if implementation details changed
3. Update machine-readable registries (`api_register.json`, `function_register.json`) if APIs/functions changed
4. Reference this master plan from all major PRs and documentation
5. Update `.github/copilot-instructions.md` if repository procedures evolved

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Guidance](#architecture-guidance)
3. [Current System Status](#current-system-status)
4. [Release Roadmap](#release-roadmap)
5. [Issue Log](#issue-log)
6. [Success Metrics](#success-metrics)
7. [Risk Register](#risk-register)

---

## Project Overview

### Mission Statement
Provide NSW Rural Fire Service volunteer stations with a modern, reliable, and user-friendly digital management system that simplifies daily operations, improves volunteer engagement, and supports station captains with data-driven insights.

### Core Values
1. **Reliability First**: System must be stable and dependable for emergency service operations
2. **Volunteer-Centric**: Simple, intuitive UX for non-technical volunteers
3. **Cost-Conscious**: Minimize operational costs to support widespread adoption
4. **Community-Driven**: Built with and for the RFS volunteer community
5. **Quality Over Speed**: Solid foundations before feature expansion

### System Capabilities (v1.0 - Production)

**Core Sign-In System:**
- Member registration and management
- One-tap check-in/check-out tracking
- Activity selection (Training, Maintenance, Meeting, Custom)
- Real-time synchronization across all devices
- QR code support for quick access
- Self-registration for new members

**Event Management:**
- Discrete event instances (incidents, training, meetings)
- Participant tracking and management
- Event start/end time recording
- Support for multiple concurrent events
- Historical event logs

**Truck Checks (Vehicle Maintenance):**
- Appliance/vehicle management
- Customizable checklist templates
- Check run execution with multi-contributor support
- Issue tracking with photo capture
- Status tracking (done/issue/skipped)
- Historical check reports

**Achievement System:**
- Milestone tracking (sign-ins, hours, events)
- Visual badges and celebrations
- Cross-feature achievements
- Animated unlock notifications

**Technical Foundation:**
- TypeScript backend (Node.js/Express 5)
- React 19 frontend with real-time updates
- Azure Table Storage database (cost-optimized)
- Azure Blob Storage for images
- Comprehensive CI/CD pipeline with quality gates
- Automated testing (45+ backend tests)
- Complete documentation suite

---

## Architecture Guidance

### System Architecture Principles

#### 1. Feature-Based Structure
- **Frontend**: Self-contained feature modules in `frontend/src/features/`
- **Backend**: Route handlers in `backend/src/routes/`, business logic in `backend/src/services/`
- **Benefit**: Scalability, maintainability, clear separation of concerns

#### 2. Real-Time Communication Pattern
```
User Action → REST API → Database Update → Socket.io Broadcast → All Clients Update
```
- **HTTP REST API**: CRUD operations, state changes
- **WebSocket (Socket.io)**: Real-time synchronization across devices
- **Event-Driven**: Backend broadcasts updates, clients listen and refresh

#### 3. Database Strategy
- **Production**: Azure Table Storage (cost-effective NoSQL)
- **Development**: In-memory database for fast local development
- **Pattern**: Database factory pattern for environment-based selection
- **Partitioning**: Entities grouped by type, events partitioned by month

#### 4. Deployment Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Kiosk      │  │   Mobile     │  │   Desktop    │      │
│  │   Browser    │  │   Browser    │  │   Browser    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ HTTPS            │ WSS              │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────┐
│            Azure App Service (Node.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Express Backend + Socket.io                          │ │
│  │  - REST API (35+ endpoints)                           │ │
│  │  - Real-time events (10+ event types)                 │ │
│  │  - Static file serving (frontend dist/)               │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────┬─────────────────────────┬────────────────────────┘
            │                         │
            │                         │
┌───────────▼────────────┐  ┌─────────▼──────────────┐
│  Azure Table Storage   │  │  Azure Blob Storage    │
│  - Members             │  │  - Appliance photos    │
│  - Activities          │  │  - Check issue photos  │
│  - Events              │  │                        │
│  - Check-ins           │  │                        │
│  - Truck checks        │  │                        │
└────────────────────────┘  └────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React | 19.x | UI framework |
| | TypeScript | 5.9.x | Type safety |
| | Vite | 7.x | Build tool & dev server |
| | React Router | 7.x | Client-side routing |
| | Socket.io Client | 4.x | Real-time communication |
| | Framer Motion | 12.x | Animations |
| **Backend** | Node.js | 22.x | Runtime |
| | Express | 5.x | Web framework |
| | TypeScript | 5.9.x | Type safety |
| | Socket.io | 4.x | Real-time server |
| | @azure/data-tables | 13.x | Table Storage SDK |
| | @azure/storage-blob | 12.x | Blob Storage SDK |
| **Database** | Azure Table Storage | Standard | NoSQL data storage |
| | Azure Blob Storage | Standard | Image/file storage |
| **Deployment** | Azure App Service | B1 | Application hosting |
| **CI/CD** | GitHub Actions | - | Automated pipeline |

### Key Design Patterns

#### 1. Database Factory Pattern
```typescript
// Environment-based database selection
const db = await ensureDatabase(); // Returns Table Storage or in-memory
```

#### 2. Real-Time Sync Pattern
```typescript
// Backend: Update database + broadcast
await db.updateMember(member);
io.emit('member-updated', member);

// Frontend: Listen for updates
socket.on('member-updated', (member) => {
  setMembers(prev => updateMemberInList(prev, member));
});
```

#### 3. Feature Component Structure
```
features/
└── feature-name/
    ├── FeaturePage.tsx        # Main component
    ├── FeaturePage.css        # Feature-specific styles
    ├── components/            # Sub-components
    └── hooks/                 # Feature-specific hooks
```

### Development Guidelines

#### Code Quality Standards
- **TypeScript Strict Mode**: No `any` types, proper interfaces required
- **ESLint**: Zero errors, consistent code style
- **Testing**: Minimum 15% backend coverage (target: 70%+)
- **Documentation**: Update AS_BUILT.md, registries, and master plan

#### UI/UX Requirements
- **NSW RFS Branding**: Official colors (core red #e5281B, lime #cbdb2a)
- **Typography**: Public Sans font family
- **Touch Targets**: Minimum 60px for kiosk-friendly operation
- **Responsive**: Mobile-first approach, works on all screen sizes
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation
- **Screenshots**: **ALL UI changes require screenshots on tablet (iPad) size in both portrait AND landscape mode**

#### Performance Targets
- Page load: < 2 seconds on 3G
- Real-time sync: < 2 seconds
- Check-in response: < 500ms
- API response (p95): < 300ms
- Support: 50+ concurrent users

#### Security Considerations
- CORS configured for frontend URL
- Rate limiting on routes (100 req/15min)
- Input validation on all endpoints
- HTTPS/WSS required in production
- Future: Optional authentication for admin functions

---

## Current System Status

### Production Metrics (January 2026)

| Metric | Value | Status |
|--------|-------|--------|
| **System Version** | 1.0.0 | Production |
| **Uptime** | 99%+ | ✅ Stable |
| **Backend Tests** | 45 tests (100% pass) | ✅ Passing |
| **Test Coverage** | 15% baseline | ⚠️ Needs improvement |
| **Frontend Tests** | 0 tests | ❌ Not implemented |
| **API Endpoints** | 35+ REST endpoints | ✅ Complete |
| **Real-time Events** | 10+ Socket.io events | ✅ Working |
| **CI/CD Pipeline** | Quality gates enabled | ✅ Enforced |
| **Documentation** | 95% complete | ✅ Comprehensive |
| **Database** | Azure Table Storage | ✅ Optimized |
| **Monthly Cost** | $13-18 AUD | ✅ Optimized |

### Recently Completed (Q1 2026)

✅ **Table Storage Migration** - Migrated from Cosmos DB to Azure Table Storage
- **Achievement**: 70-95% cost savings ($6-34/year per station)
- **Status**: Complete, legacy code removed
- **Documentation**: `docs/TABLE_STORAGE_MIGRATION_PLAN.md`

✅ **CI/CD Pipeline Enhancement** - Comprehensive quality gates
- **Features**: Parallel checks, backend testing, coverage reporting, automated failure issues
- **Status**: Complete, enforced on all branches
- **Documentation**: `docs/ci_pipeline.md`

✅ **CI/CD Azure OIDC Fix** - Fixed deployment authentication
- **Issue**: AADSTS700213 error (federated identity credential mismatch)
- **Solution**: Removed environment specification from workflow
- **Status**: Complete, deployments working

✅ **Dependabot Configuration** - Automated dependency updates
- **Features**: Weekly updates, automatic labeling, conventional commits
- **Status**: Complete, monitoring all dependencies

✅ **Post-Deployment Testing** - Health check validation after deployment
- **Achievement**: Identity-driven testing with Azure OIDC (no connection strings)
- **Features**: 8 smoke tests, test data isolation (TABLE_STORAGE_TABLE_SUFFIX=Test), automatic validation
- **Status**: Complete, integrated into CI/CD pipeline
- **Documentation**: `docs/POST_DEPLOYMENT_TESTING.md`

✅ **CI/CD Deployment Artifact Fix** - Corrected deployment package structure (January 2026)
- **Issue**: Azure was rebuilding from source, losing build metadata and deploying stale code
- **Root Cause**: SCM_DO_BUILD_DURING_DEPLOYMENT=true + incorrect deployment package structure
- **Solution**: Disabled Azure SCM rebuild, fixed package directory structure (backend/dist)
- **Impact**: Deployments now use pre-built CI/CD artifacts with correct version tracking
- **Status**: Complete, deployments working correctly

### Known Limitations

| ID | Limitation | Impact | Workaround | Priority |
|----|------------|--------|------------|----------|
| L1 | No automatic midnight rollover | Manual intervention required | Manual check-out/in | High |
| L2 | Limited historical reporting | Cannot track trends easily | Manual database queries | High |
| L3 | No data export functionality | Difficult to share data | Database backup extraction | Medium |
| L4 | No bulk member import | Time-consuming for large stations | Use API directly | Medium |
| L5 | Basic search only (name) | Hard to find members in large lists | Scroll through list | Medium |
| L6 | No offline support | Cannot use during network outages | Use mobile data | Low |
| L7 | No mobile app | Not in app stores | Add to home screen (PWA) | Low |
| L8 | No configurable notifications | No automatic reminders | Manual communication | Low |

---

## Release Roadmap

The roadmap follows a phased approach prioritizing **Quality → Stability → Features → Nice-to-haves**.

### Phase 1: Quality & Testing (Q1 2026) - v1.1
**Theme**: Establish solid testing foundation and code quality

**Duration**: 4-6 weeks  
**Priority**: Critical  
**Objective**: Achieve production-grade test coverage and code quality standards

**Focus Areas**:
1. Backend test coverage increase (15% → 70%+)
2. Frontend test infrastructure setup
3. Code quality improvements
4. Bug fixes and stability improvements

**Deliverables**:
- 70%+ backend test coverage
- Frontend test framework with initial component tests
- Zero critical bugs
- Improved code quality metrics

### Phase 2: Operational Excellence (Q1-Q2 2026) - v1.2
**Theme**: Reliability, monitoring, and operational improvements

**Duration**: 3-4 weeks  
**Priority**: High  
**Objective**: Make the system production-ready for scale

**Focus Areas**:
1. Structured logging and monitoring
2. Security enhancements
3. Performance optimization
4. Operational automation

**Deliverables**:
- Structured logging with Azure Log Analytics
- Enhanced input validation and sanitization
- Rate limiting on all API routes
- Midnight rollover automation
- Performance improvements

### Phase 3: Essential Features (Q2 2026) - v1.3
**Theme**: High-value features for daily operations

**Duration**: 4-5 weeks  
**Priority**: High  
**Objective**: Address most common user needs and pain points

**Focus Areas**:
1. Data export and reporting
2. Enhanced search and filtering
3. User experience improvements
4. Admin tools

**Deliverables**:
- CSV data export
- Reporting dashboard
- Enhanced member search
- Bulk member import

### Phase 4: Advanced Features (Q3-Q4 2026) - v2.0
**Theme**: Next-generation capabilities and enhancements

**Duration**: 8-12 weeks  
**Priority**: Medium  
**Objective**: Expand system capabilities and reach

**Focus Areas**:
1. Offline support (PWA)
2. Notification system
3. Multi-station support
4. Advanced analytics
5. Optional authentication

**Deliverables**:
- PWA with offline capabilities
- Email/SMS notifications
- Multi-station/multi-tenant support
- Advanced analytics dashboard
- Admin authentication (optional)

---

## Issue Log

All future work organized by priority: Quality → Stability → Features → Nice-to-haves.

Each issue includes:
- **Objective**: What we're trying to achieve
- **User Story**: Who benefits and why
- **Steps**: Implementation tasks
- **Success Criteria**: Definition of done
- **UI Screenshot Requirement**: For all UI changes, screenshots required on tablet (iPad) size in portrait AND landscape mode

---

### PHASE 1: QUALITY & TESTING (Q1 2026) - v1.1

Priority: **CRITICAL** - Must complete before new features

---

#### Issue #1: Increase Backend Test Coverage to 70%+
**GitHub Issue**: #96 (created 2026-01-04T07:52:21Z)

**Objective**: Establish comprehensive test coverage to prevent regressions and ensure code quality

**User Story**: As a developer, I want comprehensive test coverage so that I can refactor and add features confidently without breaking existing functionality.

**Current State**: 15% backend test coverage (45 tests covering core APIs only)  
**Target State**: 70%+ backend test coverage across all modules

**Steps**:
1. Audit current test coverage and identify untested modules
2. Set up test coverage reporting in CI/CD (already done)
3. Write tests for achievements routes and service (0% → 70%+)
   - Test milestone calculations
   - Test achievement unlock logic
   - Test cross-feature achievements
4. Write tests for events routes and service (0% → 70%+)
   - Test event creation and management
   - Test participant tracking
   - Test concurrent events
5. Write tests for truck checks routes and service (0% → 70%+)
   - Test appliance management
   - Test check run execution
   - Test checklist templates
6. Write tests for Azure storage services (0% → 70%+)
   - Test blob upload/download
   - Test image handling
   - Mock Azure SDK calls
7. Write tests for Table Storage database implementations (3.22% → 70%+)
   - Test all CRUD operations
   - Test partitioning logic
   - Test query operations
8. Add integration tests for end-to-end workflows
   - Test complete sign-in flow
   - Test event participation flow
   - Test truck check flow
9. Update CI/CD coverage threshold from 15% to 70%

**Success Criteria**:
- [ ] Backend test coverage ≥ 70% (statements, branches, functions, lines)
- [ ] All routes have corresponding test files
- [ ] All services have corresponding test files
- [ ] Integration tests cover main user workflows
- [ ] CI/CD pipeline enforces 70% coverage threshold
- [ ] Zero test failures
- [ ] Test execution time < 30 seconds

**Dependencies**: None

**Effort Estimate**: 2-3 weeks

**Priority**: P0 (Critical)

**Labels**: `quality`, `testing`, `tech-debt`, `phase-1`

**Milestone**: v1.1 - Quality & Testing


---

#### Issue #2: Add Frontend Component Tests
**GitHub Issue**: #104 (created 2026-01-04T09:23:39Z)

**Objective**: Establish frontend testing infrastructure and achieve initial coverage

**User Story**: As a developer, I want frontend component tests so that I can confidently refactor UI components and catch visual regressions early.

**Current State**: 0 frontend tests, no testing infrastructure  
**Target State**: Vitest + React Testing Library setup with 50%+ component coverage

**Steps**:
1. Install and configure Vitest
   - Add Vitest to frontend package.json
   - Configure vite.config.ts for testing
   - Set up test environment (jsdom)
2. Install React Testing Library
   - @testing-library/react
   - @testing-library/jest-dom
   - @testing-library/user-event
3. Create test utilities and setup files
   - Mock Socket.io client
   - Mock API service
   - Test helpers for common scenarios
4. Write tests for core components
   - ActivitySelector component (sign-in page)
   - MemberList component
   - CheckInList component
   - QRCodeDisplay component
5. Write tests for feature pages
   - LandingPage
   - SignInPage (basic rendering)
   - ProfilePage (basic rendering)
6. Write tests for custom hooks
   - useSocket hook
   - API integration hooks
7. Add test script to package.json
8. Add frontend tests to CI/CD pipeline
9. Set up coverage reporting

**Success Criteria**:
- [ ] Vitest and React Testing Library configured
- [ ] Test utilities and mocks in place
- [ ] At least 10 component test files created
- [ ] Core components have ≥50% coverage
- [ ] All tests passing
- [ ] Frontend tests run in CI/CD pipeline
- [ ] Coverage report generated and displayed

**Dependencies**: None

**Effort Estimate**: 1-2 weeks

**Priority**: P0 (Critical)

**Labels**: `quality`, `testing`, `frontend`, `tech-debt`, `phase-1`

**Milestone**: v1.1 - Quality & Testing

**UI Screenshot Requirement**: N/A (Testing infrastructure only)

---

#### Issue #3: Fix CI/CD Test Coverage Threshold Failure
**GitHub Issue**: #105 (created 2026-01-04T09:23:47Z)

**Objective**: Add tests to meet and exceed the 15% baseline coverage threshold

**User Story**: As a developer, I want the CI/CD pipeline to pass so that automated deployments work correctly.

**Current State**: Coverage at 14.78% branches, 14.84% lines, 13.86% functions (below 15% threshold)  
**Target State**: Coverage exceeds 15% threshold comfortably (aim for 20%+)

**Steps**:
1. Review current coverage report from CI/CD failure
2. Identify quick wins for coverage improvement
   - Add tests to partially tested files (checkins.ts at 50%)
   - Add basic tests to untested routes
3. Add tests for achievements routes (currently 0%)
   - POST /api/achievements - basic validation test
   - GET /api/achievements/:memberId - basic retrieval test
4. Add tests for events routes (currently 0%)
   - POST /api/events - basic creation test
   - GET /api/events - basic retrieval test
5. Add tests for truck checks routes (currently 0%)
   - GET /api/truckcheck/appliances - basic retrieval test
   - POST /api/truckcheck/appliances - basic creation test
6. Run coverage locally to verify threshold met
7. Push and verify CI/CD passes

**Success Criteria**:
- [ ] All coverage metrics ≥ 15%
- [ ] Statements: ≥ 15%
- [ ] Branches: ≥ 15%
- [ ] Functions: ≥ 15% (currently 13.86%, needs improvement)
- [ ] Lines: ≥ 15%
- [ ] CI/CD pipeline passes
- [ ] No test failures

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P0 (Critical - blocking deployments)

**Labels**: `bug`, `ci-failure`, `testing`, `phase-1`

**Milestone**: v1.1 - Quality & Testing

**Related Issue**: #92

---

#### Issue #4: Code Quality Audit and Cleanup
**GitHub Issue**: #106 (created 2026-01-04T09:24:17Z)

**Objective**: Improve code quality, remove dead code, and establish quality standards

**User Story**: As a developer, I want clean, well-organized code so that the codebase is maintainable and easy to understand.

**Current State**: Some code duplication, potential dead code, inconsistent patterns  
**Target State**: Clean codebase with consistent patterns and no dead code

**Steps**:
1. Run static code analysis
   - ESLint (already configured)
   - Check for unused exports
   - Check for unreachable code
2. Identify and remove dead code
   - Unused functions
   - Unused imports
   - Commented-out code blocks
3. Refactor duplicated code
   - Database factory pattern improvements (TD2.1)
   - Common validation logic
   - Shared type definitions
4. Standardize error handling patterns
   - Consistent error response format
   - Proper error logging
5. Improve TypeScript usage
   - Remove any remaining `any` types
   - Add missing type definitions
   - Use proper type imports
6. Add JSDoc comments for complex functions
7. Update documentation for any architectural changes

**Success Criteria**:
- [ ] Zero ESLint errors
- [ ] Zero TypeScript `any` types in new code
- [ ] No unused imports or exports
- [ ] No commented-out code blocks
- [ ] Consistent error handling across all routes
- [ ] All public functions have JSDoc comments
- [ ] Code review approved

**Dependencies**: None

**Effort Estimate**: 3-5 days

**Priority**: P1 (High)

**Labels**: `quality`, `refactoring`, `tech-debt`, `phase-1`

**Milestone**: v1.1 - Quality & Testing

**UI Screenshot Requirement**: N/A (Code quality only)

---


### PHASE 2: OPERATIONAL EXCELLENCE (Q1-Q2 2026) - v1.2

Priority: **HIGH** - Critical for production scale

---

#### Issue #5: Implement Structured Logging
**GitHub Issue**: #107 (created 2026-01-04T09:24:25Z)

**Objective**: Replace console.log with structured logging for better debugging and monitoring

**User Story**: As a DevOps engineer, I want structured logs so that I can debug production issues quickly and set up alerts for critical errors.

**Current State**: Using console.log throughout, no log levels, no request tracing  
**Target State**: Winston or Pino logger with log levels, request IDs, and Azure Log Analytics integration

**Steps**:
1. Choose logging library (Winston or Pino)
   - Evaluate performance
   - Check Azure integration
   - Decision: Winston (better Azure support)
2. Install and configure Winston
   - Add winston package
   - Configure log levels (error, warn, info, debug)
   - Set up log formatting (JSON for production)
3. Add request ID middleware
   - Generate unique request ID
   - Add to request object
   - Include in all logs
4. Replace all console.log statements
   - backend/src/index.ts
   - All route files
   - All service files
5. Add contextual logging
   - Include memberId, eventId, etc.
   - Add performance timing logs
6. Set up Azure Log Analytics integration
   - Configure Winston Azure transport
   - Test log ingestion
   - Set up basic queries
7. Add logging documentation
   - How to add logs
   - Log levels guide
   - Querying logs in Azure
8. Test logging in development and production

**Success Criteria**:
- [ ] Winston configured with proper log levels
- [ ] Request IDs on all requests
- [ ] All console.log replaced with logger
- [ ] Logs include contextual information
- [ ] Azure Log Analytics receiving logs
- [ ] Logging documentation complete
- [ ] Performance impact < 5ms per request

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `stability`, `monitoring`, `tech-debt`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #6: Add Input Sanitization and Validation
**GitHub Issue**: #108 (created 2026-01-04T09:24:34Z)

**Objective**: Protect against XSS, injection attacks, and invalid data

**User Story**: As a security engineer, I want robust input validation so that the system is protected from malicious input and data quality is maintained.

**Current State**: Basic trim() only, no XSS protection, minimal validation  
**Target State**: express-validator or validator.js with comprehensive validation rules

**Steps**:
1. Choose validation library
   - Evaluate express-validator vs validator.js
   - Decision: express-validator (Express integration)
2. Install express-validator
3. Create validation middleware for each route
   - Members validation (name, rank, memberNumber)
   - Activities validation (name, type)
   - Events validation (name, startTime, endTime)
   - Check-ins validation
   - Truck checks validation
4. Add sanitization rules
   - Trim whitespace
   - Escape HTML special characters
   - Normalize strings
5. Add validation error handling
   - Return clear error messages
   - Include field-level errors
6. Add validation tests
   - Test valid inputs pass
   - Test invalid inputs rejected
   - Test XSS attempts blocked
7. Update API documentation with validation rules
8. Add input validation guidelines to documentation

**Success Criteria**:
- [ ] express-validator integrated
- [ ] All POST/PUT endpoints have validation
- [ ] XSS attempts blocked (test with common payloads)
- [ ] SQL injection attempts blocked (if applicable)
- [ ] Clear error messages for validation failures
- [ ] Validation tests passing
- [ ] API documentation updated
- [ ] Zero security vulnerabilities from input handling

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P0 (Critical - Security)

**Labels**: `security`, `tech-debt`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #7: Add API Rate Limiting
**GitHub Issue**: #109 (created 2026-01-04T09:24:42Z)

**Objective**: Protect API endpoints from abuse and DDoS attacks

**User Story**: As a system administrator, I want rate limiting on all API endpoints so that the system remains stable under heavy load or attack.

**Current State**: Only SPA fallback route is rate-limited  
**Target State**: Rate limiting on all API routes with configurable limits

**Steps**:
1. Install express-rate-limit package (already available)
2. Configure rate limiting strategy
   - API routes: 100 requests per 15 minutes per IP
   - Authentication routes (future): 5 requests per 15 minutes per IP
   - Static files: No rate limiting
3. Create rate limit middleware
   - Separate limits for different route groups
   - Custom error messages
   - Include rate limit headers (X-RateLimit-*)
4. Apply rate limiting to routes
   - /api/members routes
   - /api/activities routes
   - /api/checkins routes
   - /api/events routes
   - /api/achievements routes
   - /api/truckcheck routes
5. Test rate limiting
   - Verify limits enforced
   - Verify headers included
   - Test error responses
6. Add rate limiting to documentation
7. Monitor rate limit hits in logs

**Success Criteria**:
- [ ] Rate limiting on all API routes
- [ ] Configurable limits via environment variables
- [ ] Proper rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- [ ] Clear error messages when rate limited (429 status)
- [ ] Rate limit hits logged
- [ ] Documentation updated
- [ ] No impact on normal usage patterns

**Dependencies**: None

**Effort Estimate**: Half day

**Priority**: P1 (High)

**Labels**: `security`, `stability`, `tech-debt`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #8: Implement Midnight Rollover Automation
**GitHub Issue**: #110 (created 2026-01-04T09:24:50Z)

**Objective**: Automatically reset check-ins at midnight to eliminate manual intervention

**User Story**: As a station captain, I want check-ins to automatically reset at midnight so I don't have to manually manage daily transitions.

**Current State**: Check-ins persist indefinitely, manual intervention required  
**Target State**: Scheduled job automatically deactivates check-ins at configurable time

**Steps**:
1. Choose scheduling library
   - Evaluate node-cron vs node-schedule
   - Decision: node-cron (simpler, more popular)
2. Install node-cron
3. Create rollover service
   - Query check-ins older than 24 hours
   - Deactivate old check-ins
   - Log rollover actions
   - Optional: Notify checked-in members
4. Add rollover configuration
   - ROLLOVER_TIME environment variable (default: "0 0 * * *" = midnight)
   - ROLLOVER_ENABLED flag
   - ROLLOVER_NOTIFY flag
5. Add rollover job to backend startup
6. Create rollover endpoint for manual trigger (admin only)
   - POST /api/admin/rollover
7. Add rollover tests
   - Test check-ins deactivated
   - Test timing
   - Test logging
8. Add rollover monitoring
   - Log successful rollovers
   - Alert on rollover failures
9. Update documentation

**Success Criteria**:
- [ ] node-cron installed and configured
- [ ] Check-ins automatically deactivated at midnight
- [ ] Configurable rollover time
- [ ] Rollover actions logged
- [ ] Manual trigger endpoint available
- [ ] Tests passing
- [ ] No impact on active check-ins
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `feature`, `automation`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend automation)

---


#### Issue #9: Performance Optimization - Response Compression
**GitHub Issue**: #111 (created 2026-01-04T09:24:58Z)

**Objective**: Reduce bandwidth usage and improve page load times with compression

**User Story**: As a user on a slow connection, I want faster page loads so that I can use the system efficiently even in rural areas.

**Current State**: No compression middleware  
**Target State**: Gzip/Brotli compression on all responses

**Steps**:
1. Install compression middleware
   - Add `compression` package to backend
2. Configure compression
   - Enable gzip compression
   - Set compression level (balance speed vs size)
   - Configure threshold (don't compress small responses)
3. Add compression middleware to Express app
   - Apply before routes
   - Exclude certain content types if needed
4. Test compression
   - Verify compressed responses
   - Check compression headers
   - Measure size reduction
5. Benchmark performance
   - Before: response sizes
   - After: response sizes
   - Compression overhead
6. Update documentation

**Success Criteria**:
- [ ] Compression middleware installed
- [ ] All text responses compressed (HTML, JSON, CSS, JS)
- [ ] 70-80% size reduction on text content
- [ ] Response time increase < 5ms
- [ ] Proper Content-Encoding headers
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: Half day

**Priority**: P2 (Medium)

**Labels**: `performance`, `optimization`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

#### Issue #10: Add Security Headers
**GitHub Issue**: #112 (created 2026-01-04T09:25:06Z)

**Objective**: Implement standard security headers to protect against common web vulnerabilities

**User Story**: As a security engineer, I want proper security headers so that the application is protected against XSS, clickjacking, and other attacks.

**Current State**: Minimal security headers  
**Target State**: Comprehensive security headers (CSP, X-Frame-Options, etc.)

**Steps**:
1. Install helmet middleware
   - Add `helmet` package to backend
2. Configure helmet with strict security headers
   - Content-Security-Policy
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy
3. Test CSP compatibility
   - Verify frontend still works
   - Adjust CSP for Socket.io
   - Adjust CSP for inline styles (if any)
4. Add helmet to Express app
5. Test security headers
   - Verify headers present
   - Test with security scanner
6. Document security headers

**Success Criteria**:
- [ ] Helmet middleware installed
- [ ] All security headers present
- [ ] CSP properly configured
- [ ] Frontend functionality not broken
- [ ] Security scanner passes
- [ ] A+ rating on securityheaders.com
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1 day

**Priority**: P1 (High - Security)

**Labels**: `security`, `phase-2`

**Milestone**: v1.2 - Operational Excellence

**UI Screenshot Requirement**: N/A (Backend only)

---

### PHASE 3: ESSENTIAL FEATURES (Q2 2026) - v1.3

Priority: **HIGH** - High-value user features

---

#### Issue #11: CSV Data Export
**GitHub Issue**: #113 (created 2026-01-04T09:25:13Z)

**Objective**: Allow users to export data for reporting and external analysis

**User Story**: As a station captain, I want to export member and check-in data to CSV so I can create custom reports and share data with RFS management.

**Current State**: No export functionality, manual database queries required  
**Target State**: Export buttons for members, check-ins, events, and truck checks

**Steps**:
1. Install CSV generation library
   - Add `json2csv` or `csv-writer` package
2. Create export service
   - Function to convert data to CSV
   - Handle special characters
   - Add headers
3. Add export API endpoints
   - GET /api/export/members
   - GET /api/export/checkins (with date range filter)
   - GET /api/export/events (with date range filter)
   - GET /api/export/truckcheck-results (with date range filter)
4. Add frontend export buttons
   - Sign-in page: Export members button
   - Sign-in page: Export check-ins button (with date picker)
   - Events section: Export events button
   - Truck check: Export results button
5. Handle large exports
   - Streaming for large datasets
   - Progress indicators
6. Add export tests
   - Test CSV generation
   - Test date range filtering
   - Test special characters
7. Update documentation

**Success Criteria**:
- [ ] CSV export endpoints working
- [ ] Export buttons in UI
- [ ] Members export includes all fields
- [ ] Check-ins export includes date range filter
- [ ] Events export includes participants
- [ ] Truck check export includes all check details
- [ ] Special characters handled correctly
- [ ] Large exports work without timeout
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `feature`, `data-export`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Screenshot of each export button in UI (Sign-in page, Events, Truck checks)
- iPad portrait mode
- iPad landscape mode

---

#### Issue #12: Enhanced Member Search and Filtering
**GitHub Issue**: #114 (created 2026-01-04T09:25:22Z)

**Objective**: Improve member search with multiple criteria and better UX

**User Story**: As a user, I want to search and filter members by multiple criteria so I can quickly find the person I'm looking for in a large list.

**Current State**: Basic name search only  
**Target State**: Search by name, rank, member number; filter by activity level; sort options

**Steps**:
1. Backend: Extend member query API
   - Add search parameter (name, rank, memberNumber)
   - Add filter parameter (activity level, checked-in status)
   - Add sort parameter (name, activity, rank, lastCheckIn)
   - Optimize query performance
2. Frontend: Enhance search UI
   - Keep existing search bar (name search)
   - Add filter dropdown (All, Checked In, Active Last 30 Days, Inactive)
   - Add sort dropdown (Name A-Z, Name Z-A, Most Active, Recently Active)
   - Add rank filter chips (if ranks are used)
3. Implement debounced search
   - Reduce API calls while typing
   - 300ms debounce delay
4. Add search result count
   - "Showing X of Y members"
5. Persist filter/sort preferences
   - LocalStorage for user preferences
6. Add search tests
   - Test search functionality
   - Test filters
   - Test sorting
7. Update documentation

**Success Criteria**:
- [ ] Search works for name, rank, and member number
- [ ] Filters work (activity level, checked-in status)
- [ ] Sorting works (name, activity, last check-in)
- [ ] Debounced search (no excessive API calls)
- [ ] Result count displayed
- [ ] Preferences persisted
- [ ] Responsive design maintained
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P1 (High)

**Labels**: `feature`, `ux-improvement`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Sign-in page with new filter/sort UI
- Show filter dropdown open
- Show sort dropdown open
- iPad portrait mode
- iPad landscape mode

---


#### Issue #13: Reporting Dashboard
**GitHub Issue**: #115 (created 2026-01-04T09:25:30Z)

**Objective**: Provide station captains with insights into station activity and volunteer participation

**User Story**: As a station captain, I want to see attendance statistics and trends so that I can understand station participation patterns and make data-driven decisions.

**Current State**: No reporting, manual data analysis required  
**Target State**: Interactive dashboard with charts and statistics

**Steps**:
1. Choose charting library
   - Evaluate Chart.js, Recharts, Victory
   - Decision: Recharts (React-friendly, TypeScript support)
2. Install Recharts and date utilities
3. Create reporting API endpoints
   - GET /api/reports/attendance-summary (monthly stats)
   - GET /api/reports/member-participation (top members)
   - GET /api/reports/activity-breakdown (Training vs Maintenance vs Meeting)
   - GET /api/reports/event-statistics
   - GET /api/reports/truckcheck-compliance
4. Create Reports feature page
   - New route: /reports
   - Add to landing page
5. Build dashboard components
   - Monthly attendance chart (bar chart)
   - Member participation leaderboard (top 10)
   - Activity breakdown (pie chart)
   - Event statistics cards
   - Truck check compliance gauge
6. Add date range selector
   - Last 30 days, Last 90 days, Last 12 months, Custom range
7. Add export dashboard to PDF (optional, future enhancement)
8. Add loading states and error handling
9. Make responsive for mobile
10. Add tests for report generation
11. Update documentation

**Success Criteria**:
- [ ] Recharts integrated
- [ ] Reporting API endpoints working
- [ ] Reports page accessible from landing page
- [ ] Monthly attendance chart displays correctly
- [ ] Member participation leaderboard shows top 10
- [ ] Activity breakdown pie chart accurate
- [ ] Event statistics displayed
- [ ] Truck check compliance shown
- [ ] Date range selector working
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states and error handling
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1-2 weeks

**Priority**: P1 (High)

**Labels**: `feature`, `reporting`, `analytics`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Reports page with all charts visible
- Each chart component individually
- Different date ranges selected
- iPad portrait mode
- iPad landscape mode

---

#### Issue #14: Bulk Member Import from CSV
**GitHub Issue**: #116 (created 2026-01-04T09:25:39Z)

**Objective**: Enable quick onboarding of multiple members at once

**User Story**: As a station captain setting up the system, I want to import members from a CSV file so that I can onboard my entire station quickly without adding members one by one.

**Current State**: Members must be added one at a time  
**Target State**: CSV upload with validation and preview

**Steps**:
1. Install CSV parsing library
   - Add `papaparse` for CSV parsing
2. Create upload UI component
   - File input (drag-and-drop or browse)
   - Accept .csv files only
   - Download sample CSV template button
3. Create import API endpoint
   - POST /api/members/import
   - Accept multipart/form-data
   - Parse CSV
   - Validate data
   - Return validation results
4. Implement validation logic
   - Required fields: name
   - Optional fields: rank, memberNumber, qualifications
   - Check for duplicates (by name)
   - Check for invalid data
5. Create preview/confirmation UI
   - Show parsed members in table
   - Highlight validation errors
   - Show duplicate warnings
   - Confirm/Cancel buttons
6. Handle import execution
   - Batch create members
   - Generate QR codes
   - Return success/failure results
7. Add error handling
   - Invalid CSV format
   - Server errors
   - Partial success handling
8. Create sample CSV template
   - Include headers and example rows
   - Add to documentation
9. Add import tests
   - Test valid CSV
   - Test invalid CSV
   - Test duplicates
10. Update documentation

**Success Criteria**:
- [ ] CSV upload UI working
- [ ] Drag-and-drop supported
- [ ] CSV parsing working
- [ ] Validation working (required fields, format)
- [ ] Duplicate detection working
- [ ] Preview shows all members with validation status
- [ ] Batch import working
- [ ] QR codes generated for all imported members
- [ ] Error handling graceful
- [ ] Sample CSV template available
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 3-4 days

**Priority**: P2 (Medium)

**Labels**: `feature`, `bulk-import`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: YES
- Upload page/modal
- File selected state
- Preview table with validation results
- Success confirmation
- iPad portrait mode
- iPad landscape mode

---

#### Issue #15: Bundle Size Optimization
**GitHub Issue**: #117 (created 2026-01-04T09:25:48Z)

**Objective**: Reduce frontend bundle size for faster load times on slow connections

**User Story**: As a user on a slow rural internet connection, I want the app to load quickly so that I can start using it without long waits.

**Current State**: Frontend bundle ~500KB (acceptable but could be better)  
**Target State**: Bundle < 300KB with code splitting and lazy loading

**Steps**:
1. Analyze current bundle
   - Install webpack-bundle-analyzer or rollup-plugin-visualizer
   - Run build with analyzer
   - Identify large dependencies
2. Implement code splitting
   - Split by route (landing, signin, profile, truckcheck, reports)
   - Lazy load feature pages with React.lazy()
   - Add loading fallback components
3. Optimize dependencies
   - Replace large libraries if possible
   - Use tree-shaking
   - Import only needed functions
4. Optimize images and assets
   - Compress images
   - Use appropriate formats (WebP)
   - Lazy load images
5. Enable minification and compression
   - Ensure Vite minification is enabled
   - Test gzip compression
6. Test lazy loading
   - Verify routes load correctly
   - Check loading states
   - Ensure no broken chunks
7. Measure improvements
   - Before: bundle size, load time
   - After: bundle size, load time
   - Target: 40-50% reduction
8. Update documentation

**Success Criteria**:
- [ ] Bundle analyzer integrated
- [ ] Code splitting by route implemented
- [ ] Lazy loading working for all features
- [ ] Bundle size < 300KB (gzipped)
- [ ] Initial load time improved by 30%+
- [ ] No broken routes or missing chunks
- [ ] Loading states user-friendly
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 2-3 days

**Priority**: P2 (Medium)

**Labels**: `performance`, `optimization`, `phase-3`

**Milestone**: v1.3 - Essential Features

**UI Screenshot Requirement**: N/A (Performance only, but screenshot of loading states)

---

### PHASE 4: ADVANCED FEATURES (Q3-Q4 2026) - v2.0

Priority: **MEDIUM** - Long-term enhancements

---

#### Issue #16: PWA with Offline Support
**GitHub Issue**: #119 (created 2026-01-04T09:25:56Z)

**Objective**: Enable offline functionality for use during network outages

**User Story**: As a user in a rural area, I want the app to work offline so that I can continue using it during network outages.

**Current State**: Requires active internet connection  
**Target State**: Progressive Web App with service worker and offline caching

**Steps**:
1. Install PWA dependencies
   - vite-plugin-pwa
   - workbox
2. Configure service worker
   - Cache static assets
   - Cache API responses
   - Define caching strategy (cache-first for static, network-first for dynamic)
3. Create offline queue
   - Queue actions when offline
   - Sync when connection restored
   - IndexedDB for offline storage
4. Add PWA manifest
   - App name, icons, theme colors
   - Display mode: standalone
   - Start URL
5. Create offline indicator UI
   - Show connectivity status
   - Warn when offline
   - Show queued actions
6. Handle offline scenarios
   - Check-in: Queue until online
   - Member add: Queue until online
   - Data fetch: Show cached data
7. Test offline functionality
   - Test various offline scenarios
   - Test sync when back online
   - Test data conflicts
8. Add "Add to Home Screen" prompt
9. Update documentation

**Success Criteria**:
- [ ] Service worker registered and working
- [ ] Static assets cached
- [ ] API responses cached appropriately
- [ ] Offline queue working
- [ ] Sync works when back online
- [ ] Offline indicator visible
- [ ] Add to Home Screen prompt works
- [ ] PWA installable on mobile devices
- [ ] Offline scenarios tested
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1-2 weeks

**Priority**: P2 (Medium)

**Labels**: `feature`, `pwa`, `offline`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Offline indicator UI
- Queued actions display
- Add to Home Screen prompt
- iPad portrait mode
- iPad landscape mode

---


#### Issue #17: Notification System (Email/SMS)
**GitHub Issue**: #120 (created 2026-01-04T09:26:06Z)

**Objective**: Send automated notifications to keep members informed

**User Story**: As a member, I want to receive notifications about upcoming events and reminders so that I don't miss important activities.

**Current State**: No notification system, manual communication required  
**Target State**: Email notifications with optional SMS, configurable preferences

**Steps**:
1. Choose notification provider
   - Email: SendGrid or AWS SES
   - SMS: Twilio (optional)
   - Decision: SendGrid for email
2. Install SendGrid SDK
   - Add @sendgrid/mail package
3. Create notification service
   - Send email function
   - Send SMS function (optional)
   - Template management
4. Design email templates
   - Event reminder template
   - Check-in reminder template
   - Weekly summary template
5. Create notification preferences
   - Add email field to member profile
   - Add notification preferences
   - Opt-in/opt-out per notification type
6. Add notification API endpoints
   - POST /api/notifications/send
   - GET /api/notifications/preferences/:memberId
   - PUT /api/notifications/preferences/:memberId
7. Implement notification triggers
   - Event created: Notify all members
   - Event starting in 24h: Reminder
   - Weekly activity summary
8. Create notification UI
   - Preferences in member profile
   - Test notification button (admin)
9. Add notification queue
   - Background job processing
   - Retry failed sends
10. Add notification tests
11. Update documentation

**Success Criteria**:
- [ ] SendGrid integrated
- [ ] Email templates created
- [ ] Notification preferences UI working
- [ ] Event notifications sent automatically
- [ ] Reminders sent 24h before events
- [ ] Weekly summaries sent
- [ ] Opt-in/opt-out working
- [ ] Failed sends retried
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: Issue #8 (Midnight rollover for scheduling)

**Effort Estimate**: 2 weeks

**Priority**: P3 (Low - Nice to have)

**Labels**: `feature`, `notifications`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Notification preferences UI in member profile
- Email template preview (in docs)
- iPad portrait mode
- iPad landscape mode

---

#### Issue #18: Optional Admin Authentication
**GitHub Issue**: #121 (created 2026-01-04T09:26:14Z)

**Objective**: Protect sensitive administrative operations with authentication

**User Story**: As a station captain, I want to protect administrative functions so that only authorized users can delete members or change system settings.

**Current State**: No authentication, all operations open  
**Target State**: Optional JWT or Azure AD authentication for admin operations

**Steps**:
1. Choose authentication strategy
   - Option A: Simple JWT with password
   - Option B: Azure AD integration
   - Decision: Start with simple JWT, option to add Azure AD later
2. Install authentication dependencies
   - jsonwebtoken
   - bcrypt (for password hashing)
3. Create admin user management
   - Admin users table/collection
   - Hash passwords
   - Role-based access (admin, viewer)
4. Implement JWT authentication
   - POST /api/auth/login endpoint
   - Generate JWT token
   - Verify JWT middleware
5. Protect admin endpoints
   - Member deletion: require auth
   - System settings: require auth
   - Data export: optional auth (configurable)
   - Bulk operations: require auth
6. Create login UI
   - Login page/modal
   - Token storage (httpOnly cookie or localStorage)
   - Logout functionality
7. Handle authentication state
   - Check token validity
   - Refresh tokens
   - Auto-logout on expiration
8. Add authentication toggle
   - REQUIRE_AUTH environment variable
   - Allow disabling auth for simple setups
9. Add authentication tests
10. Update documentation

**Success Criteria**:
- [ ] JWT authentication working
- [ ] Admin user management working
- [ ] Login UI functional
- [ ] Admin endpoints protected
- [ ] Auth can be enabled/disabled via env var
- [ ] Token refresh working
- [ ] Auto-logout on expiration
- [ ] Backwards compatible (auth optional)
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: None

**Effort Estimate**: 1 week

**Priority**: P2 (Medium)

**Labels**: `feature`, `security`, `authentication`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Login page/modal
- Logged in state indicator
- Logout button
- Protected function UI (before/after auth)
- iPad portrait mode
- iPad landscape mode

---

#### Issue #19: Multi-Station Support
**GitHub Issue**: #122 (created 2026-01-04T09:26:22Z)

**Objective**: Enable multi-tenant support for managing multiple RFS stations

**User Story**: As an RFS regional manager, I want to manage multiple stations in one system so that I can see activity across all stations and consolidate reporting.

**Current State**: Single station only  
**Target State**: Multi-tenant system with station selection and isolation

**Steps**:
1. Design multi-tenancy architecture
   - Shared database with stationId partitioning
   - Station-based data isolation
   - Central admin portal
2. Update database schema
   - Add stationId to all entities
   - Update partition keys for Table Storage
   - Add Stations table/collection
3. Create station management API
   - POST /api/stations (create station)
   - GET /api/stations (list all stations)
   - GET /api/stations/:id (get station details)
   - PUT /api/stations/:id (update station)
4. Add station selection UI
   - Station picker dropdown
   - Store selected station in context
   - Persist selection in localStorage
5. Update all API calls
   - Include stationId in requests
   - Filter data by stationId
   - Validate station access
6. Create station admin UI
   - Manage stations
   - Assign admins to stations
   - View cross-station reports
7. Handle data migration
   - Assign existing data to default station
   - Migration script for current deployments
8. Add multi-station tests
9. Update documentation

**Success Criteria**:
- [ ] Stations table/collection created
- [ ] All entities have stationId
- [ ] Station management API working
- [ ] Station selection UI working
- [ ] Data properly isolated by station
- [ ] Cross-station reporting available (admin only)
- [ ] Migration script tested
- [ ] Backwards compatible with single-station deployments
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: Issue #18 (Authentication for station management)

**Effort Estimate**: 2-3 weeks

**Priority**: P3 (Low - Future growth)

**Labels**: `feature`, `multi-tenant`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Station selection dropdown
- Station management UI
- Cross-station dashboard
- iPad portrait mode
- iPad landscape mode

---

#### Issue #20: Advanced Analytics Dashboard
**GitHub Issue**: #123 (created 2026-01-04T09:26:30Z)

**Objective**: Provide deep insights with advanced analytics and visualizations

**User Story**: As a station captain, I want detailed analytics so that I can identify trends, forecast needs, and optimize station operations.

**Current State**: Basic reporting (Issue #13)  
**Target State**: Advanced analytics with trends, predictions, and drill-down capabilities

**Steps**:
1. Extend reporting API with advanced metrics
   - Trend analysis (YoY, MoM growth)
   - Member retention metrics
   - Activity forecasting
   - Peak activity times
   - Member engagement scores
2. Add advanced visualizations
   - Trend lines and sparklines
   - Heat maps (activity by day/time)
   - Funnel charts (member journey)
   - Cohort analysis
3. Implement drill-down functionality
   - Click chart to see details
   - Filter by time period
   - Filter by activity type
   - Filter by member
4. Add comparison features
   - Compare periods (this month vs last month)
   - Compare activities
   - Compare members
5. Create export to PDF/Excel
   - Generate report PDFs
   - Export data to Excel
6. Add data refresh and caching
   - Cache expensive calculations
   - Auto-refresh dashboard
   - Manual refresh button
7. Add analytics tests
8. Update documentation

**Success Criteria**:
- [ ] Advanced metrics calculated correctly
- [ ] Trend analysis working
- [ ] Heat maps displaying correctly
- [ ] Drill-down working
- [ ] Comparison features working
- [ ] PDF export working
- [ ] Excel export working
- [ ] Performance acceptable (< 2s load)
- [ ] Tests passing
- [ ] Documentation updated

**Dependencies**: Issue #13 (Basic reporting)

**Effort Estimate**: 2-3 weeks

**Priority**: P3 (Low - Nice to have)

**Labels**: `feature`, `analytics`, `reporting`, `phase-4`

**Milestone**: v2.0 - Advanced Features

**UI Screenshot Requirement**: YES
- Advanced analytics dashboard
- Each new visualization type
- Drill-down examples
- Comparison views
- iPad portrait mode
- iPad landscape mode

---

## Success Metrics

### Key Performance Indicators (KPIs)

| Metric | Current | Q1 2026 Target | Q2 2026 Target | Q4 2026 Target |
|--------|---------|----------------|----------------|----------------|
| **Quality Metrics** |
| Backend Test Coverage | 15% | 70%+ | 70%+ | 75%+ |
| Frontend Test Coverage | 0% | 50%+ | 60%+ | 70%+ |
| CI/CD Success Rate | 95% | 98% | 99% | 99.5% |
| Zero Critical Bugs | 0 current | 0 | 0 | 0 |
| **Stability Metrics** |
| System Uptime | 99% | 99.5% | 99.9% | 99.9% |
| API Response Time (p95) | < 500ms | < 400ms | < 300ms | < 300ms |
| Error Rate | < 1% | < 0.5% | < 0.5% | < 0.1% |
| **Adoption Metrics** |
| Active Stations | 1 pilot | 2-3 | 5-10 | 20+ |
| Daily Active Users | 10-20 | 30-40 | 75-100 | 200+ |
| Check-ins per Day | 15-30 | 40-60 | 100-150 | 300+ |
| **User Satisfaction** |
| User Satisfaction Score | TBD | 4.0/5 | 4.3/5 | 4.5/5 |
| Support Tickets/Week | < 5 | < 5 | < 8 | < 15 |
| Feature Request Rate | - | Track | Track | > 10/month |

### Adoption Goals

**Short Term (Q1 2026)**:
- 2-3 stations using system
- 40+ registered members
- 300+ check-ins per month
- Complete Phase 1 (Quality & Testing)

**Medium Term (Q2 2026)**:
- 5-10 stations using system
- 100+ registered members
- 1000+ check-ins per month
- Complete Phase 2 (Operational Excellence)
- Complete Phase 3 (Essential Features)

**Long Term (Q4 2026)**:
- 20+ stations using system
- 500+ registered members
- 5000+ check-ins per month
- Complete Phase 4 (Advanced Features)
- Integration discussions with RFS-wide systems

---

## Risk Register

| Risk ID | Risk Description | Probability | Impact | Mitigation Strategy | Owner |
|---------|------------------|-------------|--------|---------------------|--------|
| R1 | Database outage affects all stations | Low | High | Azure SLA 99.99%, automatic backups, multi-region failover (future), disaster recovery plan | DevOps |
| R2 | Scaling issues as user base grows | Medium | Medium | Load testing, horizontal scaling capability, Table Storage auto-scales, performance monitoring | Engineering |
| R3 | Data loss or corruption | Low | High | Daily automated backups, point-in-time restore, validation checks, audit logs | DevOps |
| R4 | Security breach or data leak | Low | High | Regular security audits, penetration testing, input validation, security headers, access controls | Security |
| R5 | Key person dependency | Medium | Medium | Comprehensive documentation, knowledge transfer, code reviews, training materials | Management |
| R6 | Budget overrun (Azure costs) | Low | Medium | Cost monitoring with alerts, regular optimization, Table Storage chosen for cost efficiency | Finance |
| R7 | Low user adoption | Medium | High | Training programs, support materials, user feedback loops, iterative improvement, station champion program | Product |
| R8 | Breaking changes during refactoring | Medium | Medium | High test coverage (70%+), CI/CD quality gates, staged rollouts, feature flags | Engineering |
| R9 | Third-party dependency vulnerabilities | Medium | Medium | Dependabot automated updates, regular dependency audits, security scanning, stay current | Security |
| R10 | Network connectivity issues in rural areas | High | Medium | Offline support (PWA), optimize for low bandwidth, graceful degradation, retry logic | Engineering |

---

## Maintenance & Support

### Regular Maintenance Tasks

**Daily**:
- Monitor application health (automated via Azure)
- Check error logs for critical issues
- Verify automated backups completed

**Weekly**:
- Review system performance metrics
- Review Dependabot PRs and merge approved updates
- Check for security advisories
- Review user feedback and support tickets

**Monthly**:
- Review and prune old data (if needed)
- Capacity planning review
- Cost optimization review
- Security patch review and deployment

**Quarterly**:
- Major dependency updates (beyond Dependabot)
- Performance benchmarking
- Full security audit
- Backup restore test
- Documentation review and updates
- Roadmap review and adjustment

### Support Escalation Levels

**Level 1 - User Support** (24h response):
- How-to questions
- Basic troubleshooting
- Feature requests
- General inquiries

**Level 2 - Technical Support** (4h response during business hours):
- Bug reports
- Performance issues
- Integration problems
- Configuration issues

**Level 3 - Critical Support** (1h response 24/7 for production):
- System outages
- Data loss or corruption
- Security incidents
- Critical bugs affecting all users

### Support Channels

- **GitHub Issues**: Bug reports, feature requests (primary)
- **Email**: Direct support for station captains
- **Documentation**: Self-service knowledge base
- **Emergency**: Phone/SMS for critical production issues (future)

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Initial | Original master plan created |
| 2.0 | Jan 2026 | Comprehensive Review | Complete restructure: Added architecture guidance, consolidated roadmap into 4 phases (Quality → Stability → Features → Advanced), converted all backlog items into detailed issues with objectives, user stories, steps, success criteria, effort estimates, priorities, labels, and milestones. Added UI screenshot requirements. |

---

**End of Master Plan**

Last Updated: January 4, 2026
