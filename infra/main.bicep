// ============================================================================
// RFS Station Manager — Infrastructure orchestrator
// ----------------------------------------------------------------------------
// Deploys (into an existing resource group):
//   * Azure Table Storage (data tier)
//   * OPTIONAL Linux B1 App Service          (always-warm hosting option)
//   * OPTIONAL Azure Container Apps app       (scale-to-zero hosting option)
//
// The two hosting options are a side-by-side cost/real-time comparison. They do
// NOT touch the existing production app (`bungrfsstation`). Toggle each with the
// deployLinuxAppService / deployContainerApp flags.
//
// Validate before deploying:
//   az deployment group what-if -g <rg> -f infra/main.bicep -p infra/main.bicepparam
// Deploy:
//   az deployment group create   -g <rg> -f infra/main.bicep -p infra/main.bicepparam
// ============================================================================

targetScope = 'resourceGroup'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Short prefix for resource names, e.g. "bungrfs".')
param namePrefix string = 'bungrfs'

@description('Globally-unique storage account name (lowercase letters/numbers, 3-24 chars).')
@minLength(3)
@maxLength(24)
param storageAccountName string = toLower('${namePrefix}sa${uniqueString(resourceGroup().id)}')

@description('Deploy the Linux B1 App Service hosting option.')
param deployLinuxAppService bool = true

@description('Deploy the Azure Container Apps (scale-to-zero) hosting option.')
param deployContainerApp bool = true

@description('Container image for the Container Apps option, e.g. ghcr.io/<owner>/station-manager:<tag>. Required when deployContainerApp is true.')
param containerImage string = ''

@description('Registry login server for a private image (e.g. ghcr.io). Empty for a public image.')
param registryServer string = ''

@description('Registry username (e.g. GitHub username for GHCR).')
param registryUsername string = ''

@description('Registry password / token for a private image.')
@secure()
param registryPassword string = ''

@description('Comma-separated allowed CORS origins (FRONTEND_URLS) shared by both hosts.')
param frontendUrls string = ''

@description('JWT secret for signing authentication tokens (required for production).')
@secure()
param jwtSecret string = ''

@description('Tags applied to every resource.')
param tags object = {
  application: 'station-manager'
  managedBy: 'bicep'
  purpose: 'hosting-comparison'
}

// ---------------------------------------------------------------------------
// Data tier
// ---------------------------------------------------------------------------
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    storageAccountName: storageAccountName
    tags: tags
  }
}

// Build the connection string from the freshly-created account's keys without
// emitting the secret from the storage module's outputs.
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-05-01').keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// ---------------------------------------------------------------------------
// Hosting option A — Linux B1 App Service (always warm)
// ---------------------------------------------------------------------------
module linux 'modules/appservice-linux.bicep' = if (deployLinuxAppService) {
  name: 'linux-appservice'
  dependsOn: [storage]
  params: {
    location: location
    appServicePlanName: '${namePrefix}-linux-plan'
    webAppName: '${namePrefix}-linux'
    storageConnectionString: storageConnectionString
    frontendUrls: frontendUrls
    jwtSecret: jwtSecret
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Hosting option B — Azure Container Apps (scale to zero)
// ---------------------------------------------------------------------------
module containerApp 'modules/containerapp.bicep' = if (deployContainerApp) {
  name: 'container-app'
  dependsOn: [storage]
  params: {
    location: location
    logAnalyticsWorkspaceName: '${namePrefix}-aca-logs'
    containerAppsEnvName: '${namePrefix}-aca-env'
    containerAppName: '${namePrefix}-aca'
    image: containerImage
    storageConnectionString: storageConnectionString
    frontendUrls: frontendUrls
    jwtSecret: jwtSecret
    registryServer: registryServer
    registryUsername: registryUsername
    registryPassword: registryPassword
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output storageAccountNameOut string = storage.outputs.storageAccountName
output linuxHostName string = deployLinuxAppService ? linux!.outputs.defaultHostName : ''
output containerAppFqdn string = deployContainerApp ? containerApp!.outputs.fqdn : ''
