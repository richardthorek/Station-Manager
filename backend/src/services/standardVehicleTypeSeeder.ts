/**
 * Standard Vehicle Type Seeder
 *
 * Idempotent provisioning of pre-configured vehicle type templates. Runs on
 * app startup; uses deterministic IDs (`std-<code>`) and `seedVersion` markers
 * to detect when seeded templates change, updating in-place without duplication.
 *
 * Single-instance safe: multiple replicas call concurrently, but `upsert`
 * (insert-or-replace) handles races. If the seed changes (template content or
 * SEED_VERSION bumped), all running instances re-seed independently.
 */

import { logger } from './logger';
import { STANDARD_VEHICLE_TYPES, SEED_VERSION } from '../constants/standardVehicleTypes';
import type { IVehicleTypeDatabase } from './vehicleTypeDatabase';

let seeded = false;
let seedingInProgress = false;

export function resetForTesting(): void {
  seeded = false;
  seedingInProgress = false;
}

export async function seedStandardVehicleTypesIfNeeded(db: IVehicleTypeDatabase): Promise<void> {
  if (seeded || seedingInProgress) return;
  if (process.env.SEED_STANDARD_VEHICLE_TYPES === 'false') {
    logger.info('Standard vehicle type seeding disabled via SEED_STANDARD_VEHICLE_TYPES=false');
    seeded = true;
    return;
  }

  seedingInProgress = true;
  try {
    let created = 0;
    let updated = 0;

    for (const template of STANDARD_VEHICLE_TYPES) {
      const existing = await db.getById(template.id);
      if (!existing) {
        await db.upsert(template);
        created++;
      } else if (existing.seedVersion !== SEED_VERSION) {
        // Seed version changed: update the template in place
        const refreshed = { ...template, updatedAt: new Date() };
        await db.upsert(refreshed);
        updated++;
      }
    }

    logger.info(`Standard vehicle types seeded: ${created} created, ${updated} updated`, { seedVersion: SEED_VERSION });
  } catch (err) {
    logger.error('Failed to seed standard vehicle types', { error: err });
    throw err;
  } finally {
    seedingInProgress = false;
    seeded = true;
  }
}
