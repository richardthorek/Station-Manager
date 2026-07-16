// ============================================================================
// Container Apps module — "scale-to-zero" hosting option
// ----------------------------------------------------------------------------
// Consumption-plan Container Apps environment + a single container app that
// scales to zero when idle (minReplicas 0). Thanks to the monthly free grant
// (180k vCPU-s + 360k GiB-s + 2M requests) a single brigade's intermittent use
// is plausibly ~$0/mo. Trade-off: a ~few-second cold start on the first request
// after the app has scaled to zero.
//
// Runs the SAME Socket.io app, packaged by the repo Dockerfile. Ingress uses
// transport 'auto' (HTTP/1.1 + WebSocket upgrade) and sticky sessions so a
// client stays pinned to one replica — important for in-process Socket.io.
// maxReplicas is 1 for the spike (no Redis backplane needed); raise it only
// alongside a backplane (e.g. Azure Web PubSub for Socket.IO) later.
// ============================================================================

@description('Azure region.')
param location string

@description('Log Analytics workspace name (required for Container Apps logs).')
param logAnalyticsWorkspaceName string

@description('Container Apps managed environment name.')
param containerAppsEnvName string

@description('Container app name (also the ingress subdomain).')
param containerAppName string

@description('Fully-qualified container image, e.g. ghcr.io/<owner>/station-manager:<tag>.')
param image string

@description('Storage connection string for Table Storage (stored as a container-app secret).')
@secure()
param storageConnectionString string

@description('Comma-separated allowed CORS origins (FRONTEND_URLS).')
param frontendUrls string = ''

@description('JWT secret for signing authentication tokens (required for production).')
@secure()
param jwtSecret string

@description('Container registry login server (e.g. ghcr.io). Leave empty for a public image.')
param registryServer string = ''

@description('Registry username (e.g. GitHub username for GHCR). Ignored if registryServer is empty.')
param registryUsername string = ''

@description('Registry password / token. Ignored if registryServer is empty.')
@secure()
param registryPassword string = ''

@description('vCPU per replica. 0.5 keeps cost low and is ample for one brigade.')
param cpuCores string = '0.5'

@description('Memory per replica. Must pair validly with cpuCores (0.5 vCPU -> 1Gi).')
param memorySize string = '1Gi'

@description('Tags applied to all resources.')
param tags object = {}

var usePrivateRegistry = !empty(registryServer)

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto' // HTTP/1.1 with WebSocket upgrade support
        allowInsecure: false
        stickySessions: {
          affinity: 'sticky'
        }
      }
      secrets: concat(
        [
          {
            name: 'storage-connection-string'
            value: storageConnectionString
          }
          {
            name: 'jwt-secret'
            value: jwtSecret
          }
        ],
        usePrivateRegistry ? [
          {
            name: 'registry-password'
            value: registryPassword
          }
        ] : []
      )
      registries: usePrivateRegistry ? [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: containerAppName
          image: image
          resources: {
            cpu: json(cpuCores)
            memory: memorySize
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'USE_TABLE_STORAGE'
              value: 'true'
            }
            {
              name: 'AZURE_STORAGE_CONNECTION_STRING'
              secretRef: 'storage-connection-string'
            }
            {
              name: 'FRONTEND_URLS'
              value: frontendUrls
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0 // scale to zero when idle -> no compute charge
        maxReplicas: 1 // single replica keeps in-process Socket.io correct without a backplane
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

@description('Public FQDN of the container app.')
output fqdn string = app.properties.configuration.ingress.fqdn

@description('Container app resource name.')
output containerAppName string = app.name
