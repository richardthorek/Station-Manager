# CI/CD Pipeline Documentation

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Active  
**Related Documentation:** [MASTER_PLAN.md](MASTER_PLAN.md), [AS_BUILT.md](AS_BUILT.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Pipeline Stages](#pipeline-stages)
4. [Quality Gates](#quality-gates)
5. [Workflow Files](#workflow-files)
6. [Running Checks Locally](#running-checks-locally)
7. [Troubleshooting](#troubleshooting)
8. [Performance Optimization](#performance-optimization)
9. [Maintenance](#maintenance)

---

## Overview

The RFS Station Manager CI/CD pipeline is a comprehensive automated testing and deployment system that ensures code quality and reliability before deployment to production. The pipeline enforces strict quality gates and provides detailed feedback on failures.

### Key Features

✅ **Single-Runner Fail-Fast**: One runner installs dependencies once; steps run sequentially and stop on first failure  
✅ **Quality Gates**: Deployment blocked unless all checks pass  
✅ **Comprehensive Testing**: 45+ backend tests with 70% coverage threshold  
✅ **Automated Issue Creation**: Failures automatically create GitHub issues with detailed logs  
✅ **Caching**: npm dependencies cached for faster execution  
✅ **In-Memory Testing**: Tests use in-memory database (no Azure dependencies)  
✅ **Documentation**: Extensive inline documentation in workflow files

### Success Metrics

- **Zero False Positives**: All checks must pass for deployment
- **Fast Feedback**: Shared environment avoids repeated setup and exits early on failure
- **Cost Efficient**: Single runner + caching reduces GitHub Actions minutes
- **Developer Friendly**: Clear error messages and automated issue creation

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Push to main/PR                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
            ┌─────────────────────────────┐
            │ Checkout + backend deps     │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ Backend typecheck + tests   │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ Install frontend deps       │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ Frontend lint + typecheck   │
            │ Frontend tests + coverage   │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ Build + Package Artifacts   │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ Deploy + Post-Deploy Tests  │ (main only)
            └─────────────────────────────┘
```

---

## Pipeline Stages

### Phase 1: Quality Checks (Sequential)

These steps run in a single pipeline job to reuse installs and fail fast: backend deps → backend checks/tests → frontend deps → frontend checks/tests.

#### 1.1 Frontend Linting (pipeline step)

- **Purpose**: Enforce code quality and style consistency
- **Tool**: ESLint with TypeScript parser and React hooks plugin
- **Configuration**: `frontend/eslint.config.js`
- **Command**: `cd frontend && npm run lint`
- **Success Criteria**: Zero errors, zero warnings

**What it checks:**
- TypeScript type usage (no `any` types)
- React hooks rules (dependencies, exhaustive deps)
- Code style and formatting
- Common JavaScript/TypeScript mistakes

#### 1.2 Backend Type Checking (pipeline step)

- **Purpose**: Validate TypeScript types in backend code
- **Tool**: TypeScript Compiler (tsc)
- **Configuration**: `backend/tsconfig.json`
- **Command**: `cd backend && npx tsc --noEmit`
- **Success Criteria**: No type errors

**What it checks:**
- Type correctness
- Missing type definitions
- Type incompatibilities
- Strict mode compliance

#### 1.3 Frontend Type Checking (pipeline step)

- **Purpose**: Validate TypeScript types in frontend code
- **Tool**: TypeScript Compiler (tsc)
- **Configuration**: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`
- **Command**: `cd frontend && npx tsc -b --noEmit`
- **Success Criteria**: No type errors

**What it checks:**
- Type correctness in React components
- Props interface validation
- Type safety in hooks and utilities
- Strict mode compliance

#### 1.4 Backend Testing (pipeline step)

- **Purpose**: Run comprehensive backend test suite
- **Tool**: Jest with ts-jest preset
- **Configuration**: `backend/jest.config.js`
- **Command**: `cd backend && npm run test:coverage`
- **Success Criteria**: 
  - All 45+ tests pass
  - Coverage ≥ 70% (branches, functions, lines, statements)

**What it tests:**
- Members API endpoints (GET, POST, PUT)
- Activities API endpoints
- Check-ins API endpoints (create, toggle, list)
- Database operations
- Business logic validation

**Test Database:**
- Uses in-memory database (no Azure dependencies)
- Test data auto-initialized via `setupFilesAfterEnv`
- Tests isolated from development and production data

#### 1.5 Frontend Testing (pipeline step)

- **Purpose**: Validate core React components, hooks, and pages
- **Tool**: Vitest with React Testing Library
- **Configuration**: `frontend/vitest.config.ts`
- **Command**: `cd frontend && npm run test:coverage`
- **Success Criteria**: All tests pass and coverage summary generated

**What it tests:**
- Component rendering and accessibility states
- Hooks and socket interactions (mocked)
- Reports and station context flows
- Offline storage queue behaviors

### Phase 2: Build

Runs only if **all** Phase 1 jobs pass.

#### 2.1 Build Application (`build`)

- **Purpose**: Create production-ready build artifacts
- **Commands**:
  - `npm run build` - Build backend (tsc) and frontend (vite) using the already installed dependencies
  - Create deployment ZIP artifact (excludes node_modules)

**Build Output:**
- `backend/dist/` - Compiled JavaScript from TypeScript
- `frontend/dist/` - Optimized production bundle (HTML, CSS, JS)
- `release.zip` - Deployment package (WITHOUT node_modules, Azure installs post-deploy)

**Artifact Retention:** 7 days

**Key Optimization**: Dependencies are NOT included in deployment artifact. Azure App Service installs them post-deploy using Oryx build system.

### Phase 3: Deployment

Runs only if **build** succeeds and **branch is main** (not PRs).

#### 3.1 Deploy to Azure (`deploy`)

- **Purpose**: Deploy application to Azure App Service
- **Target**: `bungrfsstation` (Production slot)
- **Authentication**: Azure federated credentials (OIDC)
- **Deployment Method**: Azure Web Apps Deploy action
- **Azure Build**: Enabled (`SCM_DO_BUILD_DURING_DEPLOYMENT=true`)

**Deployment Steps:**
1. Download build artifact
2. Unzip deployment package
3. Login to Azure using OIDC
4. Deploy to App Service (with automatic retry on 409 Conflict errors)
5. **Azure runs `npm ci --production`** (Oryx build system)
6. Set Azure App Service environment variables (version info)
7. Restart app to apply environment variables
8. Display deployment summary

**Deployment Reliability:**
- **Automatic Retry Logic**: Handles transient 409 Conflict errors
- **Wait Period**: 60 seconds between retry attempts
- **Conflict Resolution**: Azure deployments can conflict when Oryx build system is processing
- **Success Rate**: Significantly improved with retry mechanism

**Environment Variables Set:**
- `GIT_COMMIT_SHA`: Full commit SHA (for version verification)
- `GIT_COMMIT_SHORT`: Short commit SHA (7 characters, for display)
- `BUILD_TIMESTAMP`: Build timestamp (ISO 8601 format)

These variables ensure the backend `/health` endpoint returns the correct version information for post-deployment verification.

**Deployment Gates:**
- Only on `main` branch
- Not triggered by pull requests
- Requires all previous jobs to succeed

#### 3.2 Post-Deployment Tests (`post-deployment-tests`)

- **Purpose**: Validate deployed application is functioning correctly
- **Target**: Live Azure App Service deployment
- **Test Environment**: Uses `TABLE_STORAGE_TABLE_SUFFIX=Test` for isolated test data
- **Tool**: TypeScript smoke tests (`backend/src/scripts/postDeploymentTests.ts`)

**Test Coverage:**
1. **Stabilization Phase** (Phase 1): Confirms site is up and correct version deployed
2. **Health Check**: Validates `/health` endpoint responds correctly
3. **API Status**: Verifies `/api/status` endpoint is functional
4. **Activities API**: Tests `/api/activities` endpoint
5. **Members API**: Tests `/api/members` endpoint
6. **Check-ins API**: Tests `/api/checkins` endpoint
7. **Frontend SPA**: Validates frontend loads correctly
8. **Rate Limiting**: Ensures rate limiting is configured

**Two-Phase Strategy:**

**Phase 1: Stabilization (up to 15 minutes)**
- Polls health endpoint every 10 seconds
- Validates site responds with 200 status
- Verifies deployed version matches expected commit SHA
- Exits immediately when both conditions met (efficient!)
- Maximum: 90 attempts × 10s = 900s (15 minutes)
- Typical: 1-2 minutes (exits early when ready)

**Phase 2: Functional Tests (minimal retries)**
- Runs only after stabilization confirms site is ready
- Each test gets 2 quick retries (5s between) for transient issues
- Tests fail fast since site is known to be up and correct version
- Expected completion: 30-60 seconds for all 7 tests
- Maximum: 120 seconds timeout

**Success Criteria:**
- Phase 1: Site must respond with 200 status AND correct commit SHA
- Phase 2: All 7 functional tests must pass
- Total maximum time: 17 minutes (15 min stabilization + 2 min tests)
- Typical time: 3 minutes (2 min stabilization + 1 min tests)

**Efficiency Benefits:**
- Single stabilization phase (no duplicate health checks)
- Early exit when site is ready (no wasted time)
- Minimal retries in functional tests (fast execution)
- Clear separation of concerns (stability vs functionality)

---

## Quality Gates

### Deployment Blockers

The following conditions will **prevent deployment**:

❌ **Any linting error or warning**
- Frontend ESLint must pass with zero issues

❌ **Any TypeScript type error**
- Backend and frontend type checks must pass

❌ **Any test failure**
- All 45+ backend tests must pass
- Coverage must meet 70% threshold

❌ **Build failure**
- Backend TypeScript compilation must succeed
- Frontend Vite build must succeed

❌ **Pull Request Context**
- Deployment only occurs on `main` branch merges

### Quality Assurance Levels

| Level | Gate | Tool | Enforced |
|-------|------|------|----------|
| **Style** | Linting | ESLint | ✅ Yes |
| **Types** | Type Checking | TypeScript | ✅ Yes |
| **Functionality** | Unit Tests | Jest | ✅ Yes |
| **Coverage** | 70% Threshold | Jest Coverage | ✅ Yes |
| **Build** | Compilation | tsc, Vite | ✅ Yes |
| **Deployment** | Branch Protection | GitHub | ✅ Yes |

---

## Workflow Files

### Primary Workflows

#### 1. `ci-cd.yml` (Main Pipeline)

**Location:** `.github/workflows/ci-cd.yml`

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch
- Manual workflow dispatch

**Jobs:**
- `pipeline` - Single-runner job that checks out code, installs dependencies once, runs linting, type checks, backend and frontend tests with coverage, builds artifacts, and (on `main`) deploys plus runs post-deployment smoke tests.

**Concurrency:** 
- Cancels in-progress runs for the same PR/branch
- Saves GitHub Actions minutes

#### 2. `create-issue-on-failure.yml` (Failure Handler)

**Location:** `.github/workflows/create-issue-on-failure.yml`

**Triggers:**
- When `ci-cd.yml` workflow completes with failure status

**Behavior:**
- Automatically creates GitHub issue with failure details
- Includes links to failed jobs and logs
- Adds labels: `ci-failure`, `bug`, `automated`
- Prevents duplicate issues for same failure
- Includes troubleshooting steps and resources

**Issue Template Includes:**
- Failed job names and log links
- Branch and commit information
- Timestamp and triggering user
- Next steps for resolution
- Common failure causes
- Links to documentation

---

## Running Checks Locally

Before pushing code, run these commands locally to catch issues early:

### Quick Check (Recommended before every commit)

```bash
# From project root
npm run build
cd frontend && npm run lint
cd ../backend && npm test
```

### Comprehensive Check (Before pushing to main)

```bash
# Install dependencies
npm install

# Frontend checks
cd frontend
npm run lint                    # Linting
npx tsc -b --noEmit            # Type checking
npm run build                   # Build

# Backend checks
cd ../backend
npx tsc --noEmit               # Type checking
npm test                        # Run tests
npm run test:coverage          # Run tests with coverage

# Full build
cd ..
npm run build                   # Build everything
```

### Individual Checks

```bash
# Frontend linting only
cd frontend && npm run lint

# Backend type check only
cd backend && npx tsc --noEmit

# Frontend type check only
cd frontend && npx tsc -b --noEmit

# Backend tests only
cd backend && npm test

# Backend tests with coverage
cd backend && npm run test:coverage

# Full build
npm run build
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Linting Errors

**Symptoms:**
- `lint-frontend` job fails
- ESLint reports errors or warnings

**Solutions:**

1. **Run linter locally:**
   ```bash
   cd frontend
   npm run lint
   ```

2. **Common fixes:**
   - Remove `any` types: Define proper interfaces
   - Fix React hooks deps: Add missing dependencies or use `eslint-disable-next-line`
   - Remove unused imports: Delete or use the import

3. **Auto-fix (when possible):**
   ```bash
   cd frontend
   npm run lint -- --fix
   ```

#### Issue: Type Errors

**Symptoms:**
- `typecheck-backend` or `typecheck-frontend` fails
- TypeScript compiler reports type errors

**Solutions:**

1. **Run type checker locally:**
   ```bash
   # Backend
   cd backend && npx tsc --noEmit
   
   # Frontend
   cd frontend && npx tsc -b --noEmit
   ```

2. **Common fixes:**
   - Add missing type definitions
   - Fix type incompatibilities
   - Add proper interfaces for objects
   - Use type assertions only when necessary (`as Type`)

#### Issue: Test Failures

**Symptoms:**
- `test-backend` job fails
- Jest reports failing tests

**Solutions:**

1. **Run tests locally:**
   ```bash
   cd backend
   npm test
   ```

2. **Run specific test file:**
   ```bash
   cd backend
   npm test -- members.test.ts
   ```

3. **Debug test failures:**
   - Check test output for specific assertion failures
   - Verify test data setup in `__tests__/setup.ts`
   - Ensure in-memory database is properly initialized
   - Check for race conditions in async tests

4. **Common fixes:**
   - Update expected values in assertions
   - Fix business logic in implementation
   - Add missing test data setup
   - Handle async operations properly

#### Issue: Build Failures

**Symptoms:**
- `build` job fails
- TypeScript compilation or Vite build errors

**Solutions:**

1. **Run build locally:**
   ```bash
   npm run build
   ```

2. **Common fixes:**
   - Fix TypeScript compilation errors (same as type checking)
   - Resolve missing dependencies: `npm install`
   - Check for circular dependencies
   - Verify all imported files exist

#### Issue: Coverage Below Threshold

**Symptoms:**
- Tests pass but coverage check fails
- Coverage below 70% threshold

**Solutions:**

1. **Check coverage report:**
   ```bash
   cd backend
   npm run test:coverage
   # View detailed report in coverage/lcov-report/index.html
   ```

2. **Common fixes:**
   - Add tests for uncovered code paths
   - Test error handling branches
   - Test edge cases
   - Remove dead code

#### Issue: Deployment Fails with 409 Conflict

**Symptoms:**
- `deploy` job fails with "409 Conflict" error
- Azure deployment reports conflict during OneDeploy

**Solutions:**

1. **Automatic retry:**
   - The pipeline now includes automatic retry logic
   - Waits 60 seconds and retries once
   - Handles most transient 409 Conflict errors

2. **Manual retry (if automatic retry fails):**
   - Wait 2-3 minutes for Azure to complete ongoing operations
   - Re-run the failed workflow from GitHub Actions
   - Check Azure portal for any locks or ongoing deployments

3. **Common causes:**
   - Previous deployment still running (Oryx build in progress)
   - Azure platform updates in progress
   - Concurrent deployment attempts
   - SCM_DO_BUILD_DURING_DEPLOYMENT causing build conflicts

#### Issue: Deployment Fails

**Symptoms:**
- `deploy` job fails
- Azure deployment errors

**Solutions:**

1. **Check Azure credentials:**
   - Verify secrets are configured correctly
   - Check federated credentials haven't expired

2. **Check deployment package:**
   - Ensure `release.zip` contains all necessary files
   - Verify production dependencies are included

3. **Check Azure App Service:**
   - Verify app service is running
   - Check application settings in Azure portal
   - Review deployment logs in Azure

---

## Performance Optimization

### Current Optimizations

✅ **npm Caching**: Dependencies cached per package-lock.json hash  
✅ **Single-Runner Flow**: One job reuses installed dependencies and stops on first failure  
✅ **Concurrency Control**: Cancels outdated runs for same PR  
✅ **Artifact Retention**: 7 days (balance between storage and debugging)  
✅ **Azure Post-Deploy Build**: Dependencies installed by Azure, not in CI (faster GitHub Actions)  
✅ **Smaller Artifacts**: Deployment package excludes node_modules (~50-100MB smaller)

### Pipeline Execution Time

**Typical Run Times:**
- Quality + Tests (sequential): ~6-8 minutes (shared environment, no repeated setup)
- Build: ~1-2 minutes (reduced: no production npm install)
- Deploy: ~3-4 minutes (includes Azure npm install)
- **Total (successful run)**: ~10-13 minutes (single runner, fail-fast to cut wasted minutes)

**Optimization Opportunities:**

1. **Selective Job Execution:**
   - Skip deployment on doc-only changes (future enhancement)
   - Skip frontend checks if only backend files changed (future)

2. **Test Parallelization:**
   - Split test suites into multiple jobs (if test suite grows large)

3. **Incremental Builds:**
   - Cache build outputs (currently caching dependencies only)

4. **Self-Hosted Runners:**
   - Consider self-hosted runners for larger scale (cost vs. speed tradeoff)

### GitHub Actions Minutes Usage

**Monthly Estimate (based on typical activity):**

- **Per Successful Run**: ~10 minutes × 1 concurrent job = 10 minutes
- **Per Failed Run**: ~3 minutes (fails fast at quality checks)
- **Estimated Runs/Month**: 
  - Main branch pushes: ~20
  - PRs: ~10
  - Failed runs: ~5

**Total Estimate**: ~350 minutes/month

**Free Tier**: 2000 minutes/month (sufficient for this project)

---

## Maintenance

### Regular Maintenance Tasks

#### Monthly

- [ ] Review pipeline execution times and optimize if needed
- [ ] Check GitHub Actions minutes usage
- [ ] Review and close any stale CI failure issues

#### Quarterly

- [ ] Update workflow actions to latest versions
- [ ] Review and update coverage thresholds
- [ ] Evaluate new quality checks or tools
- [ ] Review and optimize caching strategies

#### As Needed

- [ ] Update Node.js version (when new LTS released)
- [ ] Add new test suites as features are added
- [ ] Update deployment configuration for new environments
- [ ] Adjust quality gates based on team feedback

### Updating Workflow Actions

When updating action versions (e.g., `actions/checkout@v6` → `v7`):

1. **Test in a branch first**
2. **Review action changelog** for breaking changes
3. **Update all usages** (search across workflow files)
4. **Verify in PR** before merging

### Adding New Quality Checks

To add a new quality check (e.g., security scanning):

1. **Create new job** in `ci-cd.yml`
2. **Add to `needs` array** of `build` job
3. **Document the check** in this file
4. **Test in PR** with intentional failure
5. **Update** `create-issue-on-failure.yml` to include new job

Example:
```yaml
security-scan:
  name: 🔒 Security Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Run security scan
      run: npm audit --audit-level=moderate

# Add to build job needs:
build:
  needs:
    - lint-frontend
    - typecheck-backend
    - typecheck-frontend
    - test-backend
    - security-scan  # ← New dependency
```

---

## Related Documentation

- **[MASTER_PLAN.md](MASTER_PLAN.md)** - Project roadmap and strategic planning
- **[AS_BUILT.md](AS_BUILT.md)** - Current implementation state
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Local development setup
- **[FEATURE_DEVELOPMENT_GUIDE.md](FEATURE_DEVELOPMENT_GUIDE.md)** - Development guidelines
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - API reference

---

## Support

For questions or issues with the CI/CD pipeline:

1. **Check this documentation first**
2. **Review failed workflow logs** on GitHub Actions tab
3. **Check automated issue** created by failure handler
4. **Search existing issues** for similar problems
5. **Create new issue** if problem is unique

---

**Document Maintained By:** Development Team  
**Last Review:** January 2026  
**Next Review:** April 2026
