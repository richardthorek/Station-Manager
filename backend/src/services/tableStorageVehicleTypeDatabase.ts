/**
 * Azure Table Storage Vehicle Type Database Service
 *
 * Production twin of VehicleTypeDatabase. One entity per vehicle type.
 * Partition strategy: a single 'VehicleType' partition with rowKey = id, plus
 * `organizationId`/`isStandard` columns — type volume is low, so a filtered
 * single-partition scan for "my org's types + all standards" is cheap and keeps
 * getById a direct point read. `standardItems` is stored as a JSON string. Keep
 * in sync with the in-memory twin.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { VehicleType } from '../types';
import {
  normaliseStandardItems,
  type IVehicleTypeDatabase,
  type VehicleTypeInput,
  type VehicleTypePatch,
} from './vehicleTypeDatabase';

const PARTITION = 'VehicleType';

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

interface VehicleTypeEntity extends TableEntity {
  organizationId?: string;
  isStandard: boolean;
  code: string;
  name: string;
  description?: string;
  category?: string;
  agency?: string;
  standardItems: string; // JSON
  createdBy?: string;
  seedVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export class TableStorageVehicleTypeDatabase implements IVehicleTypeDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('VehicleTypes');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create VehicleTypes table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for vehicle types', { tableName });
  }

  private toEntity(row: VehicleType): VehicleTypeEntity {
    return {
      partitionKey: PARTITION,
      rowKey: row.id,
      organizationId: row.organizationId,
      isStandard: row.isStandard,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      agency: row.agency,
      standardItems: JSON.stringify(row.standardItems),
      createdBy: row.createdBy,
      seedVersion: row.seedVersion,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private fromEntity(entity: VehicleTypeEntity): VehicleType {
    return {
      id: entity.rowKey as string,
      organizationId: entity.organizationId || undefined,
      isStandard: Boolean(entity.isStandard),
      code: entity.code,
      name: entity.name,
      description: entity.description || undefined,
      category: entity.category || undefined,
      agency: entity.agency || undefined,
      standardItems: entity.standardItems ? JSON.parse(entity.standardItems) : [],
      createdBy: entity.createdBy || undefined,
      seedVersion: entity.seedVersion,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }

  async create(input: VehicleTypeInput): Promise<VehicleType> {
    const now = new Date();
    const row: VehicleType = {
      id: uuidv4(),
      organizationId: input.organizationId,
      isStandard: Boolean(input.isStandard),
      code: input.code,
      name: input.name,
      description: input.description,
      category: input.category,
      agency: input.agency,
      standardItems: normaliseStandardItems(input.standardItems),
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    await this.table.createEntity(this.toEntity(row));
    return row;
  }

  async getById(id: string): Promise<VehicleType | null> {
    try {
      const entity = await this.table.getEntity<VehicleTypeEntity>(PARTITION, id);
      return this.fromEntity(entity as VehicleTypeEntity);
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async update(id: string, patch: VehicleTypePatch): Promise<VehicleType | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated: VehicleType = {
      ...existing,
      ...('code' in patch && patch.code !== undefined ? { code: patch.code } : {}),
      ...('name' in patch && patch.name !== undefined ? { name: patch.name } : {}),
      ...('description' in patch ? { description: patch.description } : {}),
      ...('category' in patch ? { category: patch.category } : {}),
      ...('isStandard' in patch && patch.isStandard !== undefined ? { isStandard: patch.isStandard } : {}),
      ...('standardItems' in patch && patch.standardItems !== undefined
        ? { standardItems: normaliseStandardItems(patch.standardItems) }
        : {}),
      updatedAt: new Date(),
    };
    await this.table.updateEntity(this.toEntity(updated), 'Replace');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.table.deleteEntity(PARTITION, id);
      return true;
    } catch (err: any) {
      if (err.statusCode === 404) return false;
      throw err;
    }
  }

  async upsert(type: VehicleType): Promise<VehicleType> {
    // Mirror the in-memory twin: the seeder calls this directly with the raw
    // constant data, which omits `id` on each item — without normalising here,
    // every standard item is persisted with no id, which 400s every save
    // ("itemId is required") the instant a crew taps Done/Issue/Skip on it.
    const normalised: VehicleType = { ...type, standardItems: normaliseStandardItems(type.standardItems) };
    await this.table.upsertEntity(this.toEntity(normalised), 'Replace');
    return normalised;
  }

  async listForOrganization(organizationId?: string): Promise<VehicleType[]> {
    const filter = organizationId
      ? odata`PartitionKey eq ${PARTITION} and (isStandard eq true or organizationId eq ${organizationId})`
      : odata`PartitionKey eq ${PARTITION} and isStandard eq true`;
    const iterator = this.table.listEntities<VehicleTypeEntity>({ queryOptions: { filter } });
    const rows: VehicleType[] = [];
    for await (const entity of iterator) rows.push(this.fromEntity(entity as VehicleTypeEntity));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listStandards(): Promise<VehicleType[]> {
    const iterator = this.table.listEntities<VehicleTypeEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${PARTITION} and isStandard eq true` },
    });
    const rows: VehicleType[] = [];
    for await (const entity of iterator) rows.push(this.fromEntity(entity as VehicleTypeEntity));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<VehicleTypeEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${PARTITION}` },
    });
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
