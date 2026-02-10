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

async function loadAllowedStationIds(
  stationsTable: TableClient,
  allowedNames: Set<string>
): Promise<Set<string>> {
  const allowedIds = new Set<string>();
  const entities = stationsTable.listEntities({
    queryOptions: { filter: odata`PartitionKey eq 'Station'` },
  });

  for await (const entity of entities) {
    const name = String(entity.name || '').toUpperCase();
    const rowKey = String(entity.rowKey || '');
    if (allowedNames.has(name)) {
      allowedIds.add(rowKey);
    }
  }

  return allowedIds;
}

async function deletePartitionEntities(table: TableClient, partitionKey: string, dryRun: boolean): Promise<number> {
  let deleted = 0;
  const entities = table.listEntities({
    queryOptions: { filter: odata`PartitionKey eq ${partitionKey}` },
  });

  for await (const entity of entities) {
    const rowKey = String(entity.rowKey || '');
    if (!dryRun) {
      await table.deleteEntity(partitionKey, rowKey, { etag: '*' });
    }
    deleted += 1;
  }

  return deleted;
}

async function clearEventsOutsideStations(): Promise<void> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required to access Table Storage.');
  }

  const dryRun = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
  const allowedNames = parseAllowedStations();

  const stationsTable = TableClient.fromConnectionString(connectionString, buildTableName('Stations'));
  const eventsTable = TableClient.fromConnectionString(connectionString, buildTableName('Events'));
  const participantsTable = TableClient.fromConnectionString(connectionString, buildTableName('EventParticipants'));
  const auditLogsTable = TableClient.fromConnectionString(connectionString, buildTableName('EventAuditLogs'));

  const allowedStationIds = await loadAllowedStationIds(stationsTable, allowedNames);

  if (allowedStationIds.size === 0) {
    throw new Error('No allowed station IDs found. Check station names or Stations table.');
  }

  console.log(`\nTarget tables: ${buildTableName('Events')}, ${buildTableName('EventParticipants')}, ${buildTableName('EventAuditLogs')}`);
  console.log(`Dry run: ${dryRun ? 'true' : 'false'}`);
  console.log(`Allowed station names: ${Array.from(allowedNames).join(', ')}`);
  console.log(`Allowed station IDs: ${Array.from(allowedStationIds).join(', ')}`);

  let matchedEvents = 0;
  let deletedEvents = 0;
  let deletedParticipants = 0;
  let deletedAuditLogs = 0;

  const events = eventsTable.listEntities();

  for await (const entity of events) {
    const partitionKey = String(entity.partitionKey || '');
    if (!partitionKey.startsWith('Event_')) {
      continue;
    }

    const eventId = String(entity.rowKey || '');
    const stationId = String(entity.stationId || '').trim();

    const keep = stationId && allowedStationIds.has(stationId);
    if (keep) {
      continue;
    }

    matchedEvents += 1;
    console.log(`- REMOVE event ${eventId} | stationId=${stationId || '(empty)'}`);

    if (!dryRun) {
      await eventsTable.deleteEntity(partitionKey, eventId, { etag: '*' });
      deletedEvents += 1;

      deletedParticipants += await deletePartitionEntities(participantsTable, eventId, dryRun);
      deletedAuditLogs += await deletePartitionEntities(auditLogsTable, eventId, dryRun);
    }
  }

  console.log(`\nEvents matched for removal: ${matchedEvents}`);
  if (dryRun) {
    console.log('No changes applied (dry run). Set DRY_RUN=false to apply deletions.');
  } else {
    console.log(`Events deleted: ${deletedEvents}`);
    console.log(`Event participants deleted: ${deletedParticipants}`);
    console.log(`Event audit logs deleted: ${deletedAuditLogs}`);
  }
}

clearEventsOutsideStations().catch((error) => {
  console.error('\nFailed to clear events:', error);
  process.exit(1);
});
