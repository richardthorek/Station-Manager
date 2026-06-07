using './main.bicep'

// ---------------------------------------------------------------------------
// Example parameters for the dual-host comparison deployment.
// Copy/edit these values, then:
//   az deployment group what-if -g <rg> -f infra/main.bicep -p infra/main.bicepparam
//   az deployment group create  -g <rg> -f infra/main.bicep -p infra/main.bicepparam
// ---------------------------------------------------------------------------

param location = 'australiaeast'
param namePrefix = 'bungrfs'

// Toggle the two hosting options independently.
param deployLinuxAppService = true
param deployContainerApp = true

// Container image for the Container Apps option (built + pushed by the
// infra-deploy workflow). Replace <owner> and the tag as needed.
param containerImage = 'ghcr.io/richardthorek/station-manager:latest'

// For a PRIVATE GHCR image, supply registry credentials. Prefer passing the
// password at the CLI (--parameters registryPassword=...) or from a secret
// rather than committing it here. Leave empty for a public image.
param registryServer = 'ghcr.io'
param registryUsername = 'richardthorek'
param registryPassword = '' // pass at deploy time: az ... -p registryPassword=$GHCR_TOKEN

// Allowed CORS origins for the API / Socket.io. Add the two experiment hosts'
// URLs once their names are known (they are deterministic from namePrefix).
param frontendUrls = ''
