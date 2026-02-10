# Admin Login Fix - Deployment Guide

## Problem Summary

Admin login was failing with 401 Unauthorized errors at `https://station.bungendorerfs.org/` even though `DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` were properly configured.

## Root Cause

The admin user database was **in-memory only** and didn't persist to Azure Table Storage. Every time the Azure App Service restarted (which happens frequently), all admin accounts were lost. Even though the environment variables were set correctly, the accounts had to be recreated on each restart.

## The Fix

### What Was Implemented

1. **Table Storage Persistence**: Created full Azure Table Storage implementation for admin users
   - New file: `backend/src/services/tableStorageAdminUserDatabase.ts`
   - Stores admin accounts in Azure Table Storage (table name: `AdminUsers` or `AdminUsersDev`/`AdminUsersTest`)
   - Uses same pattern as other databases in the app

2. **Factory Pattern**: Created factory to automatically choose between in-memory and Table Storage
   - New file: `backend/src/services/adminUserDbFactory.ts`
   - Automatically uses Table Storage when `AZURE_STORAGE_CONNECTION_STRING` is set
   - Falls back to in-memory for local development

3. **Enhanced Logging**: Added clear error messages to help diagnose issues
   - Server startup shows: ✅ "Admin user database initialized" or ❌ "CONFIGURATION ERROR"
   - Login failures log: "No admin accounts exist" when database is empty
   - Authentication status logged on startup

4. **Documentation**: Updated `.env.example` and getting started guide
   - Documented `DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` 
   - Added authentication setup instructions

## Deployment Instructions

### For Azure App Service (Production)

Your environment variables are already configured correctly. The fix will work automatically once deployed:

1. **Deploy this PR** to your Azure App Service
2. **Server will restart** and automatically:
   - Connect to Azure Table Storage (using existing `AZURE_STORAGE_CONNECTION_STRING`)
   - Create `AdminUsers` table if it doesn't exist
   - Create default admin account using your `DEFAULT_ADMIN_PASSWORD`
   - Admin account will now **persist across restarts**

3. **Verify in logs** (Azure Portal → App Service → Log Stream):
   ```
   ✅ Admin user database initialized {"username":"admin"}
   Authentication status {"requireAuth":true,"adminAccountCreated":true}
   ```

4. **Test login** at `https://station.bungendorerfs.org/login`
   - Username: `admin` (or your configured username)
   - Password: Your configured `DEFAULT_ADMIN_PASSWORD`

### What Happens After Deployment

**Before Fix**:
- Server restart → Admin account lost → Login fails with 401
- Must manually recreate admin or server restart with correct env vars

**After Fix**:
- Server restart → Admin account **persists in Table Storage** → Login works
- Account created once, stored permanently in Azure Table Storage
- Survives all future restarts

## Environment Variables (Already Configured)

You already have these set, no changes needed:

```bash
# Authentication (already configured)
REQUIRE_AUTH=true
DEFAULT_ADMIN_USERNAME=<your-admin-username>
DEFAULT_ADMIN_PASSWORD=<your-secure-password>
JWT_SECRET=<your-jwt-secret>

# Table Storage (already configured)
AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>
```

## Verification Steps

After deploying this fix:

1. **Check server logs** for successful initialization:
   ```
   ✅ Admin user database initialized
   Using Azure Table Storage for Admin Users
   ```

2. **Attempt login** at `/login` endpoint
   - Should return JWT token and user info
   - No more 401 errors

3. **Restart the App Service** to verify persistence
   - Go to Azure Portal → App Service → Restart
   - After restart, login should still work (account persists)

4. **Check Table Storage** (optional):
   - Azure Portal → Storage Account → Tables
   - Should see `AdminUsers` table with your admin account

## Security Notes

✅ **Security scans passed**:
- CodeQL: 0 security alerts
- Code review: No issues found

✅ **Credential safety**:
- No passwords or secrets logged
- All passwords hashed with bcrypt (SALT_ROUNDS=10)
- Connection strings from environment variables only

## Troubleshooting

If login still fails after deployment:

1. **Check logs for errors**:
   ```
   ❌ CONFIGURATION ERROR: REQUIRE_AUTH=true but DEFAULT_ADMIN_PASSWORD is not set
   ```
   - This means the environment variable isn't being read

2. **Verify environment variables in Azure Portal**:
   - App Service → Settings → Configuration → Application Settings
   - Confirm `DEFAULT_ADMIN_PASSWORD` is set
   - Confirm `AZURE_STORAGE_CONNECTION_STRING` is set

3. **Check Table Storage connection**:
   ```
   Failed to connect to Azure Table Storage for Admin Users
   ```
   - Verify connection string is valid
   - Check network access to storage account

4. **Manual account creation** (if needed):
   - POST to `/api/admin/users` endpoint (if implemented)
   - Or use Azure Portal → Storage Account → Tables → AdminUsers → Add Entity

## Files Changed

- `backend/src/services/tableStorageAdminUserDatabase.ts` (NEW)
- `backend/src/services/adminUserDbFactory.ts` (NEW)
- `backend/src/index.ts` (MODIFIED - use factory)
- `backend/src/routes/auth.ts` (MODIFIED - use factory, optimize login)
- `backend/src/__tests__/auth.test.ts` (MODIFIED - mock factory)
- `backend/.env.example` (MODIFIED - document variables)
- `docs/GETTING_STARTED.md` (MODIFIED - add auth instructions)

## Questions?

If you have issues after deployment, check:
1. Server logs in Azure Portal
2. Table Storage to verify `AdminUsers` table exists
3. Environment variables are set in App Service configuration
