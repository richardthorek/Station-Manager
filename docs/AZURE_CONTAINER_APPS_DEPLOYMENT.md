# Azure Container Apps Deployment - Quick Start Guide

This guide provides step-by-step instructions for deploying to **Azure Container Apps** - the **budget-friendly option** ($0-5 AUD/month).

## Why Container Apps?

- **💰 Cost:** $0-5/month vs $13-15/month for App Service
- **✅ WebSocket Support:** Socket.io works without any code changes
- **🚀 Auto-scaling:** From 0 to 300+ instances
- **🎯 Production-ready:** Enterprise-grade reliability

**Trade-off:** 2-5 second cold start after idle periods (acceptable for most volunteer orgs)

## Prerequisites

1. Azure account with active subscription
2. Azure CLI installed ([Install guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli))
3. Docker installed (for local testing)
4. Node.js 18+ and npm

## Option A: Automated Deployment (Recommended)

Use the provided deployment script for easy setup:

```bash
# Navigate to backend directory
cd backend

# Login to Azure
az login

# Run deployment script
./deploy-container-apps.sh
```

The script will:
1. Create resource group
2. Create Azure Container Registry
3. Build and push Docker image
4. Create Container Apps environment
5. Deploy the container
6. Display the backend URL

**Follow the prompts** to configure:
- Azure Storage connection string (for Table Storage)
- Frontend URL (for CORS)

## Option B: Manual Deployment

### Step 1: Create Azure Resources

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="rfs-station-manager"
LOCATION="australiaeast"
ACR_NAME="rfsstationacr"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create Container Registry
az acr create \
  --name $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku Basic \
  --admin-enabled true
```

### Step 2: Build and Push Container

```bash
# Build and push image
cd backend
az acr build \
  --registry $ACR_NAME \
  --image rfs-station-backend:latest \
  --file Dockerfile \
  .
```

### Step 3: Create Storage Account

```bash
# Create storage account
STORAGE_ACCOUNT="rfsstationstorage"

az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Get connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Create tables
az storage table create --name Members --connection-string "$STORAGE_CONNECTION"
az storage table create --name Activities --connection-string "$STORAGE_CONNECTION"
az storage table create --name CheckIns --connection-string "$STORAGE_CONNECTION"
az storage table create --name ActiveActivity --connection-string "$STORAGE_CONNECTION"
```

### Step 4: Deploy Container App

```bash
# Get ACR credentials
ACR_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Create Container Apps environment
az containerapp env create \
  --name rfs-station-env \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Create Container App
az containerapp create \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --environment rfs-station-env \
  --image $ACR_SERVER/rfs-station-backend:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 10 \
  --cpu 0.5 \
  --memory 1Gi \
  --env-vars \
    PORT=3000 \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION" \
    FRONTEND_URL="https://YOUR_FRONTEND_URL"

# Get the backend URL
az containerapp show \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

## Step 5: Deploy Frontend

```bash
cd frontend

# Create production build
npm run build

# Create Static Web App
az staticwebapp create \
  --name rfs-station-frontend \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name rfs-station-frontend \
  --resource-group $RESOURCE_GROUP \
  --query "properties.apiKey" -o tsv)

# Deploy using SWA CLI
npm install -g @azure/static-web-apps-cli
swa deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production
```

## Configuration

### Frontend Environment Variables

Create `.env.production` in frontend directory:

```env
VITE_API_URL=https://YOUR-CONTAINER-APP.australiaeast.azurecontainerapps.io/api
VITE_SOCKET_URL=https://YOUR-CONTAINER-APP.australiaeast.azurecontainerapps.io
```

### Backend Environment Variables

Set in Container App:

```bash
az containerapp update \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    AZURE_STORAGE_CONNECTION_STRING=secretref:storage-connection \
    FRONTEND_URL=https://your-app.azurestaticapps.net \
    PORT=3000
```

## Eliminating Cold Starts (Optional)

If 2-5 second cold starts are unacceptable, set minimum replicas to 1:

```bash
az containerapp update \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1
```

**Cost impact:** +$5-8 AUD/month (still cheaper than App Service)

## Monitoring

### View Logs

```bash
# Live logs
az containerapp logs show \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --follow

# Recent logs
az containerapp logs show \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --tail 100
```

### Application Insights (Optional)

```bash
# Create Application Insights
az monitor app-insights component create \
  --app rfs-station-insights \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Get instrumentation key
INSIGHTS_KEY=$(az monitor app-insights component show \
  --app rfs-station-insights \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv)

# Add to Container App
az containerapp update \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    APPLICATIONINSIGHTS_INSTRUMENTATIONKEY=$INSIGHTS_KEY
```

## Testing

### Health Check

```bash
curl https://YOUR-CONTAINER-APP.australiaeast.azurecontainerapps.io/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-11-14T12:00:00.000Z"
}
```

### WebSocket Test

Open browser console on your frontend and check:
```javascript
// Should see "connected" in console
socket.on('connect', () => console.log('connected'));
```

## Cost Monitoring

View Container Apps usage:

```bash
az monitor metrics list \
  --resource /subscriptions/YOUR-SUB/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/containerApps/rfs-station-backend \
  --metric Requests \
  --start-time 2024-11-01T00:00:00Z
```

## Updating the Application

### Update Backend Code

```bash
cd backend

# Build and push new image
az acr build \
  --registry $ACR_NAME \
  --image rfs-station-backend:latest \
  --file Dockerfile \
  .

# Container App will auto-update with new image
# Or trigger manual update:
az containerapp update \
  --name rfs-station-backend \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_SERVER/rfs-station-backend:latest
```

### Update Frontend

```bash
cd frontend
npm run build

# Redeploy to Static Web Apps
swa deploy ./dist \
  --deployment-token $DEPLOYMENT_TOKEN \
  --env production
```

## Troubleshooting

### Issue: Cold starts too slow
**Solution:** Set min-replicas to 1 (adds ~$5-8/month cost)

### Issue: WebSocket connection fails
**Solutions:**
- Check CORS settings in backend
- Verify frontend is using correct WebSocket URL
- Check Container App ingress settings

### Issue: Database connection errors
**Solutions:**
- Verify Storage connection string is correct
- Check firewall rules on Storage Account
- Ensure tables are created

### Issue: 502 Bad Gateway
**Solutions:**
- Check container logs for startup errors
- Verify PORT environment variable (3000)
- Check health endpoint is responding

## CI/CD with GitHub Actions

See [GitHub Actions deployment guide](./AZURE_DEPLOYMENT.md#cicd-with-github-actions) and adapt for Container Apps.

## Cost Optimization Tips

1. **Use scale-to-zero** (default) for lowest cost
2. **Batch Table Storage operations** to reduce transaction costs
3. **Use Application Insights sampling** to reduce logging costs
4. **Monitor free tier usage** in Azure portal
5. **Set up budget alerts** to avoid surprises

## Next Steps

1. ✅ Deploy backend to Container Apps
2. ✅ Deploy frontend to Static Web Apps
3. ✅ Test real-time sync across multiple devices
4. ✅ Set up monitoring and alerts
5. ✅ Configure custom domain (optional)
6. ✅ Set up CI/CD pipeline (optional)

## Support

- **Container Apps docs:** https://learn.microsoft.com/en-us/azure/container-apps/
- **Table Storage docs:** https://learn.microsoft.com/en-us/azure/storage/tables/
- **Static Web Apps docs:** https://learn.microsoft.com/en-us/azure/static-web-apps/

---

**🎉 Congratulations!** You've deployed a production-ready, budget-friendly real-time application for **$0-5 AUD/month**!
