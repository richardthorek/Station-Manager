# Production Database Fix

## Problem Identified

Your production app at `https://station.bungendorerfs.org/` is **losing data on every restart** because:

1. **The backend was using an in-memory database** - Data stored only in RAM, lost on restart
2. **No MongoDB/Cosmos DB connection** - Even if `MONGODB_URI` was set, the code never used it
3. **Test users loaded from default data** - These are hardcoded in the in-memory DB initialization
4. **Your events were lost** - Because they weren't saved to persistent storage

## Solution Implemented

I've created a **database factory** system that:

✅ **Automatically connects to MongoDB/Cosmos DB when `MONGODB_URI` is set**  
✅ **Falls back to in-memory storage for local development**  
✅ **Provides clear warnings about database state**  
✅ **Maintains compatibility with existing code**

### Changes Made

1. **Created `/backend/src/services/dbFactory.ts`**
   - Smart database selection based on environment
   - Automatic connection to MongoDB when configured
   - Graceful fallback to in-memory for development

2. **Updated all route files** to use the database factory:
   - `/backend/src/routes/members.ts`
   - `/backend/src/routes/activities.ts`
   - `/backend/src/routes/checkins.ts`
   - `/backend/src/routes/events.ts`

3. **Updated `/backend/src/index.ts`**
   - Initializes database on startup
   - Health check now shows database type
   - Better logging

4. **Enhanced `/backend/src/services/mongoDatabase.ts`**
   - Added all missing event management methods
   - Added indexes for better performance
   - Now feature-complete with in-memory DB

## Required Action: Configure Azure

### Step 1: Get Your Cosmos DB Connection String

Run this command (you'll need Azure CLI installed):

```bash
# Login to Azure
az login

# List your Cosmos DB accounts
az cosmosdb list --output table

# Get connection string (replace with your actual names)
az cosmosdb keys list \
  --name <YOUR-COSMOS-DB-NAME> \
  --resource-group rfs-station-manager \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

**Or via Azure Portal:**
1. Go to https://portal.azure.com
2. Navigate to your Cosmos DB account
3. Click "Connection String" in the left menu
4. Copy the "PRIMARY CONNECTION STRING"

### Step 2: Configure App Service Environment Variables

**Option A: Using Azure CLI**

```bash
# Set the MongoDB connection string
az webapp config appsettings set \
  --name bungrfsstation \
  --resource-group rfs-station-manager \
  --settings \
    MONGODB_URI="<YOUR-CONNECTION-STRING>" \
    NODE_ENV=production

# Restart the app
az webapp restart \
  --name bungrfsstation \
  --resource-group rfs-station-manager
```

**Option B: Using Azure Portal**

1. Go to https://portal.azure.com
2. Navigate to **App Services** → **bungrfsstation**
3. Click **Configuration** in the left menu
4. Click **+ New application setting**
5. Add:
   - **Name:** `MONGODB_URI`
   - **Value:** `<your-cosmos-db-connection-string>`
6. Click **OK**, then **Save**
7. The app will automatically restart

### Step 3: Deploy Updated Code

The code changes are ready. Deploy them:

```bash
# Make sure you're in the project root
cd /workspaces/Station-Manager

# Commit the changes
git add .
git commit -m "Fix: Add persistent database support with automatic MongoDB connection"

# Push to main (triggers GitHub Actions deployment)
git push origin main
```

### Step 4: Verify the Fix

After deployment completes (5-10 minutes):

1. **Check the health endpoint:**
   ```bash
   curl https://bungrfsstation.azurewebsites.net/health
   ```
   
   Should show:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-11-15T...",
     "database": "mongodb",
     "environment": "production"
   }
   ```
   
   **Before fix:** `"database": "in-memory"`  
   **After fix:** `"database": "mongodb"` ✅

2. **Check the logs:**
   ```bash
   az webapp log tail --name bungrfsstation --resource-group rfs-station-manager
   ```
   
   Look for:
   ```
   🔌 Connecting to MongoDB/Cosmos DB...
   ✅ Connected to MongoDB/Cosmos DB
   ✅ Server running on port 8080
   Database: MongoDB/Cosmos DB (persistent)
   ```

3. **Test in the app:**
   - Create a new event
   - Restart the app service
   - Check if the event is still there ✅

## What This Fixes

| Before | After |
|--------|-------|
| ❌ Data lost on restart | ✅ Data persists in Cosmos DB |
| ❌ Only test users appear | ✅ All real data is preserved |
| ❌ Events disappear | ✅ Events stored permanently |
| ❌ No warning about data loss | ✅ Clear logging about DB type |

## URL Change Impact

The new URL `https://station.bungendorerfs.org/` is **NOT causing the issue**. The problem was the database configuration, not the URL. The app should work fine at the new URL once MongoDB is configured.

## Rollback Plan

If something goes wrong:

1. **Remove the MONGODB_URI setting** - App will revert to in-memory mode
2. **Redeploy previous version** - Git checkout previous commit
3. **Check logs** - Azure Portal → App Service → Log Stream

## Local Development

The changes are backward compatible:

```bash
# Backend (no MONGODB_URI = uses in-memory)
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Cost Impact

- **Cosmos DB Free Tier:** 1000 RU/s, 25GB storage - **$0/month**
- **Beyond Free Tier:** ~$5-10/month for typical usage

## Need Help?

If you encounter issues:

1. Check App Service logs: `az webapp log tail --name bungrfsstation --resource-group rfs-station-manager`
2. Verify MONGODB_URI is set: `az webapp config appsettings list --name bungrfsstation --resource-group rfs-station-manager`
3. Check Cosmos DB connection in Azure Portal
4. Test health endpoint: `curl https://bungrfsstation.azurewebsites.net/health`

## Summary Checklist

- [ ] Get Cosmos DB connection string
- [ ] Set `MONGODB_URI` in App Service settings
- [ ] Commit and push code changes
- [ ] Wait for GitHub Actions deployment
- [ ] Verify health endpoint shows "mongodb"
- [ ] Test creating and persisting data
- [ ] Restart app and verify data persists

---

**The fix is ready. Once you configure MONGODB_URI, your data will persist! 🎉**
