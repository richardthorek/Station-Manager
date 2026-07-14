# Azure Staging Slots Deployment Strategy

**Document Version:** 1.0  
**Created:** 2026-07-13  
**Status:** Active  
**Related:** [CI/CD Pipeline](ci-pipeline.md), [MASTER_PLAN.md](../../MASTER_PLAN.md)

---

## Overview

The RFS Station Manager CI/CD pipeline automatically detects and uses Azure Web App staging slots when available, with graceful fallback to production deployment on App Service SKUs that don't support slots.

### What This Means for You

**Current State (Standard/B1 SKU):**
- Main branch pushes deploy to **Production** slot
- Post-deployment smoke tests run against `https://bungrfs-linux.azurewebsites.net`
- Everything works as today

**Future State (Premium/P1 SKU with staging slots):**
- Main branch pushes deploy to **staging** slot
- Post-deployment smoke tests run against `https://bungrfs-linux-staging.azurewebsites.net`
- You manually verify everything, then swap slots to production
- Zero-downtime deployment

---

## Pipeline Behavior

The `.github/workflows/ci-cd.yml` includes automatic slot detection:

### Step: Determine deployment slot

```bash
# Check if staging slot exists
az webapp deployment slot list \
  --resource-group bungrfsstation_group \
  --name bungrfs-linux \
  --query "[?name=='staging']" \
  --output json
```

**If staging slot exists:**
- Deploys to `staging` slot
- Environment variables set on staging slot
- Smoke tests run against `https://bungrfs-linux-staging.azurewebsites.net`
- Logs in deployment summary: "Environment: Staging"

**If staging slot does NOT exist (current):**
- Falls back to `Production` slot
- Everything else unchanged
- Logs in deployment summary: "Environment: Production (default — no staging slot enabled yet)"

---

## Upgrading to Staging Slots

### Prerequisites

1. **App Service SKU upgrade** from Basic/Standard to Premium (P1v2 or higher)
   - [Azure App Service pricing tiers](https://azure.microsoft.com/en-us/pricing/details/app-service/windows/)
   - Premium tier includes deployment slots

2. **Required permissions** in Azure
   - Owner or Contributor role on the `bungrfsstation_group` resource group

### Step-by-Step Upgrade

#### 1. Upgrade App Service SKU

In Azure Portal or via CLI:

```bash
# Check current SKU
az appservice plan show \
  --resource-group bungrfsstation_group \
  --name bungrfsstation_plan

# Upgrade to Premium (example: P1v2)
az appservice plan update \
  --resource-group bungrfsstation_group \
  --name bungrfsstation_plan \
  --sku P1v2
```

**Note:** This scales the underlying app service plan. Billing increases immediately.

#### 2. Create the staging slot

```bash
# Create a new staging deployment slot
az webapp deployment slot create \
  --resource-group bungrfsstation_group \
  --name bungrfs-linux \
  --slot staging
```

The slot is created **empty**. The next `git push main` deploys the build there automatically.

#### 3. Verify slot detection works

Push a commit to main:

```bash
git push origin main
```

Check the GitHub Actions workflow run:

1. Look for the step **"Determine deployment slot"**
2. You should see:
   ```
   ✅ Staging slot exists - will deploy to staging
   slot_name=staging
   slot_url=https://bungrfs-linux-staging.azurewebsites.net
   ```

3. Verify the **"Deployment summary"** shows:
   ```
   - **Environment**: Staging
   - **URL**: https://bungrfs-linux-staging.azurewebsites.net
   ```

4. Post-deployment smoke tests should run against the staging slot URL

#### 4. Configure custom domain (optional)

If you want a vanity URL for staging (e.g., `staging.bungrfs.example.com`):

1. In Azure Portal, go to **bungrfs-linux** → **Deployment slots** → **staging**
2. Add a **Custom domain** binding
3. Update your DNS records
4. The slot will be accessible at both the default Azure URL and your custom domain

---

## The Manual Swap Workflow

Once you're confident everything on staging works:

### Via Azure Portal

1. Go to **bungrfs-linux** → **Deployment slots**
2. Click the **Swap** button on the staging slot
3. Review the swap settings (usually you swap staging → Production)
4. Confirm

### Via Azure CLI

```bash
# Swap staging to production
az webapp deployment slot swap \
  --resource-group bungrfsstation_group \
  --name bungrfs-linux \
  --slot staging
```

### Before Swapping

Verify in the staging slot:
- ✅ All features work end-to-end
- ✅ Real data sync (check with test members/events)
- ✅ Socket.io real-time updates work
- ✅ Reports and exports work
- ✅ No console errors in browser DevTools
- ✅ Mobile/tablet UI looks good (AAR Studio, voice agent, etc.)

---

## Technical Details

### Slot URLs and CORS

Azure generates slot URLs automatically:

| Slot | URL | Notes |
|------|-----|-------|
| Production | `https://bungrfs-linux.azurewebsites.net` | Default production slot |
| staging | `https://bungrfs-linux-staging.azurewebsites.net` | Auto-generated URL |

Both slots share the same app settings (environment variables) **unless you override them per-slot**. Currently, the pipeline sets:
- `GIT_COMMIT_SHA`
- `GIT_COMMIT_SHORT`
- `BUILD_TIMESTAMP`
- `WEBSITE_RUN_FROM_PACKAGE`

These are scoped to the deployed slot (e.g., staging env vars only affect the staging slot).

**Frontend CORS:**

The `FRONTEND_URLS` environment variable controls which origins can access the API. Update it to include the staging slot URL:

```
FRONTEND_URLS=https://bungrfs-linux.azurewebsites.net,https://bungrfs-linux-staging.azurewebsites.net
```

This is set in your Azure App Service environment or Bicep IaC. Verify it's configured before the first staging deployment.

### Smoke Tests

Post-deployment smoke tests automatically run against whichever slot the pipeline deployed to:

```
Phase 1: Stabilization
  - Polls the slot URL until it's up and correct version is deployed
  - Exits early when ready (efficient!)

Phase 2: Functional Tests
  - Validates API endpoints
  - Checks Socket.io connection
  - Confirms database connectivity
  - Validates AAR Studio accessibility
```

Test environment:
- Uses isolated test database suffix (`TABLE_STORAGE_TABLE_SUFFIX=Test`)
- Does not touch production data
- Runs against the deployed slot only

---

## Rollback Strategy

### If Something Breaks on Staging

Don't swap. Instead:

1. **Identify the issue** in the staging deployment
2. **Fix in code** on the feature branch or main
3. **Push to main** — the next CI/CD run re-deploys to staging
4. **Verify the fix** on staging
5. **Swap when ready**

No manual rollback needed; the previous production slot is still intact.

### If You Swapped and Production Breaks

You can swap back immediately:

```bash
# Swap production back to staging (reverses the previous swap)
az webapp deployment slot swap \
  --resource-group bungrfsstation_group \
  --name bungrfs-linux \
  --slot staging
```

This puts the previous code back in production while you diagnose and fix the issue.

---

## Monitoring Slot Swaps

Azure doesn't show swap history in a dedicated log, but you can:

1. **Check App Service logs** (Azure Portal → **Logs**)
2. **Monitor Application Insights** (if configured)
3. **Review GitHub Actions workflow runs** (each run logs which slot it deployed to)
4. **Use Azure CLI audit logs** if you need to see who swapped and when

---

## Costs & Considerations

| Factor | Impact | Notes |
|--------|--------|-------|
| **SKU upgrade** | ~1.3x monthly cost | Premium tier (P1v2) needed for slots |
| **Staging slot** | ~0% (included in Premium) | Slots share the same compute, just partition data |
| **Deployment time** | +30s per deploy | Slot detection check is fast |
| **Storage** | +~200 MB | Each slot has its own warm-start stack; negligible |

---

## Troubleshooting

### "Staging slot not found" on first deployment after upgrade

**Symptom:** Pipeline creates slot but first deploy fails.

**Fix:** The slot may not be fully provisioned yet. Wait 2-3 minutes and manually re-run the workflow (GitHub Actions → workflow run → "Re-run all jobs").

### Slot URLs return 404

**Symptom:** `https://bungrfs-linux-staging.azurewebsites.net` returns a 404 instead of the app.

**Causes:**
1. Slot doesn't exist — verify via CLI or portal
2. App never deployed to that slot — wait for the next CI/CD run
3. Staging slot is **stopped** — check Azure Portal → Deployment slots → staging → "State"

**Fix:** Manually deploy the current production release to staging as a baseline:

```bash
# Get the current production zip and deploy to staging
az webapp deployment slot create \
  --resource-group bungrfsstation_group \
  --name bungrfs-linux \
  --slot staging \
  --configuration-source-name bungrfs-linux
```

### Smoke tests fail on staging but pass on production

**Symptom:** Pipeline runs post-deployment tests on staging, but they fail while production tests pass.

**Causes:**
1. **Slot env vars not synced** — staging may have stale environment variables
2. **FRONTEND_URLS not updated** — staging URL not in CORS allowlist
3. **Different database suffix** — test tables isolated but not visible to test suite

**Fix:**
1. Verify `FRONTEND_URLS` includes the staging slot URL
2. Check that environment variables were set on the staging slot (not just globally)
3. Manually run a test against the staging URL with verbose logging to see what's failing

---

## FAQ

**Q: Do I have to manually swap after every deploy?**

A: Yes. The pipeline deploys to staging, runs tests, and stops. You manually swap when you're satisfied it's working. This gives you control and a safety window before production.

**Q: What happens to staging when I swap?**

A: When you swap staging → production, the old production code goes into staging. So staging always has the "previous" production, making rollback instant.

**Q: Can I deploy to production directly (skip staging)?**

A: Not with the current setup. The pipeline always uses the detected slot. If you want to bypass staging, you would need to:
1. Manually delete the staging slot (not recommended)
2. Update the pipeline to have a flag

For now, use staging for verification and manual slot swaps for prod changes.

**Q: What if I need a second staging slot?**

A: Create a second slot called `staging-2` and update the pipeline logic to detect it. Each slot can have its own deployment and manual swap.

**Q: Does the service worker (PWA) cache cause issues with staging?**

A: Not significantly. The service worker is registered per-origin, so `bungrfs-linux-staging.azurewebsites.net` has its own SW cache separate from production. Just clear browser storage if you switch between slots frequently.

---

## Next Steps

1. **Plan the upgrade** — schedule the App Service SKU change with your team
2. **Upgrade the SKU** — follow the step-by-step guide above
3. **Create the staging slot** — one-time setup
4. **Verify slot detection** — push to main and check GitHub Actions
5. **Test the swap workflow** — manually swap staging → production once to rehearse

---

## See Also

- [CI/CD Pipeline Documentation](ci-pipeline.md)
- [Azure App Service Deployment Slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots)
- [MASTER_PLAN.md — Deployment status](../../MASTER_PLAN.md)
