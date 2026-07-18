import { seedStandardVehicleTypesIfNeeded, resetForTesting } from '../services/standardVehicleTypeSeeder';
import { VehicleTypeDatabase } from '../services/vehicleTypeDatabase';
import { STANDARD_VEHICLE_TYPES, SEED_VERSION } from '../constants/standardVehicleTypes';

// Helper to simulate seed version change
function simulateSeedVersionChange(db: VehicleTypeDatabase): void {
  resetForTesting();
}

describe('standardVehicleTypeSeeder', () => {
  let db: VehicleTypeDatabase;

  beforeEach(() => {
    resetForTesting();
    db = new VehicleTypeDatabase();
  });

  test('seeds 21 standard vehicle types', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    expect(types).toHaveLength(21);
  });

  test('seeded types have agency field', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    types.forEach((t) => {
      expect(t.agency).toBeDefined();
      expect(['NSW RFS', 'Fire and Rescue NSW', 'NSW SES', 'Marine Rescue NSW', 'Generic']).toContain(t.agency);
    });
  });

  test('seeded types have seedVersion marker', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    types.forEach((t) => {
      expect(t.seedVersion).toBe(SEED_VERSION);
    });
  });

  test('all items have stable itemCode', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    types.forEach((t) => {
      t.standardItems.forEach((item) => {
        expect(item.itemCode).toBeDefined();
        expect(typeof item.itemCode).toBe('string');
        expect(item.itemCode!.length).toBeGreaterThan(0);
      });
    });
  });

  test('seeding is idempotent', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const typesAfterFirstSeed = await db.listStandards();

    await seedStandardVehicleTypesIfNeeded(db);
    const typesAfterSecondSeed = await db.listStandards();

    expect(typesAfterSecondSeed).toHaveLength(typesAfterFirstSeed.length);
  });

  test('seed version bump updates existing types', async () => {
    // First seed
    await seedStandardVehicleTypesIfNeeded(db);
    const typeAfterFirstSeed = await db.getById('std-cat1-tanker');
    expect(typeAfterFirstSeed?.seedVersion).toBe(SEED_VERSION);

    // Simulate seed version bump by clearing and reseeding with updated version
    await db.clear();
    simulateSeedVersionChange(db);
    await seedStandardVehicleTypesIfNeeded(db);
    const typeAfterSecondSeed = await db.getById('std-cat1-tanker');
    expect(typeAfterSecondSeed?.seedVersion).toBe(SEED_VERSION);
  });

  test('built-in types have no organizationId', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    types.forEach((t) => {
      expect(t.organizationId).toBeUndefined();
    });
  });

  test('built-in types are marked as standard', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    types.forEach((t) => {
      expect(t.isStandard).toBe(true);
    });
  });

  // R5 (2026-07-18 template review): these 5 NSW RFS road appliances were
  // rebuilt against real, brigade-accepted check sheets — lock in the
  // safety-critical items the review found missing so a future seed edit
  // can't silently drop them again.
  describe('NSW RFS road-appliance safety items (template review acceptance fixture)', () => {
    const roadTypeIds = ['std-cat1-tanker', 'std-cat6-tanker', 'std-cat7-tanker', 'std-urban-pumper', 'std-group-personnel-vehicle'];

    test('every road appliance keeps the universal safety-critical items', async () => {
      await seedStandardVehicleTypesIfNeeded(db);
      const universalSafety = ['no-leaks-under-vehicle', 'battery-secure', 'fire-extinguisher', 'aed-status', 'first-aid-kit', 'mdt-charger-disconnect', 'mdt-charger-reconnect'];
      for (const id of roadTypeIds) {
        const type = await db.getById(id);
        expect(type).not.toBeNull();
        const codes = type!.standardItems.map((i) => i.itemCode);
        for (const required of universalSafety) {
          expect(codes).toContain(required);
        }
      }
    });

    test('air-braked appliances (Cat 1 / Cat 6 / Urban Pumper) keep the brake air tank bleed check', async () => {
      await seedStandardVehicleTypesIfNeeded(db);
      for (const id of ['std-cat1-tanker', 'std-cat6-tanker', 'std-urban-pumper']) {
        const type = await db.getById(id);
        expect(type!.standardItems.map((i) => i.itemCode)).toContain('air-brake-bleed');
      }
    });

    test('Cat 6 Tanker is distinguished from a bare bulk-water carrier by its firefighting kit', async () => {
      await seedStandardVehicleTypesIfNeeded(db);
      const cat6 = await db.getById('std-cat6-tanker');
      expect(cat6).not.toBeNull();
      expect(cat6!.standardItems.map((i) => i.itemCode)).toContain('monitor-firefighting-kit');
    });
  });
});
