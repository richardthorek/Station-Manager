/**
 * In-Memory Device Database Service
 *
 * A Device is a first-class, named, typed, revocable credential for a
 * brigade-locked kiosk/tablet/phone/wearable (AC-5) — formalising the
 * anonymous `BrigadeAccessToken` UUID. Org-scoped, low volume per station, so
 * a single Map with filter scans (mirroring vehicleTypeDatabase.ts) is fine.
 * Production uses the Table Storage twin (tableStorageDeviceDatabase.ts),
 * selected by the factory — keep the two in sync.
 */

import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Device, DeviceType } from '../types';

export interface DeviceInput {
  organizationId?: string;
  stationId: string;
  type: DeviceType;
  name: string;
  description?: string;
  expiresAt?: Date;
}

export type DevicePatch = Partial<Pick<Device, 'name' | 'description' | 'status'>>;

export interface IDeviceDatabase {
  create(input: DeviceInput): Promise<Device>;
  getById(id: string): Promise<Device | null>;
  /** Resolves a live (active, unexpired) device by its token — used for kiosk validation. */
  getByToken(token: string): Promise<Device | null>;
  update(id: string, patch: DevicePatch): Promise<Device | null>;
  touchLastSeen(id: string): Promise<void>;
  delete(id: string): Promise<boolean>;
  listForOrganization(organizationId?: string): Promise<Device[]>;
  listForStation(stationId: string): Promise<Device[]>;
  clear(): Promise<void>;
}

/** True when a device is usable right now: active status, not past its expiry. */
export function isDeviceLive(device: Device): boolean {
  if (device.status !== 'active') return false;
  if (device.expiresAt && device.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export class DeviceDatabase implements IDeviceDatabase {
  private rows: Map<string, Device> = new Map();

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
    this.rows.set(row.id, row);
    return row;
  }

  async getById(id: string): Promise<Device | null> {
    return this.rows.get(id) ?? null;
  }

  async getByToken(token: string): Promise<Device | null> {
    for (const row of this.rows.values()) {
      if (row.token === token) {
        return isDeviceLive(row) ? row : null;
      }
    }
    return null;
  }

  async update(id: string, patch: DevicePatch): Promise<Device | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.status !== undefined) row.status = patch.status;
    row.updatedAt = new Date();
    return row;
  }

  async touchLastSeen(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.lastSeenAt = new Date();
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async listForOrganization(organizationId?: string): Promise<Device[]> {
    return Array.from(this.rows.values())
      .filter((d) => organizationId === undefined || d.organizationId === organizationId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listForStation(stationId: string): Promise<Device[]> {
    return Array.from(this.rows.values())
      .filter((d) => d.stationId === stationId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: DeviceDatabase | null = null;

export function getDeviceDatabase(): DeviceDatabase {
  if (!instance) {
    instance = new DeviceDatabase();
  }
  return instance;
}
