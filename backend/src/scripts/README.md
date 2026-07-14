# Database Seeding Scripts and Utilities

This directory contains scripts for seeding database with initial data and testing deployments across different environments.

## Scripts

### `seedDatabase.ts` - Comprehensive Database Seeding

Seeds activities, members, and appliances for test, development, and production environments.

**Usage:**

```bash
# Seed test environment (tables suffixed with 'Test')
npm run seed:test

# Seed development environment (tables suffixed with 'Dev')
npm run seed:dev

# Seed production environment (no suffix)
npm run seed:prod
```

**What gets seeded:**

- **Activities** (all environments): Training, Maintenance, Meeting, Brigade Training, District Training
- **Members** (test/dev only): 20 sample members for testing
- **Appliances** (test/dev only): 3 sample vehicles for truck checks testing

**Environment Variables:**

- `NODE_ENV`: Environment name (test, development, production)
- `TABLE_STORAGE_TABLE_SUFFIX`: Optional table suffix (auto-set: 'Test' for test, 'Dev' for development)
- `AZURE_STORAGE_CONNECTION_STRING`: Required for Table Storage

### `grantFireBreakEntitlement.ts` - Fire Break Calculator entitlement backfill

Grants `fireBreakEnabled` to existing organizations whose plan now includes it
(Basic and AI Pro). Stored entitlements are a snapshot, so the plan-catalog
change alone does not reach existing subscribers — run this once after
deploying the plan change.

```bash
# Preview (dry run is the default)
npm run grant:firebreak

# Apply
DRY_RUN=false npm run grant:firebreak
```

### `fetchEmergencyFacilitiesSnapshot.ts` + `uploadFacilitiesToBlobStorage.ts` — emergency-facilities dataset

Signup's facility-claim step (`GET /api/facilities/lookup`) is backed by a
bundled snapshot of the Digital Atlas of Australia / Geoscience Australia
"Emergency Management Facilities" dataset (rural/country fire, metro fire,
SES, ambulance, police, other), the same national dataset Fire Santa Run
claims brigades from.

**⚠️ `facilities:fetch` requires internet access to `services.ga.gov.au` —
run it from an operator machine, not CI or a sandboxed agent environment.**

```bash
# 1. Fetch the latest snapshot (writes src/data/emergency-facilities.csv)
npm run facilities:fetch

# 2. Upload it so the app can download it at runtime
npm run facilities:upload
```

If the snapshot is missing, `GET /api/facilities/lookup` returns 503 and
signup falls back to the "my unit isn't listed" custom path — the app degrades
gracefully rather than blocking signup entirely.

Requires `AZURE_STORAGE_CONNECTION_STRING` to reach the production store.

### `seedActivities.ts` - Legacy Activity Seeding

Legacy script that seeds only activities. Use `seedDatabase.ts` for comprehensive seeding.

### `postDeploymentTests.ts` - Post-Deployment Smoke Tests (NEW)

Validates deployed application health by running smoke tests against live deployment.

**Documentation:** `docs/wiki/developer/post-deployment-testing.md`

**Usage:**

```bash
# Test deployed application
APP_URL=https://bungrfsstation.azurewebsites.net \
TABLE_STORAGE_TABLE_SUFFIX=Test \
npm run test:post-deploy
```

**What gets tested:**

1. Health check endpoint responds correctly
2. API status endpoint returns valid database connection
3. Activities API functionality
4. Members API functionality
5. Check-ins API functionality
6. Frontend SPA loads correctly
7. CORS configuration is present
8. Rate limiting is configured

**Environment Variables:**

- `APP_URL`: Deployed application URL (required, e.g., https://bungrfsstation.azurewebsites.net)
- `TABLE_STORAGE_TABLE_SUFFIX`: Table suffix for test isolation (default: Test)
- `TEST_TIMEOUT`: Timeout per request in ms (default: 30000)
- `MAX_RETRIES`: Number of retries for failed requests (default: 3)

**CI/CD Integration:**

Automatically runs after deployment to validate successful deployments:

```yaml
- name: Run post-deployment smoke tests
  env:
    APP_URL: ${{ secrets.APP_URL }}
    TABLE_STORAGE_TABLE_SUFFIX: Test
  run: cd backend && npm run test:post-deploy
```

### `backupTableStorage.ts` - Table Storage backup/export

Azure Table Storage has **no native point-in-time restore** (that's a Blob
Storage feature — Tables only get geo-replication, which protects against
Azure losing a datacenter, not against a bad script or operator mistake
deleting or corrupting rows). This script exports every table in the target
storage account to newline-delimited JSON blobs, so there's something to
restore from if that ever happens.

Tables are discovered dynamically via `TableServiceClient.listTables()` — the
script does not need updating when a new table-backed service is added.

```bash
# Back up the production storage account
AZURE_STORAGE_CONNECTION_STRING=<prod-connection-string> npm run backup:prod
```

Writes to a `table-backups` blob container (override with
`BACKUP_CONTAINER_NAME`) under a `<ISO-timestamp>/<TableName>.ndjson` prefix.
Runs nightly via `.github/workflows/nightly-backup.yml` — **requires the
`AZURE_STORAGE_CONNECTION_STRING` repo secret to be set** (one-time ops step;
the deploy pipeline itself doesn't need this secret since App Service reads
it from its own app settings). Restoring from a backup is a manual step:
download the relevant `.ndjson` blob(s) and re-upsert entities with a small
script.

### `purgeProdTestData.ts` - Clear Production Test Records

Removes historical test data from production tables while leaving members and activities intact.

## Table Naming Convention

Tables are automatically suffixed based on environment to allow sharing a single Azure Storage account:

| Environment | Suffix | Example Table Name |
|-------------|--------|-------------------|
| Test        | Test   | MembersTest       |
| Development | Dev    | MembersDev        |
| Production  | (none) | Members           |

This ensures test, dev, and prod data never interfere with each other.

## CI/CD Integration

The GitHub Actions workflow automatically seeds test data before running tests:

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

## Manual Seeding

You can seed any environment manually:

```bash
# Seed specific environment with custom suffix
NODE_ENV=development TABLE_STORAGE_TABLE_SUFFIX=MyDev ts-node src/scripts/seedDatabase.ts

# Seed production (requires production connection string in .env)
NODE_ENV=production ts-node src/scripts/seedDatabase.ts
```

## Idempotency

All seed scripts are idempotent - running them multiple times is safe. They:
- Check for existing data before creating
- Skip items that already exist
- Report what was created vs skipped

### `purgeProdTestData.ts` - Clear Production Test Records

Removes historical test data from production tables while leaving members and activities intact.

**What gets cleared:**

- Events
- EventParticipants (event check-ins)
- CheckIns (legacy)
- ActiveActivity
- CheckRuns and CheckResults when `PURGE_TRUCK_CHECKS=true`

**Usage (requires production connection string and explicit confirmation):**

```bash
# Clear event history and event participants
npm run purge:prod

# Also clear truck check runs/results
npm run purge:prod:truck
```

Environment variables:

- `AZURE_STORAGE_CONNECTION_STRING`: Required
- `PURGE_CONFIRM=YES`: Required safety latch
- `TABLE_STORAGE_TABLE_PREFIX` / `TABLE_STORAGE_TABLE_SUFFIX`: Optional targeting (suffix auto-applies for test/dev)
- `PURGE_TRUCK_CHECKS=true`: Include truck check tables
