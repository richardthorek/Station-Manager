/**
 * Shared truck-check vocabulary.
 *
 * These canonical slugs are the backbone of cross-brigade consistency: when two
 * brigades tag the same logical vehicle or check item with the same slug, reports
 * can aggregate and trend across brigades even if the human-facing wording differs.
 *
 * The lists are suggestions, not a closed set — the editors surface them via
 * <select>/<datalist> but still allow a custom slug. Keeping them here means there
 * is one place to grow the shared vocabulary over time.
 */

export interface VocabularyEntry {
  /** Canonical lowercase slug stored on the record. */
  value: string;
  /** Human-friendly label shown in the UI. */
  label: string;
}

/**
 * Canonical NSW RFS appliance/vehicle types. Slugs group appliances of the same
 * type across brigades for type-level trend analysis.
 */
export const VEHICLE_TYPES: VocabularyEntry[] = [
  { value: 'cat1-tanker', label: 'Category 1 — Heavy Tanker / Pumper' },
  { value: 'cat2-tanker', label: 'Category 2 — Heavy Tanker' },
  { value: 'cat7-tanker', label: 'Category 7 — Medium Tanker' },
  { value: 'cat9-tanker', label: 'Category 9 — Light Tanker' },
  { value: 'cat11-tanker', label: 'Category 11 — Striker / Heavy Tanker' },
  { value: 'bulk-water', label: 'Bulk Water Carrier' },
  { value: 'pumper', label: 'Pumper' },
  { value: 'command', label: 'Command / Group Vehicle' },
  { value: 'personnel-carrier', label: 'Personnel Carrier' },
  { value: 'support', label: 'Support / Logistics Vehicle' },
  { value: 'trailer', label: 'Trailer / Plant' },
];

/**
 * Canonical check-item codes for the most common inspection items. Stable across
 * brigades so the same logical check trends together even when worded differently.
 */
export const ITEM_CODES: VocabularyEntry[] = [
  { value: 'fuel-level', label: 'Fuel level' },
  { value: 'fluid-levels', label: 'Engine fluid levels (oil, coolant, brake)' },
  { value: 'water-tank-level', label: 'Water tank level' },
  { value: 'foam-level', label: 'Foam / Class A level' },
  { value: 'tyre-condition', label: 'Tyre condition & pressure' },
  { value: 'lights-indicators', label: 'Lights & indicators' },
  { value: 'emergency-warning', label: 'Emergency warning devices (beacons/siren)' },
  { value: 'battery', label: 'Battery / charging' },
  { value: 'pump-operation', label: 'Pump operation & pressure' },
  { value: 'hoses-connections', label: 'Hoses & connections' },
  { value: 'radio-comms', label: 'Radio & communications' },
  { value: 'first-aid', label: 'First aid kit' },
  { value: 'fire-extinguisher', label: 'Fire extinguisher' },
  { value: 'ppe-stowage', label: 'PPE & stowage' },
  { value: 'tools-equipment', label: 'Tools & equipment' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'breathing-apparatus', label: 'Breathing apparatus' },
  { value: 'body-damage', label: 'Body / panel damage' },
  { value: 'cab-interior', label: 'Cab interior & controls' },
  { value: 'documentation', label: 'Documentation / logbook' },
];

/** Common section groupings for ordering a checklist into logical stages. */
export const SECTIONS: string[] = [
  'Cab & Controls',
  'Engine Bay',
  'Exterior & Body',
  'Pump & Tank',
  'Equipment & Stowage',
  'Communications',
  'Safety & PPE',
  'Documentation',
];

/**
 * Normalise free text into a canonical lowercase slug
 * (e.g. "Tyre Condition!" → "tyre-condition"). Used to keep custom entries
 * consistent with the canonical vocabulary format.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve user-entered text (from a datalist input) into a canonical slug.
 * If the text matches a known entry's label or value, return that entry's slug so
 * picking from the list always yields the shared vocabulary; otherwise slugify the
 * free text so custom entries are still well-formed. Empty input → undefined.
 */
export function resolveVocabSlug(input: string, entries: VocabularyEntry[]): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  const match = entries.find(
    (e) => e.label.toLowerCase() === lower || e.value === slugify(trimmed)
  );
  return match ? match.value : slugify(trimmed);
}

/**
 * Map a stored slug back to its friendly label for display in an editor input.
 * Falls back to the raw slug when it isn't part of the known vocabulary.
 */
export function vocabLabel(slug: string | undefined, entries: VocabularyEntry[]): string {
  if (!slug) return '';
  return entries.find((e) => e.value === slug)?.label ?? slug;
}
