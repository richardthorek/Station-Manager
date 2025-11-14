# Azure Deployment Guide

This guide provides step-by-step instructions for deploying the RFS Station Manager application to Azure using **Azure App Service** and **Azure Cosmos DB (Document DB) with MongoDB API**.

> **Note:** Azure Cosmos DB with MongoDB API is also known as Azure Document DB. They are the same service - "Document DB" was the original name, now officially called "Cosmos DB". This guide uses both terms interchangeably.

## Architecture Overview

```
┌──────────────────────────┐
│  Azure Static Web Apps   │  ← React Frontend (Free tier)
│     (Frontend)           │
└────────────┬─────────────┘
             │ HTTP + WebSocket
┌────────────▼─────────────┐
│  Azure App Service (B1)  │  ← Node.js + Express + Socket.io
│   bungrfsstation         │    (Backend API & Real-time)
│   - WebSocket Enabled    │
│   - Always On            │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ Azure Cosmos DB          │  ← Data Persistence
│ (Document DB)            │    (Members, Activities, Check-ins)
│ with MongoDB API         │
│ - Free tier available    │
└──────────────────────────┘
```

### Components
- **Azure Static Web Apps** - Hosts the React frontend (Free tier)
- **Azure App Service (B1 tier)** - Hosts Node.js backend with WebSocket support (deployed as `bungrfsstation`)
- **Azure Cosmos DB (Document DB) with MongoDB API** - NoSQL database with MongoDB compatibility
- **Azure Application Insights** - Monitoring and diagnostics (Optional)

### Monthly Cost Estimate
- **Static Web Apps:** $0 (Free tier - 100GB bandwidth/month)
- **App Service B1:** ~$13 AUD/month (1 core, 1.75GB RAM, always-on)
- **Cosmos DB:** $0 (Free tier - 1000 RU/s, 25GB storage) or ~$5-10 for consumption
- **TOTAL:** **~$13-25 AUD/month**

---

## Prerequisites

1. Azure account with an active subscription ([Create free account](https://azure.microsoft.com/free/))
2. Azure CLI installed locally ([Install guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli))
3. Node.js 18+ and npm installed
4. Git installed

---

## Using Your Deployed Resources

If you've already deployed Azure resources, you can configure this application to use them:

### Environment Variables to Set

For the **Backend App Service** (e.g., `bungrfsstation`), configure these settings:

```bash
# Required Environment Variables
PORT=8080
NODE_ENV=production
MONGODB_URI=<your-cosmos-db-connection-string>
FRONTEND_URL=<your-frontend-url>
```

**How to get your Cosmos DB (Document DB) connection string:**

```bash
# List your Cosmos DB accounts
az cosmosdb list --resource-group <your-resource-group> --output table

# Get connection string (replace with your actual names)
az cosmosdb keys list \
  --name <your-cosmos-db-name> \
  --resource-group <your-resource-group> \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

**How to set environment variables in your App Service:**

```bash
# Replace with your actual resource names
APP_NAME="bungrfsstation"
RESOURCE_GROUP="<your-resource-group>"
COSMOS_CONNECTION_STRING="<your-connection-string>"
FRONTEND_URL="<your-frontend-url>"

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    MONGODB_URI="$COSMOS_CONNECTION_STRING" \
    FRONTEND_URL="$FRONTEND_URL"
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

## Step 2: Create Azure Cosmos DB (Document DB) with MongoDB API

### 2.1 Create Cosmos DB Account

> **Important:** Azure Cosmos DB with MongoDB API is also referred to as "Azure Document DB". This is the same service.

```bash
# Create Azure Cosmos DB (Document DB) account with MongoDB API
az cosmosdb create \
  --name rfs-station-db \
  --resource-group rfs-station-manager \
  --kind MongoDB \
  --locations regionName=australiaeast failoverPriority=0 \
  --default-consistency-level Session \
  --enable-free-tier true \
  --server-version 4.2
```

**Note:** 
- Free tier provides 1000 RU/s and 25GB storage at no cost
- Only one free tier Cosmos DB account is allowed per Azure subscription
- If you've already deployed your Cosmos DB, you can skip this step and use your existing resource name

### 2.2 Get Connection String

```bash
# Get connection string (save this for later)
az cosmosdb keys list \
  --name rfs-station-db \
  --resource-group rfs-station-manager \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv

# Store in variable for later use
COSMOS_CONNECTION_STRING=$(az cosmosdb keys list \
  --name rfs-station-db \
  --resource-group rfs-station-manager \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

echo "Connection string saved to COSMOS_CONNECTION_STRING"
```

**Collections will be created automatically** by the backend application on first run.

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

# Set Node.js version
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    WEBSITE_NODE_DEFAULT_VERSION=18-lts
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
    MONGODB_URI="$COSMOS_CONNECTION_STRING" \
    FRONTEND_URL="https://rfs-station-frontend.azurestaticapps.net" \
    NODE_ENV=production
```

**Important:** 
- Replace `APP_NAME` and `RESOURCE_GROUP` with your actual deployed resource names
- The `FRONTEND_URL` will be updated after deploying the frontend in Step 4
- The `MONGODB_URI` should be your Azure Cosmos DB (Document DB) connection string

### 3.5 Build and Deploy Backend Code

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Create deployment package (excluding dev files)
zip -r deploy.zip dist node_modules package.json package-lock.json

# Deploy to App Service (replace with your actual App Service name)
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"

az webapp deployment source config-zip \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src deploy.zip

# Clean up
rm deploy.zip
```

**Note:** If you're using GitHub Actions (recommended), this step is automated. See the CI/CD section below.

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

## Step 4: Deploy Frontend to Azure Static Web Apps

### 4.1 Create Static Web App

```bash
# Navigate back to root
cd ..

# Create Static Web App
az staticwebapp create \
  --name rfs-station-frontend \
  --resource-group rfs-station-manager \
  --location australiaeast
```

### 4.2 Build Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file for production
# Replace with your actual App Service name
cat > .env.production << EOF
VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
EOF

# Build production bundle
npm run build
```

**Important:** Replace `bungrfsstation` with your actual App Service name.

### 4.3 Deploy Frontend

```bash
# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name rfs-station-frontend \
  --resource-group rfs-station-manager \
  --query "properties.apiKey" \
  --output tsv)

# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production
```

### 4.4 Get Frontend URL

```bash
# Get the frontend URL
az staticwebapp show \
  --name rfs-station-frontend \
  --resource-group rfs-station-manager \
  --query defaultHostname \
  --output tsv
```

Your frontend will be available at: `https://rfs-station-frontend.azurestaticapps.net`

### 4.5 Update Backend CORS Settings

```bash
# Update backend with actual frontend URL
# Replace with your actual resource names
APP_NAME="bungrfsstation"
RESOURCE_GROUP="rfs-station-manager"
FRONTEND_URL="https://rfs-station-frontend.azurestaticapps.net"

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    FRONTEND_URL="$FRONTEND_URL"

# Restart backend to apply settings
az webapp restart \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP
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

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY

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

### 6.2 Test Frontend

1. Open your browser to `https://rfs-station-frontend.azurestaticapps.net`
2. Verify the UI loads correctly
3. Check browser console for WebSocket connection
4. Test check-in functionality
5. Open in multiple browser windows/tabs to verify real-time sync

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

### View Azure Cosmos DB (Document DB) Metrics

```bash
# View Cosmos DB metrics
# Replace YOUR_SUB with your subscription ID
# Replace resource names with your actual deployed resources
SUBSCRIPTION_ID="YOUR_SUB"
RESOURCE_GROUP="rfs-station-manager"
COSMOS_DB_NAME="rfs-station-db"

az monitor metrics list \
  --resource /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DocumentDB/databaseAccounts/$COSMOS_DB_NAME \
  --metric TotalRequests \
  --interval PT1H
```

### Access Azure Cosmos DB (Document DB) Data Explorer

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Cosmos DB (Document DB) account (e.g., `rfs-station-db`)
3. Click **Data Explorer** in the left menu
4. Browse your collections: Members, Activities, CheckIns, ActiveActivity

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

The repository includes a GitHub Actions workflow at `.github/workflows/main_bungrfsstation.yml` that automatically deploys the backend to Azure App Service on every push to main.

**Current Setup:**
- Backend is automatically deployed to `bungrfsstation` App Service
- Uses Azure federated credentials for authentication
- Builds and deploys on every push to main branch

**To set up frontend CI/CD**, create `.github/workflows/azure-frontend-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install and Build Backend
        run: |
          cd backend
          npm ci
          npm run build
      
      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: bungrfsstation  # Replace with your App Service name
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: backend
  
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Deploy to Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "frontend"
          output_location: "dist"
```

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
1. Verify `MONGODB_URI` connection string is correct
2. Check Cosmos DB firewall settings (should allow Azure services)
3. Verify Cosmos DB is using MongoDB API (not SQL API)
4. Check backend logs for MongoDB connection errors

### Frontend Shows CORS Errors

**Solutions:**
1. Update backend `FRONTEND_URL` setting to match your actual frontend URL
2. Restart backend after changing settings
3. Clear browser cache and reload

### 502 Bad Gateway

**Solutions:**
1. Check backend logs for startup errors
2. Verify `PORT` environment variable is set to `8080`
3. Check that `npm start` script is configured correctly
4. Verify all dependencies were deployed

---

## Security Best Practices

1. **Use HTTPS only** - Both services use HTTPS by default
2. **Enable CORS properly** - Only allow your frontend URL
3. **Store secrets in Key Vault** - For production deployments
4. **Enable Azure DDoS Protection** - For public-facing apps
5. **Regular updates** - Keep Node.js and npm packages updated

---

## Cost Optimization

1. **Use Cosmos DB free tier** - 1000 RU/s and 25GB storage at no cost
2. **Monitor RU consumption** - Optimize queries if approaching limit
3. **Use B1 App Service tier** - Lowest cost for production WebSocket support
4. **Set up budget alerts** - Get notified if costs exceed expectations

---

## Support and Resources

- **Azure App Service:** https://docs.microsoft.com/en-us/azure/app-service/
- **Cosmos DB MongoDB API:** https://docs.microsoft.com/en-us/azure/cosmos-db/mongodb/
- **Static Web Apps:** https://docs.microsoft.com/en-us/azure/static-web-apps/
- **Socket.io:** https://socket.io/docs/

---

## Summary

You now have a production-ready deployment with:
- ✅ React frontend on Azure Static Web Apps (Free)
- ✅ Node.js backend on Azure App Service with WebSocket support
- ✅ Cosmos DB with MongoDB API for data persistence
- ✅ Real-time synchronization via Socket.io
- ✅ Monthly cost: ~$13-25 AUD
