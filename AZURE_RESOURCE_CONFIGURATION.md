# Azure Resource Configuration Guide

This guide helps you configure the RFS Station Manager application with your actual deployed Azure resources.

## Overview

You mentioned that you've deployed **Azure Document DB with MongoDB API**. This is the same as **Azure Cosmos DB with MongoDB API** - they are different names for the same service. "Document DB" was the original name, now officially called "Cosmos DB".

## Your Current Deployment

Based on the GitHub Actions workflow in this repository, your backend is deployed as:
- **Backend App Service**: `bungrfsstation`

You need to provide the names of your other deployed resources.

---

## Step 1: Identify Your Azure Resources

Run these commands to list your deployed Azure resources:

```bash
# Login to Azure
az login

# List your resource groups
az group list --output table

# List resources in a specific resource group (replace with your group name)
az resource list --resource-group <your-resource-group> --output table
```

You should see resources similar to:
- **Resource Group**: (e.g., `rfs-station-manager`)
- **App Service**: `bungrfsstation` (confirmed from GitHub Actions)
- **Azure Cosmos DB (Document DB)**: (e.g., `rfs-station-db` or your custom name)
- **App Service Plan**: (e.g., `rfs-station-plan`)
- **Static Web App** (if deployed): (e.g., `rfs-station-frontend`)

---

## Step 2: Get Your Cosmos DB Connection String

Once you know your Cosmos DB (Document DB) name and resource group:

```bash
# Replace with your actual names
COSMOS_DB_NAME="<your-cosmos-db-name>"
RESOURCE_GROUP="<your-resource-group>"

# Get connection string
az cosmosdb keys list \
  --name $COSMOS_DB_NAME \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

Save this connection string - you'll need it in the next step.

---

## Step 3: Configure Backend Environment Variables

Set the required environment variables in your App Service:

```bash
# Replace with your actual values
APP_NAME="bungrfsstation"
RESOURCE_GROUP="<your-resource-group>"
COSMOS_CONNECTION_STRING="<your-connection-string-from-step-2>"
FRONTEND_URL="<your-frontend-url>"  # e.g., https://your-frontend.azurestaticapps.net

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    MONGODB_URI="$COSMOS_CONNECTION_STRING" \
    FRONTEND_URL="$FRONTEND_URL"
```

**Required Environment Variables:**
- `PORT`: Must be `8080` for Azure App Service
- `NODE_ENV`: Set to `production`
- `MONGODB_URI`: Your Azure Cosmos DB (Document DB) connection string
- `FRONTEND_URL`: Your frontend URL (for CORS)

---

## Step 4: Ensure WebSockets Are Enabled

The application requires WebSocket support for real-time features:

```bash
APP_NAME="bungrfsstation"
RESOURCE_GROUP="<your-resource-group>"

az webapp config set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --web-sockets-enabled true \
  --always-on true
```

---

## Step 5: Configure Frontend (if needed)

If you're using Azure Static Web Apps for the frontend:

### 5.1 Create `.env.production` file

```bash
cd frontend

cat > .env.production << EOF
VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
EOF
```

### 5.2 Build and Deploy

```bash
# Build
npm run build

# Get deployment token (if using Azure Static Web Apps)
FRONTEND_NAME="<your-static-web-app-name>"
RESOURCE_GROUP="<your-resource-group>"

DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name $FRONTEND_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.apiKey" \
  --output tsv)

# Deploy
npm install -g @azure/static-web-apps-cli
swa deploy ./dist --deployment-token $DEPLOYMENT_TOKEN --env production
```

---

## Step 6: Verify Deployment

### Test Backend

```bash
# Health check
curl https://bungrfsstation.azurewebsites.net/health

# Expected response:
# {"status":"ok","timestamp":"..."}

# Test API endpoints
curl https://bungrfsstation.azurewebsites.net/api/members
curl https://bungrfsstation.azurewebsites.net/api/activities
```

### Test Frontend

1. Open your browser to your frontend URL
2. Check browser console for any errors
3. Verify WebSocket connection is established
4. Test check-in functionality

---

## Troubleshooting

### Backend Returns 500 Error

**Check environment variables:**
```bash
az webapp config appsettings list \
  --name bungrfsstation \
  --resource-group <your-resource-group> \
  --output table
```

Ensure `MONGODB_URI` is set correctly.

### Database Connection Error

**Check Cosmos DB connection:**
1. Verify Cosmos DB (Document DB) is running
2. Verify connection string is correct
3. Check Cosmos DB firewall settings (should allow Azure services)

**View backend logs:**
```bash
az webapp log tail \
  --name bungrfsstation \
  --resource-group <your-resource-group>
```

### WebSocket Connection Fails

**Ensure WebSockets are enabled:**
```bash
az webapp config show \
  --name bungrfsstation \
  --resource-group <your-resource-group> \
  --query "webSocketsEnabled"
```

Should return `true`.

---

## Quick Reference

### Your Resources (Fill in your actual names):

| Resource Type | Resource Name | URL/Connection |
|---------------|---------------|----------------|
| Resource Group | `________________` | N/A |
| App Service | `bungrfsstation` | https://bungrfsstation.azurewebsites.net |
| Cosmos DB (Document DB) | `________________` | Connection string from Azure |
| App Service Plan | `________________` | N/A |
| Static Web App | `________________` | https://____________.azurestaticapps.net |

### Environment Variables Checklist:

Backend (`bungrfsstation`):
- [ ] `PORT=8080`
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI=<your-cosmos-db-connection-string>`
- [ ] `FRONTEND_URL=<your-frontend-url>`

Frontend (`.env.production`):
- [ ] `VITE_API_URL=https://bungrfsstation.azurewebsites.net/api`
- [ ] `VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net`

---

## Additional Resources

- **Main Deployment Guide**: [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)
- **API Documentation**: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- **Getting Started (Local Dev)**: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

---

## Need Help?

If you're missing resource names from your deployment, you can:

1. Check the Azure Portal: https://portal.azure.com
2. Look at your resource group to see all deployed resources
3. Check the CSV file you mentioned in the issue (if you have it handy, share the resource names)

Once you have the resource names, fill them in the "Quick Reference" table above and use them in the configuration commands.
