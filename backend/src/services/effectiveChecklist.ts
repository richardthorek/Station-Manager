/**
 * Effective-checklist resolution — shared by the truck-check routes and the
 * voice agent's tool layer (A3), so both always merge the same way.
 */

import { Appliance, ChecklistItem, ChecklistTemplate, EffectiveChecklist, VehicleType } from '../types';

/**
 * Resolve the checklist an inspector actually works through for an appliance:
 * the VehicleType's locked standard items merged with the brigade's custom
 * overlay items, in the brigade's saved order. Standard items are always present
 * and immutable; type edits propagate. Falls back to the legacy per-appliance
 * template when the appliance has no vehicle type.
 */
export function resolveEffectiveChecklist(
  appliance: Appliance,
  template: ChecklistTemplate | null | undefined,
  vehicleType: VehicleType | null | undefined,
): EffectiveChecklist {
  const base = {
    applianceId: appliance.id,
    applianceName: appliance.name,
    vehicleTypeId: appliance.vehicleTypeId,
    vehicleTypeName: vehicleType?.name,
  };

  // Legacy / no type → the template items are the whole checklist.
  if (!appliance.vehicleTypeId || !vehicleType) {
    const items = (template?.items ?? []).map((i, idx) => ({ ...i, order: idx, isStandard: i.isStandard ?? false }));
    return { ...base, items };
  }

  const standard: ChecklistItem[] = (vehicleType.standardItems ?? []).map((i) => ({ ...i, isStandard: true }));
  const custom: ChecklistItem[] = (template?.items ?? []).map((i) => ({ ...i, isStandard: false }));
  const order = template?.itemOrder ?? [];

  const standardByCode = new Map(standard.map((i) => [i.itemCode || i.id, i]));
  const customById = new Map(custom.map((i) => [i.id, i]));

  const merged: ChecklistItem[] = [];
  const usedStandard = new Set<string>();
  const usedCustom = new Set<string>();
  for (const key of order) {
    if (standardByCode.has(key) && !usedStandard.has(key)) {
      merged.push(standardByCode.get(key)!);
      usedStandard.add(key);
    } else if (customById.has(key) && !usedCustom.has(key)) {
      merged.push(customById.get(key)!);
      usedCustom.add(key);
    }
  }
  // Standard items are always present (locked) — append any not referenced by the saved order.
  for (const s of standard) {
    const key = s.itemCode || s.id;
    if (!usedStandard.has(key)) merged.push(s);
  }
  // Then any custom items not referenced.
  for (const c of custom) {
    if (!usedCustom.has(c.id)) merged.push(c);
  }

  return { ...base, items: merged.map((i, idx) => ({ ...i, order: idx })) };
}
