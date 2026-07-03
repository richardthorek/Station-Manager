# Post-Deployment Testing Strategy

**Document Version:** 1.1
**Last Updated:** June 2026
**Status:** ⚠️ **DISABLED IN CI — DO NOT RELY ON THESE TESTS**

> ## ⚠️ Current status (as of 2026-06-20): post-deployment smoke tests are DISABLED
>
> The post-deployment smoke tests described below are **not run by the CI/CD
> pipeline** and must not be relied upon as a deployment gate.
>
> **Why:** the tests are written in TypeScript and require `ts-node` (a **dev**
> dependency) to execute. The production deploy package ships **production
> dependencies only**, so `ts-node` is unavailable in the deployed environment
> and the job cannot run.
>
> **What this means in practice:**
> - A green pipeline does **not** imply post-deploy smoke tests passed — they
>   were skipped.
> - Verify production health manually after deploy (e.g. `curl /health`, load
>   `/` and `/aar`) until the tests are re-enabled.
> - Re-enabling requires either compiling these tests to plain JS as part of the
>   build, or otherwise making them runnable without dev dependencies.
>
> See `.github/workflows/ci-cd.yml` for the disabled job and TODO items.
>
> Everything below documents the **intended design** for when the tests are
> re-enabled; it does not describe currently-active CI behavior.

---

## Overview

The RFS Station Manager implements a post-deployment testing strategy that validates successful deployments by running smoke tests against the live Azure deployment. This approach ensures that:

1. The application is running and responsive
2. Database connectivity is functional
3. Critical API endpoints are working
4. No production data is affected by test operations

This strategy follows **Identity-Driven CI/CD** best practices, using Azure OIDC (Workload Identity Federation) instead of connection strings, and isolates test data using table suffixes.

---

## Architecture

### Authentication Approach: Azure OIDC (Workload Identity Federation)

**Why OIDC Instead of Connection Strings:**

The traditional approach of using Azure Storage connection strings in CI/CD pipelines has significant drawbacks:

1. **Security Risk**: Connection strings are long-lived bearer tokens with full administrative access
2. **Credential Precedence Issues**: Conflicts with DefaultAzureCredential resolution chain
3. **Zero Trust Violation**: Static secrets violate modern security principles
4. **Audit Trail**: No visibility into which pipeline run accessed storage

**Our OIDC Approach:**

```
GitHub Actions Runner
  ↓
  1. Request OIDC token from GitHub (token.actions.githubusercontent.com)
  ↓
  2. Present token to Azure Entra ID
  ↓
  3. Azure validates token signature and subject claim
  ↓
  4. Azure returns short-lived access token (valid only for job duration)
  ↓
  5. Tests use Azure SDK with DefaultAzureCredential
```

**Benefits:**
- ✅ No secrets to manage or rotate
- ✅ Tokens expire automatically after job completes
- ✅ Full audit trail in Azure logs
- ✅ Scoped permissions (read-only, specific resources)
- ✅ Works seamlessly with DefaultAzureCredential

---

## Test Data Isolation

### Table Suffix Strategy

Production data is protected by using the `TABLE_STORAGE_TABLE_SUFFIX` environment variable:

```bash
# Production tables (no suffix)
members
activities
checkins
events
appliances

# Test tables (with "Test" suffix)
membersTest
activitiesTest
checkinsTest
eventsTest
appliancesTest
```

### Configuration

**In CI/CD Workflow:**
```yaml
env:
  TABLE_STORAGE_TABLE_SUFFIX: Test
```

**In Backend Application:**
```typescript
// backend/src/services/tableStorageDatabase.ts
const suffix = process.env.TABLE_STORAGE_TABLE_SUFFIX || '';
const tableName = `members${suffix}`; // "membersTest" when suffix is "Test"
```

### Benefits

1. **Production Safety**: Test operations cannot affect production data
2. **Isolation**: Tests run in parallel without conflicts
3. **Cleanup**: Test data can be purged independently
4. **Flexibility**: Multiple test environments (Dev, Test, Staging)

---

## Test Suite

### Post-Deployment Smoke Tests

**Location:** `backend/src/scripts/postDeploymentTests.ts`

**Purpose:** Validate deployment success and application health

**Test Coverage:**

| Test # | Test Name | Validates |
|--------|-----------|-----------|
| 1 | Health Check Endpoint | `/health` returns 200, database connectivity |
| 2 | API Status Endpoint | `/api/status` returns database type and environment |
| 3 | Get Activities | `/api/activities` returns array with default activities |
| 4 | Get Members | `/api/members` returns members array |
| 5 | Get Check-ins | `/api/checkins` returns check-ins array |
| 6 | Frontend Loads | `/` returns HTML with root element |
| 7 | CORS Headers | API endpoints have CORS configuration |
| 8 | Rate Limiting | Rate limiting configured but not overly restrictive |

### Test Characteristics

- **Fast**: < 3 minutes total execution time (with retries)
- **Reliable**: Retry logic with 12 attempts and 10-second delays
- **Informative**: Clear pass/fail reporting with detailed error messages
- **Configurable**: Timeout, retries, and target URL via environment variables

### Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `APP_URL` | (required) | Target deployment URL (e.g., https://bungrfsstation.azurewebsites.net) |
| `TABLE_STORAGE_TABLE_SUFFIX` | `Test` | Table suffix for test isolation |
| `TEST_TIMEOUT` | `30000` | Timeout per request in milliseconds |
| `MAX_RETRIES` | `12` | Number of retries for failed requests |

---

## CI/CD Integration

### Pipeline Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Phase 1: Quality Checks (Parallel)                          │
│   • Lint frontend                                            │
│   • Type check backend                                       │
│   • Type check frontend                                      │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Phase 2: Testing (Parallel)                                 │
│   • Run backend unit tests (45+ tests)                       │
│   • Generate coverage report (77%+)                          │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Phase 3: Build                                               │
│   • Build backend (TypeScript → JavaScript)                  │
│   • Build frontend (Vite production build)                   │
│   • Create deployment package                                │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Phase 4: Deploy (Main Branch Only)                          │
│   • Login to Azure (OIDC)                                    │
│   • Deploy to Azure App Service                              │
│   • Wait for deployment to complete                          │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Phase 5: Post-Deployment Tests (NEW)                        │
│   • Wait 30 seconds for stabilization                        │
│   • Login to Azure (OIDC)                                    │
│   • Run smoke tests against live deployment                  │
│   • Test with TABLE_STORAGE_TABLE_SUFFIX=Test               │
│   • Generate test summary                                    │
└──────────────────────────────────────────────────────────────┘
```

### Workflow Configuration

**File:** `.github/workflows/ci-cd.yml`

**Key Job Definition:**

```yaml
post-deployment-tests:
  name: 🧪 Post-Deployment Tests
  runs-on: ubuntu-latest
  needs: deploy
  if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
  permissions:
    id-token: write  # Required for OIDC
    contents: read
  steps:
    - name: Checkout code
      uses: actions/checkout@v6

    - name: Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: 22.x
        cache: 'npm'

    - name: Install dependencies
      run: cd backend && npm ci

    - name: Wait for deployment stabilization
      run: sleep 30

    - name: Login to Azure (OIDC)
      uses: azure/login@v2
      with:
        client-id: ${{ secrets.AZUREAPPSERVICE_CLIENTID_* }}
        tenant-id: ${{ secrets.AZUREAPPSERVICE_TENANTID_* }}
        subscription-id: ${{ secrets.AZUREAPPSERVICE_SUBSCRIPTIONID_* }}

    - name: Run smoke tests
      env:
        APP_URL: ${{ secrets.APP_URL }}
        TABLE_STORAGE_TABLE_SUFFIX: Test
      run: cd backend && npm run test:post-deploy
```

**Required Secrets:**
- `APP_URL`: The deployed application URL (e.g., https://bungrfsstation.azurewebsites.net)
- `AZUREAPPSERVICE_CLIENTID_*`: Azure service principal client ID (for OIDC)
- `AZUREAPPSERVICE_TENANTID_*`: Azure tenant ID (for OIDC)
- `AZUREAPPSERVICE_SUBSCRIPTIONID_*`: Azure subscription ID (for OIDC)

---

## Running Tests Locally

### Prerequisites

1. Azure credentials configured (Azure CLI or OIDC)
2. Backend dependencies installed: `cd backend && npm install`
3. Deployed application URL

### Execution

**Against Local Server:**
```bash
cd backend
npm run dev  # Start server in separate terminal

# In another terminal
APP_URL=http://localhost:3000 npm run test:post-deploy
```

**Against Deployed Application:**
```bash
cd backend
APP_URL=https://bungrfsstation.azurewebsites.net \
TABLE_STORAGE_TABLE_SUFFIX=Test \
npm run test:post-deploy
```

### Expected Output

```
🧪 Starting Post-Deployment Smoke Tests

Target URL: https://bungrfsstation.azurewebsites.net
Timeout: 30000ms
Max Retries: 12
Test Environment: TABLE_STORAGE_TABLE_SUFFIX=Test

Running tests...

  Testing: Health check endpoint responds... ✅ PASS
  Testing: API status endpoint responds... ✅ PASS
  Testing: Activities API endpoint works... ✅ PASS
  Testing: Members API endpoint works... ✅ PASS
  Testing: Check-ins API endpoint works... ✅ PASS
  Testing: Frontend SPA loads correctly... ✅ PASS
  Testing: CORS configuration present... ✅ PASS
  Testing: Rate limiting configured... ✅ PASS

============================================================
Test Summary
============================================================
Total Tests:  8
Passed:       8 ✅
Failed:       0 ❌
============================================================

✅ All tests passed! Deployment successful.
```

---

## Troubleshooting

### Common Issues

#### Test Timeout

**Symptom:** Tests fail with "Request timeout" errors

**Causes:**
1. Application is still starting up
2. Cold start delay (Azure App Service)
3. Network connectivity issues

**Solutions:**
- Increase `TEST_TIMEOUT` environment variable
- Increase `MAX_RETRIES` (default is 12, providing up to 120 seconds)
- Increase stabilization wait time (currently 100 seconds)
- Check Azure App Service logs for startup issues

#### Database Connection Failures

**Symptom:** Health check fails with "Database connection failed"

**Causes:**
1. Azure Storage credentials not configured
2. Network firewall blocking access
3. Table Storage tables not initialized

**Solutions:**
- Verify OIDC authentication is working (check Azure login step)
- Check Azure Storage firewall rules
- Verify TABLE_STORAGE_TABLE_SUFFIX is set correctly
- Check Azure App Service environment variables

#### Tests Pass in CI but Fail Locally

**Symptom:** Tests work in GitHub Actions but not on local machine

**Causes:**
1. Missing Azure credentials locally
2. Different environment variables
3. Local server not running

**Solutions:**
- Ensure Azure CLI is logged in: `az login`
- Set environment variables: `export TABLE_STORAGE_TABLE_SUFFIX=Test`
- Start local server before running tests

---

## Future Enhancements

### Planned Improvements

1. **Comprehensive Integration Tests**
   - Full member sign-in flow
   - Event creation and participation
   - Truck check workflow
   - Real-time WebSocket testing

2. **Test Data Seeding**
   - Automatic seeding of test data before tests
   - Automatic cleanup after tests complete
   - Consistent test data across environments

3. **Performance Testing**
   - Response time assertions
   - Load testing with multiple concurrent requests
   - Database query performance monitoring

4. **Extended Coverage**
   - Test all API endpoints (currently 8 of 35+)
   - Test error scenarios (404, 500, etc.)
   - Test authentication when implemented
   - Test file upload functionality

5. **Monitoring Integration**
   - Send test results to Azure Application Insights
   - Alert on test failures
   - Track deployment success rate over time

---

## References

### Related Documentation

- **CI/CD Pipeline:** `.github/workflows/ci-cd.yml`
- **Master Plan:** `docs/MASTER_PLAN.md`
- **As-Built:** `docs/wiki/developer/architecture.md`
- **API Documentation:** `docs/wiki/developer/api-reference.md`

### Azure Resources

- [Azure OIDC with GitHub Actions](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure)
- [Workload Identity Federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation)
- [Azure Table Storage Best Practices](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-design)

### Best Practices References

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Zero Trust Security Model](https://www.microsoft.com/en-us/security/business/zero-trust)
- [CI/CD Best Practices](https://docs.github.com/en/actions/deployment/about-deployments/deploying-with-github-actions)

---

**Document Status:** Production Ready  
**Last Review:** January 4, 2026  
**Next Review:** April 2026
