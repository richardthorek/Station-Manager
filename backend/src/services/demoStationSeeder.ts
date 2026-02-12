/**
 * Demo Station Seeder
 * 
 * Automatically seeds demo station data if not already present.
 * This ensures demo station is always available for demonstration and testing.
 * 
 * Seeded on:
 * - Server startup (in-memory database)
 * - First request to demo station (if using Azure Table Storage)
 */

import { ensureDatabase } from './dbFactory';
import { DEMO_STATION_ID, DEMO_BRIGADE_ID } from '../constants/stations';
import { logger } from './logger';
import type { Station } from '../types';

// Track if demo station has been seeded in this session
let demoStationSeeded = false;

/**
 * Seed demo station with sample data if it doesn't exist
 */
export async function seedDemoStationIfNeeded(): Promise<void> {
  // Skip if already seeded in this session
  if (demoStationSeeded) {
    return;
  }

  try {
    const db = await ensureDatabase();

    // Check if demo station exists
    const stations = await db.getAllStations();
    const demoStation = stations.find((s: Station) => s.id === DEMO_STATION_ID);

    if (demoStation) {
      logger.debug('Demo station already exists, skipping seed');
      demoStationSeeded = true;
      return;
    }

    logger.info('Seeding demo station data...');

    // Create demo station
    await db.createStation({
      id: DEMO_STATION_ID,
      name: 'Demo Station',
      brigadeId: DEMO_BRIGADE_ID,
      brigadeName: 'Demo Brigade',
      hierarchy: {
        jurisdiction: 'NSW',
        area: 'Demo Area',
        district: 'Demo District',
        brigade: 'Demo Brigade',
        station: 'Demo Station',
      },
      isActive: true,
    });

    // Create standard activities (if they don't exist for demo station)
    const activities = ['Training', 'Maintenance', 'Meeting', 'Brigade Training', 'District Training'];
    for (const name of activities) {
      const existingActivities = await db.getAllActivities(DEMO_STATION_ID);
      const exists = existingActivities.some((a) => a.name === name);
      if (!exists) {
        await db.createActivity(name, undefined, DEMO_STATION_ID);
      }
    }

    // Create demo members
    const demoMembers = [
      { name: 'Axel Thorne', rank: 'Captain' },
      { name: 'Maris Vale', rank: 'Senior Deputy Captain' },
      { name: 'Soraya Finch', rank: 'Deputy Captain' },
      { name: 'Devon Quill', rank: 'Firefighter' },
      { name: 'Kira Embers', rank: 'Firefighter' },
      { name: 'Lucien Hale', rank: 'Deputy Captain' },
      { name: 'Rhea Calder', rank: 'Firefighter' },
      { name: 'Rio Penn', rank: 'Firefighter' },
      { name: 'Aria Lark', rank: 'Probationary Firefighter' },
      { name: 'Milo Sable', rank: 'Firefighter' },
    ];

    for (const member of demoMembers) {
      await db.createMember(member.name, { rank: member.rank, stationId: DEMO_STATION_ID });
    }

    logger.info('✅ Demo station seeded successfully', {
      stationId: DEMO_STATION_ID,
      members: demoMembers.length,
      activities: activities.length,
    });

    demoStationSeeded = true;
  } catch (error) {
    logger.error('Failed to seed demo station', { error });
    // Don't throw - allow server to continue even if seeding fails
  }
}

/**
 * Reset the seeded flag (for testing)
 */
export function resetDemoStationSeeded(): void {
  demoStationSeeded = false;
}
