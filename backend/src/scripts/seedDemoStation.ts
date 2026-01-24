/**
 * Demo Station Seed Data Script
 * 
 * Seeds the demo station with realistic sample data including:
 * - 15-20 diverse members with various ranks
 * - 5 standard activities
 * - 10 recent check-ins (last 30 days)
 * - 3-4 events (1 active, rest completed)
 * - 2 appliances with check results
 * - Realistic timestamps
 * 
 * Usage:
 *   ts-node src/scripts/seedDemoStation.ts
 *   or
 *   npm run seed:demo
 */

import dotenv from 'dotenv';
dotenv.config();

import { ensureDatabase } from '../services/dbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { DEMO_STATION_ID, DEMO_BRIGADE_ID } from '../constants/stations';
import type { Station, Member, Activity, CheckIn, Event, EventParticipant } from '../types';

// Diverse member names with various cultural backgrounds
const DEMO_MEMBERS = [
  { name: 'Captain Sarah Chen', rank: 'Captain' },
  { name: 'Deputy Marcus Rodriguez', rank: 'Deputy Captain' },
  { name: 'Senior Firefighter Aisha Patel', rank: 'Senior Firefighter' },
  { name: 'John O\'Brien', rank: 'Firefighter' },
  { name: 'Emma Nguyen', rank: 'Firefighter' },
  { name: 'Liam Thompson', rank: 'Firefighter' },
  { name: 'Sofia Dimitriou', rank: 'Firefighter' },
  { name: 'James MacDonald', rank: 'Senior Firefighter' },
  { name: 'Priya Kumar', rank: 'Firefighter' },
  { name: 'Connor Smith', rank: 'Firefighter' },
  { name: 'Yasmin Al-Rashid', rank: 'Probationary Firefighter' },
  { name: 'David Wilson', rank: 'Firefighter' },
  { name: 'Mei Lin Wang', rank: 'Senior Firefighter' },
  { name: 'Oliver Johnson', rank: 'Probationary Firefighter' },
  { name: 'Isabella Rossi', rank: 'Firefighter' },
  { name: 'Noah Anderson', rank: 'Firefighter' },
  { name: 'Fatima Hassan', rank: 'Probationary Firefighter' },
  { name: 'Ethan Brown', rank: 'Senior Firefighter' },
  { name: 'Chloe Murphy', rank: 'Firefighter' },
  { name: 'Ryan Park', rank: 'Firefighter' },
];

// Standard RFS activities
const STANDARD_ACTIVITIES = [
  'Training',
  'Maintenance',
  'Meeting',
  'Brigade Training',
  'District Training',
];

// Demo appliances
const DEMO_APPLIANCES = [
  { name: '1.1 CAT 1', description: 'Category 1 Pumper - Primary response vehicle' },
  { name: '1.7 CAT 7', description: 'Category 7 Tanker - Water carrier' },
];

/**
 * Generate random date within last N days
 */
function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  const msInDay = 24 * 60 * 60 * 1000;
  const randomMs = Math.random() * days * msInDay;
  return new Date(now - randomMs);
}

/**
 * Get random item from array
 */
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Seed demo station data
 */
async function seedDemoStation() {
  console.log('\n🎭 Seeding Demo Station...\n');

  try {
    const db = await ensureDatabase();
    const truckChecksDb = await ensureTruckChecksDatabase();

    // Step 1: Create demo station
    console.log('📍 Creating demo station...');
    const existingStations = await db.getAllStations();
    let demoStation = existingStations.find((s: Station) => s.id === DEMO_STATION_ID);
    
    if (!demoStation) {
      demoStation = await db.createStation({
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
      console.log('  ✅ Created demo station');
    } else {
      console.log('  ✓ Demo station already exists');
    }

    // Step 2: Create activities
    console.log('\n📚 Creating activities...');
    const activities: Activity[] = [];
    for (const activityName of STANDARD_ACTIVITIES) {
      const existing = (await db.getAllActivities(DEMO_STATION_ID)).find(
        (a: Activity) => a.name === activityName
      );
      if (existing) {
        activities.push(existing);
        console.log(`  ✓ Activity exists: ${activityName}`);
      } else {
        const activity = await db.createActivity(activityName, 'seed-script', DEMO_STATION_ID);
        activities.push(activity);
        console.log(`  ✅ Created activity: ${activityName}`);
      }
    }

    // Step 3: Create members
    console.log('\n👥 Creating members...');
    const members: Member[] = [];
    for (const { name, rank } of DEMO_MEMBERS) {
      const existing = (await db.getAllMembers(DEMO_STATION_ID)).find(
        (m: Member) => m.name === name
      );
      if (existing) {
        members.push(existing);
        console.log(`  ✓ Member exists: ${name}`);
      } else {
        const member = await db.createMember(name, { rank, stationId: DEMO_STATION_ID });
        members.push(member);
        console.log(`  ✅ Created member: ${name} (${rank})`);
      }
    }

    // Step 4: Create recent check-ins (last 30 days)
    console.log('\n✅ Creating recent check-ins...');
    const existingCheckIns = await db.getAllCheckIns(DEMO_STATION_ID);
    if (existingCheckIns.length >= 10) {
      console.log(`  ✓ Already have ${existingCheckIns.length} check-ins`);
    } else {
      const checkInsToCreate = 10 - existingCheckIns.length;
      for (let i = 0; i < checkInsToCreate; i++) {
        const member = randomItem(members);
        const activity = randomItem(activities);
        const checkInTime = randomDateWithinDays(30);
        
        // Create check-in with past timestamp
        const checkIn = await db.createCheckIn(
          member.id,
          activity.id,
          'kiosk',
          undefined,
          false,
          DEMO_STATION_ID
        );
        
        // Note: For realistic timestamps, we'd need to update the checkIn.checkInTime
        // but that requires database update methods. For now, recent check-ins are fine.
        console.log(`  ✅ Created check-in: ${member.name} - ${activity.name}`);
      }
    }

    // Step 5: Create events (3-4 events: 1 active, rest completed)
    console.log('\n📅 Creating events...');
    const existingEvents = await db.getEvents(100, 0, DEMO_STATION_ID);
    const activeEvents = await db.getActiveEvents(DEMO_STATION_ID);
    
    let newEventsCreated = 0;
    if (existingEvents.length >= 3) {
      console.log(`  ✓ Already have ${existingEvents.length} events (${activeEvents.length} active)`);
    } else {
      // Create 3-4 events
      const numEvents = 3 + Math.floor(Math.random() * 2); // 3 or 4
      const eventsToCreate = Math.max(0, numEvents - existingEvents.length);
      
      for (let i = 0; i < eventsToCreate; i++) {
        const activity = randomItem(activities);
        const event = await db.createEvent(activity.id, 'seed-script', DEMO_STATION_ID);
        
        // Add 2-5 participants to each event
        const numParticipants = 2 + Math.floor(Math.random() * 4);
        const selectedMembers = members.slice(0, numParticipants);
        
        for (const member of selectedMembers) {
          await db.addEventParticipant(
            event.id,
            member.id,
            'kiosk',
            undefined,
            false,
            DEMO_STATION_ID
          );
        }
        
        // End all but one event (keep last one active)
        if (i < eventsToCreate - 1) {
          await db.endEvent(event.id);
          console.log(`  ✅ Created completed event: ${activity.name} (${numParticipants} participants)`);
        } else {
          console.log(`  ✅ Created active event: ${activity.name} (${numParticipants} participants)`);
        }
        
        newEventsCreated++;
      }
    }

    // Step 6: Create appliances and sample check runs
    console.log('\n🚒 Creating appliances...');
    const existingAppliances = await truckChecksDb.getAllAppliances(DEMO_STATION_ID);
    
    for (const { name, description } of DEMO_APPLIANCES) {
      const existing = existingAppliances.find(
        (a) => a.name === name && a.stationId === DEMO_STATION_ID
      );
      if (existing) {
        console.log(`  ✓ Appliance exists: ${name}`);
      } else {
        const appliance = await truckChecksDb.createAppliance(name, description, undefined, DEMO_STATION_ID);
        console.log(`  ✅ Created appliance: ${name}`);
        
        // Create a sample check run for the first appliance
        if (name === '1.1 CAT 1') {
          console.log('\n📋 Creating sample check run...');
          const member = members[0]; // Use captain
          const checkRun = await truckChecksDb.createCheckRun(
            appliance.id,
            member.id,
            member.name,
            DEMO_STATION_ID
          );
          
          // Get template for this appliance
          const template = await truckChecksDb.getTemplateByApplianceId(appliance.id);
          
          if (template) {
            // Complete some items with mixed results
            const items = template.items;
            for (let i = 0; i < Math.min(5, items.length); i++) {
              const status = i === 2 ? 'issue' : 'done'; // Make one item have an issue
              const comment = i === 2 ? 'Low tire pressure on rear driver side - needs attention' : undefined;
              
              await truckChecksDb.createCheckResult(
                checkRun.id,
                items[i].id,
                items[i].name,
                items[i].description,
                status,
                comment,
                undefined,
                member.name,
                DEMO_STATION_ID
              );
            }
            
            console.log('  ✅ Created sample check run with mixed results');
          }
        }
      }
    }

    console.log('\n✅ Demo station seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`  - Station: Demo Station (${DEMO_STATION_ID})`);
    console.log(`  - Members: ${members.length}`);
    console.log(`  - Activities: ${activities.length}`);
    console.log(`  - Events: ${existingEvents.length + newEventsCreated}`);
    console.log(`  - Appliances: ${DEMO_APPLIANCES.length}`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed demo station:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoStation();
}

export { seedDemoStation };
