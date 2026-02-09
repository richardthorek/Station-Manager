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
  { firstName: 'Lennox', lastName: 'Hawke', rank: 'Captain' },
  { firstName: 'Ivy', lastName: 'Ridge', rank: 'Deputy Captain' },
  { firstName: 'Rowan', lastName: 'Frost' },
  { firstName: 'Nova', lastName: 'Reyes' },
  { firstName: 'Pax', lastName: 'Emberly' },
  { firstName: 'Sol', lastName: 'Arcade', rank: 'Senior Firefighter' },
  { firstName: 'Aster', lastName: 'North' },
  { firstName: 'Quill', lastName: 'Harbor' },
  { firstName: 'Cora', lastName: 'Vale' },
  { firstName: 'Finn', lastName: 'Temple' },
];
