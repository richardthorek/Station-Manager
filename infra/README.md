# Infrastructure (Bicep)

Infrastructure-as-Code for the RFS Station Manager, and a **side-by-side hosting
comparison** to find the cheapest setup that still keeps real-time (Socket.io)
snappy for brigades with little weekday activity.

> **Production is not touched by anything here.** The existing prod app
> (`bungrfsstation`, Windows App Service) keeps running. These templates create
> *new, separately-named* experiment resources (`bungrfs-linux`, `bungrfs-aca`).

## What gets deployed

| Resource | Module | Purpose |
|---|---|---|
| Storage account + Table service | `modules/storage.bicep` | Data tier (already cost-optimal; codified for reproducibility) |
| Linux **B1** App Service + plan | `modules/appservice-linux.bicep` | **Always-warm** hosting option |
| Container Apps env + app | `modules/containerapp.bicep` | **Scale-to-zero** hosting option |
| Log Analytics workspace | (in container module) | Required for Container Apps logs |

Both hosts run the **current Socket.io app unchanged**. Toggle each with
`deployLinuxAppService` / `deployContainerApp`.

## The comparison

| | Linux B1 (always-warm) | Container Apps (scale-to-zero) |
|---|---|---|
| Idle cost | ~**$13/mo** flat | ~**$0/mo** (inside the monthly free grant¹) |
| Real-time when active | Instant (always warm) | Good — **~few-second cold start** on the first hit after idle, then instant |
| Cost when busy | Flat | Pennies per active session (0.5 vCPU / 1 GiB) |
| Scale-out path | Needs a backplane² | Needs a backplane² (keep `maxReplicas: 1` until then) |
| Effort | Lowest (app unchanged, zip-deploy) | Low-med (Dockerfile, app unchanged) |

¹ Container Apps free grant: **180,000 vCPU-seconds + 360,000 GiB-seconds + 2M requests per month**, with no charge while scaled to zero. A single brigade's intermittent use sits well inside it.
² In-process Socket.io assumes one instance. To run multiple replicas, add a backplane — for this stack that's **Azure Web PubSub for Socket.IO** (keeps the code, has a free tier), *not* a SignalR SDK rewrite.

## Prerequisites — one-time bootstrap (also fixes the broken prod deploy)

CI deploys authenticate to Azure with a GitHub OIDC federated identity. That
app registration is currently **missing** from the tenant — the last few `main`
deploys failed with `AADSTS700016: Application ... was not found`. Recreating it
restores production deploys **and** enables `infra-deploy.yml`.

Run once as an Azure AD admin (replace IDs as needed):

```bash
SUBSCRIPTION_ID="<your-subscription-id>"
RG="bungrfsstation_group"
APP_NAME="github-station-manager-oidc"

# 1) App registration + service principal
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# 2) Federated credentials for the branches/refs that deploy
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name":"main","issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:richardthorek/Station-Manager:ref:refs/heads/main",
  "audiences":["api://AzureADTokenExchange"]}'

# (optional) allow manual infra-deploy from any branch via environment/ref as needed

# 3) Grant the SP rights on the resource group
az role assignment create --assignee "$APP_ID" --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"

echo "Update GitHub secret AZUREAPPSERVICE_CLIENTID_... to: $APP_ID"
az account show --query tenantId -o tsv   # -> AZUREAPPSERVICE_TENANTID_...
echo "Subscription: $SUBSCRIPTION_ID"     # -> AZUREAPPSERVICE_SUBSCRIPTIONID_...
```

Then update the three repo secrets referenced by the workflows
(`AZUREAPPSERVICE_CLIENTID_*`, `AZUREAPPSERVICE_TENANTID_*`,
`AZUREAPPSERVICE_SUBSCRIPTIONID_*`) with the values above.

### Container image visibility (spike)

The Container Apps option pulls its image from GHCR. For the spike, make the
package **public** (one-time) so no pull credentials are needed:
`GitHub repo → Packages → station-manager → Package settings → Change visibility → Public`.
The Bicep also supports a private registry (`registryServer/Username/Password`)
if you prefer to keep it private later.

## Deploy

### Option 1 — GitHub Actions (recommended)
Run the **“Infra Deploy (manual)”** workflow (`workflow_dispatch`). It builds and
pushes the image to GHCR, runs `what-if`, deploys the Bicep, and zip-deploys the
app to the Linux host.

### Option 2 — Local `az`
```bash
az group create -n bungrfsstation_group -l australiaeast   # if not already present

# Preview
az deployment group what-if -g bungrfsstation_group \
  -f infra/main.bicep -p infra/main.bicepparam

# Apply (pass a real image + token if using a private registry)
az deployment group create -g bungrfsstation_group \
  -f infra/main.bicep -p infra/main.bicepparam \
  -p containerImage='ghcr.io/richardthorek/station-manager:latest'
```

Outputs include the Linux hostname and the Container App FQDN. Smoke-test each:
`curl https://<host>/health`.

## Teardown

Experiment resources are cheap, but to remove them:
```bash
az resource delete --ids \
  $(az resource list -g bungrfsstation_group \
     --query "[?contains(name,'bungrfs-linux') || contains(name,'bungrfs-aca')].id" -o tsv)
```
(Leaves prod and storage intact. Delete the storage account only if it was created solely for the spike.)

## Follow-ups / hardening (out of scope here)

- **Managed identity for storage** instead of a connection string (`allowSharedKeyAccess: false` + RBAC `Storage Table Data Contributor`). The web app already has a system-assigned identity for this.
- **Migrate prod off Windows → Linux B1** once the comparison confirms the choice (separate issue).
- **App Insights daily cap + sampling** to bound telemetry cost (separate issue).
- **Azure Web PubSub for Socket.IO** if/when multi-brigade concurrency needs more than one replica.

## Notes

- Bicep is authored here but **compiled and deployed in the maintainer's Azure
  subscription** — it is not validated in the CI sandbox.
- API versions pinned: Storage `2023-05-01`, Web `2023-12-01`, App `2024-03-01`,
  OperationalInsights `2023-09-01`.
