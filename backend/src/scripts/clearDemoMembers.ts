import dotenv from 'dotenv';
import { TableClient, odata } from '@azure/data-tables';
import { DEFAULT_STATION_ID, DEMO_STATION_ID } from '../constants/stations';

dotenv.config();

function buildTableName(baseName: string, overrideSuffix?: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');

  let suffix = '';
  if (overrideSuffix !== undefined) {
    suffix = sanitize(overrideSuffix);
  } else {
    let defaultSuffix = '';
    if (process.env.NODE_ENV === 'test') {
      defaultSuffix = 'Test';
    } else if (process.env.NODE_ENV === 'development') {
      defaultSuffix = 'Dev';
    }
    suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  }

  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName;
}

async function clearDemoMembers(): Promise<void> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required to access Table Storage.');
  }

  const dryRun = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
  const hardDelete = (process.env.HARD_DELETE || 'false').toLowerCase() === 'true';
  const tableName = buildTableName('Members');

  console.log(`\nTarget table: ${tableName}`);
  console.log(`Dry run: ${dryRun ? 'true' : 'false'}`);
  console.log(`Hard delete: ${hardDelete ? 'true' : 'false'}`);
  console.log(`Station IDs: ${DEFAULT_STATION_ID}, ${DEMO_STATION_ID}, (legacy empty stationId)\n`);

  const membersTable = TableClient.fromConnectionString(connectionString, tableName);

  const filter = odata`PartitionKey eq 'Member' and (stationId eq '' or stationId eq ${DEFAULT_STATION_ID} or stationId eq ${DEMO_STATION_ID})`;
  const entities = membersTable.listEntities({
    queryOptions: { filter },
  });

  let matched = 0;
  let deleted = 0;

  for await (const entity of entities) {
    matched += 1;
    const name = String(entity.name || '');
    const stationId = String(entity.stationId || '');
    const rowKey = String(entity.rowKey || '');

    console.log(`- ${rowKey} | ${name} | stationId=${stationId || '(empty)'}`);

    if (!dryRun) {
      if (hardDelete) {
        await membersTable.deleteEntity('Member', rowKey, { etag: '*' });
      } else {
        await membersTable.updateEntity(
          {
            partitionKey: 'Member',
            rowKey,
            isDeleted: true,
            isActive: false,
            updatedAt: new Date().toISOString(),
          },
          'Merge',
          { etag: '*' }
        );
      }
      deleted += 1;
    }
  }

  console.log(`\nMatched members: ${matched}`);
  if (dryRun) {
    console.log('No changes applied (dry run). Set DRY_RUN=false to apply deletions.');
  } else {
    console.log(`Members ${hardDelete ? 'hard-deleted' : 'soft-deleted'}: ${deleted}`);
  }
}

clearDemoMembers().catch((error) => {
  console.error('\nFailed to clear demo/default members:', error);
  process.exit(1);
});
