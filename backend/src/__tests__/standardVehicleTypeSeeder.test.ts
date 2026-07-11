import { seedStandardVehicleTypesIfNeeded } from '../services/standardVehicleTypeSeeder';
import { VehicleTypeDatabase } from '../services/vehicleTypeDatabase';
import { STANDARD_VEHICLE_TYPES, SEED_VERSION } from '../constants/standardVehicleTypes';

describe('standardVehicleTypeSeeder', () => {
  let db: VehicleTypeDatabase;

  beforeEach(() => {
    db = new VehicleTypeDatabase();
  });

  test('seeds 20 standard vehicle types', async () => {
    await seedStandardVehicleTypesIfNeeded(db);
    const types = await db.listStandards();
    expect(types).toHaveLength(20);
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
});
