# Azure App Service Environment Configuration

## Problem
Production deployment at `https://station.bungendorerfs.org` is returning 40 dev sample members instead of 104 real brigade members from MongoDB because environment variables are not configured.

## Required Environment Variables

Set these in Azure App Service Configuration:

### 1. MONGODB_URI (CRITICAL)
```
mongodb+srv://bungrfsstationadm:mf4NAtcf*aF-f6xgovW%40@bungrfsstation.global.mongocluster.cosmos.azure.com/StationManager?retryWrites=true&w=majority&appName=BungRFSStation
```

**Important Notes:**
- Password contains `@` which is URL-encoded as `%40`
- Database name is `StationManager` (case-sensitive)
- Collection is `Members` with capital M (case-sensitive)

### 2. NODE_ENV
```
production
```

### 3. FRONTEND_URL (for CORS)
```
https://station.bungendorerfs.org
```

### 4. PORT
```
Usually auto-configured by Azure, but can be set explicitly if needed
```

## How to Set Environment Variables in Azure

### Option 1: Azure Portal
1. Go to Azure Portal (https://portal.azure.com)
2. Navigate to your App Service
3. Go to **Settings** → **Environment variables** (or **Configuration**)
4. Click **+ New application setting**
5. Add each variable:
   - Name: `MONGODB_URI`
   - Value: `mongodb+srv://bungrfsstationadm:mf4NAtcf*aF-f6xgovW%40@bungrfsstation.global.mongocluster.cosmos.azure.com/StationManager?retryWrites=true&w=majority&appName=BungRFSStation`
6. Repeat for `NODE_ENV` and `FRONTEND_URL`
7. Click **Save** at the top
8. **Restart** the App Service

### Option 2: Azure CLI
```bash
az webapp config appsettings set --name <your-app-name> --resource-group <your-resource-group> --settings \
  MONGODB_URI="mongodb+srv://bungrfsstationadm:mf4NAtcf*aF-f6xgovW%40@bungrfsstation.global.mongocluster.cosmos.azure.com/StationManager?retryWrites=true&w=majority&appName=BungRFSStation" \
  NODE_ENV="production" \
  FRONTEND_URL="https://station.bungendorerfs.org"
```

## Verification Steps

After setting environment variables and restarting:

### 1. Check Health Endpoint
```bash
curl https://station.bungendorerfs.org/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-15T...",
  "database": "mongodb",
  "environment": "production"
}
```

**If you see `"database": "in-memory"`**, the `MONGODB_URI` is not set correctly.

### 2. Check Status Endpoint
```bash
curl https://station.bungendorerfs.org/api/status
```

Expected response:
```json
{
  "status": "ok",
  "databaseType": "mongodb",
  "isProduction": true,
  "usingInMemory": false,
  "timestamp": "2025-11-15T..."
}
```

### 3. Check Members Count
```bash
curl https://station.bungendorerfs.org/api/members | jq '. | length'
```

Expected: **104** (not 40)

### 4. Verify Real Members
```bash
curl https://station.bungendorerfs.org/api/members | jq '.[0]'
```

Should show real members like:
- Hayden Johnson (memberNumber: 55131287)
- Callum Ceglinski (memberNumber: 55132754)
- Samuel Clements (memberNumber: 55133249)

**Not** sample members like:
- John Smith
- Sarah Johnson
- Andrew King

## Current Database State

The MongoDB database `StationManager` contains:
- ✅ **Members** collection: 104 real brigade members
- ✅ No lowercase 'members' collection (cleaned up)
- ✅ Members sorted by 6-month activity (implemented in code)

Collections include: Members, CheckIns, Events, EventParticipants, Activities, ActiveActivity, Appliances, ChecklistTemplates, CheckRuns, CheckResults

## Troubleshooting

### App Service Logs
Check application logs in Azure Portal:
1. Go to App Service
2. **Monitoring** → **Log stream** or **App Service logs**
3. Look for startup messages:
   - `✅ Server running on port...`
   - `Database: MongoDB/Cosmos DB (persistent)` ← Should see this
   - `Database: In-memory (data will be lost on restart)` ← Should NOT see this

### Common Issues

1. **Still showing in-memory database**
   - Environment variable not saved
   - App Service not restarted after changes
   - Typo in variable name (must be exactly `MONGODB_URI`)

2. **Connection errors**
   - Password not URL-encoded correctly (`@` must be `%40`)
   - Database name case mismatch (must be `StationManager`)
   - Network/firewall blocking connection from Azure

3. **Empty members list**
   - Collection name case mismatch (must be `Members` with capital M)
   - Wrong database name in connection string
   - Check Azure Cosmos DB firewall rules

## Next Steps

1. ✅ Set `MONGODB_URI` environment variable in Azure App Service
2. ✅ Set `NODE_ENV=production`
3. ✅ Set `FRONTEND_URL=https://station.bungendorerfs.org`
4. ✅ Save and restart App Service
5. ✅ Test `/health` endpoint - should show `"database": "mongodb"`
6. ✅ Test `/api/members` - should return 104 members
7. ✅ Hard refresh browser at `https://station.bungendorerfs.org`
8. ✅ Verify real member names appear in UI
