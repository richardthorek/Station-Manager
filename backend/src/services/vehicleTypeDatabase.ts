/**
 * In-Memory Vehicle Type Database Service
 *
 * A VehicleType owns a locked standard checklist; brigades adopt a type for
 * their vehicles and customise via a per-appliance overlay (never editing the
 * standard items). Org-scoped, with an `isStandard` flag marking a type
 * published as a shared standard any org can adopt. Production uses the Table
 * Storage twin (tableStorageVehicleTypeDatabase.ts), selected by the factory —
 * keep the two in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { VehicleType, ChecklistItem } from '../types';
import { slugify } from '../utils/slug';

export interface VehicleTypeInput {
  organizationId?: string;
  isStandard?: boolean;
  code: string;
  name: string;
  description?: string;
  category?: string;
  agency?: string;
  standardItems: ChecklistItem[];
  createdBy?: string;
}

export type VehicleTypePatch = Partial<Omit<VehicleType, 'id' | 'organizationId' | 'seedVersion' | 'createdAt' | 'updatedAt'>>;

export interface IVehicleTypeDatabase {
  create(input: VehicleTypeInput): Promise<VehicleType>;
  getById(id: string): Promise<VehicleType | null>;
  update(id: string, patch: VehicleTypePatch): Promise<VehicleType | null>;
  delete(id: string): Promise<boolean>;
  /** Idempotent insert-or-update: create if missing, update if present. Used by seeders. */
  upsert(type: VehicleType): Promise<VehicleType>;
  /** Types an org may use: its own + all published standards, by name. */
  listForOrganization(organizationId?: string): Promise<VehicleType[]>;
  listStandards(): Promise<VehicleType[]>;
  clear(): Promise<void>;
}

/** Ensure every standard item has a stable itemCode + isStandard flag + order. */
export function normaliseStandardItems(items: ChecklistItem[]): ChecklistItem[] {
  return (items ?? []).map((item, index) => ({
    ...item,
    id: item.id || uuidv4(),
    order: typeof item.order === 'number' ? item.order : index,
    itemCode: item.itemCode || slugify(item.name) || `item-${index + 1}`,
    isStandard: true,
  }));
}

export class VehicleTypeDatabase implements IVehicleTypeDatabase {
  private rows: Map<string, VehicleType> = new Map();

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
    this.rows.set(row.id, row);
    return row;
  }

  async getById(id: string): Promise<VehicleType | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: VehicleTypePatch): Promise<VehicleType | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.code !== undefined) row.code = patch.code;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.isStandard !== undefined) row.isStandard = patch.isStandard;
    if (patch.standardItems !== undefined) row.standardItems = normaliseStandardItems(patch.standardItems);
    row.updatedAt = new Date();
    return row;
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async upsert(type: VehicleType): Promise<VehicleType> {
    this.rows.set(type.id, type);
    return type;
  }

  async listForOrganization(organizationId?: string): Promise<VehicleType[]> {
    return Array.from(this.rows.values())
      .filter((t) => t.isStandard || (organizationId !== undefined && t.organizationId === organizationId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async listStandards(): Promise<VehicleType[]> {
    return Array.from(this.rows.values())
      .filter((t) => t.isStandard)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: VehicleTypeDatabase | null = null;

export function getVehicleTypeDatabase(): VehicleTypeDatabase {
  if (!instance) {
    instance = new VehicleTypeDatabase();
  }
  return instance;
}
