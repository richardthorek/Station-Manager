import dotenv from 'dotenv';

// Load environment variables so Table Storage credentials are available
dotenv.config();

import { ensureDatabase } from '../services/dbFactory';

async function seedActivities() {
  const desired = [
    'Maintenance',
    'Meeting',
    'Brigade Training',
    'District Training',
  ];

  try {
    const db = await ensureDatabase();

    const existing = await db.getAllActivities();
    const existingNames = new Set(existing.map(a => a.name.toLowerCase()));

    for (const name of desired) {
      if (existingNames.has(name.toLowerCase())) {
        console.log(`Skipping existing activity: ${name}`);
      } else {
        await db.createActivity(name, 'seed-script');
        console.log(`Created activity: ${name}`);
      }
    }

    console.log('Activity seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed activities:', error);
    process.exit(1);
  }
}

seedActivities();
