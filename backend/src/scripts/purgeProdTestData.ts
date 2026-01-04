import dotenv from 'dotenv';
import { TableClient } from '@azure/data-tables';

dotenv.config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const nodeEnv = process.env.NODE_ENV || 'production';
const prefix = (process.env.TABLE_STORAGE_TABLE_PREFIX || '').replace(/[^A-Za-z0-9]/g, '');
const suffix = (process.env.TABLE_STORAGE_TABLE_SUFFIX || '').replace(/[^A-Za-z0-9]/g, '') || (nodeEnv === 'test' ? 'Test' : nodeEnv === 'development' ? 'Dev' : '');
const purgeTruckChecks = process.env.PURGE_TRUCK_CHECKS === 'true';

function buildTableName(baseName: string): string {
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName;
}

async function ensureTableExists(client: TableClient): Promise<void> {
  try {
    await client.createTable();
  } catch (error: any) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }
}

async function clearTable(baseName: string, description: string): Promise<void> {
  const tableName = buildTableName(baseName);
  const client = TableClient.fromConnectionString(connectionString, tableName);

  await ensureTableExists(client);

  let deleted = 0;
  for await (const entity of client.listEntities()) {
    await client.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    deleted += 1;
    if (deleted % 100 === 0) {
      console.log(`  ...${deleted} rows removed from ${tableName}`);
    }
  }

  console.log(`  Cleared ${deleted} rows from ${tableName} (${description})`);
}

async function run() {
  if (!connectionString) {
    console.error('AZURE_STORAGE_CONNECTION_STRING is required to purge data.');
    process.exit(1);
  }

  if (process.env.PURGE_CONFIRM !== 'YES') {
    console.error('Set PURGE_CONFIRM=YES to acknowledge this will delete production data.');
    process.exit(1);
  }

  console.log('\nPurging production test data');
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   Table prefix: '${prefix}'`);
  console.log(`   Table suffix: '${suffix}'`);
  console.log(`   Purge truck checks: ${purgeTruckChecks}\n`);

  const tablesToClear: Array<{ base: string; description: string }> = [
    { base: 'Events', description: 'event history' },
    { base: 'EventParticipants', description: 'event participants / check-ins' },
    { base: 'CheckIns', description: 'legacy check-ins' },
    { base: 'ActiveActivity', description: 'active activity pointer' },
  ];

  if (purgeTruckChecks) {
    tablesToClear.push(
      { base: 'CheckRuns', description: 'truck check runs' },
      { base: 'CheckResults', description: 'truck check results' }
    );
  }

  try {
    for (const { base, description } of tablesToClear) {
      console.log(`Clearing ${description}...`);
      await clearTable(base, description);
    }

    console.log('\nPurge complete. Members and activities are untouched.');
    console.log('   If you also want to remove custom activities, delete them manually after this purge.\n');
  } catch (error) {
    console.error('Failed to purge data:', error);
    process.exit(1);
  }
}

run();
