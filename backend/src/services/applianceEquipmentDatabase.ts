/**
 * In-Memory Appliance Equipment Database Service
 *
 * A1 — per-truck inventory. Each ApplianceEquipment is a piece of equipment on
 * exactly ONE appliance, optionally located in a zone. Production uses the Table
 * Storage twin (tableStorageApplianceEquipmentDatabase.ts), selected by the
 * factory — keep the two in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ApplianceEquipment } from '../types';
import { slugify } from '../utils/slug';

export interface ApplianceEquipmentInput {
  applianceId: string;
  stationId?: string;
  name: string;
  equipmentCode?: string;
  zoneId?: string;
  serialNumber?: string;
  notes?: string;
  active?: boolean;
}

export type ApplianceEquipmentPatch = Partial<Omit<ApplianceEquipment, 'id' | 'applianceId' | 'createdAt' | 'updatedAt'>>;

export interface IApplianceEquipmentDatabase {
  create(input: ApplianceEquipmentInput): Promise<ApplianceEquipment>;
  getById(id: string): Promise<ApplianceEquipment | null>;
  update(id: string, patch: ApplianceEquipmentPatch): Promise<ApplianceEquipment | null>;
  delete(id: string): Promise<boolean>;
  /** All equipment on one appliance, name-sorted; pass includeInactive to keep retired rows. */
  listForAppliance(applianceId: string, includeInactive?: boolean): Promise<ApplianceEquipment[]>;
  clear(): Promise<void>;
}

/** Canonical equipmentCode slug derived from a name (undefined when empty). */
export function slugifyEquipmentName(name: string): string | undefined {
  return slugify(name) || undefined;
}

/** Sort equipment by name for a deterministic list. */
export function sortEquipment(items: ApplianceEquipment[]): ApplianceEquipment[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export class ApplianceEquipmentDatabase implements IApplianceEquipmentDatabase {
  private rows: Map<string, ApplianceEquipment> = new Map();

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
    this.rows.set(row.id, row);
    return row;
  }

  async getById(id: string): Promise<ApplianceEquipment | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: ApplianceEquipmentPatch): Promise<ApplianceEquipment | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.equipmentCode !== undefined) row.equipmentCode = patch.equipmentCode;
    if (patch.zoneId !== undefined) row.zoneId = patch.zoneId;
    if (patch.serialNumber !== undefined) row.serialNumber = patch.serialNumber;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.active !== undefined) row.active = patch.active;
    if (patch.stationId !== undefined) row.stationId = patch.stationId;
    row.updatedAt = new Date();
    return row;
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async listForAppliance(applianceId: string, includeInactive = false): Promise<ApplianceEquipment[]> {
    return sortEquipment(
      Array.from(this.rows.values())
        .filter((e) => e.applianceId === applianceId && (includeInactive || e.active)),
    );
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: ApplianceEquipmentDatabase | null = null;

export function getApplianceEquipmentDatabase(): ApplianceEquipmentDatabase {
  if (!instance) {
    instance = new ApplianceEquipmentDatabase();
  }
  return instance;
}
