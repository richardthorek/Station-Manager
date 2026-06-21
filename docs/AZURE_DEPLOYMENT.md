# Azure Deployment Guide

This guide provides step-by-step instructions for deploying the RFS Station
Manager application to Azure using **Azure App Service** (Linux) and **Azure
Table Storage**.

> **Database note (June 2026):** The application uses **Azure Table Storage**
> for persistence in production — **not** Cosmos DB or MongoDB. Table Storage is
> selected at runtime when `USE_TABLE_STORAGE=true` and
> `AZURE_STORAGE_CONNECTION_STRING` is set; otherwise the backend falls back to
> an **in-memory** store (used for local dev and the test suite). Earlier
> revisions of this guide recommended Cosmos DB / MongoDB — that guidance is
> obsolete and has been removed.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Azure App Service (B1, Linux)              │  ← Single deployment
│  bungrfs-linux                              │
│   - Express 5 + Socket.io (API + real-time) │
│   - Serves React SPA            at  /        │
│   - Serves AAR Studio bundle    at  /aar     │
│   - WebSocket Enabled, Always On            │
└───────────────────────┬─────────────────────┘
                        │
┌───────────────────────▼─────────────────────┐
│ Azure Storage Account                       │  ← Data Persistence
│  - Table Storage (members, activities,      │
│    check-ins, events, stations, truck       │
│    checks, admin users, organizations,      │
│    usage records)                           │
│  - Blob Storage (truck-check photos)        │
└─────────────────────────────────────────────┘
```

The backend is a **single App Service** that serves both frontends from one
origin: the React SPA at `/` and the no-build AAR Studio sub-app at `/aar`. There
is no separate Static Web App in the current architecture.

### Components
- **Azure App Service (B1 tier, Linux)** - Hosts the Node.js backend (Express +
  Socket.io) **and** serves both frontends (`frontend/dist` at `/`, `aar-studio/`
  at `/aar`). Deployed as `bungrfs-linux`.
- **Azure Storage Account** - Provides both **Table Storage** (all application
  data) and **Blob Storage** (truck-check / appliance photos). One account
  serves both.
- **Azure Application Insights** - Monitoring and diagnostics (optional).

### Monthly Cost Estimate
- **App Service B1:** ~$13 AUD/month (1 core, 1.75GB RAM, always-on)
- **Azure Storage (Table + Blob):** ~$0.10-2/month typical usage
- **Application Insights:** $0 within free ingestion quota (optional)
- **TOTAL:** **~$13-15 AUD/month**

> **💰 Why Table Storage:** No RU management, straightforward per-transaction
> pricing, reuses the same storage account as blob photos, and costs
> $0.10-2/month vs $0.50-3/month for Cosmos DB Serverless. This is the shipped
> production database.

---

## Prerequisites

1. Azure account with an active subscription ([Create free account](https://azure.microsoft.com/free/))
2. Azure CLI installed locally ([Install guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli))
3. Node.js 22.x and npm ≥ 10 installed
4. Git installed

---

## Environment Variable Reference

These are the **real** environment variables read by `backend/src/`. Set the
required ones on the App Service; the rest are optional and feature-dependent.
Frontend (`VITE_*`) vars are build-time only — they are baked into
`frontend/dist` at build time, not read by the running App Service.

### Core (app + auth)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | yes (prod) | App Service expects `8080`. |
| `NODE_ENV` | yes (prod) | Set to `production`. |
| `FRONTEND_URL` | — | Single allowed origin (legacy; superseded by `FRONTEND_URLS`). |
| `FRONTEND_URLS` | yes (prod) | Comma-separated allowed CORS origins. **Must include the prod origin** or CORS falls back to `localhost` and blocks everything. Used by both Express and Socket.io. |
| `REQUIRE_AUTH` | — | `true` to require admin JWT for protected routes. |
| `JWT_SECRET` | yes (prod) | Signing secret for JWTs. Defaults to a dev secret — **must** be overridden in production. |
| `JWT_EXPIRY` | — | Token lifetime (default `24h`). |
| `DEFAULT_ADMIN_USERNAME` | — | Seed admin username (default `admin`). |
| `DEFAULT_ADMIN_PASSWORD` | recommended | Seed admin password. Change before going live. |

### Database (Table Storage)

| Variable | Required | Notes |
|---|---|---|
| `USE_TABLE_STORAGE` | yes (prod) | `true` selects Table Storage; otherwise in-memory. |
| `AZURE_STORAGE_CONNECTION_STRING` | yes (prod) | Storage account connection string (Table + Blob). |
| `AZURE_STORAGE_REFERENCE_CONTAINER` | — | Blob container for reference images. |
| `AZURE_STORAGE_RESULT_CONTAINER` | — | Blob container for result/photo uploads. |
| `TABLE_STORAGE_TABLE_PREFIX` | — | Prefix for table names (multi-env separation). |
| `TABLE_STORAGE_TABLE_SUFFIX` | — | Suffix for table names (test isolation, e.g. `Test`). |
| `DEMO_USE_TABLE_STORAGE` | — | Persist the demo station in Table Storage instead of memory. |

### SaaS / entitlements

| Variable | Required | Notes |
|---|---|---|
| `ENABLE_ENTITLEMENTS` | — | Default **ON**. Set `false` only for local dev. Never disable in production. |
| `ENABLE_DATA_PROTECTION` | — | `true` requires a JWT or brigade token on data endpoints. |

### Stripe billing

| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | for billing | Stripe API secret key. |
| `STRIPE_WEBHOOK_SECRET` | for billing | Verifies `POST /api/billing/webhook` signatures. |
| `STRIPE_PRICE_BASIC_MONTHLY` | for billing | Stripe price ID. |
| `STRIPE_PRICE_BASIC_ANNUAL` | for billing | Stripe price ID. |
| `STRIPE_PRICE_AI_MONTHLY` | for billing | Stripe price ID. |
| `STRIPE_PRICE_AI_ANNUAL` | for billing | Stripe price ID. |
| `STRIPE_METERED_USAGE_ENABLED` | — | Toggle metered AI-usage reporting to Stripe. |
| `STRIPE_AI_METER_EVENT` | — | Stripe billing-meter event name for AI usage. |
| `APP_URL` | for billing | Public app URL (used for Checkout/Portal return URLs). |

### AI gateway (server-side AI)

| Variable | Required | Notes |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | for AI | Azure OpenAI resource endpoint. |
| `AZURE_OPENAI_KEY` | for AI | Azure OpenAI API key. |
| `AZURE_OPENAI_DEPLOYMENT_CHAT` | for AI | Deployment name for chat completions. |
| `AZURE_OPENAI_DEPLOYMENT_REPORT` | for AI | Deployment name for report generation. |
| `AZURE_OPENAI_API_VERSION` | for AI | Azure OpenAI API version. |
| `AZURE_SPEECH_KEY` | for AI speech | Azure Speech key (short-lived token vending). |
| `AZURE_SPEECH_REGION` | for AI speech | Azure Speech region. |

### AAR Studio

| Variable | Required | Notes |
|---|---|---|
| `AAR_STUDIO_PATH` | — | Override path to the `aar-studio/` bundle. Defaults to the bundled copy beside `dist`. |

### Rate limiting

| Variable | Required | Notes |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | — | Rate-limit window in ms. |
| `RATE_LIMIT_API_MAX` | — | Max API requests per window. |
| `RATE_LIMIT_AUTH_MAX` | — | Max auth requests per window. |

### Monitoring / other

| Variable | Required | Notes |
|---|---|---|
| `AZURE_APP_INSIGHTS_CONNECTION_STRING` | — | Application Insights connection string. |
| `EVENT_EXPIRY_HOURS` | — | Hours before events auto-expire / roll over. |

### Frontend (Vite, build-time only)

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Backend API base URL. |
| `VITE_SOCKET_URL` | Socket.io URL. |
| `VITE_SANTA_RUN_URL` | Link target for the Fire Santa Run sibling app. |
| `VITE_FIREBREAK_URL` | Link target for the Fire Break Calculator sibling app. |

---

## Dual-Frontend Serving & Deployment Packaging

This is a **monorepo deployed as a single App Service**. The backend serves
everything from one origin:

- **React SPA** mounted at `/` from `frontend/dist`.
- **AAR Studio** (no-build vanilla HTML/ES modules) mounted at `/aar` from the
  `aar-studio/` bundle (path overridable via `AAR_STUDIO_PATH`, guarded by
  `fs.existsSync`).
- **API + Socket.io** under `/api` and the WebSocket upgrade path.

The CI/CD deployment package (`.github/workflows/ci-cd.yml`, "Create deployment
package" step) bundles **three directories** into one deploy zip:

1. `backend/dist` — compiled server.
2. `frontend/dist` — built React SPA.
3. `aar-studio/` — the AAR Studio sub-app (served as-is, no build step).

The SPA-fallback route in `backend/src/index.ts` excludes `/api`, `/assets`, and
`/aar` so those paths are not swallowed by the React shell. See the "Multi-app
structure & integration seams" section of `CLAUDE.md` for the matching
service-worker denylist and scoped `/aar` CSP override.

---

## Table Storage Deployment

**Status:** ✅ Shipped (production database)

### Why Table Storage?

- **Lower Cost:** $0.10-2/month per station.
- **Same Storage Account:** Reuses the existing blob storage account (truck-check
  photos) — no new resource.
- **Simplicity:** No RU management, straightforward per-transaction pricing.
- **Dev parity:** Omitting `USE_TABLE_STORAGE` falls back to the in-memory store
  for local dev and tests.

### Table Storage Setup

#### Option 1: Use Existing Storage Account (Recommended)

If you already have a storage account for blob storage (appliance photos):

```bash
# Get your existing storage account connection string
STORAGE_ACCOUNT_NAME="<your-storage-account-name>"
RESOURCE_GROUP="<your-resource-group>"

az storage account show-connection-string \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --output tsv
```

#### Option 2: Create New Storage Account

If you don't have a storage account yet:

```bash
# Variables
RESOURCE_GROUP="rg-station-manager"
STORAGE_ACCOUNT_NAME="stationstorageXXXXX"  # Must be globally unique, lowercase, no hyphens
LOCATION="australiaeast"

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get connection string
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --output tsv
```

#### Configure App Service for Table Storage

```bash
# Variables
APP_NAME="bungrfsstation"
RESOURCE_GROUP="<your-resource-group>"
STORAGE_CONNECTION_STRING="<your-storage-connection-string>"
FRONTEND_URL="<your-frontend-url>"

# Set environment variables
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    USE_TABLE_STORAGE=true \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING" \
    FRONTEND_URLS="$FRONTEND_URL" \
    JWT_SECRET="$(openssl rand -base64 32)"
```

> Set `FRONTEND_URLS` to the **comma-separated** list of allowed origins (the
> public app origin must be present). `FRONTEND_URL` is still read as a
> single-origin fallback but `FRONTEND_URLS` is preferred.

#### Verify Table Storage Connection

After deployment, check the application logs:

```bash
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP
```

Look for:
```
✅ Connected to Azure Table Storage
✅ Connected to Table Storage for Truck Checks
```

#### View Tables in Azure Portal

1. Go to Azure Portal → Your Storage Account
2. Navigate to "Tables" in the left menu
3. You should see tables: Members, Activities, Events, EventParticipants, etc.

#### Cost Monitoring

```bash
# View storage account metrics
az monitor metrics list \
  --resource "/subscriptions/<sub-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT_NAME" \
  --metric "UsedCapacity" \
  --interval PT1H
```

Expected costs:
- **Storage:** $0.03/GB/month (typically < 1GB = $0.03)
- **Transactions:** $0.00045 per 10K transactions (typically 100-500K/month = $0.05-0.23)
- **Total:** $0.08-0.26/month per station

### Fall Back to In-Memory (dev only)

To run without Table Storage (for example, a throwaway test instance), unset
`USE_TABLE_STORAGE` (or set it to `false`). The backend then uses the in-memory
store. **Do not** do this in production — data will not persist across restarts.

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings USE_TABLE_STORAGE=false

# Restart app
az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP
```

---

## Using Your Deployed Resources

If you've already deployed Azure resources, you can configure this application to use them:

### Environment Variables to Set

For the **App Service** (e.g., `bungrfs-linux`), configure at minimum:

```bash
PORT=8080
NODE_ENV=production
USE_TABLE_STORAGE=true
AZURE_STORAGE_CONNECTION_STRING=<your-storage-connection-string>
FRONTEND_URLS=<comma-separated-allowed-origins>
JWT_SECRET=<random-secret>
DEFAULT_ADMIN_PASSWORD=<strong-password>
```

See the **Environment Variable Reference** section above for the full set
(SaaS, Stripe, AI gateway, rate limiting, monitoring).

**How to get your storage connection string:**

```bash
az storage account show-connection-string \
  --name <your-storage-account-name> \
  --resource-group <your-resource-group> \
  --output tsv
```

**How to set environment variables in your App Service:**

```bash
APP_NAME="bungrfs-linux"
RESOURCE_GROUP="<your-resource-group>"
STORAGE_CONNECTION_STRING="<your-storage-connection-string>"

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    USE_TABLE_STORAGE=true \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING" \
    FRONTEND_URLS="https://your-app.azurewebsites.net" \
    JWT_SECRET="$(openssl rand -base64 32)"
```

---

## Step 1: Set Up Azure Resources

### 1.1 Login and Configure Azure CLI

```bash
# Login to Azure
az login

# List subscriptions
az account list --output table

# Set your subscription (if you have multiple)
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### 1.2 Create Resource Group

```bash
# Create resource group in Australia East
az group create \
  --name rfs-station-manager \
  --location australiaeast
```

---

## Step 2: Create the Azure Storage Account (Table + Blob)

### 2.1 Create Storage Account

```bash
# One Standard_LRS StorageV2 account serves both Table Storage (data)
# and Blob Storage (truck-check photos).
az storage account create \
  --name stationstorageXXXXX \
  --resource-group rfs-station-manager \
  --location australiaeast \
  --sku Standard_LRS \
  --kind StorageV2
```

**Note:**
- The storage account name must be globally unique, lowercase, no hyphens.
- If you already have a storage account (e.g. for blob photos), reuse it.

### 2.2 Get Connection String

```bash
# Store in a variable for later use
STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --name stationstorageXXXXX \
  --resource-group rfs-station-manager \
  --output tsv)

echo "Connection string captured."
```

**Tables are created automatically** by the backend on first run (members,
activities, check-ins, events, stations, truck checks, admin users,
organizations, usage records).

---

## Step 3: Deploy Backend to Azure App Service

### 3.1 Create App Service Plan

```bash
# Create App Service plan (B1 tier)
az appservice plan create \
  --name rfs-station-plan \
  --resource-group rfs-station-manager \
  --sku B1 \
  --is-linux
```

**B1 Tier Specifications:**
- 1 vCPU core
- 1.75 GB RAM
- ~$13 AUD/month
- Supports WebSockets
- Always-on capability

### 3.2 Create Web App

```bash
# Create the web app
# Example: Using 'bungrfsstation' as the app name
az webapp create \
  --name bungrfsstation \
  --resource-group rfs-station-manager \
  --plan rfs-station-plan \
  --runtime "NODE|18-lts"
```

**Note:** 
- The web app name must be globally unique
- If you've already deployed your App Service (e.g., `bungrfsstation`), use that name instead
- Your app will be accessible at `https://<your-app-name>.azurewebsites.net`

### 3.3 Configure Web App Settings

```bash
# Replace 'bungrfsstation' with your actual App Service name
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

# Enable WebSockets (required for Socket.io)
az webapp config set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --web-sockets-enabled true \
  --always-on true

# Set Node.js version (Node 22.x required)
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    WEBSITE_NODE_DEFAULT_VERSION=22-lts
```

### 3.4 Configure Environment Variables

```bash
# Set backend environment variables
# Replace APP_NAME with your actual App Service name (e.g., bungrfsstation)
# Replace RESOURCE_GROUP with your actual resource group name
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    USE_TABLE_STORAGE=true \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING" \
    FRONTEND_URLS="https://${APP_NAME}.azurewebsites.net" \
    JWT_SECRET="$(openssl rand -base64 32)" \
    DEFAULT_ADMIN_PASSWORD="<strong-password>"
```

**Important:**
- Replace `APP_NAME` and `RESOURCE_GROUP` with your actual deployed resource names.
- Because the backend serves the frontend from the **same origin**, `FRONTEND_URLS`
  is the App Service origin itself.
- `AZURE_STORAGE_CONNECTION_STRING` is your storage account connection string from Step 2.

### 3.5 Build and Deploy the App (backend + both frontends)

Because the single App Service serves both frontends, the deployment package must
bundle **all three** directories: `backend/dist`, `frontend/dist`, and
`aar-studio/`.

```bash
# From the repo root: build backend and frontend
npm run build           # builds backend → backend/dist, then frontend → frontend/dist

# Assemble the deploy zip (mirrors the CI "Create deployment package" step)
zip -r deploy.zip \
  backend/dist \
  backend/node_modules \
  backend/package.json \
  backend/package-lock.json \
  frontend/dist \
  aar-studio

# Deploy to App Service
APP_NAME="bungrfs-linux"
RESOURCE_GROUP="rfs-station-manager"

az webapp deployment source config-zip \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src deploy.zip

rm deploy.zip
```

**Note:** Using GitHub Actions (recommended) automates this — `ci-cd.yml` builds
all three and packages them into one zip. See the CI/CD section below.

### 3.6 Get Backend URL

```bash
# Get the backend URL (replace with your actual App Service name)
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

az webapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query defaultHostName \
  --output tsv
```

Your backend will be available at: `https://<your-app-name>.azurewebsites.net`

Example: `https://bungrfsstation.azurewebsites.net`

### 3.7 Verify Backend Deployment

```bash
# Test health endpoint (replace with your actual App Service name)
curl https://bungrfsstation.azurewebsites.net/health

# Expected response:
# {"status":"ok","timestamp":"2024-11-14T..."}
```

---

## Step 4: Frontends (served by the App Service)

There is **no separate Azure Static Web App**. The same App Service serves the
React SPA at `/` and AAR Studio at `/aar` from the deploy zip built in Step 3.5.
The frontends are built as part of that zip — you do not deploy them separately.

### 4.1 Frontend build-time configuration

The SPA's API/Socket targets are baked in at **build time** via `VITE_*` vars.
Because the backend serves the SPA from the same origin, these can point at the
App Service origin (or be left relative). If you build manually:

```bash
cd frontend
cat > .env.production << EOF
VITE_API_URL=https://bungrfs-linux.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfs-linux.azurewebsites.net
VITE_SANTA_RUN_URL=<fire-santa-run-url>
VITE_FIREBREAK_URL=<fire-break-calculator-url>
EOF
npm run build
```

(In CI this is handled automatically; `VITE_*` vars are set as build env, not as
App Service settings.)

### 4.2 CORS / same-origin note

Because everything is served from one origin, `FRONTEND_URLS` should include that
origin. The CORS origin callback **denies without throwing**
(`callback(null, false)`) — if `FRONTEND_URLS` is wrong it falls back to
`localhost` and blocks every same-origin asset request. After changing it:

```bash
az webapp restart --name bungrfs-linux --resource-group rfs-station-manager
```

---

## Step 5: Optional - Enable Application Insights

### 5.1 Create Application Insights

```bash
# Create Application Insights resource
az monitor app-insights component create \
  --app rfs-station-insights \
  --location australiaeast \
  --resource-group rfs-station-manager \
  --application-type web
```

### 5.2 Link to App Service

```bash
# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app rfs-station-insights \
  --resource-group rfs-station-manager \
  --query instrumentationKey \
  --output tsv)

# Add to App Service (replace with your actual App Service name)
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

CONNECTION_STRING=$(az monitor app-insights component show \
  --app rfs-station-insights \
  --resource-group rfs-station-manager \
  --query connectionString \
  --output tsv)

# The backend reads AZURE_APP_INSIGHTS_CONNECTION_STRING
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    AZURE_APP_INSIGHTS_CONNECTION_STRING="$CONNECTION_STRING"

# Restart to apply
az webapp restart \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP
```

---

## Step 6: Testing

### 6.1 Test Backend API

```bash
# Replace with your actual App Service name
APP_NAME="bungrfsstation"

# Health check
curl https://${APP_NAME}.azurewebsites.net/health

# Get members
curl https://${APP_NAME}.azurewebsites.net/api/members

# Get activities
curl https://${APP_NAME}.azurewebsites.net/api/activities
```

### 6.2 Test Frontends

1. Open your browser to `https://<your-app-name>.azurewebsites.net/` — the React SPA.
2. Open `https://<your-app-name>.azurewebsites.net/aar` — AAR Studio. A blank
   `/aar` page means the service worker served the React shell (denylist
   regression) — see `CLAUDE.md` integration seams.
3. Check browser console for the WebSocket connection.
4. Test check-in functionality.
5. Open in multiple browser windows/tabs to verify real-time sync.

### 6.3 Test Real-Time Sync

1. Open the app in two different browsers/devices
2. Check in a member in one browser
3. Verify the update appears immediately in the other browser
4. Change activity and verify it syncs across devices

---

## Monitoring and Maintenance

### View Application Logs

```bash
# Stream live logs from App Service
# Replace with your actual resource names
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

az webapp log tail \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Download logs
az webapp log download \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --log-file logs.zip
```

### View Storage Account Metrics

```bash
# View storage account capacity/transaction metrics
SUBSCRIPTION_ID="YOUR_SUB"
RESOURCE_GROUP="rfs-station-manager"
STORAGE_ACCOUNT_NAME="stationstorageXXXXX"

az monitor metrics list \
  --resource /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT_NAME \
  --metric "Transactions" \
  --interval PT1H
```

### Browse Table Storage Data

1. Go to [Azure Portal](https://portal.azure.com).
2. Navigate to your **Storage Account** → **Tables** (under Data storage).
3. Browse the tables: Members, Activities, CheckIns, Events, Stations, TruckChecks,
   AdminUsers, Organizations, Usage, etc. (table names may carry your configured
   `TABLE_STORAGE_TABLE_PREFIX`/`TABLE_STORAGE_TABLE_SUFFIX`).

---

## Updating the Application

### Update Backend Code

```bash
cd backend

# Make your code changes
# ...

# Build
npm run build

# Deploy (replace with your actual resource names)
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

zip -r deploy.zip dist node_modules package.json package-lock.json

az webapp deployment source config-zip \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src deploy.zip

rm deploy.zip
```

**Note:** If you're using GitHub Actions, this is automated on every push to main.

### Update Frontend Code

```bash
cd frontend

# Make your code changes
# ...

# Build
npm run build

# Deploy
swa deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production
```

---

## CI/CD with GitHub Actions

The repository deploys via a single workflow, `.github/workflows/ci-cd.yml`. It
runs the full CI gate chain — backend typecheck → backend tests → frontend lint →
frontend typecheck → frontend tests → AAR Studio tests (`node --test`) → build —
and, on `main`, packages **all three** bundles (`backend/dist`, `frontend/dist`,
`aar-studio/`) into one zip and deploys it to the `bungrfs-linux` App Service.

**Key points:**
- One workflow deploys the backend **and** both frontends; there is no separate
  frontend deploy job and no Static Web App.
- Uses Azure OIDC (Workload Identity Federation), not publish profiles.
- The "Create deployment package" step **must** copy `aar-studio/` into the zip —
  if it is dropped, `/aar` 404s. See `CLAUDE.md` integration seams.
- Docs-only changes (`docs/**`, `*.md`) skip the pipeline.
- Post-deployment smoke tests are **disabled** in CI (they need `ts-node`, which
  prod dependencies don't include). See `docs/POST_DEPLOYMENT_TESTING.md`.

---

## Troubleshooting

### WebSocket Connection Fails

**Solutions:**
1. Verify WebSockets are enabled in App Service configuration
2. Check CORS settings match your frontend URL
3. Ensure frontend is using `https://` (not `http://`)
4. Check backend logs for Socket.io connection messages

### Database Connection Errors

**Solutions:**
1. Verify `USE_TABLE_STORAGE=true` is set.
2. Verify `AZURE_STORAGE_CONNECTION_STRING` is correct and not expired.
3. Check the storage account firewall (should allow Azure services / your App Service).
4. Check backend logs for `✅ Connected to Azure Table Storage`. If absent, the
   app silently fell back to the in-memory store (missing/invalid connection string).

### Frontend Shows CORS Errors

**Solutions:**
1. Update `FRONTEND_URLS` (comma-separated) to include the app origin.
2. Restart the App Service after changing settings.
3. Clear browser cache and reload.
4. Remember the CORS origin callback denies without throwing — a wrong
   `FRONTEND_URLS` silently falls back to `localhost` and blocks everything.

### 502 Bad Gateway

**Solutions:**
1. Check backend logs for startup errors
2. Verify `PORT` environment variable is set to `8080`
3. Check that `npm start` script is configured correctly
4. Verify all dependencies were deployed

---

## Security Best Practices

1. **Use HTTPS only** - The App Service uses HTTPS by default.
2. **Set `FRONTEND_URLS` precisely** - Only allow the real app origin(s).
3. **Store secrets in Key Vault** - For production, reference Key Vault from App
   Service settings (`JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `AZURE_OPENAI_KEY`, `AZURE_SPEECH_KEY`, `DEFAULT_ADMIN_PASSWORD`,
   `AZURE_STORAGE_CONNECTION_STRING`). See `docs/SECURITY_DEPLOYMENT_GUIDE.md`.
4. **Keep `ENABLE_ENTITLEMENTS` on in production** - It is default-on; never set
   it `false` in prod (removes all plan/billing enforcement).
5. **Regular updates** - Keep Node.js 22.x and npm packages current.

---

## Cost Optimization

1. **Standard_LRS storage** - Cheapest redundancy tier; sufficient for this workload.
2. **Monitor storage transactions** - The bulk of Table Storage cost is per-transaction.
3. **Use B1 App Service tier** - Lowest cost for production WebSocket support.
4. **Set up budget alerts** - Get notified if costs exceed expectations.

---

## Support and Resources

- **Azure App Service:** https://docs.microsoft.com/en-us/azure/app-service/
- **Azure Table Storage:** https://learn.microsoft.com/en-us/azure/storage/tables/
- **Azure Blob Storage:** https://learn.microsoft.com/en-us/azure/storage/blobs/
- **Socket.io:** https://socket.io/docs/

---

## Summary

You now have a production-ready single-App-Service deployment with:
- ✅ Node.js backend (Express + Socket.io) on Azure App Service (Linux, B1).
- ✅ React SPA served at `/` and AAR Studio served at `/aar` from the same origin.
- ✅ Azure Table Storage for data persistence (Blob Storage for photos).
- ✅ Real-time synchronization via Socket.io (WebSockets enabled).
- ✅ Monthly cost: ~$13-15 AUD.
