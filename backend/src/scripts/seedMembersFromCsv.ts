/**
 * Seed members from a CSV file into the configured database (Table Storage or in-memory).
 *
 * The CSV must include a header row with columns:
 *   First Name,Last Name,Preferred Name,Rank
 *
 * Usage examples (from backend/):
 *   TABLE_STORAGE_TABLE_SUFFIX= NODE_ENV=production ts-node src/scripts/seedMembersFromCsv.ts
 *   TABLE_STORAGE_TABLE_SUFFIX=Dev NODE_ENV=development ts-node src/scripts/seedMembersFromCsv.ts
 *   TABLE_STORAGE_TABLE_SUFFIX=Test NODE_ENV=test ts-node src/scripts/seedMembersFromCsv.ts
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { ensureDatabase } from '../services/dbFactory';

interface CsvMemberRow {
  firstName: string;
  lastName: string;
  preferredName?: string;
  rank?: string;
}

function parseCsv(content: string): CsvMemberRow[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim().length > 0);
  const [, ...rows] = lines; // skip header

  return rows.map(row => {
    const [firstName = '', lastName = '', preferredName = '', rank = ''] = row.split(',');
    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      preferredName: preferredName.trim() || undefined,
      rank: rank.trim() || undefined,
    };
  }).filter(r => r.firstName || r.lastName);
}

function buildDisplayName(row: CsvMemberRow): string {
  const primary = row.preferredName || row.firstName;
  const parts = [primary, row.lastName].filter(Boolean);
  return parts.join(' ').trim();
}

function makeKey(first?: string, last?: string, display?: string): string {
  const f = (first || '').toLowerCase();
  const l = (last || '').toLowerCase();
  const d = (display || '').toLowerCase();
  return `${f}|${l}|${d}`;
}

async function seedMembers() {
  const csvPath = path.resolve(__dirname, '../../../bungendore_members.csv');
  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCsv(csvContent);

  if (rows.length === 0) {
    console.log('No members found in CSV. Nothing to seed.');
    return;
  }

  const db = await ensureDatabase();
  const existing = await db.getAllMembers();
  const existingKeys = new Set<string>();

  existing.forEach(m => {
    existingKeys.add(makeKey(m.firstName, m.lastName, m.name));
  });

  let created = 0;

  for (const row of rows) {
    const displayName = buildDisplayName(row);
    const key = makeKey(row.firstName, row.lastName, displayName);

    if (existingKeys.has(key)) {
      console.log(`Skipping existing member: ${displayName}`);
      continue;
    }

    await db.createMember(displayName, {
      rank: row.rank || null,
      firstName: row.firstName,
      lastName: row.lastName,
      preferredName: row.preferredName,
    });

    existingKeys.add(key);
    created++;
    console.log(`Created member: ${displayName}${row.rank ? ` (${row.rank})` : ''}`);
  }

  console.log(`\nDone. Added ${created} new members (total now ${existing.length + created}).`);
}

seedMembers().catch(err => {
  console.error('Failed to seed members from CSV:', err);
  process.exit(1);
});
