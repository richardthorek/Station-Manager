import dotenv from 'dotenv';
dotenv.config();

import { TableClient } from '@azure/data-tables';

async function queryOrganizations() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    console.error('AZURE_STORAGE_CONNECTION_STRING not set');
    process.exit(1);
  }

  const tableClient = TableClient.fromConnectionString(connectionString, 'Organizations');
  
  console.log('\n📊 Querying Organizations table...\n');
  let count = 0;

  try {
    for await (const entity of tableClient.listEntities()) {
      count++;
      console.log(`Organization #${count}:`);
      console.log(`  Name: ${entity.name}`);
      console.log(`  Slug: ${entity.slug}`);
      console.log(`  Plan: ${entity.planCode}`);
      console.log(`  Status: ${entity.status}`);
      console.log(`  Entitlements:`);
      if (entity.entitlements) {
        Object.entries(entity.entitlements).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
      }
      console.log('');
    }
    
    if (count === 0) {
      console.log('⚠️  No organizations found in production!\n');
    } else {
      console.log(`✅ Found ${count} organization(s)\n`);
    }
  } catch (error) {
    console.error('Error querying table:', (error as Error).message);
    process.exit(1);
  }
}

queryOrganizations();
