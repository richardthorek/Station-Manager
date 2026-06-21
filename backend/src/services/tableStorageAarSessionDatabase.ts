/**
 * Azure Table Storage AAR Session Database Service
 *
 * Production twin of AarSessionDatabase. Persists one entity per saved AAR
 * Studio review.
 * Partition strategy: PartitionKey = organizationId, RowKey = review id. This
 * makes the per-org listing a single-partition scan and the composite key means
 * a client-generated review id is always scoped to its org — two orgs can never
 * collide on, or read, the same row. Keep in sync with the in-memory twin.
 */

import { TableClient, TableEntity } from '@azure/data-tables';
import { logger } from './logger';
import type { AARSession } from '../types';
import type {
  IAarSessionDatabase,
  UpsertAarSessionInput,
  AarSessionSummary,
} from './aarSessionDatabase';

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

// A single Table Storage string property maxes out at 64 KiB and an entity at
// ~1 MiB total, so the JSON payload is chunked across `payload0..payloadN`
// properties (~32k chars each, safely under 64 KiB for BMP text) and the count
// is stored in `payloadChunks`. Reassembled on read; metadata columns stay
// addressable for the listing query.
const PAYLOAD_CHUNK_CHARS = 32000;

function chunkPayload(payload: string): { payloadChunks: number; chunks: Record<string, string> } {
  const chunks: Record<string, string> = {};
  let i = 0;
  for (let offset = 0; offset < payload.length; offset += PAYLOAD_CHUNK_CHARS) {
    chunks[`payload${i}`] = payload.slice(offset, offset + PAYLOAD_CHUNK_CHARS);
    i += 1;
  }
  return { payloadChunks: i, chunks };
}

function joinPayload(entity: Record<string, unknown>): string {
  const count = typeof entity.payloadChunks === 'number' ? entity.payloadChunks : 0;
  let payload = '';
  for (let i = 0; i < count; i++) {
    payload += (entity[`payload${i}`] as string) ?? '';
  }
  return payload;
}

interface AarSessionEntity extends TableEntity {
  stationId?: string;
  title: string;
  incidentDate?: string;
  schemaVersion: number;
  payloadChunks: number;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown; // payload0..payloadN
}

export class TableStorageAarSessionDatabase implements IAarSessionDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('AARSessions');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create AARSessions table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for AAR sessions', { tableName });
  }

  private toEntity(row: AARSession): AarSessionEntity {
    const { payloadChunks, chunks } = chunkPayload(row.payload);
    return {
      partitionKey: row.organizationId,
      rowKey: row.id,
      stationId: row.stationId,
      title: row.title,
      incidentDate: row.incidentDate,
      schemaVersion: row.schemaVersion,
      payloadChunks,
      ...chunks,
      createdBy: row.createdBy,
      createdByName: row.createdByName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private fromEntity(entity: AarSessionEntity): AARSession {
    return {
      id: entity.rowKey as string,
      organizationId: entity.partitionKey as string,
      stationId: entity.stationId,
      title: entity.title,
      incidentDate: entity.incidentDate,
      schemaVersion: entity.schemaVersion,
      payload: joinPayload(entity),
      createdBy: entity.createdBy,
      createdByName: entity.createdByName,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async upsert(input: UpsertAarSessionInput): Promise<AARSession> {
    const existing = await this.getById(input.organizationId, input.id);
    const now = new Date();
    const row: AARSession = {
      id: input.id,
      organizationId: input.organizationId,
      stationId: input.stationId,
      title: input.title,
      incidentDate: input.incidentDate,
      schemaVersion: input.schemaVersion,
      payload: input.payload,
      createdBy: existing ? existing.createdBy ?? input.createdBy : input.createdBy,
      createdByName: existing ? existing.createdByName ?? input.createdByName : input.createdByName,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    // upsertEntity (Replace) creates or fully replaces — idempotent for re-saves.
    await this.table.upsertEntity(this.toEntity(row), 'Replace');
    return row;
  }

  async getById(organizationId: string, id: string): Promise<AARSession | null> {
    try {
      const entity = await this.table.getEntity<AarSessionEntity>(organizationId, id);
      return this.fromEntity(entity as AarSessionEntity);
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async listByOrganization(organizationId: string): Promise<AarSessionSummary[]> {
    const iterator = this.table.listEntities<AarSessionEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${organizationId.replace(/'/g, "''")}'`,
        // Skip the (potentially large, chunked) payload columns in the listing.
        select: ['partitionKey', 'rowKey', 'stationId', 'title', 'incidentDate', 'schemaVersion', 'createdBy', 'createdByName', 'createdAt', 'updatedAt'],
      },
    });
    const rows: AarSessionSummary[] = [];
    for await (const entity of iterator) {
      // joinPayload returns '' here since the payload columns aren't selected.
      const { payload: _payload, ...summary } = this.fromEntity(entity as AarSessionEntity);
      rows.push(summary);
    }
    return rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    try {
      await this.table.deleteEntity(organizationId, id);
      return true;
    } catch (err: any) {
      if (err.statusCode === 404) return false;
      throw err;
    }
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<AarSessionEntity>();
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
