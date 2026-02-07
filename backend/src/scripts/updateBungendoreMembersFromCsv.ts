import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import Papa from 'papaparse';

dotenv.config();

interface CsvRow {
  ['First Name']?: string;
  ['Last Name']?: string;
  ['Preferred Name']?: string;
  Rank?: string;
  Roles?: string;
  ['Member of Brigade Since']?: string;
}

interface ApiMember {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
}

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';
const STATION_ID_HEADER = process.env.STATION_ID || process.env.X_STATION_ID;
const FILTER_NAMES = (process.env.FILTER_NAMES || '')
  .split(',')
  .map(n => n.trim().toLowerCase())
  .filter(Boolean);

function clean(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function parseDate(dmy: string | undefined): string | null {
  if (!dmy) return null;
  const [d, m, y] = dmy.split(/[\/]/).map(part => parseInt(part, 10));
  if (!d || !m || !y) return null;
  // Month is 0-indexed in Date
  const iso = new Date(Date.UTC(y, m - 1, d)).toISOString();
  return iso;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (STATION_ID_HEADER) {
    headers['X-Station-Id'] = STATION_ID_HEADER;
  }
  return headers;
}

async function fetchMembers(): Promise<ApiMember[]> {
  const res = await fetch(`${API_BASE}/members`, {
    headers: buildHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch members: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ApiMember[];
}

async function fetchMembersWithRetry(maxAttempts = 5, delayMs = 120_000): Promise<ApiMember[]> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchMembers();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`fetchMembers attempt ${attempt} failed: ${msg}`);
      if (attempt === maxAttempts) throw err;
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
  throw new Error('Unreachable');
}

function key(first?: string, last?: string, display?: string): string {
  return `${clean(first).toLowerCase()}|${clean(last).toLowerCase()}|${clean(display).toLowerCase()}`;
}

async function upsertMember(row: CsvRow, lookup: Map<string, ApiMember>): Promise<{ ok: boolean; status?: number; name: string }> {
  const firstName = clean(row['Preferred Name'] || row['First Name']);
  const lastName = clean(row['Last Name']);
  const rank = clean(row.Rank);
  const roles = clean(row.Roles);
  const membershipStartDate = parseDate(clean(row['Member of Brigade Since']));

  const displayName = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
  if (!displayName) {
    console.warn('Skipping row without name', row);
    return { ok: false, name: 'unknown', status: 0 };
  }

  const rankOrRoles = rank || (roles ? roles : undefined);
  const memberKey = key(firstName, lastName, displayName);
  const existing = lookup.get(memberKey);

  const headers = buildHeaders();

  if (existing) {
    const payload = {
      name: displayName,
      rank: rankOrRoles || null,
      membershipStartDate: membershipStartDate || undefined,
    };
    const res = await fetch(`${API_BASE}/members/${existing.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Failed to update ${displayName}: ${res.status} ${res.statusText}`);
      return { ok: false, status: res.status, name: displayName };
    }
    console.log(`Updated ${displayName}${rankOrRoles ? ` (rank/roles: ${rankOrRoles})` : ''}${membershipStartDate ? ` start=${membershipStartDate}` : ''}`);
    return { ok: true, name: displayName };
  } else {
    const payload = {
      name: displayName,
      firstName: clean(row['First Name']),
      lastName,
      preferredName: clean(row['Preferred Name']) || undefined,
      rank: rankOrRoles || undefined,
      membershipStartDate: membershipStartDate || undefined,
    };
    const res = await fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Failed to create ${displayName}: ${res.status} ${res.statusText}`);
      return { ok: false, status: res.status, name: displayName };
    }
    console.log(`Created ${displayName}${rankOrRoles ? ` (rank/roles: ${rankOrRoles})` : ''}${membershipStartDate ? ` start=${membershipStartDate}` : ''}`);
    return { ok: true, name: displayName };
  }
}

async function main() {
  const csvArg = process.argv[2];
  const csvPath = csvArg
    ? path.resolve(csvArg)
    : path.resolve(__dirname, '../../2026-02-07_Brigade Administration Report (Bungendore).csv');

  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const parsed = Papa.parse<CsvRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    process.exit(1);
  }

  const members = await fetchMembersWithRetry();
  const lookup = new Map<string, ApiMember>();
  members.forEach(m => {
    const parts = (m.firstName || m.name).split(' ');
    const first = parts[0];
    const last = m.lastName || parts.slice(1).join(' ');
    lookup.set(key(first, last, m.name), m);
  });

  const rows = parsed.data.filter(row => {
    if (FILTER_NAMES.length === 0) return true;
    const first = clean(row['Preferred Name'] || row['First Name']);
    const last = clean(row['Last Name']);
    const full = `${first} ${last}`.trim().toLowerCase();
    return FILTER_NAMES.some(target => full.includes(target));
  });
  const failures: { row: CsvRow; attempt: number; status?: number; name: string }[] = [];

  for (const row of rows) {
    const result = await upsertMember(row, lookup);
    if (!result.ok) {
      failures.push({ row, attempt: 1, status: result.status, name: result.name });
    }
    await new Promise(res => setTimeout(res, 1000)); // 1s spacing to reduce burst
  }

  const maxAttempts = 5;
  for (let attempt = 2; attempt <= maxAttempts && failures.length > 0; attempt++) {
    console.log(`Retry pass ${attempt} for ${failures.length} remaining... waiting 60s`);
    await new Promise(res => setTimeout(res, 60_000));

    const stillFailing: typeof failures = [];
    for (const item of failures) {
      const result = await upsertMember(item.row, lookup);
      if (!result.ok) {
        stillFailing.push({ row: item.row, attempt, status: result.status, name: result.name });
      }
      await new Promise(res => setTimeout(res, 1000));
    }
    failures.length = 0;
    failures.push(...stillFailing);
  }

  if (failures.length) {
    console.error('Final failures:', failures.map(f => `${f.name} (status ${f.status ?? 'unknown'})`).join(', '));
    process.exitCode = 1;
  } else {
    console.log('Done with all members updated.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
