# Production Seeding Guide - Temporary CI/CD Relaxation

**Status:** ACTIVE  
**Created:** January 2026  
**Expiry:** 2 weeks from deployment  
**Related Issue:** Allow deploy with failing test suite in CI/CD pipeline

---

## Overview

This document provides step-by-step instructions for deploying to production with the temporarily relaxed CI/CD pipeline and running the critical database seeding scripts.

### Context

Recent test failures (400/404/500 errors in activities and check-ins endpoints) are blocking deployment. These failures are related to Table Storage migration issues, but seeding scripts must run in production immediately. The CI/CD pipeline has been temporarily modified to allow deployment despite failing tests.

---

## ⚠️ Important Warnings

1. **This is a TEMPORARY measure** - Must be reverted within 2 weeks
2. **Tests still run** - They just don't block deployment anymore
3. **Increased risk** - Deploy with extra caution and monitor closely
4. **Manual verification required** - Check production thoroughly after seeding

---

## Pre-Deployment Checklist

- [ ] Verify PR has been merged to `main` branch
- [ ] Confirm GitHub Actions workflow is configured with `continue-on-error: true`
- [ ] Backup production database (Azure Table Storage export)
- [ ] Notify team of deployment window
- [ ] Have rollback plan ready

---

## Deployment Steps

### Step 1: Merge and Deploy

```bash
# 1. Merge the PR to main branch via GitHub UI
# 2. Monitor GitHub Actions workflow
#    - Go to: https://github.com/richardthorek/Station-Manager/actions
#    - Watch the "Build and deploy Node.js app to Azure Web App" workflow
#    - Tests may fail - this is expected and will show warnings
#    - Deployment should continue and succeed

# 3. Verify deployment completes successfully
#    - Check workflow shows "Deploy to Azure Web App" step as successful
#    - Verify artifact upload completed
```

### Step 2: Access Production Environment

```bash
# SSH to Azure App Service or use Azure Portal Console
# Option A: Azure Portal
# 1. Go to Azure Portal → App Services → bungrfsstation
# 2. Click "SSH" or "Advanced Tools" → "Go" → "SSH"

# Option B: Azure CLI
az webapp ssh --name bungrfsstation --resource-group <your-resource-group>
```

### Step 3: Run Production Seeding Scripts

```bash
# Once connected to production environment:

# Navigate to backend directory
cd backend

# Verify environment variables are set
echo $AZURE_STORAGE_CONNECTION_STRING
echo $USE_TABLE_STORAGE
# Both should have values

# Run production seeding script
npm run seed:prod

# Expected output:
# ✅ Successfully seeded Activities table with default activities
# ✅ Successfully seeded Members table (if applicable)
# ✅ Successfully seeded other tables...

# If errors occur, capture full output for debugging
```

### Step 4: Verify Seed Data

```bash
# Option A: Use Azure Storage Explorer
# 1. Open Azure Storage Explorer
# 2. Connect to storage account
# 3. Browse Tables
# 4. Verify tables exist: Members, Activities, Events, etc.
# 5. Check default activities: Training, Maintenance, Meeting

# Option B: Use Azure Portal
# 1. Go to Storage Account in Azure Portal
# 2. Navigate to Tables
# 3. Browse each table to verify data

# Option C: Test via production API
curl https://bungrfsstation.azurewebsites.net/api/activities
# Should return default activities

curl https://bungrfsstation.azurewebsites.net/api/members
# Should return empty array or existing members
```

### Step 5: Smoke Test Production

```bash
# Test critical endpoints:

# 1. Get activities
curl https://bungrfsstation.azurewebsites.net/api/activities

# 2. Get active activity
curl https://bungrfsstation.azurewebsites.net/api/activities/active

# 3. Get members
curl https://bungrfsstation.azurewebsites.net/api/members

# 4. Test frontend
# Open browser to: https://bungrfsstation.azurewebsites.net
# Verify landing page loads
# Test sign-in flow
# Test truck check flow
```

---

## Post-Seeding Actions

### Immediate (Within 24 hours)

- [ ] **Verify production functionality**
  - Test all major features: sign-in, events, truck checks
  - Monitor for errors in Application Insights
  - Check real-time sync works across devices

- [ ] **Document any issues**
  - Record any unexpected behavior
  - Note which tests correspond to real issues vs false failures

### Within 1 Week

- [ ] **Fix Table Storage test compatibility** (Technical Debt TD1.1)
  - Update tests for activities endpoints
  - Fix check-ins tests for Table Storage
  - Remove or update legacy check-in method tests
  - Ensure all 45 tests pass
  
- [ ] **Run tests locally with Table Storage**
  ```bash
  cd backend
  USE_TABLE_STORAGE=true npm test
  # All tests should pass
  ```

### Within 2 Weeks (DEADLINE)

- [ ] **Re-enable strict CI/CD requirements**
  
  Edit `.github/workflows/main_bungrfsstation.yml`:
  
  ```yaml
  # REMOVE these lines:
  # id: tests
  # continue-on-error: true
  
  # REMOVE entire "Warn if tests failed" step
  
  # REMOVE temporary comments
  ```
  
  Result should be:
  ```yaml
  - name: Run backend tests
    env:
      AZURE_STORAGE_CONNECTION_STRING: ${{ secrets.AZURE_STORAGE_CONNECTION_STRING }}
      USE_TABLE_STORAGE: 'true'
    run: |
      cd backend
      npm run seed:test
      npm test
  ```

- [ ] **Update documentation**
  - Remove Known Issue L1.3 from `docs/MASTER_PLAN.md`
  - Remove Technical Debt TD1.1 from `docs/MASTER_PLAN.md`
  - Update Immediate Actions section
  - Mark this guide as OBSOLETE

- [ ] **Verify strict CI works**
  - Make a small test commit
  - Confirm tests must pass for deployment
  - Verify deployment blocked if tests fail

---

## Rollback Plan

If seeding fails or causes issues:

### Option 1: Rollback Application

```bash
# Via Azure Portal:
# 1. Go to App Service → Deployment Center
# 2. Select previous successful deployment
# 3. Click "Redeploy"

# Via Azure CLI:
az webapp deployment source sync \
  --name bungrfsstation \
  --resource-group <your-resource-group>
```

### Option 2: Restore Database

```bash
# If Table Storage data is corrupted:
# 1. Azure Portal → Storage Account → Tables
# 2. Delete affected tables
# 3. Re-run deployment with fixed seeding scripts
# 4. Or restore from backup if available
```

### Option 3: Emergency Fix

```bash
# If production is broken:
# 1. Revert to previous Git commit
# 2. Force push to main (temporarily)
# 3. Let CI/CD redeploy old version
# 4. Investigate and fix offline

git revert HEAD
git push origin main --force  # Use with extreme caution
```

---

## Troubleshooting

### Seeding Script Fails

**Problem:** `npm run seed:prod` returns errors

**Solutions:**
1. Check `AZURE_STORAGE_CONNECTION_STRING` is set correctly
2. Verify Table Storage firewall rules allow App Service
3. Check logs: `cat /home/LogFiles/*.log`
4. Verify table names and structure match code expectations

### Tests Fail But Show No Warnings

**Problem:** Tests fail but workflow doesn't show warnings

**Cause:** `continue-on-error` not working or warnings suppressed

**Solution:**
1. Check workflow file syntax
2. Verify `id: tests` is set on test step
3. Check GitHub Actions logs manually

### Production Broken After Seeding

**Problem:** Production app returns 500 errors after seeding

**Immediate Actions:**
1. Check Application Insights for error details
2. Verify environment variables in App Service
3. Check if seeding script modified wrong tables
4. Consider rollback (see above)

### Cannot SSH to Production

**Problem:** Cannot access Azure App Service SSH

**Solutions:**
1. Use Azure Portal Console instead
2. Enable SSH in App Service Configuration
3. Use `az webapp` commands remotely
4. Contact Azure support

---

## Success Criteria

✅ **Deployment successful when:**
- GitHub Actions workflow completes without blocking
- Azure App Service shows latest deployment
- Production site loads without errors
- Default activities exist in database
- Sign-in flow works
- Real-time sync functions
- No critical errors in Application Insights

✅ **Seeding successful when:**
- Tables created: Members, Activities, Events, etc.
- Default activities present: Training, Maintenance, Meeting
- No duplicate data
- API endpoints return expected data
- Frontend can fetch and display data

✅ **Reversion successful when:**
- All tests pass locally and in CI
- CI/CD blocks deployment on test failure
- No `continue-on-error` in workflow
- Documentation updated
- This guide marked OBSOLETE

---

## Contact & Support

**Primary Contact:** @richardthorek  
**GitHub Issues:** https://github.com/richardthorek/Station-Manager/issues  
**Emergency:** Escalate via GitHub mentions

**Related Documentation:**
- `docs/MASTER_PLAN.md` - Known Issue L1.3
- `docs/AZURE_DEPLOYMENT.md` - General deployment guide
- `.github/workflows/main_bungrfsstation.yml` - CI/CD configuration
- `backend/src/scripts/seedDatabase.ts` - Seeding script source

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| Jan 2026 | Copilot | Initial creation for temporary CI/CD relaxation |

---

**⏰ REMEMBER: This is a temporary measure. Must be reverted within 2 weeks!**
