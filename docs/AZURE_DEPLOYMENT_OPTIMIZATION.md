# Azure Deployment Strategy

**Document Version:** 2.0  
**Last Updated:** February 2026  
**Status:** Implemented

---

## Executive Summary

The Azure deployment process has been optimized to ensure **reliable, deterministic deployments** by pre-installing production dependencies in CI/CD and eliminating server-side builds. This approach prevents "missing module" errors and ensures consistent deployments.

## Problem Statement

### Original Issues (v1.0)
- **Slow Deployments**: 4-6 minutes per deployment
- **Large Artifacts**: 150-200MB zip files
- **Redundant Builds**: Code built twice (CI/CD + Azure)
- **Inefficient Process**: Shipping node_modules then reinstalling

### Root Causes (v1.0)
1. `.deployment` file had `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
2. GitHub Actions packaged pre-built code + node_modules
3. Azure Kudu rebuilt all code despite receiving built artifacts
4. Duplicate dependency installation (local + server)

### Issues with v1.0 Optimization (February 2026)
The initial optimization attempted to exclude `node_modules` and rely on `startup.sh` to install dependencies. This failed because:

1. **Azure App Service is running on Windows with IIS/iisnode** (not Linux)
2. **Windows/IIS does not execute bash scripts** like `startup.sh`
3. With `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, **no npm install runs**
4. Result: **Production outage** with "Cannot find module 'helmet'" error

## Current Deployment Strategy (v2.0)

### Key Principles
1. **Pre-install dependencies in CI/CD** for deterministic builds
2. **Disable server-side builds** to avoid redundancy
3. **Ship complete, ready-to-run artifacts** with no runtime setup needed

### Implementation

#### 1. Disabled Azure Server-Side Builds
```ini
# .deployment
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

**Impact**: Eliminates 2-3 minutes of redundant build time

#### 2. Pre-Install Production Dependencies
```yaml
# .github/workflows/ci-cd.yml
- name: Install production dependencies
  run: |
    cd backend
    npm ci --production

- name: Create deployment package
  run: |
    cp -r backend/node_modules deploy/backend/  # ✅ Pre-installed deps
```

**Impact**: 
- **Reliable**: Dependencies guaranteed present at startup
- **Deterministic**: Exact versions from package-lock.json
- **Fast startup**: No npm install delay
- **No network issues**: Dependencies already on disk

#### 3. Why Include node_modules?

**Azure App Service on Windows/IIS:**
- Uses `web.config` for IIS configuration
- Executes Node.js via `iisnode` handler
- **Does NOT execute startup.sh** (bash scripts don't run on Windows)
- With `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, no build/install runs

**Therefore:**
- Pre-installing dependencies in CI/CD is the ONLY way to ensure they're available
- `startup.sh` is kept for documentation but is not used on Windows
- This approach works on both Linux and Windows App Service

## Deployment Package Contents

### What's Included ✅
- `backend/dist/` - Compiled JavaScript from TypeScript
- `backend/node_modules/` - Production dependencies (pre-installed)
- `backend/package.json` - Dependency manifest
- `backend/package-lock.json` - Locked dependency versions
- `frontend/dist/` - Optimized static assets (HTML, CSS, JS)
- `startup.sh` - Kept for reference (not used on Windows)
- `web.config` - IIS configuration
- `package.json` - Root workspace manifest

### What's Excluded ❌
- `frontend/node_modules/` - Not needed (only dist shipped)
- `backend/src/` - TypeScript source (already compiled)
- `frontend/src/` - React source (already built)
- Test files and coverage reports
- Development dependencies (only production deps in node_modules)

## Deployment Flow

### Previous Approach (v1.0 - FAILED)
```
1. GitHub Actions Build (2 min)
   ├─ Install deps
   ├─ Build TypeScript → JavaScript
   ├─ Build React → static files
   └─ Package minimal artifact (no node_modules) ❌

2. Upload Artifact (30 sec)
   └─ 50-100MB zip file

3. Azure Deployment (FAILED) ❌
   ├─ Extract zip
   ├─ Skip build (SCM_DO_BUILD_DURING_DEPLOYMENT=false)
   ├─ startup.sh NOT executed (Windows/IIS doesn't run bash) ❌
   ├─ No npm install runs ❌
   └─ Start application → CRASH: "Cannot find module 'helmet'" ❌

Result: Production outage
```

### Current Approach (v2.0 - WORKING)
```
1. GitHub Actions Build (2-3 min)
   ├─ Install all deps for build
   ├─ Build TypeScript → JavaScript
   ├─ Build React → static files
   ├─ Install production deps (fresh, clean) ✅
   └─ Package with pre-installed node_modules ✅

2. Upload Artifact (1-2 min)
   └─ 150-200MB zip file (includes node_modules)

3. Azure Deployment (1 min) ✅
   ├─ Extract zip
   ├─ Skip build (SCM_DO_BUILD_DURING_DEPLOYMENT=false)
   ├─ Dependencies already present ✅
   └─ Start application → SUCCESS ✅

Total: 4-6 minutes (reliable, deterministic)
```

## Benefits

### Reliability Improvements ⭐
- **No missing dependencies**: All modules guaranteed present
- **Deterministic builds**: Exact versions from package-lock.json
- **Platform-independent**: Works on Linux and Windows App Service
- **Fast startup**: No npm install delay
- **No network issues**: Dependencies already on disk

### Performance
- **Fast startup**: Application starts immediately (no npm install)
- **Predictable**: Deployment time is consistent
- **No Azure bottlenecks**: No dependency resolution on server

### Developer Experience
- **No surprises**: What works in CI/CD works in production
- **Easy debugging**: Exact same node_modules in dev and prod
- **Simple**: No complex startup scripts or server-side configuration

## Validation

### How to Verify Deployment
1. Check workflow logs show "Install production dependencies" step
2. Verify `backend/node_modules` is included in deployment package
3. Confirm app starts immediately (no npm install logs)
4. Test /health endpoint returns 200
5. Verify helmet and all modules are available

### Monitoring
Monitor deployment success in Azure portal:
- **Target**: 100% successful deployments
- **Alert if**: Any "module not found" errors
- **Check**: Application Insights for startup errors

## Troubleshooting

### If Deployment Fails with "Module not found"
**Possible Causes:**
1. CI/CD didn't run "Install production dependencies" step
2. node_modules not included in deployment package
3. Package corruption during zip/upload

**Solution:**
```bash
# Verify deployment package contents
unzip -l release.zip | grep node_modules/helmet
# Should show helmet module directory

# Check CI/CD logs
# Should show "Install production dependencies" step
# Should show "added XXX packages" output
```

### If Deployment is Still Slow (> 6 min)
**Possible Causes:**
1. Azure server-side build accidentally re-enabled
2. Network issues during upload
3. Azure resource constraints

**Debug Steps:**
```bash
# 1. Verify .deployment file
cat .deployment
# Should show: SCM_DO_BUILD_DURING_DEPLOYMENT=false

# 2. Check artifact size
ls -lh release.zip
# Should be ~150-200MB (includes node_modules)

# 3. Verify node_modules in package
unzip -l release.zip | grep backend/node_modules/helmet
# Should show helmet module directory

# 4. Check Azure deployment logs
az webapp log tail --name bungrfsstation --resource-group bungrfsstation_group
# Should NOT show "Running build" or "npm install"
```

### If Dependencies are Wrong Version
**Cause**: package-lock.json out of sync  
**Solution**: 
```bash
cd backend
rm package-lock.json node_modules -rf
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
```

## Platform Considerations

### Windows vs Linux App Service

**Current Setup: Windows with IIS/iisnode**
- Uses `web.config` for configuration
- Does NOT execute bash scripts (`startup.sh` ignored)
- Dependencies MUST be pre-installed in deployment package

**If migrating to Linux App Service:**
- `startup.sh` would execute
- Could use server-side dependency installation
- Would need to update deployment strategy

**Why Windows?**
- Already configured and working
- No migration needed
- `node_modules` approach works on both platforms

## Related Documentation
- **CI/CD Pipeline**: `.github/workflows/ci-cd.yml` - Full pipeline configuration
- **Startup Script**: `startup.sh` - Kept for reference, not used on Windows
- **Azure Config**: `.deployment` - Kudu deployment settings
- **Master Plan**: `docs/MASTER_PLAN.md` - Strategic planning

## Maintenance

### When to Update This Document
- If deployment strategy changes
- If Azure platform changes (Windows → Linux, etc.)
- If dependency installation approach changes
- If new deployment issues are discovered

### Periodic Review
- **After Each Deployment**: Verify successful startup
- **Monthly**: Review deployment success rate
- **Quarterly**: Review Azure costs and optimization opportunities
- **Annually**: Comprehensive deployment strategy review

## Incident History

### February 6, 2026 - Production Outage (Missing helmet module)
**Issue**: Site returned 503, backend failed to start with "Cannot find module 'helmet'"

**Root Cause**: 
- Initial v1.0 optimization excluded `node_modules` from deployment package
- Assumed `startup.sh` would install dependencies
- However, Azure App Service runs on Windows/IIS, which doesn't execute bash scripts
- With `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, no npm install occurred
- Result: Dependencies never installed, app crashed on startup

**Resolution**: 
- Updated CI/CD workflow to pre-install production dependencies
- Include `backend/node_modules` in deployment package
- Updated documentation to reflect Windows/IIS platform constraints
- Now using v2.0 deployment strategy (pre-installed dependencies)

**Prevention**: 
- All future deployments include node_modules
- Verification steps added to troubleshooting guide
- Platform constraints documented

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | Feb 2026 | Initial optimization - excluded node_modules | **FAILED** |
| 2.0 | Feb 6, 2026 | Fixed: Include node_modules, document platform constraints | **WORKING** |


