/**
 * Unit tests for the in-memory VehicleTypeDatabase (the twin used in dev/test).
 * Covers standard-item normalisation, org+standard visibility, and ownership.
 */

import { VehicleTypeDatabase, normaliseStandardItems } from '../services/vehicleTypeDatabase';
import type { ChecklistItem } from '../types';

const items = (...names: string[]): ChecklistItem[] =>
  names.map((name, i) => ({ id: '', name, description: `${name} desc`, order: i }));

describe('VehicleTypeDatabase', () => {
  let db: VehicleTypeDatabase;

  beforeEach(() => {
    db = new VehicleTypeDatabase();
  });

  it('normaliseStandardItems assigns stable itemCodes and flags items standard', () => {
    const out = normaliseStandardItems(items('Tyre Condition', 'Fluid Levels'));
    expect(out[0].itemCode).toBe('tyre-condition');
    expect(out[1].itemCode).toBe('fluid-levels');
    expect(out.every((i) => i.isStandard === true)).toBe(true);
    expect(out.every((i) => i.id)).toBe(true);
  });

  it('creates a type with normalised standard items', async () => {
    const t = await db.create({ organizationId: 'org-1', code: 'cat1-tanker', name: 'Cat 1 Tanker', standardItems: items('Tyres') });
    expect(t.id).toBeTruthy();
    expect(t.standardItems[0].isStandard).toBe(true);
    expect(t.standardItems[0].itemCode).toBe('tyres');
  });

  it('listForOrganization returns the org’s own types plus all standards', async () => {
    await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: [] });
    await db.create({ organizationId: 'org-2', code: 'b', name: 'B', standardItems: [] });
    await db.create({ organizationId: 'org-2', isStandard: true, code: 'std', name: 'Standard', standardItems: [] });

    const forOrg1 = await db.listForOrganization('org-1');
    const names = forOrg1.map((t) => t.name).sort();
    expect(names).toEqual(['A', 'Standard']); // own (A) + the published standard, not org-2's private B
  });

  it('listStandards returns only published standards', async () => {
    await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: [] });
    await db.create({ organizationId: 'org-1', isStandard: true, code: 'std', name: 'Standard', standardItems: [] });
    const standards = await db.listStandards();
    expect(standards.map((t) => t.name)).toEqual(['Standard']);
  });

  it('update replaces standard items (re-normalised) and patches fields', async () => {
    const t = await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: items('Old') });
    const updated = await db.update(t.id, { name: 'A2', standardItems: items('New Check') });
    expect(updated?.name).toBe('A2');
    expect(updated?.standardItems[0].itemCode).toBe('new-check');
    expect(updated?.standardItems[0].isStandard).toBe(true);
  });

  it('delete removes a type', async () => {
    const t = await db.create({ organizationId: 'org-1', code: 'a', name: 'A', standardItems: [] });
    expect(await db.delete(t.id)).toBe(true);
    expect(await db.getById(t.id)).toBeNull();
  });
});
