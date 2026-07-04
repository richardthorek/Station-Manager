/**
 * Azure Table Storage Device Database Service
 *
 * Production twin of DeviceDatabase. One entity per device. Partition
 * strategy mirrors tableStorageVehicleTypeDatabase.ts: a single 'Device'
 * partition with rowKey = id — device volume per org/station is low, so a
 * filtered single-partition scan (for "my org's devices" or "token lookup")
 * is cheap and keeps getById a direct point read. Keep in sync with the
 * in-memory twin.
 */

import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import type { Device, DeviceType, DeviceStatus } from '../types';
import { isDeviceLive, type IDeviceDatabase, type DeviceInput, type DevicePatch } from './deviceDatabase';

const PARTITION = 'Device';

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

interface DeviceEntity extends TableEntity {
  organizationId?: string;
  stationId: string;
  type: DeviceType;
  name: string;
  token: string;
  status: DeviceStatus;
  description?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export class TableStorageDeviceDatabase implements IDeviceDatabase {
  private connectionString: string;
  private table!: TableClient;
  private isConnected = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    const tableName = buildTableName('Devices');
    this.table = TableClient.fromConnectionString(this.connectionString, tableName);
    try {
      await this.table.createTable();
    } catch (err: any) {
      if (err.statusCode !== 409) {
        logger.error('Failed to create Devices table', { error: err, tableName });
        throw err;
      }
    }
    this.isConnected = true;
    logger.info('Connected to Azure Table Storage for devices', { tableName });
  }

  private toEntity(row: Device): DeviceEntity {
    return {
      partitionKey: PARTITION,
      rowKey: row.id,
      organizationId: row.organizationId,
      stationId: row.stationId,
      type: row.type,
      name: row.name,
      token: row.token,
      status: row.status,
      description: row.description,
      lastSeenAt: row.lastSeenAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
    };
  }

  private fromEntity(entity: DeviceEntity): Device {
    return {
      id: entity.rowKey as string,
      organizationId: entity.organizationId || undefined,
      stationId: entity.stationId,
      type: entity.type,
      name: entity.name,
      token: entity.token,
      status: entity.status,
      description: entity.description || undefined,
      lastSeenAt: entity.lastSeenAt ? new Date(entity.lastSeenAt) : undefined,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
      expiresAt: entity.expiresAt ? new Date(entity.expiresAt) : undefined,
    };
  }

  async create(input: DeviceInput): Promise<Device> {
    const now = new Date();
    const row: Device = {
      id: uuidv4(),
      organizationId: input.organizationId,
      stationId: input.stationId,
      type: input.type,
      name: input.name,
      token: randomUUID(),
      status: 'active',
      description: input.description,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
    };
    await this.table.createEntity(this.toEntity(row));
    return row;
  }

  async getById(id: string): Promise<Device | null> {
    try {
      const entity = await this.table.getEntity<DeviceEntity>(PARTITION, id);
      return this.fromEntity(entity as DeviceEntity);
    } catch (err: any) {
      if (err.statusCode === 404) return null;
      throw err;
    }
  }

  async getByToken(token: string): Promise<Device | null> {
    const iterator = this.table.listEntities<DeviceEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${PARTITION} and token eq ${token}` },
    });
    for await (const entity of iterator) {
      const row = this.fromEntity(entity as DeviceEntity);
      return isDeviceLive(row) ? row : null;
    }
    return null;
  }

  async update(id: string, patch: DevicePatch): Promise<Device | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated: Device = {
      ...existing,
      ...('name' in patch && patch.name !== undefined ? { name: patch.name } : {}),
      ...('description' in patch ? { description: patch.description } : {}),
      ...('status' in patch && patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: new Date(),
    };
    await this.table.updateEntity(this.toEntity(updated), 'Replace');
    return updated;
  }

  async touchLastSeen(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const updated: Device = { ...existing, lastSeenAt: new Date() };
    await this.table.updateEntity(this.toEntity(updated), 'Merge');
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

  async listForOrganization(organizationId?: string): Promise<Device[]> {
    const filter = organizationId
      ? odata`PartitionKey eq ${PARTITION} and organizationId eq ${organizationId}`
      : odata`PartitionKey eq ${PARTITION}`;
    const iterator = this.table.listEntities<DeviceEntity>({ queryOptions: { filter } });
    const rows: Device[] = [];
    for await (const entity of iterator) rows.push(this.fromEntity(entity as DeviceEntity));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listForStation(stationId: string): Promise<Device[]> {
    const iterator = this.table.listEntities<DeviceEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${PARTITION} and stationId eq ${stationId}` },
    });
    const rows: Device[] = [];
    for await (const entity of iterator) rows.push(this.fromEntity(entity as DeviceEntity));
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async clear(): Promise<void> {
    const iterator = this.table.listEntities<DeviceEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${PARTITION}` },
    });
    for await (const entity of iterator) {
      await this.table.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
    }
  }
}
