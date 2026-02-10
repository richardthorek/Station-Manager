import dotenv from 'dotenv';
import { TableClient, odata } from '@azure/data-tables';

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

function parseAllowedStations(): Set<string> {
  const raw = process.env.ALLOWED_STATIONS || 'BUNGENDORE,CARWOOLA';
  const names = raw
    .split(',')
    .map((name) => name.trim().toUpperCase())
    .filter(Boolean);
  return new Set(names);
}

async function clearStationsExcept(): Promise<void> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required to access Table Storage.');
  }

  const dryRun = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
  const tableName = buildTableName('Stations');
  const allowed = parseAllowedStations();

  console.log(`\nTarget table: ${tableName}`);
  console.log(`Dry run: ${dryRun ? 'true' : 'false'}`);
  console.log(`Allowed stations: ${Array.from(allowed).join(', ')}`);

  const stationsTable = TableClient.fromConnectionString(connectionString, tableName);
  const entities = stationsTable.listEntities({
    queryOptions: { filter: odata`PartitionKey eq 'Station'` },
  });

  let matched = 0;
  let deleted = 0;

  for await (const entity of entities) {
    const rowKey = String(entity.rowKey || '');
    const name = String(entity.name || '');
    const normalizedName = name.toUpperCase();

    const keep = allowed.has(normalizedName);
    if (keep) {
      console.log(`= KEEP ${rowKey} | ${name}`);
      continue;
    }

    matched += 1;
    console.log(`- REMOVE ${rowKey} | ${name}`);

    if (!dryRun) {
      await stationsTable.deleteEntity('Station', rowKey, { etag: '*' });
      deleted += 1;
    }
  }

  console.log(`\nStations matched for removal: ${matched}`);
  if (dryRun) {
    console.log('No changes applied (dry run). Set DRY_RUN=false to apply deletions.');
  } else {
    console.log(`Stations deleted: ${deleted}`);
  }
}

clearStationsExcept().catch((error) => {
  console.error('\nFailed to clear stations:', error);
  process.exit(1);
});
