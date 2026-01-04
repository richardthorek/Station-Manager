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

✅ **Parallel Execution**: Independent jobs run simultaneously for faster feedback  
✅ **Quality Gates**: Deployment blocked unless all checks pass  
✅ **Comprehensive Testing**: 45+ backend tests with 70% coverage threshold  
✅ **Automated Issue Creation**: Failures automatically create GitHub issues with detailed logs  
✅ **Caching**: npm dependencies cached for faster execution  
✅ **In-Memory Testing**: Tests use in-memory database (no Azure dependencies)  
✅ **Documentation**: Extensive inline documentation in workflow files

### Success Metrics

- **Zero False Positives**: All checks must pass for deployment
- **Fast Feedback**: Parallel execution reduces total pipeline time
- **Cost Efficient**: Optimized caching reduces GitHub Actions minutes
- **Developer Friendly**: Clear error messages and automated issue creation

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Push to main/PR                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  PHASE 1: QUALITY CHECKS (Parallel)  │
        └──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────────┐
        │              │               │                  │
        ▼              ▼               ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Lint Frontend│ │ Typecheck    │ │ Typecheck    │ │ Test Backend │
│              │ │ Backend      │ │ Frontend     │ │              │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                                │
                       ❌ Any Fail? ──► Stop & Create Issue
                                │
                       ✅ All Pass
                                │
                                ▼
                    ┌────────────────────┐
                    │  PHASE 2: BUILD    │
                    └────────────────────┘
                                │
                                ▼
                    ┌────────────────────┐
                    │ Build Backend      │
                    │ Build Frontend     │
                    │ Create Artifact    │
                    └────────┬───────────┘
                             │
                    ❌ Fail? ──► Stop & Create Issue
                             │
                    ✅ Pass
                             │
                             ▼
                ┌────────────────────────┐
                │ PHASE 3: DEPLOY        │
                │ (main branch only)     │
                └────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Deploy to Azure    │
                    │ App Service        │
                    └────────────────────┘
```

---

## Pipeline Stages

### Phase 1: Quality Checks (Parallel)

These jobs run in parallel to provide fast feedback on code quality issues.

#### 1.1 Frontend Linting (`lint-frontend`)

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

#### 1.2 Backend Type Checking (`typecheck-backend`)

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

#### 1.3 Frontend Type Checking (`typecheck-frontend`)

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

#### 1.4 Backend Testing (`test-backend`)

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

### Phase 2: Build

Runs only if **all** Phase 1 jobs pass.

#### 2.1 Build Application (`build`)

- **Purpose**: Create production-ready build artifacts
- **Commands**:
  - `npm install` - Install all dependencies
  - `npm run build` - Build backend (tsc) and frontend (vite)
  - `npm prune --production` - Remove dev dependencies
  - Create deployment ZIP artifact

**Build Output:**
- `backend/dist/` - Compiled JavaScript from TypeScript
- `frontend/dist/` - Optimized production bundle (HTML, CSS, JS)
- `release.zip` - Deployment package with production dependencies

**Artifact Retention:** 7 days

### Phase 3: Deployment

Runs only if **build** succeeds and **branch is main** (not PRs).

#### 3.1 Deploy to Azure (`deploy`)

- **Purpose**: Deploy application to Azure App Service
- **Target**: `bungrfsstation` (Production slot)
- **Authentication**: Azure federated credentials (OIDC)
- **Deployment Method**: Azure Web Apps Deploy action

**Deployment Steps:**
1. Download build artifact
2. Unzip deployment package
3. Login to Azure using OIDC
4. Deploy to App Service
5. Set Azure App Service environment variables (version info)
6. Display deployment summary

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
1. **Version Verification**: Confirms deployed code matches expected commit SHA
2. **Health Check**: Validates `/health` endpoint responds correctly
3. **API Status**: Verifies `/api/status` endpoint is functional
4. **Activities API**: Tests `/api/activities` endpoint
5. **Members API**: Tests `/api/members` endpoint
6. **Check-ins API**: Tests `/api/checkins` endpoint
7. **Frontend SPA**: Validates frontend loads correctly
8. **CORS Configuration**: Verifies CORS headers are present
9. **Rate Limiting**: Ensures rate limiting is configured

**Retry Strategy:**
- 100-second initial wait for deployment stabilization (polling health endpoint every 10s)
- 12 retries per request with 10-second delays
- Automatic retry on 404, 502, 503 status codes (deployment stabilizing)
- Automatic retry on version mismatch (Azure App Service restart)
- Total maximum time: 220 seconds (100s polling + 120s version verification)

**Success Criteria:**
- All 9 smoke tests must pass
- Deployed commit SHA must match GitHub deployment SHA
- All critical API endpoints must respond with 200 status

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
- `lint-frontend` - Frontend linting
- `typecheck-backend` - Backend type checking
- `typecheck-frontend` - Frontend type checking
- `test-backend` - Backend testing
- `build` - Build application (needs all above)
- `deploy` - Deploy to Azure (needs build, main branch only)
- `post-deployment-tests` - Smoke tests on live deployment (needs deploy, main branch only)

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
✅ **Parallel Execution**: Independent jobs run simultaneously  
✅ **Concurrency Control**: Cancels outdated runs for same PR  
✅ **Artifact Retention**: 7 days (balance between storage and debugging)  
✅ **Production Dependencies**: Dev dependencies pruned before deployment

### Pipeline Execution Time

**Typical Run Times:**
- Quality Checks (parallel): ~2-3 minutes
- Build: ~2-3 minutes
- Deploy: ~3-5 minutes
- **Total (successful run)**: ~7-11 minutes

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
