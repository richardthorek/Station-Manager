/**
 * Backfill a real organization's own station with realistic historical
 * check-in/event data, so pages that only look good with real usage history
 * (reports, the activity heat map, the in-app wiki's example screenshots)
 * have something worth looking at on an otherwise-empty account.
 *
 * Deliberately NOT the same thing as seedDemoStation.ts: that seeds the
 * shared, public `demo-station` every visitor can reset via `?demo=true`.
 * This seeds one specific paying organization's own station with its own
 * roster and history, so it reads as that org's real usage, not a
 * recognizable canned demo. Every check-in/event this creates carries a
 * genuine, spread-out historical timestamp (via the startTimeOverride/
 * checkInTimeOverride/endTimeOverride params added to createEvent/
 * addEventParticipant/endEvent) instead of "now" — a flat wall of
 * same-second data defeats the entire point of a heat map or trend chart.
 *
 * Idempotent: does nothing if the target org already has a station with
 * event history — safe to re-run, will not pile up duplicate history.
 *
 * Usage:
 *   TARGET_ORG_SLUG=test-brigade-1 npm run seed:account-demo
 *   (TARGET_ORG_SLUG defaults to test-brigade-1 if unset)
 *
 * Requires AZURE_STORAGE_CONNECTION_STRING (writes to whatever storage
 * account that connection string points at — almost certainly production;
 * there is no separate confirmation latch beyond that, unlike
 * purgeProdTestData.ts's PURGE_CONFIRM, since this is purely additive and
 * every write already goes through the same validated service-layer calls
 * a real signup would use).
 */

import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { ensureDatabase } from '../services/dbFactory';
import { ensureOrganizationDatabase, initializeOrganizationDatabase } from '../services/organizationDbFactory';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureVehicleTypeDatabase, initializeVehicleTypeDatabase } from '../services/vehicleTypeDbFactory';
import { resolveEffectiveChecklist } from '../services/effectiveChecklist';
import type { Activity, Event, Member } from '../types';

const TARGET_ORG_SLUG = process.env.TARGET_ORG_SLUG || 'test-brigade-1';
const HISTORY_DAYS = 80; // ~2.5 months

const ROSTER: Array<{ name: string; rank: string; joinedDaysAgo: number; attendanceWeight: number }> = [
  { name: 'Chris Whitfield', rank: 'Captain', joinedDaysAgo: 620, attendanceWeight: 0.95 },
  { name: 'Michael O’Brien', rank: 'Senior Deputy Captain', joinedDaysAgo: 540, attendanceWeight: 0.9 },
  { name: 'Sarah Nguyen', rank: 'Deputy Captain', joinedDaysAgo: 480, attendanceWeight: 0.85 },
  { name: 'James Cooper', rank: 'Deputy Captain', joinedDaysAgo: 410, attendanceWeight: 0.8 },
  { name: 'Emma Walsh', rank: 'Firefighter', joinedDaysAgo: 360, attendanceWeight: 0.75 },
  { name: 'Liam Fraser', rank: 'Firefighter', joinedDaysAgo: 300, attendanceWeight: 0.7 },
  { name: 'Olivia Bennett', rank: 'Firefighter', joinedDaysAgo: 260, attendanceWeight: 0.75 },
  { name: 'Jack Sullivan', rank: 'Firefighter', joinedDaysAgo: 240, attendanceWeight: 0.6 },
  { name: 'Sophie Marsh', rank: 'Firefighter', joinedDaysAgo: 200, attendanceWeight: 0.65 },
  { name: 'Noah Kelly', rank: 'Firefighter', joinedDaysAgo: 150, attendanceWeight: 0.55 },
  { name: 'Ava Thompson', rank: 'Probationary Firefighter', joinedDaysAgo: 95, attendanceWeight: 0.5 },
  { name: 'Ethan Reid', rank: 'Probationary Firefighter', joinedDaysAgo: 70, attendanceWeight: 0.45 },
  { name: 'Mia Harrington', rank: 'Firefighter', joinedDaysAgo: 130, attendanceWeight: 0.6 },
  { name: 'Lucas Doyle', rank: 'Probationary Firefighter', joinedDaysAgo: 40, attendanceWeight: 0.35 },
];

const REQUIRED_ACTIVITY_NAMES = ['Training', 'Maintenance', 'Meeting', 'Brigade Training', 'District Training'];

// Two appliances linked to real, already-seeded standard vehicle types
// (their locked standard checklists resolve automatically — no per-appliance
// template needed, see effectiveChecklist.ts). Name substrings matched
// against listStandards() rather than hardcoded ids, since ids are generated.
const APPLIANCES = [
  { name: '1.1 CAT 1', typeNameMatch: 'cat 1 tanker' },
  { name: '1.7 CAT 7', typeNameMatch: 'cat 7 tanker' },
];

const ISSUE_COMMENTS = [
  'Low — needs topping up before next shift.',
  'Worn, keep an eye on it — flag for replacement next service.',
  'Not working, reported to equipment officer.',
  'Damaged, needs repair.',
  'Missing from locker, needs replacing.',
  'Reading outside normal range — recheck next run.',
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function atTime(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function addMinutes(base: Date, mins: number): Date {
  return new Date(base.getTime() + mins * 60_000);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

interface ScheduledEvent {
  activityName: string;
  start: Date;
  durationMins: number;
}

/** Build a realistic weekly/fortnightly/monthly training-brigade schedule over the last HISTORY_DAYS. */
function buildSchedule(): ScheduledEvent[] {
  const schedule: ScheduledEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = HISTORY_DAYS; offset >= 1; offset--) {
    const day = daysAgo(offset);
    const dow = day.getDay(); // 0 Sun .. 6 Sat

    // Weekly Tuesday evening training, alternating plain Training / Brigade Training
    if (dow === 2) {
      const weekIndex = Math.floor(offset / 7);
      schedule.push({
        activityName: weekIndex % 2 === 0 ? 'Training' : 'Brigade Training',
        start: atTime(day, 18, 30),
        durationMins: randomInt(90, 130),
      });
    }

    // Saturday maintenance, roughly fortnightly
    if (dow === 6 && Math.floor(offset / 7) % 2 === 0) {
      schedule.push({
        activityName: 'Maintenance',
        start: atTime(day, 9, 0),
        durationMins: randomInt(90, 150),
      });
    }

    // First Monday of the (rolling) month: brigade meeting
    if (dow === 1 && day.getDate() <= 7) {
      schedule.push({
        activityName: 'Meeting',
        start: atTime(day, 19, 0),
        durationMins: randomInt(60, 90),
      });
    }

    // One Sunday a month: district training
    if (dow === 0 && day.getDate() >= 8 && day.getDate() <= 14) {
      schedule.push({
        activityName: 'District Training',
        start: atTime(day, 9, 0),
        durationMins: randomInt(240, 330),
      });
    }
  }

  return schedule.filter((s) => s.start < today || s.start < new Date());
}

async function main() {
  const dryRun = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
  console.log(`\n🌱 Seeding realistic demo history for org slug "${TARGET_ORG_SLUG}" — dry run: ${dryRun}\n`);

  const schedule = buildSchedule();
  const byActivity = new Map<string, number>();
  for (const s of schedule) byActivity.set(s.activityName, (byActivity.get(s.activityName) || 0) + 1);
  console.log(`📅 Planned schedule: ${schedule.length} events over the last ${HISTORY_DAYS} days`);
  for (const [name, count] of byActivity) console.log(`   - ${name}: ${count}`);
  console.log(`👥 Planned roster: ${ROSTER.length} members`);

  await initializeOrganizationDatabase();
  const orgDb = ensureOrganizationDatabase();
  const db = await ensureDatabase();

  const org = await orgDb.getOrganizationBySlug(TARGET_ORG_SLUG);
  if (!org) {
    console.error(`❌ No organization found with slug "${TARGET_ORG_SLUG}" — aborting, nothing written.`);
    process.exit(1);
  }
  console.log(`\n📍 Found organization: ${org.name} (${org.id})`);

  if (dryRun) {
    console.log('\nDry run only — nothing written. Re-run with DRY_RUN=false to apply.\n');
    return;
  }

  // Step 1: find or create this org's own station.
  const allStations = await db.getAllStations();
  let station = allStations.find((s) => s.organizationId === org.id);
  if (!station) {
    station = await db.createStation({
      id: `${TARGET_ORG_SLUG}-station`,
      name: org.name,
      brigadeId: `${TARGET_ORG_SLUG}-brigade`,
      brigadeName: org.name,
      hierarchy: {
        jurisdiction: 'NSW',
        area: 'Southern Highlands',
        district: 'Southern Highlands District',
        brigade: org.name,
        station: org.name,
      },
      isActive: true,
      organizationId: org.id,
    });
    console.log(`  ✅ Created station "${station.name}" (${station.id})`);
  } else {
    console.log(`  ✓ Station already exists: ${station.name} (${station.id})`);
  }

  // Idempotency guard: if this station already has a decent amount of event
  // history, assume a previous run already seeded it — skip re-creating
  // events/check-ins, but still fall through to roster/truck-check setup
  // below (each phase is independently idempotent, so a partial prior run —
  // e.g. events seeded but truck checks not yet added — still completes).
  const existingEvents = await db.getEvents(500, 0, station.id);
  const eventsAlreadySeeded = existingEvents.length >= 20;
  if (eventsAlreadySeeded) {
    console.log(`\n✓ Station already has ${existingEvents.length} events — skipping event/check-in creation.`);
  }

  // Step 2: roster.
  const existingMembers = await db.getAllMembers(station.id);
  const members: Member[] = [];
  for (const person of ROSTER) {
    const existing = existingMembers.find((m) => m.name === person.name);
    if (existing) {
      members.push(existing);
      continue;
    }
    const member = await db.createMember(person.name, {
      rank: person.rank,
      stationId: station.id,
      membershipStartDate: daysAgo(person.joinedDaysAgo),
    });
    members.push(member);
    console.log(`  ✅ Added member: ${person.name} (${person.rank})`);
  }

  // Step 3: reuse the existing global standard activities (Training, Maintenance, etc.) rather than creating duplicates.
  const allActivities = await db.getAllActivities();
  const activityByName = new Map<string, Activity>();
  for (const name of REQUIRED_ACTIVITY_NAMES) {
    const activity = allActivities.find((a) => a.name === name);
    if (!activity) {
      console.error(`❌ Expected standard activity "${name}" not found — aborting, nothing written for events.`);
      process.exit(1);
    }
    activityByName.set(name, activity);
  }

  // Step 4: create the historical event schedule (already planned above).
  let eventsCreated = 0;
  let participantsCreated = 0;

  if (!eventsAlreadySeeded) {
    console.log(`\n📅 Creating ${schedule.length} historical events over the last ${HISTORY_DAYS} days...`);

    for (const item of schedule) {
      const activity = activityByName.get(item.activityName)!;
      const event: Event = await db.createEvent(activity.id, undefined, station.id, item.start);

      // Attendance: each member has their own weight (veterans attend almost
      // everything, new probationaries less), plus a small per-event jitter so
      // the same set of people isn't at literally every session.
      const attendees = members.filter((m) => {
        const person = ROSTER.find((p) => p.name === m.name)!;
        // A member can't attend a session before they'd joined.
        if (m.membershipStartDate && new Date(m.membershipStartDate) > item.start) return false;
        return Math.random() < person.attendanceWeight * randomInt(85, 115) / 100;
      });

      for (const member of attendees) {
        // People trickle in over the first ~20 minutes rather than all at the exact start time.
        const checkInTime = addMinutes(item.start, randomInt(-5, 20));
        await db.addEventParticipant(event.id, member.id, 'kiosk', undefined, false, station.id, checkInTime);
        participantsCreated++;
      }

      await db.endEvent(event.id, addMinutes(item.start, item.durationMins));
      eventsCreated++;
    }
  }

  // Step 5: truck checks — one run per appliance on every Maintenance day in
  // the schedule above, so the fleet's check history reads as tied to the
  // same maintenance sessions the crew actually attended (Step 4).
  console.log('\n🚒 Setting up appliances and truck check history...');

  await initializeVehicleTypeDatabase();
  const vehicleTypeDb = ensureVehicleTypeDatabase();
  const truckChecksDb = await ensureTruckChecksDatabase();
  const standardTypes = await vehicleTypeDb.listStandards();

  const existingAppliances = await truckChecksDb.getAllAppliances(station.id);
  const appliances: Array<{ id: string; name: string }> = [];
  for (const spec of APPLIANCES) {
    const existing = existingAppliances.find((a) => a.name === spec.name);
    if (existing) {
      appliances.push(existing);
      continue;
    }
    const vehicleType = standardTypes.find((t) => t.name.toLowerCase().includes(spec.typeNameMatch));
    if (!vehicleType) {
      console.warn(`  ⚠️  No standard vehicle type matching "${spec.typeNameMatch}" — skipping appliance "${spec.name}".`);
      continue;
    }
    const appliance = await truckChecksDb.createAppliance(spec.name, vehicleType.name, undefined, station.id, undefined, {
      vehicleTypeId: vehicleType.id,
    });
    appliances.push(appliance);
    console.log(`  ✅ Added appliance: ${spec.name} (${vehicleType.name})`);
  }

  const maintenanceDays = schedule.filter((s) => s.activityName === 'Maintenance');
  const checkers = members.filter((m) => {
    const person = ROSTER.find((p) => p.name === m.name)!;
    return person.attendanceWeight >= 0.75; // senior/regular members do the truck checks
  });

  let checkRunsCreated = 0;
  let issuesCreated = 0;

  const existingCheckRuns = await truckChecksDb.getAllCheckRuns(station.id);
  const checkRunsAlreadySeeded = existingCheckRuns.length >= maintenanceDays.length * appliances.length;
  if (checkRunsAlreadySeeded) {
    console.log(`  ✓ Already have ${existingCheckRuns.length} check runs — skipping truck check creation.`);
  }

  for (const appliance of checkRunsAlreadySeeded ? [] : appliances) {
    const applianceRecord = await truckChecksDb.getApplianceById(appliance.id);
    if (!applianceRecord) continue;
    const vehicleType = applianceRecord.vehicleTypeId ? await vehicleTypeDb.getById(applianceRecord.vehicleTypeId) : null;
    const effectiveChecklist = resolveEffectiveChecklist(applianceRecord, null, vehicleType);
    if (effectiveChecklist.items.length === 0) {
      console.warn(`  ⚠️  ${appliance.name} resolved to an empty checklist — skipping its check history.`);
      continue;
    }

    for (const day of maintenanceDays) {
      const checker = checkers.length > 0 ? checkers[randomInt(0, checkers.length - 1)] : members[0];
      const startTime = addMinutes(day.start, randomInt(0, 30));

      const run = await truckChecksDb.createCheckRun(
        appliance.id,
        checker.id,
        checker.name,
        station.id,
        undefined,
        startTime
      );

      // A couple of different, varied items fail each run — never the same
      // pair twice — so the issue history looks like real, varied faults
      // rather than one broken part nobody ever fixes.
      //
      // Not every seeded standard vehicle type's items carry a real `id`
      // (some only have a stable `itemCode`, e.g. Cat 7 Tanker) — selecting
      // by `.id` there meant every id-less item shared the same `undefined`
      // key, so picking "one" as an issue flagged *all* of them. itemCode is
      // the actually-stable identifier per the ChecklistItem type; fall back
      // to id only for items that genuinely have neither (shouldn't happen
      // for a real seeded standard type, but keeps this from crashing if it does).
      const itemKey = (item: (typeof effectiveChecklist.items)[number]): string => item.itemCode || item.id || item.name;
      const shuffled = [...effectiveChecklist.items].sort(() => Math.random() - 0.5);
      const issueCount = Math.min(effectiveChecklist.items.length, randomInt(2, 3));
      const issueItemKeys = new Set(shuffled.slice(0, issueCount).map(itemKey));

      for (const item of effectiveChecklist.items) {
        const isIssue = issueItemKeys.has(itemKey(item));
        await truckChecksDb.createCheckResult(
          run.id,
          itemKey(item),
          item.name,
          item.description,
          isIssue ? 'issue' : 'done',
          isIssue ? ISSUE_COMMENTS[randomInt(0, ISSUE_COMMENTS.length - 1)] : undefined,
          undefined,
          checker.name,
          station.id,
          item.itemCode,
          item.section
        );
        if (isIssue) issuesCreated++;
      }

      await truckChecksDb.completeCheckRun(run.id, undefined, addMinutes(startTime, randomInt(15, 35)));
      checkRunsCreated++;
    }
  }

  const manifest = {
    orgId: org.id,
    orgSlug: org.slug,
    stationId: station.id,
    membersCreated: members.length,
    eventsCreated,
    participantsCreated,
    appliancesCreated: appliances.length,
    checkRunsCreated,
    issuesCreated,
    historyDays: HISTORY_DAYS,
    ranAt: new Date().toISOString(),
  };
  const manifestPath = path.join(__dirname, `../../.seed-manifest-${TARGET_ORG_SLUG}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n✅ Done!\n');
  console.log('📊 Summary:');
  console.log(`  - Organization: ${org.name} (${org.slug})`);
  console.log(`  - Station: ${station.name} (${station.id})`);
  console.log(`  - Members: ${members.length}`);
  console.log(`  - Events: ${eventsCreated}`);
  console.log(`  - Check-ins: ${participantsCreated}`);
  console.log(`  - Appliances: ${appliances.length}`);
  console.log(`  - Truck check runs: ${checkRunsCreated} (${issuesCreated} flagged issues)`);
  console.log(`  - Manifest written to ${manifestPath} (not committed — for this run's own records)`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to seed account demo data:', error);
    process.exit(1);
  });
