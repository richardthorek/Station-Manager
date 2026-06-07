// ============================================================================
// Storage module — Azure Table Storage backing store
// ----------------------------------------------------------------------------
// Codifies the existing data tier. The app persists members, activities,
// check-ins, events, stations, truck checks and admin users in Table Storage
// (see backend/src/services/tableStorage*.ts). Table Storage is serverless and
// billed per-transaction, so it already scales to ~$0 on idle days — no tuning
// needed beyond locking down access.
// ============================================================================

@description('Azure region for the storage account.')
param location string

@description('Globally-unique storage account name (3-24 chars, lowercase letters and numbers).')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('Replication SKU. Standard_LRS is the cheapest and is sufficient for a single-region brigade workload.')
@allowed([
  'Standard_LRS'
  'Standard_ZRS'
  'Standard_GRS'
])
param skuName string = 'Standard_LRS'

@description('Tags applied to all resources.')
param tags object = {}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // app currently authenticates with a connection string; see README for the managed-identity hardening follow-up
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

@description('The storage account resource name.')
output storageAccountName string = storage.name

@description('Primary table endpoint, e.g. https://<name>.table.core.windows.net/.')
output tableEndpoint string = storage.properties.primaryEndpoints.table

@description('Resource ID, used by callers that build a connection string via listKeys().')
output storageAccountId string = storage.id
