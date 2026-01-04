# GitHub Actions Workflows

This directory contains the automated CI/CD workflows for the RFS Station Manager project.

## Active Workflows

### `ci-cd.yml` (Primary Pipeline)
**Status:** ✅ Active  
**Purpose:** Comprehensive CI/CD pipeline with quality gates, testing, and deployment  
**Documentation:** See [docs/ci_pipeline.md](../../docs/ci_pipeline.md)

**Features:**
- Parallel quality checks (linting, type checking)
- Backend testing with coverage reporting
- Build validation with strict quality gates
- Deployment gating (only on main branch)
- npm dependency caching
- Concurrency control

**Triggers:**
- Push to `main` branch
- Pull requests to `main` branch
- Manual workflow dispatch

### `create-issue-on-failure.yml` (Failure Handler)
**Status:** ✅ Active  
**Purpose:** Automatically creates GitHub issues when CI/CD pipeline fails

**Features:**
- Triggered when `ci-cd.yml` fails
- Includes detailed error logs and links
- Prevents duplicate issues
- Provides troubleshooting steps

## Deprecated Workflows

### `main_bungrfsstation.yml.deprecated`
**Status:** ⚠️ Deprecated  
**Replaced by:** `ci-cd.yml` (January 2026)  
**Reason:** Replaced with comprehensive pipeline featuring quality gates, parallel execution, and automated failure handling

**What changed:**
- Old workflow had basic build and test steps
- New workflow adds comprehensive quality checks, parallel execution, caching, and failure tracking
- Old workflow kept for reference only (not executed)

## Migration Notes

The new `ci-cd.yml` workflow provides:
1. **Better Quality Assurance:** Multiple quality gates prevent broken deployments
2. **Faster Feedback:** Parallel job execution reduces pipeline time
3. **Cost Efficiency:** npm caching and concurrency control reduce GitHub Actions minutes
4. **Better DX:** Automatic issue creation on failures with detailed logs

## Documentation

For detailed information about the CI/CD pipeline:
- **Pipeline Documentation:** [docs/ci_pipeline.md](../../docs/ci_pipeline.md)
- **Master Plan:** [docs/MASTER_PLAN.md](../../docs/MASTER_PLAN.md)
- **As-Built Documentation:** [docs/AS_BUILT.md](../../docs/AS_BUILT.md)

## Running Checks Locally

Before pushing code, run these checks locally:

```bash
# Linting
cd frontend && npm run lint

# Type checking
cd backend && npx tsc --noEmit
cd frontend && npx tsc -b --noEmit

# Tests
cd backend && npm test

# Build
npm run build
```

See [docs/ci_pipeline.md](../../docs/ci_pipeline.md) for more details.
