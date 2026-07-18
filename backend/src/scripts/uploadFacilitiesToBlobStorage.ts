#!/usr/bin/env ts-node

/**
 * Upload the combined Emergency Facilities CSV to Azure Blob Storage so the
 * app can download it at runtime (services/facilitiesParser.ts).
 *
 * Prerequisites:
 * 1. Run `npm run facilities:fetch` (from a machine with internet access to
 *    services.ga.gov.au) to produce backend/src/data/emergency-facilities.csv
 * 2. Set AZURE_STORAGE_CONNECTION_STRING
 *
 * Usage:
 *   npm run facilities:upload
 */

import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const CONTAINER_NAME = 'data-files';
const BLOB_NAME = 'emergency-facilities.csv';
const CSV_PATH = path.join(__dirname, '../data/emergency-facilities.csv');

async function uploadCsvToBlob(): Promise<void> {
  try {
    console.log('🚀 Starting emergency-facilities CSV upload to Azure Blob Storage...');

    if (!fs.existsSync(CSV_PATH)) {
      console.error(`❌ CSV file not found at ${CSV_PATH}`);
      console.error('   Run `npm run facilities:fetch` first (needs internet access to services.ga.gov.au)');
      process.exit(1);
    }

    const stats = fs.statSync(CSV_PATH);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📂 Found CSV file: ${CSV_PATH} (${fileSizeMB} MB)`);

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      console.error('❌ AZURE_STORAGE_CONNECTION_STRING environment variable not set');
      process.exit(1);
    }

    console.log('🔌 Connecting to Azure Storage...');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    console.log(`📦 Ensuring container '${CONTAINER_NAME}' exists...`);
    // Private container — facilitiesParser.ts / rfsFacilitiesParser.ts both
    // read via an authenticated connection string, never anonymous access, so
    // there's no reason to request public blob access here. Requesting it
    // also fails outright on any storage account with "allow blob public
    // access" disabled (a standard security setting, and the case in prod).
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(BLOB_NAME);
    console.log(`⬆️  Uploading ${BLOB_NAME} to blob storage...`);
    const uploadResponse = await blockBlobClient.uploadFile(CSV_PATH, {
      blobHTTPHeaders: { blobContentType: 'text/csv' },
    });

    console.log('✅ Upload successful!');
    console.log(`   Container: ${CONTAINER_NAME}`);
    console.log(`   Blob: ${BLOB_NAME}`);
    console.log(`   Request ID: ${uploadResponse.requestId}`);
    console.log(`   URL: ${blockBlobClient.url}`);
    console.log('');
    console.log('🎉 The facility lookup will pick this up on next app start.');
  } catch (error) {
    console.error('❌ Error uploading CSV to blob storage:', error);
    process.exit(1);
  }
}

uploadCsvToBlob().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
