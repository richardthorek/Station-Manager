/**
 * In-Memory Appliance Zone Database Service
 *
 * A1 — per-truck spatial model. Each ApplianceZone is a named physical area on
 * exactly ONE appliance (every truck is unique), ordered for the agent
 * walk-around. Production uses the Table Storage twin
 * (tableStorageApplianceZoneDatabase.ts), selected by the factory — keep the
 * two in sync.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ApplianceZone } from '../types';
import { slugify } from '../utils/slug';

export interface ApplianceZoneInput {
  applianceId: string;
  stationId?: string;
  name: string;
  zoneCode?: string;
  parentZoneId?: string;
  side?: ApplianceZone['side'];
  order?: number;
  description?: string;
}

export type ApplianceZonePatch = Partial<Omit<ApplianceZone, 'id' | 'applianceId' | 'createdAt' | 'updatedAt'>>;

export interface IApplianceZoneDatabase {
  create(input: ApplianceZoneInput): Promise<ApplianceZone>;
  getById(id: string): Promise<ApplianceZone | null>;
  update(id: string, patch: ApplianceZonePatch): Promise<ApplianceZone | null>;
  delete(id: string): Promise<boolean>;
  /** All zones on one appliance, in walk-around order. */
  listForAppliance(applianceId: string): Promise<ApplianceZone[]>;
  clear(): Promise<void>;
}

/** Order zones by their `order`, then name, so a list is always deterministic. */
export function sortZones(zones: ApplianceZone[]): ApplianceZone[] {
  return [...zones].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
}

/** Canonical zoneCode slug derived from a zone name (undefined when empty). */
export function slugifyName(name: string): string | undefined {
  return slugify(name) || undefined;
}

export class ApplianceZoneDatabase implements IApplianceZoneDatabase {
  private rows: Map<string, ApplianceZone> = new Map();

  async create(input: ApplianceZoneInput): Promise<ApplianceZone> {
    const now = new Date();
    // Default `order` to the end of the appliance's current list when not given.
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
    this.rows.set(row.id, row);
    return row;
  }

  async getById(id: string): Promise<ApplianceZone | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: ApplianceZonePatch): Promise<ApplianceZone | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.zoneCode !== undefined) row.zoneCode = patch.zoneCode;
    if (patch.parentZoneId !== undefined) row.parentZoneId = patch.parentZoneId;
    if (patch.side !== undefined) row.side = patch.side;
    if (patch.order !== undefined) row.order = patch.order;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.stationId !== undefined) row.stationId = patch.stationId;
    row.updatedAt = new Date();
    return row;
  }

  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async listForAppliance(applianceId: string): Promise<ApplianceZone[]> {
    return sortZones(Array.from(this.rows.values()).filter((z) => z.applianceId === applianceId));
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }
}

let instance: ApplianceZoneDatabase | null = null;

export function getApplianceZoneDatabase(): ApplianceZoneDatabase {
  if (!instance) {
    instance = new ApplianceZoneDatabase();
  }
  return instance;
}
