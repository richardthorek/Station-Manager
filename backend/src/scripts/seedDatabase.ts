/**
 * Comprehensive Database Seeding Script
 * 
 * Seeds activities and members for test, development, and production environments.
 * Uses TABLE_STORAGE_TABLE_SUFFIX to target the appropriate table set.
 * 
 * Usage:
 *   npm run seed:test    - Seed test environment (tables suffixed with 'Test')
 *   npm run seed:dev     - Seed development environment (tables suffixed with 'Dev')
 *   npm run seed:prod    - Seed production environment (no suffix)
 * 
 * Or manually:
 *   NODE_ENV=test TABLE_STORAGE_TABLE_SUFFIX=Test ts-node src/scripts/seedDatabase.ts
 *   NODE_ENV=development TABLE_STORAGE_TABLE_SUFFIX=Dev ts-node src/scripts/seedDatabase.ts
 *   NODE_ENV=production ts-node src/scripts/seedDatabase.ts
 */

import dotenv from 'dotenv';

// Load environment variables so Table Storage credentials are available
dotenv.config();

import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';

// Consistent activities across all environments
const STANDARD_ACTIVITIES = [
  'Training',
  'Maintenance',
  'Meeting',
  'Brigade Training',
  'District Training',
];

// Sample members for test/dev environments (production would use real members)
const SAMPLE_MEMBERS = [
  'John Smith',
  'Sarah Johnson',
  'Michael Brown',
  'Emily Davis',
  'David Wilson',
  'Lisa Anderson',
  'James Taylor',
  'Jennifer Martinez',
  'Robert Lee',
  'Mary Williams',
  'Christopher Thompson',
  'Patricia Garcia',
  'Daniel Rodriguez',
  'Linda Martinez',
  'Matthew Anderson',
  'Barbara Thomas',
  'Joseph Jackson',
  'Elizabeth White',
  'Charles Harris',
  'Susan Clark',
];

async function seedDatabase() {
  const environment = process.env.NODE_ENV || 'development';
  const tableSuffix = process.env.TABLE_STORAGE_TABLE_SUFFIX || '';
  
  console.log(`\n🌱 Seeding database for environment: ${environment}`);
  if (tableSuffix) {
    console.log(`📋 Table suffix: '${tableSuffix}'`);
  }
  console.log('');

  try {
    const db = await ensureDatabase();
    const truckChecksDb = await ensureTruckChecksDatabase();

    // Seed Activities
    console.log('📚 Seeding activities...');
    const existing = await db.getAllActivities();
    const existingNames = new Set(existing.map(a => a.name.toLowerCase()));
    
    let activitiesCreated = 0;
    for (const name of STANDARD_ACTIVITIES) {
      if (existingNames.has(name.toLowerCase())) {
        console.log(`  ✓ Activity already exists: ${name}`);
      } else {
        await db.createActivity(name, 'seed-script');
        console.log(`  ✅ Created activity: ${name}`);
        activitiesCreated++;
      }
    }
    console.log(`📚 Activities: ${activitiesCreated} created, ${existing.length} total\n`);

    // Seed Members (for test and dev environments only)
    if (environment === 'test' || environment === 'development') {
      console.log('👥 Seeding sample members...');
      const existingMembers = await db.getAllMembers();
      const existingMemberNames = new Set(existingMembers.map(m => m.name.toLowerCase()));
      
      let membersCreated = 0;
      for (const name of SAMPLE_MEMBERS) {
        if (existingMemberNames.has(name.toLowerCase())) {
          console.log(`  ✓ Member already exists: ${name}`);
        } else {
          await db.createMember(name);
          console.log(`  ✅ Created member: ${name}`);
          membersCreated++;
        }
      }
      console.log(`👥 Members: ${membersCreated} created, ${existingMembers.length + membersCreated} total\n`);
    } else {
      console.log('👥 Skipping member seeding for production environment\n');
    }

    // Seed Sample Appliances (for test and dev environments only)
    if (environment === 'test' || environment === 'development') {
      console.log('🚒 Seeding sample appliances...');
      const existingAppliances = await truckChecksDb.getAllAppliances();
      
      const sampleAppliances = [
        { name: '1.1 CAT 1', description: 'Category 1 Pumper' },
        { name: '1.7 CAT 7', description: 'Category 7 Tanker' },
        { name: '1.9 CAT 9', description: 'Light Unit' },
      ];
      
      const existingApplianceNames = new Set(existingAppliances.map(a => a.name.toLowerCase()));
      let appliancesCreated = 0;
      
      for (const { name, description } of sampleAppliances) {
        if (existingApplianceNames.has(name.toLowerCase())) {
          console.log(`  ✓ Appliance already exists: ${name}`);
        } else {
          await truckChecksDb.createAppliance(name, description);
          console.log(`  ✅ Created appliance: ${name}`);
          appliancesCreated++;
        }
      }
      console.log(`🚒 Appliances: ${appliancesCreated} created, ${existingAppliances.length + appliancesCreated} total\n`);
    } else {
      console.log('🚒 Skipping appliance seeding for production environment\n');
    }

    console.log('✅ Database seeding complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    process.exit(1);
  }
}

seedDatabase();
