// ============================================================================
// Linux App Service module — "always-warm" hosting option
// ----------------------------------------------------------------------------
// Basic B1 Linux plan running Node 22. Flat ~$13/mo, Always-On keeps the
// Socket.io server warm 24/7 so real-time is instant. This is the simple,
// reliable option and ~half the price of the current Windows plan, with native
// WebSocket support (no iisnode bridging).
//
// Deployment model matches the existing pipeline: a zip of the prebuilt
// backend/dist + node_modules + frontend/dist is pushed via zip-deploy, and the
// app is started with the repo's startup.sh (cd backend && npm start).
// ============================================================================

@description('Azure region.')
param location string

@description('App Service Plan name.')
param appServicePlanName string

@description('Web App name (also the default *.azurewebsites.net host).')
param webAppName string

@description('Storage connection string for Table Storage (passed as a secure app setting).')
@secure()
param storageConnectionString string

@description('Comma-separated allowed CORS origins for the API / Socket.io (FRONTEND_URLS).')
param frontendUrls string = ''

@description('Tags applied to all resources.')
param tags object = {}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  kind: 'linux'
  properties: {
    reserved: true // reserved == true denotes a Linux plan
  }
}

resource web 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned' // ready for the managed-identity storage hardening follow-up
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: true // required to keep the persistent Socket.io server alive
      webSocketsEnabled: true
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/health'
      // The deployment zip lays out backend/dist + backend/node_modules +
      // frontend/dist + startup.sh at the site root, mirroring CI today.
      appCommandLine: 'bash startup.sh'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '22-lts'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false' // dependencies are pre-installed and shipped in the zip
        }
        {
          name: 'USE_TABLE_STORAGE'
          value: 'true'
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'FRONTEND_URLS'
          value: frontendUrls
        }
      ]
    }
  }
}

@description('Default hostname of the Linux web app.')
output defaultHostName string = web.properties.defaultHostName

@description('Web app resource name.')
output webAppName string = web.name

@description('System-assigned managed identity principal ID (for future storage RBAC).')
output principalId string = web.identity.principalId
