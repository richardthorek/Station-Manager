/**
 * Azure Table Storage Appliance Equipment Database Service
 *
 * Production twin of ApplianceEquipmentDatabase. One entity per equipment item.
 * Partition strategy: PartitionKey = applianceId, rowKey = id — "all equipment
 * on this truck" is a single cheap partition scan. Keep in sync with the
 * in-memory twin.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { ApplianceEquipment } from '../types';
import {
  sortEquipment,
  slugifyEquipmentName,
  type IApplianceEquipmentDatabase,
  type ApplianceEquipmentInput,
  type ApplianceEquipmentPatch,
} from './applianceEquipmentDatabase';

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

interface ApplianceEquipmentEntity extends TableEntity {
  applianceId: string;
  stationId?: string;
  name: string;
  equipmentCode?: string;
  zoneId?: string;
  serialNumber?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export class TableStorageApplianceEquipmentDatabase implements IApplianceEquipmentDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('ApplianceEquipment');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create ApplianceEquipment table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for appliance equipment', { tableName });
  }

  private toEntity(row: ApplianceEquipment): ApplianceEquipmentEntity {
    return {
      partitionKey: row.applianceId,
      rowKey: row.id,
      applianceId: row.applianceId,
      stationId: row.stationId,
      name: row.name,
      equipmentCode: row.equipmentCode,
      zoneId: row.zoneId,
      serialNumber: row.serialNumber,
      notes: row.notes,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private fromEntity(entity: ApplianceEquipmentEntity): ApplianceEquipment {
    return {
      id: entity.rowKey as string,
      applianceId: entity.applianceId,
      stationId: entity.stationId || undefined,
      name: entity.name,
      equipmentCode: entity.equipmentCode || undefined,
      zoneId: entity.zoneId || undefined,
      serialNumber: entity.serialNumber || undefined,
      notes: entity.notes || undefined,
      active: entity.active !== false,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async create(input: ApplianceEquipmentInput): Promise<ApplianceEquipment> {
    const now = new Date();
    const row: ApplianceEquipment = {
      id: uuidv4(),
      applianceId: input.applianceId,
      stationId: input.stationId,
      name: input.name,
      equipmentCode: input.equipmentCode || slugifyEquipmentName(input.name),
      zoneId: input.zoneId,
      serialNumber: input.serialNumber,
      notes: input.notes,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await this.table.createEntity(this.toEntity(row));
    return row;
  }

  /** Find an item's owning appliance partition by scanning on rowKey (id-only paths). */
  private async findEntity(id: string): Promise<ApplianceEquipmentEntity | null> {
    const iterator = this.table.listEntities<ApplianceEquipmentEntity>({
      queryOptions: { filter: odata`RowKey eq ${id}` },
    });
    for await (const entity of iterator) return entity as ApplianceEquipmentEntity;
    return null;
  }

  async getById(id: string): Promise<ApplianceEquipment | null> {
    const entity = await this.findEntity(id);
    return entity ? this.fromEntity(entity) : null;
  }

  async update(id: string, patch: ApplianceEquipmentPatch): Promise<ApplianceEquipment | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated: ApplianceEquipment = {
      ...existing,
      ...('name' in patch && patch.name !== undefined ? { name: patch.name } : {}),
      ...('equipmentCode' in patch ? { equipmentCode: patch.equipmentCode } : {}),
      ...('zoneId' in patch ? { zoneId: patch.zoneId } : {}),
      ...('serialNumber' in patch ? { serialNumber: patch.serialNumber } : {}),
      ...('notes' in patch ? { notes: patch.notes } : {}),
      ...('active' in patch && patch.active !== undefined ? { active: patch.active } : {}),
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

  async listForAppliance(applianceId: string, includeInactive = false): Promise<ApplianceEquipment[]> {
    const iterator = this.table.listEntities<ApplianceEquipmentEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${applianceId}` },
    });
    const rows: ApplianceEquipment[] = [];
    for await (const entity of iterator) {
      const row = this.fromEntity(entity as ApplianceEquipmentEntity);
      if (includeInactive || row.active) rows.push(row);
    }
    return sortEquipment(rows);
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<ApplianceEquipmentEntity>({});
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
