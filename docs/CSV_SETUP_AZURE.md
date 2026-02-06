# RFS Facilities CSV Setup for Azure Deployment

## Overview

The RFS Station Manager uses a national fire service facilities dataset (rfs-facilities.csv, ~2.2MB) to enable station lookup features. Due to its size, this file is not stored in Git but is automatically downloaded from Azure Blob Storage at application startup.

## Setup for Azure Deployment

### One-Time Setup (Required before first deployment)

1. **Download the CSV file** (if you haven't already):
   - Source: [Australian Digital Atlas - Fire and Emergency Services](https://atlas.gov.au/)
   - Dataset: Rural Fire Service and CFA Facilities
   - Format: CSV
   - Size: ~2.2MB, ~4500 facilities

2. **Place the CSV file locally**:
   ```bash
   # From repository root
   mkdir -p backend/src/data
   # Copy your downloaded CSV to:
   # backend/src/data/rfs-facilities.csv
   ```

3. **Upload to Azure Blob Storage**:
   ```bash
   cd backend
   npm run upload:csv
   ```

   This will:
   - Create a `data-files` container in your Azure Storage account (if it doesn't exist)
   - Upload `rfs-facilities.csv` to the container
   - Make it available for the application to download at startup

4. **Verify Azure Storage configuration**:
   - Ensure `AZURE_STORAGE_CONNECTION_STRING` is set in your Azure App Service configuration
   - The same connection string used for photo uploads will work for CSV download

### How It Works in Production

When the application starts on Azure:

1. **Checks for local CSV file** at `/home/site/wwwroot/backend/dist/data/rfs-facilities.csv`
2. **If not found**, automatically downloads from Azure Blob Storage (`data-files` container)
3. **Caches locally** for faster subsequent restarts
4. **Falls back gracefully** if CSV is unavailable (app still starts, station lookup returns 503)

### Updating the CSV File

To update the facilities data:

1. Download the latest CSV from atlas.gov.au
2. Place it at `backend/src/data/rfs-facilities.csv`
3. Run `npm run upload:csv`
4. Restart the Azure App Service (or wait for auto-restart on next deployment)

### Environment Variables

Required in Azure App Service configuration:

```bash
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
```

### Container Details

- **Container Name**: `data-files`
- **Blob Name**: `rfs-facilities.csv`
- **Access Level**: Blob (public read access)
- **Content Type**: text/csv

### Troubleshooting

**Error: CSV file not found at startup**
- Check that `AZURE_STORAGE_CONNECTION_STRING` is set in Azure App Service configuration
- Verify the CSV was uploaded: Check Azure Portal > Storage Account > Containers > `data-files`
- Check application logs for specific error messages

**Station lookup endpoints return 503**
- CSV data is not available
- App will still run, but station lookup features will be disabled
- Upload the CSV using `npm run upload:csv`

**CSV upload fails**
- Verify `AZURE_STORAGE_CONNECTION_STRING` is set in your local `.env` file
- Check that you have write permissions to the storage account
- Ensure the CSV file exists at `backend/src/data/rfs-facilities.csv`

### Cost Considerations

- **Storage**: ~2.2MB blob storage (negligible cost)
- **Transactions**: 1 download per app instance startup (minimal)
- **Bandwidth**: ~2.2MB egress per startup (minimal)

### Security

- The CSV contains only public facility data (addresses, coordinates, names)
- No sensitive information is stored
- Blob access is public-read only
- Connection string should be kept secure (stored in Azure Key Vault or App Service configuration)

### Development vs Production

**Development (local)**:
- CSV can be stored locally at `backend/src/data/rfs-facilities.csv`
- Gitignored to keep repository size small
- Optional blob storage download (uses local file if available)

**Production (Azure)**:
- CSV is automatically downloaded from blob storage
- Cached locally on the app service instance
- Falls back gracefully if unavailable

### Manual Verification

To verify the CSV is accessible in Azure Blob Storage:

```bash
# The blob URL (public read):
https://<your-storage-account>.blob.core.windows.net/data-files/rfs-facilities.csv
```

You can test this URL in a browser to confirm the CSV is accessible.
