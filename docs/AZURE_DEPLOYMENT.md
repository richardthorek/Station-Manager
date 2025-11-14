# Azure Deployment Guide

This guide provides step-by-step instructions for deploying the RFS Station Manager application to Azure.

> **📋 NEW: Budget-Friendly Deployment Options**  
> For a comprehensive analysis of **cost-optimized deployment architectures** (including $0-5/month options), see the [Azure Budget Deployment Plan](./AZURE_DEPLOYMENT_BUDGET_PLAN.md).  
> This guide covers the traditional App Service approach. For lower costs, consider **Azure Container Apps** (see budget plan).

## Architecture Overview

The application uses:
- **Azure Static Web Apps** for hosting the React frontend
- **Azure App Service** for the Node.js backend with Socket.io (**~$13/month**)
- **Azure Container Apps** for the backend (**$0-5/month alternative - see budget plan**)
- **Azure Table Storage** for data persistence (recommended for budget)
- **Azure Cosmos DB** (alternative option, free tier available)
- **Azure Application Insights** for monitoring (optional)

## Prerequisites

1. Azure account with an active subscription
2. Azure CLI installed locally
3. Node.js 18+ and npm installed
4. Git installed

## Option 1: Deploy Backend to Azure App Service (Recommended for WebSockets)

### Step 1: Create an Azure App Service

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Create a resource group
az group create --name rfs-station-manager --location australiaeast

# Create an App Service plan (B1 tier for low budget)
az appservice plan create \
  --name rfs-station-plan \
  --resource-group rfs-station-manager \
  --sku B1 \
  --is-linux

# Create the web app
az webapp create \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --plan rfs-station-plan \
  --runtime "NODE|18-lts"
```

### Step 2: Configure App Service Settings

```bash
# Enable WebSockets
az webapp config set \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --web-sockets-enabled true

# Set environment variables
az webapp config appsettings set \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --settings \
    PORT=8080 \
    FRONTEND_URL="https://YOUR_STATIC_WEB_APP_URL"
```

### Step 3: Deploy Backend Code

```bash
# From the backend directory
cd backend

# Create a deployment package
npm install --production
npm run build

# Create a zip file for deployment
zip -r deploy.zip dist node_modules package.json

# Deploy to App Service
az webapp deployment source config-zip \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --src deploy.zip
```

Your backend will be available at: `https://rfs-station-backend.azurewebsites.net`

## Option 2: Deploy Frontend to Azure Static Web Apps

### Step 1: Build the Frontend

```bash
cd frontend

# Create production build
npm run build
```

### Step 2: Deploy to Static Web Apps

```bash
# Create a Static Web App
az staticwebapp create \
  --name rfs-station-frontend \
  --resource-group rfs-station-manager \
  --location australiaeast

# Get the deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name rfs-station-frontend \
  --resource-group rfs-station-manager \
  --query "properties.apiKey" -o tsv)

# Deploy using Azure CLI (or use GitHub Actions)
# Install the SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production
```

### Step 3: Configure Frontend Environment Variables

In your Static Web App settings, add:

```
VITE_API_URL=https://rfs-station-backend.azurewebsites.net/api
VITE_SOCKET_URL=https://rfs-station-backend.azurewebsites.net
```

## Option 3: Set Up Azure Cosmos DB (Optional - for production data)

### Step 1: Create Cosmos DB Account

```bash
# Create Cosmos DB account with Table API
az cosmosdb create \
  --name rfs-station-db \
  --resource-group rfs-station-manager \
  --kind GlobalDocumentDB \
  --locations regionName=australiaeast failoverPriority=0 \
  --default-consistency-level Session \
  --enable-free-tier true

# Get the connection string
az cosmosdb keys list \
  --name rfs-station-db \
  --resource-group rfs-station-manager \
  --type connection-strings
```

### Step 2: Update Backend to Use Cosmos DB

Add to your App Service configuration:

```bash
az webapp config appsettings set \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --settings \
    COSMOS_DB_ENDPOINT="https://rfs-station-db.documents.azure.com:443/" \
    COSMOS_DB_KEY="YOUR_PRIMARY_KEY" \
    COSMOS_DB_DATABASE="StationManager"
```

## Option 4: Set Up Azure Table Storage (Budget-Friendly Alternative)

### Step 1: Create Storage Account

```bash
# Create storage account
az storage account create \
  --name rfsstationstorage \
  --resource-group rfs-station-manager \
  --location australiaeast \
  --sku Standard_LRS \
  --kind StorageV2

# Get connection string
az storage account show-connection-string \
  --name rfsstationstorage \
  --resource-group rfs-station-manager
```

### Step 2: Create Tables

```bash
# Set the connection string
CONNECTION_STRING="YOUR_CONNECTION_STRING"

# Create tables
az storage table create --name Members --connection-string $CONNECTION_STRING
az storage table create --name Activities --connection-string $CONNECTION_STRING
az storage table create --name CheckIns --connection-string $CONNECTION_STRING
az storage table create --name ActiveActivity --connection-string $CONNECTION_STRING
```

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    # Deploy Backend
    - name: Setup Node.js
      uses: actions/setup-node@v2
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
        app-name: rfs-station-backend
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: backend
    
    # Deploy Frontend
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

## Cost Estimation (Monthly)

For a volunteer organization with low traffic:

- **App Service (B1)**: ~$13 AUD/month
- **Static Web Apps (Free tier)**: $0
- **Cosmos DB (Free tier)**: $0 (first 1000 RU/s and 25GB)
- **Table Storage**: < $1 AUD/month
- **Total**: ~$13-15 AUD/month

## Monitoring and Maintenance

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app rfs-station-insights \
  --location australiaeast \
  --resource-group rfs-station-manager \
  --application-type web

# Link to App Service
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app rfs-station-insights \
  --resource-group rfs-station-manager \
  --query instrumentationKey -o tsv)

az webapp config appsettings set \
  --name rfs-station-backend \
  --resource-group rfs-station-manager \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

### View Logs

```bash
# Stream logs from App Service
az webapp log tail \
  --name rfs-station-backend \
  --resource-group rfs-station-manager
```

## Scaling Considerations

As usage grows, you can:

1. **Scale Up**: Move to higher-tier App Service plans
2. **Scale Out**: Add more instances
3. **Add CDN**: Use Azure CDN for static assets
4. **Add Redis**: Use Azure Cache for Redis for session management

## Security Best Practices

1. Enable HTTPS only
2. Configure CORS properly
3. Use Managed Identity for Azure resource access
4. Enable Azure DDoS Protection
5. Regular security updates
6. Use Azure Key Vault for secrets

## Troubleshooting

### WebSocket Connection Issues
- Verify WebSockets are enabled in App Service
- Check CORS configuration
- Ensure frontend is using WSS (not WS) in production

### Database Connection Issues
- Verify connection strings are correct
- Check firewall rules in Cosmos DB/Storage
- Ensure proper permissions are set

## Support

For issues or questions:
- Check Azure Service Health
- Review Application Insights logs
- Contact Azure Support if needed

---

## 💰 Cost-Saving Alternative: Azure Container Apps

This guide documents the **traditional Azure App Service deployment** (~$13/month).

For a **budget-friendly alternative** that costs **$0-5/month**:
- See the [Azure Budget Deployment Plan](./AZURE_DEPLOYMENT_BUDGET_PLAN.md)
- Uses **Azure Container Apps** instead of App Service
- Supports WebSockets/Socket.io (no code changes needed)
- Includes scale-to-zero for cost savings
- Production-ready architecture

**Cost Comparison:**
- **App Service (this guide):** $13-15 AUD/month
- **Container Apps (budget plan):** $0-5 AUD/month
- **Savings:** Up to $156 AUD/year

Choose App Service if you need:
- Zero cold starts (instant response 24/7)
- Simplest deployment process
- Predictable fixed costs

Choose Container Apps if you want:
- Lowest possible cost
- Serverless architecture
- Can tolerate 2-5 second cold start after idle periods

**📖 Read the full analysis:** [Azure Budget Deployment Plan](./AZURE_DEPLOYMENT_BUDGET_PLAN.md)

