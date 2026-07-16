import dotenv from 'dotenv';
dotenv.config();

import { TableServiceClient } from '@azure/data-tables';

async function listTables() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    console.error('AZURE_STORAGE_CONNECTION_STRING not set');
    process.exit(1);
  }
  const serviceClient = TableServiceClient.fromConnectionString(connectionString);
  
  console.log('\n📋 Tables in storage account:\n');
  
  for await (const table of serviceClient.listTables()) {
    console.log(`  - ${table.name}`);
  }
  console.log('');
}

listTables().catch(console.error);
