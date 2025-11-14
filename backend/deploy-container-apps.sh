#!/bin/bash

# Azure Container Apps Deployment Script
# This script deploys the RFS Station Manager backend to Azure Container Apps

set -e  # Exit on error

# Configuration
RESOURCE_GROUP="rfs-station-manager"
LOCATION="australiaeast"
CONTAINER_APP_ENV="rfs-station-env"
CONTAINER_APP_NAME="rfs-station-backend"
ACR_NAME="rfsstationacr"
IMAGE_NAME="rfs-station-backend"
IMAGE_TAG="latest"

echo "🚀 Deploying RFS Station Manager to Azure Container Apps"
echo "=================================================="

# Check if logged in to Azure
echo "Checking Azure login status..."
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

echo "✅ Logged in to Azure"

# Create resource group if it doesn't exist
echo "Creating resource group (if not exists)..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output none

echo "✅ Resource group ready"

# Create Azure Container Registry if it doesn't exist
echo "Creating Azure Container Registry (if not exists)..."
if ! az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    az acr create \
      --name $ACR_NAME \
      --resource-group $RESOURCE_GROUP \
      --sku Basic \
      --admin-enabled true \
      --output none
    echo "✅ Container Registry created"
else
    echo "✅ Container Registry already exists"
fi

# Build and push image to ACR
echo "Building and pushing container image..."
cd "$(dirname "$0")/.."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:$IMAGE_TAG \
  --file Dockerfile \
  . \
  --output table

echo "✅ Image built and pushed"

# Get ACR credentials
ACR_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

# Create Container Apps Environment if it doesn't exist
echo "Creating Container Apps Environment (if not exists)..."
if ! az containerapp env show --name $CONTAINER_APP_ENV --resource-group $RESOURCE_GROUP &> /dev/null; then
    az containerapp env create \
      --name $CONTAINER_APP_ENV \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --output none
    echo "✅ Container Apps Environment created"
else
    echo "✅ Container Apps Environment already exists"
fi

# Prompt for Azure Storage connection string
echo ""
echo "⚠️  Storage Configuration Required"
echo "You need an Azure Storage Account connection string for Table Storage."
echo "Create one with: az storage account create --name <name> --resource-group $RESOURCE_GROUP --location $LOCATION --sku Standard_LRS"
echo ""
read -p "Enter Azure Storage Connection String (or press Enter to skip): " STORAGE_CONNECTION_STRING

# Prompt for frontend URL
echo ""
read -p "Enter Frontend URL (e.g., https://your-app.azurestaticapps.net): " FRONTEND_URL

# Create or update Container App
echo "Deploying Container App..."
if ! az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    # Create new container app
    ENV_VARS="PORT=3000"
    if [ ! -z "$STORAGE_CONNECTION_STRING" ]; then
        ENV_VARS="$ENV_VARS AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION_STRING"
    fi
    if [ ! -z "$FRONTEND_URL" ]; then
        ENV_VARS="$ENV_VARS FRONTEND_URL=$FRONTEND_URL"
    fi

    az containerapp create \
      --name $CONTAINER_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --environment $CONTAINER_APP_ENV \
      --image $ACR_SERVER/$IMAGE_NAME:$IMAGE_TAG \
      --registry-server $ACR_SERVER \
      --registry-username $ACR_USERNAME \
      --registry-password $ACR_PASSWORD \
      --target-port 3000 \
      --ingress external \
      --min-replicas 0 \
      --max-replicas 10 \
      --cpu 0.5 \
      --memory 1Gi \
      --env-vars $ENV_VARS \
      --query properties.configuration.ingress.fqdn \
      --output tsv
    
    echo "✅ Container App created"
else
    # Update existing container app
    az containerapp update \
      --name $CONTAINER_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $ACR_SERVER/$IMAGE_NAME:$IMAGE_TAG \
      --output none
    
    echo "✅ Container App updated"
fi

# Get the Container App URL
BACKEND_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo ""
echo "=================================================="
echo "🎉 Deployment Complete!"
echo "=================================================="
echo ""
echo "Backend URL: https://$BACKEND_URL"
echo "Health Check: https://$BACKEND_URL/health"
echo ""
echo "Next steps:"
echo "1. Update your frontend environment variables:"
echo "   VITE_API_URL=https://$BACKEND_URL/api"
echo "   VITE_SOCKET_URL=https://$BACKEND_URL"
echo ""
echo "2. Deploy your frontend to Azure Static Web Apps"
echo ""
echo "3. Test the deployment by visiting the health check URL"
echo ""
echo "💰 Cost estimate: $0-5 AUD/month (within free tier for typical usage)"
echo ""
