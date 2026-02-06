#!/usr/bin/env ts-node

/**
 * Upload RFS Facilities CSV to Azure Blob Storage
 * 
 * This script uploads the rfs-facilities.csv file to Azure Blob Storage
 * so it can be downloaded by the application at runtime.
 * 
 * Prerequisites:
 * 1. Download rfs-facilities.csv from atlas.gov.au (2.2MB)
 * 2. Place it in backend/src/data/rfs-facilities.csv
 * 3. Set AZURE_STORAGE_CONNECTION_STRING environment variable
 * 
 * Usage:
 *   ts-node src/scripts/uploadCsvToBlobStorage.ts
 */

import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

const CONTAINER_NAME = 'data-files';
const BLOB_NAME = 'rfs-facilities.csv';
const CSV_PATH = path.join(__dirname, '../data/rfs-facilities.csv');

async function uploadCsvToBlob(): Promise<void> {
  try {
    console.log('🚀 Starting CSV upload to Azure Blob Storage...');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_PATH)) {
      console.error(`❌ CSV file not found at ${CSV_PATH}`);
      console.error('   Please download rfs-facilities.csv from atlas.gov.au and place it in backend/src/data/');
      process.exit(1);
    }

    // Get file stats
    const stats = fs.statSync(CSV_PATH);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📂 Found CSV file: ${CSV_PATH} (${fileSizeMB} MB)`);

    // Check for connection string
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      console.error('❌ AZURE_STORAGE_CONNECTION_STRING environment variable not set');
      console.error('   Please set it in your .env file or environment');
      process.exit(1);
    }

    // Initialize blob service client
    console.log('🔌 Connecting to Azure Storage...');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    
    // Get container client (create if doesn't exist)
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    console.log(`📦 Ensuring container '${CONTAINER_NAME}' exists...`);
    await containerClient.createIfNotExists({
      access: 'blob' // Public read access for the blobs
    });

    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(BLOB_NAME);

    // Upload the file
    console.log(`⬆️  Uploading ${BLOB_NAME} to blob storage...`);
    const uploadResponse = await blockBlobClient.uploadFile(CSV_PATH, {
      blobHTTPHeaders: {
        blobContentType: 'text/csv'
      }
    });

    console.log(`✅ Upload successful!`);
    console.log(`   Container: ${CONTAINER_NAME}`);
    console.log(`   Blob: ${BLOB_NAME}`);
    console.log(`   Request ID: ${uploadResponse.requestId}`);
    console.log(`   File size: ${fileSizeMB} MB`);
    console.log(`   URL: ${blockBlobClient.url}`);
    console.log('');
    console.log('🎉 The application will now be able to download this CSV at startup!');

  } catch (error) {
    console.error('❌ Error uploading CSV to blob storage:', error);
    process.exit(1);
  }
}

// Run the upload
uploadCsvToBlob().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
