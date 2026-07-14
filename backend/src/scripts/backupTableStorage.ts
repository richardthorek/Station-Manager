/**
 * Backs up every Azure Table Storage table in the target account to
 * newline-delimited JSON blobs in a `backups/<timestamp>/` prefix of a
 * dedicated blob container.
 *
 * Azure Table Storage has no native point-in-time restore (that's a Blob
 * Storage feature) — geo-replication protects against Azure losing a
 * datacenter, not against an operator running the wrong script against prod.
 * This is the mitigation: a scheduled, cheap, append-only export that can be
 * downloaded and replayed by hand if data is ever lost or corrupted.
 *
 * Tables are discovered dynamically via TableServiceClient.listTables() —
 * this script does not need updating when a new table-backed service is
 * added.
 *
 * Usage:
 *   AZURE_STORAGE_CONNECTION_STRING=... npm run backup:prod
 *
 * Env vars:
 *   AZURE_STORAGE_CONNECTION_STRING - required, the storage account to back up
 *   BACKUP_CONTAINER_NAME           - optional, default 'table-backups'
 *   TABLE_STORAGE_TABLE_PREFIX / TABLE_STORAGE_TABLE_SUFFIX - optional, only
 *     back up tables matching this prefix/suffix (defaults to backing up
 *     every table in the account, since that's what a disaster recovery
 *     restore needs)
 */
import dotenv from 'dotenv';
import { TableServiceClient, TableClient } from '@azure/data-tables';
import { BlobServiceClient } from '@azure/storage-blob';

dotenv.config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const containerName = process.env.BACKUP_CONTAINER_NAME || 'table-backups';
const tablePrefix = process.env.TABLE_STORAGE_TABLE_PREFIX || '';
const tableSuffix = process.env.TABLE_STORAGE_TABLE_SUFFIX || '';

async function backupTable(
  tableName: string,
  blobService: BlobServiceClient,
  containerNameLocal: string,
  runTimestamp: string
): Promise<number> {
  const client = TableClient.fromConnectionString(connectionString, tableName);
  const rows: string[] = [];

  for await (const entity of client.listEntities()) {
    rows.push(JSON.stringify(entity));
  }

  const blobName = `${runTimestamp}/${tableName}.ndjson`;
  const containerClient = blobService.getContainerClient(containerNameLocal);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const content = rows.join('\n');
  await blockBlobClient.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: 'application/x-ndjson' },
  });

  return rows.length;
}

async function run() {
  if (!connectionString) {
    console.error('AZURE_STORAGE_CONNECTION_STRING is required to run a backup.');
    process.exit(1);
  }

  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`\nBacking up Azure Table Storage → container '${containerName}', prefix '${runTimestamp}'`);
  if (tablePrefix || tableSuffix) {
    console.log(`   Filtering to tables matching prefix='${tablePrefix}' suffix='${tableSuffix}'`);
  }

  const tableServiceClient = TableServiceClient.fromConnectionString(connectionString);
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const tableNames: string[] = [];
  for await (const table of tableServiceClient.listTables()) {
    if (!table.name) continue;
    if (tablePrefix && !table.name.startsWith(tablePrefix)) continue;
    if (tableSuffix && !table.name.endsWith(tableSuffix)) continue;
    tableNames.push(table.name);
  }

  if (tableNames.length === 0) {
    console.warn('No tables matched — nothing to back up.');
    return;
  }

  let totalRows = 0;
  for (const tableName of tableNames) {
    const rowCount = await backupTable(tableName, blobServiceClient, containerName, runTimestamp);
    totalRows += rowCount;
    console.log(`   ${tableName}: ${rowCount} rows`);
  }

  console.log(`\nBackup complete: ${tableNames.length} tables, ${totalRows} rows, prefix '${runTimestamp}'.`);
}

run().catch((error) => {
  console.error('Backup failed:', error);
  process.exit(1);
});
