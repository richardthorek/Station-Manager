export interface SeedMember {
  firstName: string;
  lastName: string;
  preferredName?: string;
  rank?: string;
}

export function buildDisplayName(seed: SeedMember): string {
  const first = (seed.preferredName && seed.preferredName.trim()) || seed.firstName.trim();
  const last = seed.lastName.trim();
  return last ? `${first} ${last}` : first;
}

export const DEFAULT_MEMBERS: SeedMember[] = [
  { firstName: 'Casey', lastName: 'Harper', rank: 'Captain' },
  { firstName: 'Jordan', lastName: 'Blaze', rank: 'Senior Deputy Captain' },
  { firstName: 'Alex', lastName: 'Mason' },
  { firstName: 'Taylor', lastName: 'Reed', preferredName: 'Tay' },
  { firstName: 'Morgan', lastName: 'Quinn' },
  { firstName: 'Riley', lastName: 'Hale', rank: 'Deputy Captain' },
  { firstName: 'Avery', lastName: 'Cross' },
  { firstName: 'Sam', lastName: 'Parker' },
  { firstName: 'Quinn', lastName: 'Banks' },
  { firstName: 'Charlie', lastName: 'Hayes' },
  { firstName: 'Dakota', lastName: 'Woods' },
  { firstName: 'Sydney', lastName: 'Brooks' },
];
