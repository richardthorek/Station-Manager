/**
 * Azure Table Storage Billing Event Database Service
 *
 * Production twin of BillingEventDatabase. Persists a Stripe webhook audit row
 * per event received.
 * Partition strategy: PartitionKey = organizationId (or '_global' when the event
 * carries no org metadata), RowKey = record id. Partitioning by org keeps the
 * per-org audit listing to a single-partition scan; the idempotency lookup by
 * Stripe event id is a low-volume filtered scan.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { BillingEvent } from '../types';
import type { IBillingEventDatabase, RecordBillingEventInput } from './billingEventDatabase';

/** Partition key used when an event carries no organizationId metadata. */
const GLOBAL_PARTITION = '_global';

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

interface BillingEventEntity extends TableEntity {
  stripeEventId: string;
  eventType: string;
  payload: string;
  processedAt: string;
  error?: string;
}

export class TableStorageBillingEventDatabase implements IBillingEventDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('BillingEvents');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create BillingEvents table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for billing events', { tableName });
  }

  private toEntity(row: BillingEvent): BillingEventEntity {
    return {
      partitionKey: row.organizationId || GLOBAL_PARTITION,
      rowKey: row.id,
      stripeEventId: row.stripeEventId,
      eventType: row.eventType,
      payload: row.payload,
      processedAt: row.processedAt.toISOString(),
      error: row.error,
    };
  }

  private fromEntity(entity: BillingEventEntity): BillingEvent {
    const partitionKey = entity.partitionKey as string;
    return {
      id: entity.rowKey as string,
      organizationId: partitionKey === GLOBAL_PARTITION ? undefined : partitionKey,
      stripeEventId: entity.stripeEventId,
      eventType: entity.eventType,
      payload: entity.payload,
      processedAt: new Date(entity.processedAt),
      error: entity.error,
    };
  }

  async record(input: RecordBillingEventInput): Promise<BillingEvent> {
    const row: BillingEvent = { id: uuidv4(), processedAt: new Date(), ...input };
    await this.table.createEntity(this.toEntity(row));
    return row;
  }

  async findByStripeEventId(stripeEventId: string): Promise<BillingEvent | null> {
    const iterator = this.table.listEntities<BillingEventEntity>({
      queryOptions: { filter: odata`stripeEventId eq ${stripeEventId}` },
    });
    for await (const entity of iterator) {
      return this.fromEntity(entity as BillingEventEntity);
    }
    return null;
  }

  async listByOrganization(organizationId: string): Promise<BillingEvent[]> {
    const iterator = this.table.listEntities<BillingEventEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${organizationId}` },
    });
    const rows: BillingEvent[] = [];
    for await (const entity of iterator) {
      rows.push(this.fromEntity(entity as BillingEventEntity));
    }
    return rows.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }

  async listAll(): Promise<BillingEvent[]> {
    const iterator = this.table.listEntities<BillingEventEntity>();
    const rows: BillingEvent[] = [];
    for await (const entity of iterator) {
      rows.push(this.fromEntity(entity as BillingEventEntity));
    }
    return rows.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<BillingEventEntity>();
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
