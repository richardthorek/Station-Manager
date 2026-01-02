# Azure Static Web App Setup Guide

This guide covers setting up the RFS Station Manager as an Azure Static Web App with the backend remaining on Azure App Service.

## Architecture Overview

The application uses a **Hybrid Architecture**:

```
┌─────────────────────────────┐
│  Azure Static Web Apps      │ ← React Frontend (FREE)
│  (Static Content + CDN)     │   - Vite build output
└──────────────┬──────────────┘
               │
               │ HTTPS + WSS (WebSocket Secure)
               │
┌──────────────▼──────────────┐
│  Azure App Service          │ ← Express + Socket.io Backend
│  (bungrfsstation)           │   - API endpoints
│  - WebSocket: ON            │   - Real-time sync
│  - Always On: ON            │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Azure Cosmos DB            │ ← MongoDB API
│  (Document DB)              │   - Data persistence
└─────────────────────────────┘
```

**Why this architecture?**
- Azure Static Web Apps' managed Functions **do not support WebSockets**
- Our application requires Socket.io for real-time sign-in synchronization
- This hybrid approach preserves all functionality while gaining Static Web App benefits

## Prerequisites

- Azure account with active subscription
- Azure CLI installed ([Install guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli))
- Node.js 22+ and npm
- Git
- Existing Azure App Service deployment (bungrfsstation)
- Azure Cosmos DB (MongoDB API) configured

## Part 1: Frontend Preparation

### 1.1 Verify Frontend Build

```bash
cd frontend
npm install
npm run build
```

**Expected output**: `dist/` folder with:
- `index.html`
- `assets/` folder with bundled JS/CSS
- Public assets

### 1.2 Test Production Build Locally

```bash
npm run preview
```

Visit `http://localhost:4173` and verify:
- All routes work (/, /signin, /profile/:id, /truckcheck)
- Assets load correctly
- No console errors

### 1.3 Update Frontend Environment Variables

The frontend needs to know where the backend API is located.

**For Local Development** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

**For Production** (Set in Azure Static Web App):
```env
VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
```

**Important**: These will be set in Azure Static Web App configuration, not in `.env` file.

## Part 2: Backend Configuration

### 2.1 Update CORS Settings

The backend needs to allow requests from the Static Web App domain.

**File**: `backend/src/index.ts`

Update the CORS configuration to include your Static Web App URL:

```typescript
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://<your-app-name>.azurestaticapps.net', // Add your Static Web App URL
  'http://localhost:4280' // SWA CLI local testing
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Socket.io CORS
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

### 2.2 Set Backend Environment Variables

In Azure App Service (bungrfsstation), ensure these are set:

```bash
az webapp config appsettings set \
  --name bungrfsstation \
  --resource-group <your-resource-group> \
  --settings \
    FRONTEND_URL="https://<your-app-name>.azurestaticapps.net" \
    PORT=8080 \
    NODE_ENV=production \
    MONGODB_URI="<your-cosmos-db-connection-string>"
```

**Or via Azure Portal**:
1. Navigate to your App Service (bungrfsstation)
2. Go to **Configuration** → **Application settings**
3. Add/Update:
   - `FRONTEND_URL`: `https://<your-app-name>.azurestaticapps.net`
   - `PORT`: `8080`
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: Your Cosmos DB connection string

### 2.3 Verify App Service WebSocket Settings

1. Go to Azure Portal → Your App Service (bungrfsstation)
2. Navigate to **Configuration** → **General settings**
3. Ensure:
   - **Web sockets**: ON ✅
   - **Always On**: ON ✅
   - **ARR Affinity**: ON ✅

## Part 3: Azure Static Web App Creation

### 3.1 Create Static Web App via Portal

1. **Sign in to Azure Portal**: https://portal.azure.com
2. Click **Create a resource**
3. Search for "Static Web Apps"
4. Click **Create**

**Configuration**:
- **Subscription**: Your subscription
- **Resource Group**: Same as your App Service (or new one)
- **Name**: Choose a name (e.g., `rfs-station-manager`)
- **Plan type**: Free (for production) or Standard (if needed)
- **Region**: Choose closest to your users (e.g., Australia East)

**Deployment Details**:
- **Source**: GitHub
- **Organization**: Your GitHub account
- **Repository**: `richardthorek/Station-Manager`
- **Branch**: `main` (or your production branch)

**Build Details**:
- **Build Presets**: React
- **App location**: `/frontend`
- **Api location**: (Leave empty - we're using App Service)
- **Output location**: `dist`

**Review + create** → **Create**

### 3.2 Retrieve Static Web App URL

After creation:
1. Go to your Static Web App resource
2. Note the **URL**: `https://<your-app-name>.azurestaticapps.net`
3. This is your frontend URL

### 3.3 Configure Environment Variables

In Azure Static Web App:
1. Go to **Configuration** → **Application settings**
2. Add these variables:

```
VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
```

**Important**: These are build-time variables. After adding them, you need to trigger a new deployment.

### 3.4 Trigger Deployment

Azure Static Web Apps automatically deploys from GitHub. The workflow file was created during setup.

**Check deployment**:
1. Go to your GitHub repository
2. Navigate to **Actions** tab
3. You should see a workflow run for "Azure Static Web Apps CI/CD"
4. Wait for it to complete (usually 2-5 minutes)

**Manually trigger** (if needed):
```bash
git commit --allow-empty -m "Trigger Static Web App deployment"
git push
```

## Part 4: Local Development with SWA CLI

### 4.1 Install Azure Static Web Apps CLI

```bash
npm install -g @azure/static-web-apps-cli
```

### 4.2 Local Testing Workflow

**Terminal 1 - Start Backend**:
```bash
cd backend
npm run dev
# Backend runs on http://localhost:3000
```

**Terminal 2 - Start Frontend with SWA CLI**:
```bash
# From repository root
swa start frontend --api-location ""
# Frontend runs on http://localhost:4280
# API proxied to http://localhost:3000
```

**Access the app**: http://localhost:4280

### 4.3 Test Local Setup

1. Navigate to http://localhost:4280/signin
2. Check browser console - verify no CORS errors
3. Test member check-in
4. Open a second browser tab
5. Verify real-time updates appear in both tabs
6. Check WebSocket connection status indicator

## Part 5: Testing and Verification

### 5.1 Production Testing Checklist

After deployment, test the following:

**Basic Connectivity**:
- [ ] Static Web App URL loads: `https://<your-app-name>.azurestaticapps.net`
- [ ] All routes work: `/`, `/signin`, `/profile/test`, `/truckcheck`
- [ ] No 404 errors for routes (SPA fallback working)
- [ ] Assets load from CDN
- [ ] No console errors related to CORS

**API Connectivity**:
- [ ] API calls reach backend (check Network tab)
- [ ] Backend responds successfully
- [ ] No CORS errors in console

**WebSocket Connectivity**:
- [ ] WebSocket connection establishes (check console for Socket.io logs)
- [ ] Connection status shows "Connected"
- [ ] No WebSocket errors in console

**Real-Time Features**:
- [ ] Open app in two different browsers/devices
- [ ] Check in a member in Browser A
- [ ] Verify check-in appears in Browser B within 2 seconds
- [ ] Change activity in Browser A
- [ ] Verify activity updates in Browser B
- [ ] Create event in Browser A
- [ ] Verify event appears in Browser B

**Mobile Testing**:
- [ ] Open on mobile device
- [ ] Test touch interactions
- [ ] Verify responsive layout
- [ ] Test QR code scanning (if available)

**Performance**:
- [ ] Page load time < 2 seconds
- [ ] Real-time updates < 2 seconds
- [ ] Check-in response < 500ms
- [ ] No lag or stuttering

### 5.2 Troubleshooting

**Issue: CORS Errors**
```
Access to XMLHttpRequest at 'https://bungrfsstation.azurewebsites.net/api/...' 
from origin 'https://<your-app>.azurestaticapps.net' has been blocked by CORS policy
```

**Solution**:
1. Verify `FRONTEND_URL` is set correctly in App Service
2. Check CORS configuration in `backend/src/index.ts`
3. Redeploy backend after changes
4. Clear browser cache and test again

**Issue: WebSocket Connection Fails**
```
WebSocket connection to 'wss://bungrfsstation.azurewebsites.net/socket.io/...' failed
```

**Solution**:
1. Verify Web Sockets are enabled in App Service
2. Check Socket.io CORS configuration
3. Verify URL is using `wss://` (not `ws://`)
4. Check if ARR Affinity is enabled

**Issue: Real-Time Updates Not Working**
```
Sign-in works but doesn't appear on other devices
```

**Solution**:
1. Check WebSocket connection status in app
2. Verify backend is emitting events (check logs)
3. Check if multiple instances of App Service are running (ARR Affinity)
4. Test with browser dev tools Network tab (WS filter)

**Issue: Environment Variables Not Applied**
```
API calls go to localhost instead of production backend
```

**Solution**:
1. Verify environment variables in Static Web App configuration
2. Trigger a new deployment (variables are build-time)
3. Check build logs for variable values
4. Clear browser cache

## Part 6: GitHub Actions Workflow

Azure Static Web Apps automatically created a workflow file at:
`.github/workflows/azure-static-web-apps-<name>.yml`

**Typical workflow structure**:
```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
      
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          api_location: ""
          output_location: "dist"
```

**Important**: The workflow is automatically configured during Static Web App creation. You don't need to modify it.

## Part 7: Monitoring and Maintenance

### 7.1 Monitor Static Web App

**Via Azure Portal**:
1. Go to your Static Web App resource
2. **Metrics**: View bandwidth, request count
3. **Logs**: Check deployment logs

**Via GitHub Actions**:
1. Go to your repository → **Actions** tab
2. View deployment history
3. Check build logs for errors

### 7.2 Monitor App Service Backend

**Via Azure Portal**:
1. Go to your App Service (bungrfsstation)
2. **Metrics**: Monitor CPU, memory, response time
3. **Log stream**: Real-time logs
4. **Application Insights**: Detailed telemetry (if configured)

### 7.3 Health Checks

**Static Web App Health**:
```bash
curl https://<your-app-name>.azurestaticapps.net
```

**Backend Health**:
```bash
curl https://bungrfsstation.azurewebsites.net/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-02T...",
  "database": "mongodb",
  "environment": "production"
}
```

## Part 8: Cost Optimization

### Current Estimated Costs

- **Azure Static Web Apps**: $0/month (Free tier - 100GB bandwidth)
- **Azure App Service B1**: ~$13 AUD/month
- **Azure Cosmos DB**: $0/month (Free tier) or ~$5-10 for consumption
- **Total**: **~$13-20 AUD/month**

### Cost Optimization Tips

1. **Use Free Tiers**:
   - Static Web Apps: Free tier suitable for most usage
   - Cosmos DB: Free tier (1000 RU/s, 25GB)

2. **Monitor Bandwidth**:
   - Free tier includes 100GB/month
   - Typical usage: 1-5GB/month

3. **Optimize Assets**:
   - Compress images
   - Minify JS/CSS (Vite does this automatically)
   - Use appropriate cache headers

4. **App Service**:
   - B1 tier is adequate for current usage
   - Consider scaling up during high-traffic periods only

## Security Considerations

### Frontend (Static Web App)
- ✅ HTTPS enforced automatically
- ✅ CDN with DDoS protection
- ✅ No secrets in frontend code
- ✅ Environment variables at build time only

### Backend (App Service)
- ✅ HTTPS/WSS enforced in production
- ✅ CORS properly configured
- ✅ Secrets in environment variables
- ✅ Rate limiting on API endpoints
- ✅ Input validation on all endpoints

### Database (Cosmos DB)
- ✅ Connection string in environment variables
- ✅ Network isolation (if configured)
- ✅ Encryption at rest
- ✅ Encryption in transit

## Support and Documentation

**Documentation**:
- **Main README**: `/README.md`
- **Master Plan**: `/MASTER_PLAN.md`
- **API Docs**: `/docs/API_DOCUMENTATION.md`
- **Getting Started**: `/docs/GETTING_STARTED.md`
- **Azure Deployment**: `/docs/AZURE_DEPLOYMENT.md`

**Resources**:
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Socket.io Documentation](https://socket.io/docs/)

**Repository**: https://github.com/richardthorek/Station-Manager

---

## Quick Reference

### Environment Variables Summary

**Frontend (Static Web App)**:
```
VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
```

**Backend (App Service)**:
```
FRONTEND_URL=https://<your-app-name>.azurestaticapps.net
PORT=8080
NODE_ENV=production
MONGODB_URI=<cosmos-db-connection-string>
```

### URLs

- **Frontend (Prod)**: `https://<your-app-name>.azurestaticapps.net`
- **Backend (Prod)**: `https://bungrfsstation.azurewebsites.net`
- **Frontend (Local)**: `http://localhost:4280` (SWA CLI)
- **Backend (Local)**: `http://localhost:3000`

### Key Commands

```bash
# Local development
cd backend && npm run dev              # Start backend
swa start frontend --api-location ""   # Start frontend with SWA CLI

# Build
cd frontend && npm run build           # Build frontend
cd backend && npm run build            # Build backend

# Deploy
git push                               # Triggers Static Web App deployment
az webapp deploy ...                   # Deploy backend (if needed)

# Test
npm run lint                           # Lint frontend
curl https://bungrfsstation.azurewebsites.net/health  # Backend health
```

---

**Setup Complete!** 🎉

Your RFS Station Manager is now running as an Azure Static Web App with a Node.js backend on Azure App Service, maintaining full real-time functionality via Socket.io.
