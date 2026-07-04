/**
 * Azure Table Storage AI Usage Database Service
 *
 * Production twin of UsageDatabase. Persists AI gateway usage rows.
 * Partition strategy: PartitionKey = organizationId, RowKey = record id.
 * Partitioning by org keeps the per-org allowance count (the hot query) to a
 * single-partition scan.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { UsageRecord, UsageType } from '../types';
import {
  monthStart,
  type IUsageDatabase,
  type RecordUsageInput,
} from './usageDatabase';

function buildTableName(baseName: string): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9]/g, '');
  const prefix = sanitize(process.env.TABLE_STORAGE_TABLE_PREFIX || '');
  let defaultSuffix = '';
  if (process.env.NODE_ENV === 'test') defaultSuffix = 'Test';
  else if (process.env.NODE_ENV === 'development') defaultSuffix = 'Dev';
  const suffix = sanitize(process.env.TABLE_STORAGE_TABLE_SUFFIX || defaultSuffix);
  const name = `${prefix}${baseName}${suffix}`;
  return name || baseName;
}

interface UsageEntity extends TableEntity {
  type: string;
  units: number;
  sessionId?: string;
  createdAt: string;
  reportedToStripe: boolean;
}

export class TableStorageUsageDatabase implements IUsageDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('AiUsage');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create AiUsage table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for AI usage', { tableName });
  }

  private toEntity(row: UsageRecord): UsageEntity {
    return {
      partitionKey: row.organizationId,
      rowKey: row.id,
      type: row.type,
      units: row.units,
      sessionId: row.sessionId,
      createdAt: row.createdAt.toISOString(),
      reportedToStripe: row.reportedToStripe ?? false,
    };
  }

  private fromEntity(entity: UsageEntity): UsageRecord {
    return {
      id: entity.rowKey as string,
      organizationId: entity.partitionKey as string,
      type: entity.type as UsageType,
      units: entity.units,
      sessionId: entity.sessionId,
      createdAt: new Date(entity.createdAt),
      reportedToStripe: entity.reportedToStripe,
    };
  }

  async recordUsage(input: RecordUsageInput): Promise<UsageRecord> {
    const row: UsageRecord = {
      id: uuidv4(),
      organizationId: input.organizationId,
      type: input.type,
      units: input.units ?? 1,
      sessionId: input.sessionId,
      createdAt: new Date(),
      reportedToStripe: false,
    };
    await this.table.createEntity(this.toEntity(row));
    return row;
  }

  /** Dedupes by sessionId — see the in-memory twin's countUsage for why (AAR-11). */
  async countUsage(organizationId: string, type: UsageType, since: Date = monthStart()): Promise<number> {
    const sinceIso = since.toISOString();
    const iterator = this.table.listEntities<UsageEntity>({
      queryOptions: {
        filter: odata`PartitionKey eq ${organizationId} and type eq ${type} and createdAt ge ${sinceIso}`,
      },
    });
    let total = 0;
    const seenSessionIds = new Set<string>();
    for await (const entity of iterator) {
      const row = entity as UsageEntity;
      if (row.sessionId) {
        if (seenSessionIds.has(row.sessionId)) continue;
        seenSessionIds.add(row.sessionId);
      }
      total += row.units;
    }
    return total;
  }

  async hasRecordedSession(organizationId: string, type: UsageType, sessionId: string, since: Date = monthStart()): Promise<boolean> {
    const sinceIso = since.toISOString();
    const iterator = this.table.listEntities<UsageEntity>({
      queryOptions: {
        filter: odata`PartitionKey eq ${organizationId} and type eq ${type} and sessionId eq ${sessionId} and createdAt ge ${sinceIso}`,
      },
    });
    for await (const _entity of iterator) return true;
    return false;
  }

  async listUsage(organizationId: string, since?: Date): Promise<UsageRecord[]> {
    const filter = since
      ? odata`PartitionKey eq ${organizationId} and createdAt ge ${since.toISOString()}`
      : odata`PartitionKey eq ${organizationId}`;
    const iterator = this.table.listEntities<UsageEntity>({ queryOptions: { filter } });
    const rows: UsageRecord[] = [];
    for await (const entity of iterator) {
      rows.push(this.fromEntity(entity as UsageEntity));
    }
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listUnreported(): Promise<UsageRecord[]> {
    const iterator = this.table.listEntities<UsageEntity>({
      queryOptions: { filter: odata`reportedToStripe eq ${false}` },
    });
    const rows: UsageRecord[] = [];
    for await (const entity of iterator) {
      rows.push(this.fromEntity(entity as UsageEntity));
    }
    return rows;
  }

  async markReported(ids: string[]): Promise<void> {
    // Caller passes a small batch; look each up to get its partition key.
    for (const id of ids) {
      const iterator = this.table.listEntities<UsageEntity>({
        queryOptions: { filter: odata`RowKey eq ${id}` },
      });
      for await (const entity of iterator) {
        await this.table.updateEntity({ ...(entity as UsageEntity), reportedToStripe: true }, 'Merge');
      }
    }
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<UsageEntity>();
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
