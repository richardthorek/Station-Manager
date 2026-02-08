# GitHub Copilot Instructions for RFS Station Manager

## Project Overview

The RFS Station Manager is a modern, real-time digital sign-in system built for NSW Rural Fire Service (RFS) stations. It enables member presence tracking, activity monitoring, and vehicle maintenance checks across multiple devices with instant synchronization.

**Version**: 1.0.0  
**Status**: Production-ready with active development  
**Purpose**: Volunteer organization management for RFS stations

---

## Documentation & Planning Discipline

### Single Source of Truth Principle

This repository follows strict documentation discipline to ensure consistency, maintainability, and effective AI-assisted development:

#### Master Plan (Planning Source of Truth)
- **Location**: `/docs/MASTER_PLAN.md`
- **Purpose**: Single source of truth for ALL planning, roadmap, phases, enhancement tracking, and strategic intent
- **Requirements**:
  - ALL feature planning, enhancement backlog, technical debt, and future roadmap MUST be documented here
  - NO duplicate planning documents allowed
  - All major documentation files MUST reference the master plan
  - All PRs that affect project direction MUST update the master plan
  - Version-controlled and living document (updated continuously)

#### As-Built Documentation (Implementation Source of Truth)
- **Location**: `/docs/AS_BUILT.md` (main) and feature-specific docs in `/docs/`
- **Purpose**: Single, always-updated record of current system state, architecture, and implementation
- **Requirements**:
  - ONE authoritative as-built doc per major feature/component (never duplicated)
  - Must include: API endpoints, database schema, architecture diagrams, configuration, deployment info
  - Always kept up-to-date - NEVER create "as-built v2" or dated copies
  - Include links to images/diagrams stored in repo or cloud storage
  - Update immediately when implementation changes

#### Machine-Readable API and Function Registries
- **Location**: 
  - `/docs/api_register.json` - REST API endpoints and WebSocket events
  - `/docs/function_register.json` - Backend functions, services, and business logic
- **Purpose**: Structured, programmatically-accessible interface definitions
- **Requirements**:
  - **MUST capture**:
    - REST endpoint paths, methods, parameters, request/response schemas
    - WebSocket event names and payloads
    - Function signatures with parameter types and return types
    - Database service methods
    - TypeScript interfaces and type definitions
    - Implementation file locations and line numbers
  - **JSON Schema**: Follow JSON Schema Draft 7 format
  - **Validation**: Must be valid JSON, validated in CI/CD
  - **Cross-references**: Referenced from AS_BUILT.md, MASTER_PLAN.md, and API_DOCUMENTATION.md
  - **Update triggers**: New endpoints, modified signatures, schema changes, new services
  - **Tools**: Use `jsonlint` or `ajv-cli` for validation

### Documentation Organization Policy

The `/docs/` directory structure enforces strict separation between current/live documentation and historical/reference material:

#### **Allowed in Root `/docs/` Directory**
Only current, actively-maintained documentation belongs in the root `/docs/` directory:
- **Master planning**: `MASTER_PLAN.md` - Single source of truth for roadmap and planning
- **Current implementation state**: `AS_BUILT.md`, `API_DOCUMENTATION.md` - Always up-to-date system documentation
- **Machine-readable registries**: `api_register.json`, `function_register.json` + human-readable companions (`FUNCTION_REGISTER.md`, `MACHINE_READABLE_REGISTRIES.md`)
- **Active guides**: 
  - Development: `GETTING_STARTED.md`, `FEATURE_DEVELOPMENT_GUIDE.md`
  - Deployment: `AZURE_DEPLOYMENT.md`, `AZURE_DEPLOYMENT_OPTIMIZATION.md`, `AZURE_APP_INSIGHTS.md`
  - User/Accessibility: `KEYBOARD_SHORTCUTS.md`, `SCREEN_READER_GUIDE.md`, `DEVELOPER_ACCESSIBILITY_CHECKLIST.md`
  - Operations: `LOGGING.md`, `SECURITY_ADVISORY_XLSX.md`, `POST_DEPLOYMENT_TESTING.md`, `ci_pipeline.md`
- **Recent audits/reviews**: Reports from last 3 months (for visibility); older reports move to archive
- **Active feature documentation**: Documentation for current, in-use features (e.g., `ACHIEVEMENTS.md`)

#### **Required Subdirectories**
- **`/docs/archive/`**: Historical documentation that is no longer current
  - Completed feature implementation summaries (e.g., `PWA_IMPLEMENTATION_SUMMARY.md`)
  - Superseded deployment/migration guides (e.g., `TABLE_STORAGE_MIGRATION_PLAN.md`)
  - Outdated analysis documents (e.g., old `STORAGE_ANALYSIS*.md` files)
  - Historical review reports (older than 3 months)
  - Deprecated guides that have been superseded
  - **Must contain**: README.md explaining archive contents and referencing current docs
  
- **`/docs/implementation-notes/`**: Detailed implementation references supporting active development
  - Configuration guides (e.g., `KIOSK_MODE_SETUP.md`, `CSV_SETUP_AZURE.md`)
  - Optimization references (e.g., `COSMOS_DB_OPTIMIZATION_GUIDE.md`)
  - Accessibility standards (e.g., `ACCESSIBILITY.md`, `COLOR_CONTRAST_WCAG_AA.md`)
  - Security guides (e.g., `AUDIT_LOGGING_SECURITY_PRIVACY.md`)
  - Feature implementation details (e.g., `EVENT_MANAGEMENT.md`)
  
- **`/docs/current_state/`**: Point-in-time snapshots and validation reports
  - Audit snapshots with specific dates (e.g., `audit-20260207.md`)
  - Validation reports (e.g., `VALIDATION_REPORT.md`)
  - UI reviews with specific dates (e.g., `UI_REVIEW_20260207.md`)
  - Test result documentation (e.g., `REPRODUCTION_TESTS.md`)

#### **Document Lifecycle Rules**

**When creating new documentation:**
1. Feature implementation notes → Start in `/docs/implementation-notes/` or root if actively referenced
2. Guides for new features → Root `/docs/` while feature is active
3. Audit/review reports → `/docs/current_state/` if dated, root if current analysis

**When a feature is completed:**
1. Move implementation summary from root → `/docs/archive/`
2. Keep feature usage guide in root if feature remains active
3. Update archive README.md with entry pointing to new location

**When documentation is superseded:**
1. Move old version → `/docs/archive/` with note about what replaced it
2. Create/update new version in root
3. Update cross-references in other docs

**Quarterly maintenance (every 3 months):**
1. Review reports older than 3 months → Move to archive
2. Check for duplicate documentation → Consolidate and remove duplicates
3. Verify implementation notes still relevant → Archive if obsolete

#### **Prohibited in Root `/docs/`**
- ❌ Implementation summaries of completed features (suffix `_IMPLEMENTATION_SUMMARY.md` or `_SUMMARY.md`)
- ❌ Historical review/audit reports (older than 3 months)
- ❌ Superseded technical analysis documents
- ❌ Completed migration plans
- ❌ Duplicate files (different names, same content)
- ❌ Point-in-time snapshots with dates in filename (use `/docs/current_state/`)
- ❌ "Historical", "Old", "Backup", "v2" versions of documents

### Pull Request Requirements

Every PR (including AI-generated PRs) MUST:

1. **Update `/docs/MASTER_PLAN.md`** if the PR:
   - Adds/removes features
   - Changes project roadmap or priorities
   - Addresses technical debt
   - Affects future planning

2. **Update `/docs/AS_BUILT.md`** and related as-built docs if the PR:
   - Modifies architecture or system design
   - Changes API endpoints or database schema
   - Updates deployment configuration
   - Adds/removes major components

3. **Update `/docs/api_register.json`** if the PR:
   - Adds, modifies, or removes REST API endpoints
   - Changes request/response schemas
   - Adds or modifies WebSocket events
   - Updates endpoint authentication or parameters

4. **Update `/docs/function_register.json`** if the PR:
   - Adds new backend service methods or functions
   - Modifies function signatures or parameters
   - Changes business logic organization
   - Adds new database methods

5. **Update `.github/copilot-instructions.md`** if the PR:
   - Introduces new repository conventions
   - Changes development workflows or standards
   - Modifies project structure rules
   - Updates deployment or CI/CD processes

6. **Add tests for all new code** (RECOMMENDED):
   - Backend: Add tests in `backend/src/__tests__/` for new routes, services, utilities
   - Frontend: Add tests next to components (`.test.tsx` files) for new components, hooks, pages
   - Run `npm test` to verify tests pass
   - Include test additions in the same PR as code changes when feasible
   - Coverage thresholds are not enforced during the app stabilization phase

7. **Validate machine-readable files**:
   - Run `jsonlint` on all modified JSON registry files
   - Ensure cross-references between docs are maintained
   - Verify file locations match actual implementation

### Recursive Enforcement

**Copilot and AI tools MUST:**
- Propose updates to `.github/copilot-instructions.md` when repository procedures evolve
- Suggest corrections when documentation drifts from implementation
- Flag when multiple planning documents are created (violation of single source of truth)
- Recommend consolidation when duplicate as-built docs are detected
- Validate that PRs include required documentation updates
- **Enforce documentation organization policy**: Flag when non-current docs are added to root `/docs/` or when completed feature summaries remain in root
- **Suggest archival**: When a feature implementation summary is completed, suggest moving it to `/docs/archive/`
- **Prevent clutter**: Recommend moving historical reports, superseded guides, and old analysis to appropriate subdirectories

**Examples of Required Updates:**
```yaml
# Scenario: Adding a new API endpoint
Required updates:
  - backend/src/routes/new-feature.ts (implementation)
  - docs/api_register.json (add endpoint definition)
  - docs/AS_BUILT.md (update API endpoint count/summary)
  - docs/MASTER_PLAN.md (if implementing planned feature, mark complete)

# Scenario: Changing development workflow
Required updates:
  - .github/workflows/*.yml (implementation)
  - .github/copilot-instructions.md (document new workflow)
  - docs/MASTER_PLAN.md (update CI/CD section if strategic)

# Scenario: Major refactoring
Required updates:
  - Source files (implementation)
  - docs/function_register.json (updated signatures/locations)
  - docs/AS_BUILT.md (architecture changes)
  - .github/copilot-instructions.md (if patterns change)
```

### Documentation Cross-Reference Map

```
┌─────────────────────────────────────────────────────────────┐
│ .github/copilot-instructions.md (This File)                 │
│ - Repository conventions and AI guidance                     │
│ - References: MASTER_PLAN.md, AS_BUILT.md, api_register.json│
└─────────────────────────────────────────────────────────────┘
           │
           ├──────────────────┬────────────────────────┐
           ▼                  ▼                        ▼
┌────────────────────┐ ┌──────────────────┐ ┌─────────────────────┐
│ MASTER_PLAN.md     │ │ AS_BUILT.md      │ │ api_register.json   │
│ (Planning Truth)   │ │ (Implementation) │ │ function_register.json│
│                    │ │                  │ │ (Machine-Readable)  │
│ - Roadmap          │ │ - Architecture   │ │                     │
│ - Enhancements     │ │ - API Endpoints  │ │ - Endpoint schemas  │
│ - Technical Debt   │ │ - Database       │ │ - Function sigs     │
│ - Future Features  │ │ - Deployment     │ │ - Type definitions  │
└────────────────────┘ └──────────────────┘ └─────────────────────┘
           │                  │                        │
           └──────────────────┴────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Feature Docs:    │
                    │ - API_DOCS.md    │
                    │ - GETTING_STARTED│
                    │ - DEPLOYMENT.md  │
                    └──────────────────┘
```

### Machine-Readable Format Examples

**API Register Example:**
```json
{
  "endpoints": {
    "members": {
      "GET /api/members": {
        "method": "GET",
        "path": "/api/members",
        "description": "Get all members",
        "authentication": "none",
        "responses": {
          "200": { "schema": { "type": "array", "items": { "$ref": "#/definitions/Member" } } }
        },
        "implementation": "backend/src/routes/members.ts:18"
      }
    }
  }
}
```

**Function Register Example:**
```json
{
  "services": {
    "database": {
      "methods": {
        "createMember": {
          "signature": "createMember(name: string): Member",
          "parameters": [{ "name": "name", "type": "string" }],
          "returns": "Member",
          "line": 219,
          "sideEffects": "Adds member to database"
        }
      }
    }
  }
}
```

---

## Technology Stack

### Frontend
- **React 19** with TypeScript (strict mode)
- **Vite 7** as build tool and dev server
- **React Router DOM 7** for client-side routing
- **Socket.io Client 4** for real-time WebSocket communication
- **Framer Motion 12** for animations and transitions
- **QRCode.react** for QR code generation
- **ESLint 9** with TypeScript ESLint for code quality

### Backend
- **Node.js 22** with TypeScript
- **Express 5** for REST API
- **Socket.io 4** for real-time bidirectional communication
- **@azure/data-tables** for Azure Table Storage integration
- **Multer** for file uploads (appliance photos, check photos)
- **Azure Storage Blob** for cloud storage
- **CORS** enabled for frontend communication
- **Rate limiting** on SPA fallback routes

### Database
- **Production**: Azure Table Storage (cost-effective, scalable NoSQL storage)
- **Development**: In-memory database (when NODE_ENV=development)
- **Tables**: Members, Activities, Events, EventParticipants, CheckIns, ActiveActivity, Appliances, ChecklistTemplates, CheckRuns, CheckResults

### Deployment
- **Frontend**: Azure Static Web Apps or served from backend `/dist`
- **Backend**: Azure App Service (Node.js)
- **Storage**: Azure Blob Storage for images
- **Protocol**: HTTPS in production, WSS for WebSockets

## Architecture

### Feature-Based Structure

The application uses a **feature-based routing architecture** for scalability:

```
frontend/src/
├── features/              # Self-contained feature modules
│   ├── landing/          # Landing page (/)
│   ├── signin/           # Sign-in system (/signin)
│   ├── profile/          # User profiles (/profile/:memberId)
│   └── truckcheck/       # Vehicle checks (/truckcheck)
├── components/           # Shared reusable UI components
├── hooks/                # Custom React hooks (useSocket, etc.)
├── services/             # API services and external integrations
├── types/                # TypeScript type definitions
└── App.tsx              # Main router configuration

backend/src/
├── routes/               # Express route handlers
├── services/             # Business logic and database operations
│   ├── database.ts       # In-memory database service
│   ├── tableStorageDatabase.ts  # Table Storage database service (production)
│   ├── dbFactory.ts      # Database factory (Table Storage or in-memory)
│   ├── truckChecksDatabase.ts  # In-memory truck checks database service
│   ├── tableStorageTruckChecksDatabase.ts  # Table Storage truck checks service (production)
│   └── truckChecksDbFactory.ts # Truck checks DB factory
└── types/                # TypeScript type definitions
```

### Real-Time Communication

- **HTTP REST API** for CRUD operations
- **WebSocket (Socket.io)** for instant synchronization across devices
- Events: `checkin`, `activity-change`, `member-added`, `event-created`, `event-ended`, `participant-change`
- Backend broadcasts updates to all connected clients
- Frontend listens for updates and refreshes UI state automatically

### Data Flow

1. User interacts with React frontend
2. Frontend calls REST API via `services/api.ts`
3. Backend processes request, updates database
4. Backend emits Socket.io event
5. All connected clients receive update
6. Clients update their local state and re-render

## NSW RFS Branding & UI/UX Standards

### Brand Colors (Official NSW RFS Style Guide Sept 2024)

**Primary Colors:**
```css
--rfs-core-red: #e5281B       /* Primary brand color */
--rfs-lime: #cbdb2a           /* Accent color */
--rfs-black: #000000          /* Text and backgrounds */
--rfs-white: #ffffff          /* Text on dark backgrounds */
--rfs-dark-grey: #4d4d4f      /* Secondary text */
--rfs-light-grey: #bcbec0     /* Borders and subtle elements */
```

**Thematic UI Colors:**
```css
--ui-amber: #fbb034           /* Bush Fire Ready / Watch & Act */
--ui-blue: #215e9e            /* Advice / Hyperlinks */
--ui-green: #008550           /* Success / DGR */
```

### Typography

- **Font Family**: 'Public Sans' (Google Fonts), fallback to system fonts
- **Weights**: Regular (400), Medium (500), Bold (700)
- **Line Height**: 1.5 for body text
- **Hierarchy**: Clear heading levels (h1: 2.5rem, h2: 2rem, h3: 1.5rem)

### UI Principles

1. **Large Touch Targets**: Minimum 60px for buttons and interactive elements (kiosk-friendly)
2. **High Contrast**: Ensure visibility in various lighting conditions (station environments)
3. **Responsive Design**: Mobile-first approach, works on all screen sizes
4. **Accessibility**: 
   - Semantic HTML elements
   - Proper ARIA labels
   - Keyboard navigation support
   - Screen reader compatibility
5. **Consistent Spacing**: Use rem units for spacing (0.5rem, 1rem, 1.5rem, 2rem)
6. **Subtle Animations**: Framer Motion for feedback (200-300ms transitions)
7. **Visual Feedback**: Loading states, success/error messages, hover effects
8. **UI Screenshot Requirement**: **ALL UI changes MUST include screenshots on tablet (iPad) size in BOTH portrait AND landscape mode**
   - Take screenshots using browser developer tools or actual iPad
   - Typical iPad dimensions: 768px × 1024px (portrait), 1024px × 768px (landscape)
   - Include screenshots in PR description or issue updates
   - Show before/after for UI modifications
   - Capture complete feature workflows for new features
   - This requirement applies to all issues marked with UI changes in the master plan

### Design Patterns

**Header Pattern:**
```tsx
<header className="feature-header">
  <Link to="/" className="back-link">← Back to Home</Link>
  <h1>Feature Title</h1>
</header>
```

**Button Pattern:**
```tsx
<button className="primary-button">Action</button>
<button className="secondary-button">Secondary Action</button>
```

**Card Pattern:**
```tsx
<div className="card">
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

## Development Practices

### Code Style & Conventions

**TypeScript:**
- Strict mode enabled
- Always define interfaces for data structures
- Use explicit return types for functions
- Prefer `interface` over `type` for object shapes
- Use proper type imports: `import type { Type } from './types'`

**React:**
- Functional components with hooks (no class components)
- Use `useState`, `useEffect`, `useCallback`, `useMemo` appropriately
- Custom hooks for reusable logic (prefix with `use`)
- Props destructuring in component parameters
- Export components as named exports

**File Naming:**
- Components: `PascalCase.tsx` (e.g., `SignInPage.tsx`, `ActivitySelector.tsx`)
- Styles: Match component name (e.g., `SignInPage.css`)
- Utilities: `camelCase.ts`
- Types: `index.ts` or `descriptive.ts`

**CSS:**
- Component-scoped CSS files
- BEM-like naming: `.component-name`, `.component-name__element`, `.component-name--modifier`
- Use CSS variables from `:root` (defined in `index.css`)
- Mobile-first media queries
- Avoid inline styles (use classes)

### Project Structure Rules

**Adding New Features:**
1. Create directory in `frontend/src/features/feature-name/`
2. Create `FeaturePage.tsx` and `FeaturePage.css`
3. Register route in `App.tsx` with lazy loading:
   ```typescript
   const FeaturePage = lazy(() => import('./features/feature-name/FeaturePage').then(m => ({ default: m.FeaturePage })));
   ```
4. Add feature card to `LandingPage.tsx`
5. Add backend routes if needed in `backend/src/routes/`

**Code Splitting and Lazy Loading:**
- All route components MUST use lazy loading with `React.lazy()`
- Wrap routes in `<Suspense fallback={<LoadingFallback />}>`
- Use `LoadingFallback` component for consistent loading UX
- This maintains optimal bundle size and initial load performance
- Bundle analyzer report available in `dist/stats.html` after build

**Shared Components:**
- Place in `frontend/src/components/` if reusable across features
- Keep feature-specific components in feature directory
- Document props with TypeScript interfaces

**API Integration:**
- All API calls go through `frontend/src/services/api.ts`
- Use async/await with try/catch
- Handle errors gracefully with user-friendly messages
- Show loading states during async operations

**Socket.io Usage:**
- Use `useSocket` hook from `frontend/src/hooks/useSocket.ts`
- Clean up event listeners in useEffect cleanup
- Emit events after successful API calls
- Handle disconnection gracefully

### Environment Configuration

**Development:**
- Backend runs on port 3000 (configurable via PORT env var)
- Frontend runs on port 5173 (Vite default)
- Use `npm run dev` for development mode (in-memory database)
- Use `npm run dev:prod` to test with production database

**Environment Variables:**

Backend `.env`:
```
MONGODB_URI=<azure-cosmos-db-connection-string>
FRONTEND_URL=http://localhost:5173
AZURE_STORAGE_CONNECTION_STRING=<optional-for-file-uploads>
```

Frontend `.env`:
```
VITE_API_URL=http://localhost:3000
```

### Testing & Quality

**Automated Testing:**

**Frontend Tests (Vitest + React Testing Library):**
```bash
cd frontend
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
npm run test:ui       # Run tests with UI  
npm run test:coverage # Generate coverage report
```
- 80+ tests covering components, hooks, and pages
- 93%+ code coverage
- Test files located next to source files (*.test.tsx, *.test.ts)
- Mock utilities in `src/test/mocks/` (socket.ts, api.ts)
- Test utilities in `src/test/utils/test-utils.tsx` (custom render with providers)
- Test setup in `src/test/setup.ts` (jsdom, jest-dom matchers)

**Backend Tests (Jest + Supertest):**
```bash
cd backend
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```
- 45+ integration tests covering all API endpoints
- Tests in `src/__tests__/` directory
- In-memory database for fast, isolated tests

**Test Conventions:**
- Use `describe` blocks to group related tests
- Use `it` or `test` for individual test cases
- Use `beforeEach` to reset state between tests
- Always clean up after tests (useEffect cleanup, event listener removal)
- Mock external dependencies (Socket.io, API calls)
- Test user interactions with `@testing-library/user-event`
- Test accessibility (semantic HTML, ARIA labels, keyboard navigation)

**Testing Guidelines:**

**Tests are encouraged but coverage thresholds are not enforced:**

- **Testing Status**:
  - Coverage thresholds temporarily disabled to allow the app to stabilize
  - Will be re-enabled once the app reaches maturity
  - Tests are still valuable for catching bugs and documenting behavior

- **When adding new code:**
  1. Write tests for new functions, routes, and services when feasible
  2. Run `npm test` to verify tests pass
  3. Include test additions in the same PR as code changes when practical
  4. Focus on critical paths and bug-prone areas

- **Test Best Practices:**
  - **New routes**: Add integration tests in `backend/src/__tests__/`
  - **New services**: Add unit tests covering main code paths
  - **New components**: Add React component tests with user interactions
  - **New utilities**: Add unit tests with edge cases
  - **Bug fixes**: Add regression tests to prevent future recurrence
  - **Refactoring**: Maintain or improve existing test coverage

- **Coverage Exclusions:**
  - Services requiring external data files (e.g., `rfsFacilitiesParser.ts` needs 2.2MB CSV)
  - Services requiring Azure credentials (e.g., `tableStorageDatabase.ts`, `azureStorage.ts`)
  - Use `describe.skip` for tests requiring external resources not available in CI
  - Document why tests are skipped in test file comments

- **Why Testing Matters:**
  - Untested code leads to bugs in production
  - Tests serve as documentation for future developers
  - Good coverage enables confident refactoring
  - Catches regressions early

- **Example - Adding a New API Endpoint:**
  ```typescript
  // Step 1: Implement the endpoint in backend/src/routes/
  // Step 2: Add tests in backend/src/__tests__/
  describe('POST /api/new-feature', () => {
    it('should create new resource', async () => {
      const response = await request(app)
        .post('/api/new-feature')
        .send({ data: 'value' });
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
    
    it('should validate input', async () => {
      const response = await request(app)
        .post('/api/new-feature')
        .send({});
      expect(response.status).toBe(400);
    });
  });
  ```

- **Example - Adding a New Component:**
  ```typescript
  // Step 1: Create component in frontend/src/components/
  // Step 2: Add test file NewComponent.test.tsx
  describe('NewComponent', () => {
    it('renders correctly', () => {
      render(<NewComponent title="Test" />);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
    
    it('handles user interaction', async () => {
      const onAction = vi.fn();
      render(<NewComponent onAction={onAction} />);
      await userEvent.click(screen.getByRole('button'));
      expect(onAction).toHaveBeenCalled();
    });
  });
  ```

**Manual Testing:**
1. Test on multiple devices simultaneously to verify real-time sync
2. Test on different screen sizes (mobile, tablet, desktop, kiosk)
3. Test with slow network conditions
4. Test keyboard navigation and accessibility

**Build Process:**
```bash
# Backend
cd backend
npm run build     # Compiles TypeScript to dist/

# Frontend
cd frontend
npm run build     # Vite production build to dist/
npm run preview   # Preview production build
```

**Linting:**
```bash
cd frontend
npm run lint      # ESLint with TypeScript
```

### Error Handling

**Frontend Pattern:**
```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  try {
    setLoading(true);
    setError(null);
    await api.someAction();
    // Success handling
  } catch (err) {
    setError('User-friendly error message');
    console.error('Detailed error:', err);
  } finally {
    setLoading(false);
  }
};
```

**Backend Pattern:**
```typescript
router.post('/', async (req, res) => {
  try {
    const result = await db.someAction(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in route:', error);
    res.status(500).json({ error: 'User-friendly error message' });
  }
});
```

## Key Features & Business Logic

### 1. Sign-In System (`/signin`)
- Member check-in/check-out tracking
- Activity selection (Training, Maintenance, Meeting, Custom)
- Real-time updates across devices
- QR code support for quick check-in
- Self-registration for new members

### 2. Event System
- Discrete event instances (vs continuous activities)
- Start/end time tracking
- Participant management
- Historical event logs
- Support for concurrent events

### 3. User Profiles (`/profile/:memberId`)
- Member information display
- Personal achievement tracking
- Check-in history
- Event participation history
- Rank and member number display

### 4. Truck Checks (`/truckcheck`)
- Vehicle/appliance management
- Customizable checklist templates
- Photo capture for issues
- Multi-contributor check runs
- Status tracking (done/issue/skipped)
- Historical check reports

### 5. Achievement System
- Milestone tracking (sign-ins, hours, events)
- Visual badges and celebrations
- Cross-feature achievements (sign-ins + truck checks)
- Animated unlock notifications

## Security Considerations

**Current Implementation:**
- CORS configured for frontend URL
- Rate limiting on SPA fallback routes (100 req/15min)
- Input validation on all endpoints (basic)
- HTTPS required in production
- WSS (WebSocket Secure) in production

**Future Enhancements:**
- Optional authentication for admin functions
- Role-based access control
- Audit logging
- Enhanced input sanitization

## Performance Guidelines

**Target Metrics:**
- Page load: < 2 seconds on 3G
- Real-time sync: < 2 seconds
- Check-in response: < 500ms
- Support: 50+ concurrent users
- Bundle size: Keep optimized with code splitting

**Optimization Strategies:**
- Lazy load heavy components
- Optimize images (compress, use appropriate formats)
- Minimize re-renders with React.memo, useMemo, useCallback
- Use WebSocket for real-time data (not polling)
- Efficient database queries with Table Storage partitioning

## Common Tasks & Patterns

### Adding a New Component

```typescript
// Component file: frontend/src/components/NewComponent.tsx
import { useState } from 'react';
import './NewComponent.css';

interface NewComponentProps {
  title: string;
  onAction: () => void;
}

export function NewComponent({ title, onAction }: NewComponentProps) {
  return (
    <div className="new-component">
      <h3>{title}</h3>
      <button onClick={onAction} className="primary-button">
        Action
      </button>
    </div>
  );
}
```

### Adding a New API Endpoint

```typescript
// Backend: backend/src/routes/feature.ts
import { Router } from 'express';
import { ensureDatabase } from '../services/dbFactory';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const data = db.getData();
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

export default router;

// Register in backend/src/index.ts:
// import featureRouter from './routes/feature';
// app.use('/api/feature', featureRouter);
```

### Using Socket.io

```typescript
// Frontend component
import { useSocket } from '../../hooks/useSocket';

function MyComponent() {
  const { isConnected, emit, on, off } = useSocket();

  useEffect(() => {
    const handleUpdate = (data: any) => {
      console.log('Received update:', data);
      // Update local state
    };

    on('my-event', handleUpdate);
    return () => off('my-event', handleUpdate);
  }, [on, off]);

  const sendUpdate = () => {
    emit('my-event', { data: 'value' });
  };

  return <div>{isConnected ? 'Connected' : 'Disconnected'}</div>;
}
```

## Documentation References

- **Getting Started**: `docs/GETTING_STARTED.md`
- **Azure Deployment**: `docs/AZURE_DEPLOYMENT.md`
- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **Feature Development**: `docs/FEATURE_DEVELOPMENT_GUIDE.md`
- **Truck Checks**: `docs/TRUCK_CHECKS_IMPLEMENTATION.md`
- **Achievements**: `docs/ACHIEVEMENTS.md`
- **Main README**: `README.md`

## Important Notes for Copilot

1. **NSW RFS Branding is Critical**: Always use official colors and maintain brand consistency
2. **Real-Time is Core**: Changes must sync across devices via Socket.io
3. **Kiosk-Friendly**: Large touch targets (60px+) for station kiosk use
4. **TypeScript Strict**: No `any` types, proper interfaces required
5. **Feature Independence**: Keep features self-contained and modular
6. **Mobile-First**: Responsive design is non-negotiable
7. **Volunteer Context**: Simple, intuitive UX for non-technical volunteers
8. **Production-Ready**: Code must work in Azure production environment
9. **Database Strategy**: Azure Table Storage for production, in-memory for development
10. **Error Recovery**: Handle network failures gracefully (rural areas)

## Workflow Commands

```bash
# Development
npm run install       # Install all dependencies (root)
cd backend && npm run dev       # Start backend (in-memory DB)
cd backend && npm run dev:prod  # Start backend (production DB)
cd frontend && npm run dev      # Start frontend dev server

# Building
npm run build        # Build both frontend and backend (root)
cd backend && npm run build    # Build backend only
cd frontend && npm run build   # Build frontend only

# Linting
cd frontend && npm run lint    # Run ESLint

# Production
npm start            # Start production server (root)
```

## Azure Table Storage Implementation

**Status**: ✅ COMPLETE (January 2026)  
**Achievement**: Migrated from Azure Cosmos DB to Azure Table Storage for 70-95% cost savings

### Key Points for AI Assistants

1. **Production Database**: Azure Table Storage (using @azure/data-tables SDK)
2. **Development Database**: In-memory database for fast local development
3. **Environment Variable**: `USE_TABLE_STORAGE=true` enables Table Storage (default in development mode when connection string is available)
4. **Connection String**: `AZURE_STORAGE_CONNECTION_STRING` (same account as blob storage)
5. **Documentation**: See `docs/TABLE_STORAGE_MIGRATION_PLAN.md` for migration history

### Database Selection Priority

```typescript
// Priority order in dbFactory:
// 1. Table Storage (if USE_TABLE_STORAGE=true and AZURE_STORAGE_CONNECTION_STRING set)
// 2. Table Storage (if NODE_ENV=development and AZURE_STORAGE_CONNECTION_STRING set - uses dev table prefix)
// 3. In-memory database (fallback for development without Azure connection)
```

### Important Implementation Notes

- **Partition Strategy**: Entities grouped by type (e.g., `PartitionKey='Member'`)
- **Event Partitioning**: Events partitioned by month (`Event_YYYY-MM`) for efficient queries
- **Co-location**: Event participants co-located with events (same partition key)
- **Real-time Sync**: Socket.io events unchanged; works seamlessly with Table Storage
- **Default Activities**: Auto-initialized on first connection (Training, Maintenance, Meeting)

### Testing with Table Storage

```bash
# Local development with Table Storage
cd backend
echo "USE_TABLE_STORAGE=true" >> .env
echo "AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>" >> .env
npm run dev

# Test with in-memory database
cd backend
echo "USE_TABLE_STORAGE=false" >> .env  # or remove the variable
npm run dev
```

### Cost Benefits

| Database | Monthly Cost (per station) | Annual Cost |
|----------|---------------------------|-------------|
| Azure Table Storage | $0.01-0.20 | $0.12-2.40 |
| Previous (Cosmos DB) | $0.50-3 | $6-36 |
| **Savings** | **70-95%** | **$6-34/year** |

---

## Version Information

- Node.js: 22.x
- npm: >=10.0.0
- React: 19.2.0
- TypeScript: ~5.9.3
- Vite: ^7.2.2
- Express: ^5.1.0
- Socket.io: ^4.8.1
- @azure/data-tables: ^13.x (for Table Storage)

---

**Built with ❤️ for the RFS volunteer community**
