/**
 * Azure Table Storage Appliance Zone Database Service
 *
 * Production twin of ApplianceZoneDatabase. One entity per zone.
 * Partition strategy: PartitionKey = applianceId, rowKey = id — so "all zones on
 * this truck" is a single cheap partition scan and getById is a point read once
 * the appliance is known (we look it up by rowKey across partitions only for the
 * id-only update/delete paths). Keep in sync with the in-memory twin.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { ApplianceZone } from '../types';
import {
  sortZones,
  slugifyName,
  type IApplianceZoneDatabase,
  type ApplianceZoneInput,
  type ApplianceZonePatch,
} from './applianceZoneDatabase';

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

interface ApplianceZoneEntity extends TableEntity {
  applianceId: string;
  stationId?: string;
  name: string;
  zoneCode?: string;
  parentZoneId?: string;
  side?: string;
  order: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export class TableStorageApplianceZoneDatabase implements IApplianceZoneDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('ApplianceZones');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create ApplianceZones table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for appliance zones', { tableName });
  }

  private toEntity(row: ApplianceZone): ApplianceZoneEntity {
    return {
      partitionKey: row.applianceId,
      rowKey: row.id,
      applianceId: row.applianceId,
      stationId: row.stationId,
      name: row.name,
      zoneCode: row.zoneCode,
      parentZoneId: row.parentZoneId,
      side: row.side,
      order: row.order,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private fromEntity(entity: ApplianceZoneEntity): ApplianceZone {
    return {
      id: entity.rowKey as string,
      applianceId: entity.applianceId,
      stationId: entity.stationId || undefined,
      name: entity.name,
      zoneCode: entity.zoneCode || undefined,
      parentZoneId: entity.parentZoneId || undefined,
      side: (entity.side as ApplianceZone['side']) || undefined,
      order: typeof entity.order === 'number' ? entity.order : 0,
      description: entity.description || undefined,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async create(input: ApplianceZoneInput): Promise<ApplianceZone> {
    const now = new Date();
    const order = typeof input.order === 'number'
      ? input.order
      : (await this.listForAppliance(input.applianceId)).length;
    const row: ApplianceZone = {
      id: uuidv4(),
      applianceId: input.applianceId,
      stationId: input.stationId,
      name: input.name,
      zoneCode: input.zoneCode || slugifyName(input.name),
      parentZoneId: input.parentZoneId,
      side: input.side,
      order,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    await this.table.createEntity(this.toEntity(row));
    return row;
  }

  /** Find a zone's owning appliance partition by scanning on rowKey (id-only paths). */
  private async findEntity(id: string): Promise<ApplianceZoneEntity | null> {
    const iterator = this.table.listEntities<ApplianceZoneEntity>({
      queryOptions: { filter: odata`RowKey eq ${id}` },
    });
    for await (const entity of iterator) return entity as ApplianceZoneEntity;
    return null;
  }

  async getById(id: string): Promise<ApplianceZone | null> {
    const entity = await this.findEntity(id);
    return entity ? this.fromEntity(entity) : null;
  }

  async update(id: string, patch: ApplianceZonePatch): Promise<ApplianceZone | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated: ApplianceZone = {
      ...existing,
      ...('name' in patch && patch.name !== undefined ? { name: patch.name } : {}),
      ...('zoneCode' in patch ? { zoneCode: patch.zoneCode } : {}),
      ...('parentZoneId' in patch ? { parentZoneId: patch.parentZoneId } : {}),
      ...('side' in patch ? { side: patch.side } : {}),
      ...('order' in patch && patch.order !== undefined ? { order: patch.order } : {}),
      ...('description' in patch ? { description: patch.description } : {}),
      ...('stationId' in patch ? { stationId: patch.stationId } : {}),
      updatedAt: new Date(),
    };
    await this.table.updateEntity(this.toEntity(updated), 'Replace');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const entity = await this.findEntity(id);
    if (!entity) return false;
    await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    return true;
  }

  async listForAppliance(applianceId: string): Promise<ApplianceZone[]> {
    const iterator = this.table.listEntities<ApplianceZoneEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${applianceId}` },
    });
    const rows: ApplianceZone[] = [];
    for await (const entity of iterator) rows.push(this.fromEntity(entity as ApplianceZoneEntity));
    return sortZones(rows);
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<ApplianceZoneEntity>({});
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
