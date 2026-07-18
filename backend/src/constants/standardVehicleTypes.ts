/**
 * Pre-provisioned standard vehicle type templates
 *
 * Version-controlled templates for rapid brigade onboarding. Each has a stable
 * `code` (used as the seed ID: `std-<code>`) and deterministic `itemCode`s on
 * checklist items for cross-brigade comparison. Templates are seeded idempotent
 * by the standardVehicleTypeSeeder; bump SEED_VERSION to update existing types.
 *
 * Template structure: reusable check groups (FLUIDS, TYRES, FUEL, etc.; RFS_*
 * groups are NSW RFS road-appliance specific) stacked per vehicle. Items omit
 * `id`/`order` here — the seeder's `upsert` stores them as-is (array order is
 * display order), unlike `VehicleTypeDatabase.create/update`, which run
 * `normaliseStandardItems` to backfill both.
 */

import type { ChecklistItem, VehicleType } from '../types';

export const SEED_VERSION = 2;

// Reusable checklist item groups (mutable references merged per-template)
// Using Partial<ChecklistItem> since normaliseStandardItems will fill in id/order
const FLUIDS: Partial<ChecklistItem>[] = [
  { name: 'Engine Oil', description: '', itemCode: 'engine-oil' },
  { name: 'Coolant', description: '', itemCode: 'coolant' },
  { name: 'Brake Fluid', description: '', itemCode: 'brake-fluid' },
  { name: 'Power Steering', description: '', itemCode: 'power-steering' },
  { name: 'Washer Fluid', description: '', itemCode: 'washer-fluid' },
];

const TYRES: Partial<ChecklistItem>[] = [
  { name: 'Tyre Condition', description: '', itemCode: 'tyre-condition' },
  { name: 'Tyre Pressure (PSI)', description: '', itemCode: 'tyre-pressure' },
  { name: 'Spare Tyre Present', description: '', itemCode: 'spare-tyre' },
];

const FUEL: Partial<ChecklistItem>[] = [
  { name: 'Fuel Level', description: '', itemCode: 'fuel-level' },
  { name: 'AdBlue Level', description: '', itemCode: 'adblue-level' },
];

const ROAD_LIGHTS: Partial<ChecklistItem>[] = [
  { name: 'Headlights', description: '', itemCode: 'headlights' },
  { name: 'Indicator Lights', description: '', itemCode: 'indicator-lights' },
  { name: 'Brake Lights', description: '', itemCode: 'brake-lights' },
  { name: 'Reverse Lights', description: '', itemCode: 'reverse-lights' },
  { name: 'Hazard Lights', description: '', itemCode: 'hazard-lights' },
];

const EMERGENCY_WARNING: Partial<ChecklistItem>[] = [
  { name: 'Beacons & Lightbar', description: '', itemCode: 'beacons-lightbar' },
  { name: 'Siren', description: '', itemCode: 'siren' },
  { name: 'Scene Lights', description: '', itemCode: 'scene-lights' },
];

const CONSUMABLES: Partial<ChecklistItem>[] = [
  { name: 'Spare Fuel', description: '', itemCode: 'spare-fuel' },
  { name: 'Drinking Water', description: '', itemCode: 'drinking-water' },
  { name: 'First Aid Kit', description: '', itemCode: 'first-aid-kit' },
  { name: 'PPE Stock', description: '', itemCode: 'ppe-stock' },
];

const LOCKERS: Partial<ChecklistItem>[] = [
  { name: 'Locker Inventory Complete', description: '', itemCode: 'locker-inventory' },
  { name: 'Lockers Secure', description: '', itemCode: 'lockers-secure' },
];

// NSW RFS specific
const PUMP_WATER: Partial<ChecklistItem>[] = [
  { name: 'Pump Prime Function', description: '', itemCode: 'pump-prime' },
  { name: 'Tank Level', description: '', itemCode: 'tank-level' },
  { name: 'Hoses & Branches', description: '', itemCode: 'hoses-branches' },
  { name: 'Foam Stock', description: '', itemCode: 'foam-stock' },
];

// NSW SES / Rescue specific
const RESCUE_EQUIPMENT: Partial<ChecklistItem>[] = [
  { name: 'Hydraulic Extrication Tools', description: '', itemCode: 'hydraulic-tools' },
  { name: 'Generator', description: '', itemCode: 'generator' },
  { name: 'Portable Lighting', description: '', itemCode: 'portable-lighting' },
  { name: 'Rope & Rigging', description: '', itemCode: 'rope-rigging' },
];

// Marine Rescue specific
const VESSEL_HULL: Partial<ChecklistItem>[] = [
  { name: 'Hull Integrity', description: '', itemCode: 'hull-integrity' },
  { name: 'Bilge Pump', description: '', itemCode: 'bilge-pump' },
  { name: 'Drain Plug Secure', description: '', itemCode: 'drain-plug' },
  { name: 'Seals & Gaskets', description: '', itemCode: 'seals-gaskets' },
];

const VESSEL_ENGINE: Partial<ChecklistItem>[] = [
  { name: 'Engine Oil', description: '', itemCode: 'engine-oil-marine' },
  { name: 'Coolant', description: '', itemCode: 'coolant-marine' },
  { name: 'Fuel Condition', description: '', itemCode: 'fuel-condition' },
  { name: 'Battery Voltage', description: '', itemCode: 'battery-voltage' },
];

const NAV_SAFETY: Partial<ChecklistItem>[] = [
  { name: 'Navigation Lights', description: '', itemCode: 'nav-lights' },
  { name: 'Radio / VHF', description: '', itemCode: 'radio-vhf' },
  { name: 'EPIRB & Beacons', description: '', itemCode: 'epirb-beacons' },
  { name: 'Life Jackets', description: '', itemCode: 'life-jackets' },
  { name: 'Flares & Signalling', description: '', itemCode: 'flares-signalling' },
];

const SUPPORT_VEHICLE: Partial<ChecklistItem>[] = [
  { name: 'Communication Equipment', description: '', itemCode: 'comms-equipment' },
  { name: 'Maps & Reference Materials', description: '', itemCode: 'maps-materials' },
  { name: 'Portable Power', description: '', itemCode: 'portable-power' },
];

const COMMUNICATION_EQUIPMENT: Partial<ChecklistItem>[] = [
  { name: 'Radio Equipment', description: '', itemCode: 'radio-equipment' },
  { name: 'Antenna System', description: '', itemCode: 'antenna-system' },
  { name: 'Power Supply', description: '', itemCode: 'power-supply' },
];

// ─── NSW RFS road-appliance groups ─────────────────────────────────────────
// Sourced from 5 real, brigade-accepted "Maintenance check sheet 2026" forms
// (PC Bravo / B1 Cat1 / Pumper / B7 Cat7 / LG Support6 Cat6) — see
// docs/wiki/developer/history/reviews/TRUCK_CHECKLIST_TEMPLATE_REVIEW_20260718.md.
// Truck-specific values (tyre PSI, pump kpa target, radio channels, cabin
// water counts) deliberately stay out of these — they vary appliance to
// appliance even within one category, so they belong in the per-appliance
// ChecklistTemplate overlay, not the shared standard.

const RFS_PRE_CHECK: Partial<ChecklistItem>[] = [
  { name: 'Disconnect MDT Charger', description: 'Before commencing the check, remove the 240v MDT charge cable.', itemCode: 'mdt-charger-disconnect', section: 'Pre-Check' },
];

const RFS_UNDER_VEHICLE: Partial<ChecklistItem>[] = [
  { name: 'No Leaks Under Vehicle', description: 'Visually inspect the ground under the vehicle for fluid leaks before starting checks.', itemCode: 'no-leaks-under-vehicle', section: 'Engine Bay' },
];

// Heavy appliance: air-over-hydraulic brakes, no clutch (Cat 1 / Cat 6 / Pumper)
const RFS_FLUIDS_HEAVY: Partial<ChecklistItem>[] = [
  { name: 'Engine Oil', description: 'Mark and top up to full level.', itemCode: 'engine-oil', section: 'Engine Bay' },
  { name: 'Coolant', description: 'Top up to full level.', itemCode: 'coolant', section: 'Engine Bay' },
  { name: 'Brake Fluid', description: 'Top up to full level.', itemCode: 'brake-fluid', section: 'Engine Bay' },
  { name: 'Battery Secure & Charge Indicator', description: 'Battery clamps tight, dust cover secure and clipped, charge indicator showing green.', itemCode: 'battery-secure', section: 'Engine Bay' },
  { name: 'Brake Air Tanks', description: 'Briefly bleed brake air tanks and check for moisture.', itemCode: 'air-brake-bleed', section: 'Engine Bay' },
  { name: 'Washer Water', description: 'Top up washer fluid reservoir (under bonnet at front).', itemCode: 'washer-fluid', section: 'Engine Bay' },
];

// Light appliance: combined brake/clutch fluid, no air brakes (Cat 7 / Personnel Carrier)
const RFS_FLUIDS_LIGHT: Partial<ChecklistItem>[] = [
  { name: 'Engine Oil', description: 'Mark and top up to full level.', itemCode: 'engine-oil', section: 'Engine Bay' },
  { name: 'Coolant', description: 'Top up to full level.', itemCode: 'coolant', section: 'Engine Bay' },
  { name: 'Brake & Clutch Fluid', description: 'Top up to full level.', itemCode: 'brake-fluid', section: 'Engine Bay' },
  { name: 'Battery Secure & Charge Indicator', description: 'Battery clamps tight, dust cover secure and clipped, charge indicator showing green.', itemCode: 'battery-secure', section: 'Engine Bay' },
  { name: 'Washer Water', description: 'Top up washer fluid reservoir (under bonnet at front).', itemCode: 'washer-fluid', section: 'Engine Bay' },
];

const RFS_TYRES: Partial<ChecklistItem>[] = [
  {
    name: 'Tyre Condition & Pressure',
    description: "Check for unusual wear or damage; inflate to the appliance's placard pressure (see appliance notes for target PSI). Full pressure check performed monthly, 1st Friday.",
    itemCode: 'tyre-condition',
    section: 'Engine Bay',
    expectedResponseType: 'numeric',
    unit: 'psi',
  },
];

const RFS_CABIN_KIT: Partial<ChecklistItem>[] = [
  { name: 'Cabin Equipment', description: 'Pens, directory/maps, Kestrel, disposable gloves and masks present.', itemCode: 'cabin-equipment', section: 'Cabin' },
  { name: 'Radio Channels', description: "Check all radios are set to the brigade's channels (see appliance notes for PRN/UHF/VHF).", itemCode: 'radio-channels', section: 'Cabin', expectedResponseType: 'text' },
  { name: 'Restart MDT', description: 'Restart the Mobile Data Terminal.', itemCode: 'restart-mdt', section: 'Cabin' },
  { name: 'Cabin Water Supplies', description: "Check bottled water stock in the cab is at the appliance's set level (see appliance notes).", itemCode: 'cabin-water-supplies', section: 'Cabin', expectedResponseType: 'numeric' },
];

const RFS_START_AND_MOVE: Partial<ChecklistItem>[] = [
  { name: 'Start Engine & Move to Forecourt', description: 'Start the vehicle and check the instrument panel for warning lights before moving out of the shed.', itemCode: 'start-move-forecourt', section: 'Cabin' },
];

const RFS_RUNNING_CHECKS: Partial<ChecklistItem>[] = [
  { name: 'Wipers, Washers & Accessories', description: 'Check wipers, washers, lights (including brake and reverse) and indicators.', itemCode: 'wipers-washers-accessories', section: 'Running Checks' },
  { name: 'Lights, Indicators & Work Lights', description: 'Check lights and indicators, locker lights, work lights and step lights.', itemCode: 'lights-indicators-work', section: 'Running Checks' },
  { name: 'Siren & Beacons', description: '', itemCode: 'siren-beacons', section: 'Running Checks' },
  { name: 'Fuel Level', description: 'If less than ¾ full, arrange refuelling.', itemCode: 'fuel-level', section: 'Running Checks', expectedResponseType: 'level' },
];

const RFS_PUMP_WATER: Partial<ChecklistItem>[] = [
  { name: 'Water Tank Full', description: '', itemCode: 'water-tank-full', section: 'Pump & Water' },
  { name: 'Pump Oil & Condition', description: 'Check pump oil level; report any damage or leaks.', itemCode: 'pump-oil-condition', section: 'Pump & Water' },
  { name: 'Valve Settings Review', description: 'Foam OFF, Bypass ON.', itemCode: 'valve-settings-review', section: 'Pump & Water' },
  {
    name: 'Run Pump & Check Pressure',
    description: "Run the pump and check pressure reaches the appliance's target (see appliance notes for kpa target).",
    itemCode: 'pump-pressure-test',
    section: 'Pump & Water',
    expectedResponseType: 'numeric',
    unit: 'kpa',
  },
  { name: 'Foam Levels', description: 'Check foam drum/tank levels.', itemCode: 'foam-stock', section: 'Pump & Water', expectedResponseType: 'level' },
  { name: 'Hose Reels', description: 'Check operation and inspect for damage.', itemCode: 'hose-reels', section: 'Pump & Water' },
];

const RFS_BA_CHECKS: Partial<ChecklistItem>[] = [
  { name: 'BA Checks', description: 'By a qualified operator — check the BA board and cleaning equipment.', itemCode: 'ba-checks', section: 'BA' },
];

const RFS_PORTABLE_EQUIPMENT: Partial<ChecklistItem>[] = [
  { name: 'Fuel Supplies for Portable Items', description: '', itemCode: 'portable-fuel-supplies', section: 'Portable Equipment' },
  { name: 'Portable Pumps', description: 'Check oil and fuel; run test, then turn off fuel.', itemCode: 'portable-pumps-test', section: 'Portable Equipment' },
  { name: 'Drip Torches', description: 'Full and secure; spare torch fuel stocked.', itemCode: 'drip-torches', section: 'Portable Equipment' },
];

// Urban Pumper only — rescue-adjacent equipment not carried by tankers
const RFS_PUMPER_EQUIPMENT: Partial<ChecklistItem>[] = [
  { name: 'RAM Fan', description: 'Check oil and fuel; run test.', itemCode: 'ram-fan-test', section: 'Portable Equipment' },
  { name: 'Generator', description: 'Check oil and fuel; run test, then turn off fuel.', itemCode: 'generator', section: 'Portable Equipment' },
  { name: 'Grinder Battery Charge', description: 'Check angle grinder battery is charged.', itemCode: 'grinder-battery-charge', section: 'Portable Equipment' },
];

const RFS_STOWAGE: Partial<ChecklistItem>[] = [
  { name: 'Hose Stocks', description: 'Complete, as per numbers listed on shelves.', itemCode: 'hose-stocks-complete', section: 'Stowage' },
  { name: 'Lockers Complete & Secure', description: 'Torches, traffic wands, flares and other locker contents as per the appliance inventory.', itemCode: 'lockers-secure', section: 'Stowage' },
  { name: 'Ladders & Hydrants', description: 'Ladder(s) stowed correctly; hydrant fittings secured.', itemCode: 'ladders-hydrants', section: 'Stowage' },
];

const RFS_SAFETY_EQUIPMENT: Partial<ChecklistItem>[] = [
  { name: 'AED', description: 'Check status.', itemCode: 'aed-status', section: 'Safety Equipment' },
  { name: 'First Aid Kit', description: 'Present and stocked.', itemCode: 'first-aid-kit', section: 'Safety Equipment' },
  { name: 'Fire Extinguisher', description: 'Dry Chem — gauge in the green.', itemCode: 'fire-extinguisher', section: 'Safety Equipment' },
];

const RFS_SIGNOFF: Partial<ChecklistItem>[] = [
  { name: 'Signoff Check Sheet', description: 'Complete signoff on page 2.', itemCode: 'signoff-check-sheet', section: 'Sign-off' },
  { name: 'Isolate & Reconnect Charger', description: 'Isolate the truck only after 5 minutes from ignition off, then connect the 240v MDT charger.', itemCode: 'mdt-charger-reconnect', section: 'Sign-off' },
];

// Personnel Carrier / Group vehicle: no pump, safety kit lives in the load area
const RFS_LOAD_AREA_SAFETY: Partial<ChecklistItem>[] = [
  { name: 'AED', description: 'Check status.', itemCode: 'aed-status', section: 'Load Area' },
  { name: 'First Aid Kit', description: 'Present and stocked.', itemCode: 'first-aid-kit', section: 'Load Area' },
  { name: 'Fire Extinguisher', description: 'Dry Chem — gauge in the green.', itemCode: 'fire-extinguisher', section: 'Load Area' },
  { name: 'Additional Bottled Water', description: 'Approx. 1 slab.', itemCode: 'load-area-water', section: 'Load Area' },
  { name: 'Fire Protection Blankets', description: 'Cabin set plus additional stock in the load area.', itemCode: 'fire-blankets', section: 'Load Area' },
];

// NSW RFS templates (6)
const CAT1_TANKER: VehicleType = {
  id: 'std-cat1-tanker',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'cat1-tanker',
  name: 'Cat 1 Tanker',
  description: 'NSW RFS Category 1 tanker for rural fire suppression',
  category: 'tanker',
  standardItems: [
    ...RFS_PRE_CHECK,
    ...RFS_UNDER_VEHICLE,
    ...RFS_FLUIDS_HEAVY,
    ...RFS_TYRES,
    ...RFS_CABIN_KIT,
    ...RFS_START_AND_MOVE,
    ...RFS_RUNNING_CHECKS,
    ...RFS_PUMP_WATER,
    ...RFS_BA_CHECKS,
    ...RFS_PORTABLE_EQUIPMENT,
    ...RFS_STOWAGE,
    ...RFS_SAFETY_EQUIPMENT,
    ...RFS_SIGNOFF,
  ] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-07-18'),
};

const CAT6_TANKER: VehicleType = {
  id: 'std-cat6-tanker',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'cat6-tanker',
  name: 'Cat 6 Tanker',
  description: 'NSW RFS Category 6 bulk water tanker fitted with full firefighting equipment (front-mounted monitor/water cannon, pump and hoses) — distinct from a bulk water carrier that has only a transfer pump and no firefighting kit',
  category: 'tanker',
  standardItems: [
    ...RFS_PRE_CHECK,
    ...RFS_UNDER_VEHICLE,
    ...RFS_FLUIDS_HEAVY,
    ...RFS_TYRES,
    ...RFS_CABIN_KIT,
    ...RFS_START_AND_MOVE,
    ...RFS_RUNNING_CHECKS,
    ...RFS_PUMP_WATER,
    { name: 'Monitor & Firefighting Equipment', description: 'Check top locker — tools, monitor (water cannon) and axe.', itemCode: 'monitor-firefighting-kit', section: 'Pump & Water' },
    ...RFS_PORTABLE_EQUIPMENT,
    ...RFS_STOWAGE,
    ...RFS_SAFETY_EQUIPMENT,
    ...RFS_SIGNOFF,
  ] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-07-18'),
  updatedAt: new Date('2026-07-18'),
};

const CAT7_TANKER: VehicleType = {
  id: 'std-cat7-tanker',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'cat7-tanker',
  name: 'Cat 7 Tanker',
  description: 'NSW RFS Category 7 tanker for rural fire suppression',
  category: 'tanker',
  standardItems: [
    ...RFS_PRE_CHECK,
    ...RFS_UNDER_VEHICLE,
    ...RFS_FLUIDS_LIGHT,
    ...RFS_TYRES,
    ...RFS_CABIN_KIT,
    ...RFS_START_AND_MOVE,
    ...RFS_RUNNING_CHECKS,
    ...RFS_PUMP_WATER,
    ...RFS_PORTABLE_EQUIPMENT,
    ...RFS_STOWAGE,
    ...RFS_SAFETY_EQUIPMENT,
    ...RFS_SIGNOFF,
  ] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-07-18'),
};

const CAT9_TANKER: VehicleType = {
  id: 'std-cat9-tanker',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'cat9-tanker',
  name: 'Cat 9 Tanker (Light)',
  description: 'NSW RFS Category 9 light tanker for rapid response',
  category: 'tanker',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const URBAN_PUMPER: VehicleType = {
  id: 'std-urban-pumper',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'urban-pumper',
  name: 'Urban Pumper (Cat 10/11)',
  description: 'NSW RFS urban structure fire pumper',
  category: 'pumper',
  standardItems: [
    ...RFS_PRE_CHECK,
    ...RFS_UNDER_VEHICLE,
    ...RFS_FLUIDS_HEAVY,
    ...RFS_TYRES,
    ...RFS_CABIN_KIT,
    ...RFS_START_AND_MOVE,
    ...RFS_RUNNING_CHECKS,
    ...RFS_PUMP_WATER,
    ...RFS_BA_CHECKS,
    ...RFS_PORTABLE_EQUIPMENT,
    ...RFS_PUMPER_EQUIPMENT,
    ...RFS_STOWAGE,
    ...RFS_SAFETY_EQUIPMENT,
    { name: 'CO2 Extinguisher', description: 'Present; gauge/seal intact.', itemCode: 'fire-extinguisher-co2', section: 'Safety Equipment' },
    ...RFS_SIGNOFF,
  ] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-07-18'),
};

const GROUP_PERSONNEL_VEHICLE: VehicleType = {
  id: 'std-group-personnel-vehicle',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'group-personnel-vehicle',
  name: 'Group / Personnel Vehicle',
  description: 'NSW RFS group transport and personnel carrier — covers both a troop-carrier bus and a dual-cab ute Personnel Carrier (PC); no pump/tank, safety kit carried in the load area',
  category: 'support',
  standardItems: [
    ...RFS_PRE_CHECK,
    ...RFS_UNDER_VEHICLE,
    ...RFS_FLUIDS_LIGHT,
    ...RFS_TYRES,
    ...RFS_START_AND_MOVE,
    ...RFS_CABIN_KIT,
    { name: 'Test Torch', description: 'Test handheld torch operation.', itemCode: 'test-torch', section: 'Cabin' },
    ...RFS_RUNNING_CHECKS,
    ...RFS_LOAD_AREA_SAFETY,
    ...RFS_SIGNOFF,
  ] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-07-18'),
};

// Fire & Rescue NSW templates (4)
const CLASS3_PUMPER: VehicleType = {
  id: 'std-class3-pumper',
  organizationId: undefined,
  isStandard: true,
  agency: 'Fire and Rescue NSW',
  code: 'class3-pumper',
  name: 'Class 3 Pumper',
  description: 'Fire and Rescue NSW Class 3 structure fire pumper',
  category: 'pumper',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const RESCUE_PUMPER: VehicleType = {
  id: 'std-rescue-pumper',
  organizationId: undefined,
  isStandard: true,
  agency: 'Fire and Rescue NSW',
  code: 'rescue-pumper',
  name: 'Rescue Pumper',
  description: 'Fire and Rescue NSW multi-purpose rescue and pumping vehicle',
  category: 'rescue',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...RESCUE_EQUIPMENT, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const AERIAL_LADDER: VehicleType = {
  id: 'std-aerial-ladder',
  organizationId: undefined,
  isStandard: true,
  agency: 'Fire and Rescue NSW',
  code: 'aerial-ladder',
  name: 'Aerial Ladder Platform',
  description: 'Fire and Rescue NSW aerial ladder platform for high-rise operations',
  category: 'aerial',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const HAZMAT_APPLIANCE: VehicleType = {
  id: 'std-hazmat-appliance',
  organizationId: undefined,
  isStandard: true,
  agency: 'Fire and Rescue NSW',
  code: 'hazmat-appliance',
  name: 'Hazmat Appliance',
  description: 'Fire and Rescue NSW hazardous materials response vehicle',
  category: 'hazmat',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...CONSUMABLES, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// NSW SES templates (5)
const GENERAL_PURPOSE_VEHICLE: VehicleType = {
  id: 'std-general-purpose-vehicle',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW SES',
  code: 'general-purpose-vehicle',
  name: 'General Purpose Vehicle',
  description: 'NSW SES general purpose support and transport vehicle',
  category: 'support',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...CONSUMABLES, ...SUPPORT_VEHICLE, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const LIGHT_RESCUE: VehicleType = {
  id: 'std-light-rescue',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW SES',
  code: 'light-rescue',
  name: 'Light Rescue Vehicle',
  description: 'NSW SES light rescue response vehicle',
  category: 'rescue',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const HEAVY_RESCUE: VehicleType = {
  id: 'std-heavy-rescue',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW SES',
  code: 'heavy-rescue',
  name: 'Heavy Rescue Vehicle',
  description: 'NSW SES heavy rescue and extrication vehicle',
  category: 'rescue',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const HIGH_CLEARANCE_VEHICLE: VehicleType = {
  id: 'std-high-clearance-vehicle',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW SES',
  code: 'high-clearance-vehicle',
  name: 'High Clearance Vehicle',
  description: 'NSW SES high clearance terrain vehicle',
  category: 'support',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...CONSUMABLES, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const STORM_TRUCK: VehicleType = {
  id: 'std-storm-truck',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW SES',
  code: 'storm-truck',
  name: 'Storm Truck',
  description: 'NSW SES storm response and cleanup vehicle',
  category: 'response',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...CONSUMABLES, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Marine Rescue NSW templates (3)
const OFFSHORE_RESCUE_VESSEL: VehicleType = {
  id: 'std-offshore-rescue-vessel',
  organizationId: undefined,
  isStandard: true,
  agency: 'Marine Rescue NSW',
  code: 'offshore-rescue-vessel',
  name: 'Offshore Rescue Vessel',
  description: 'Marine Rescue NSW offshore rescue vessel for open ocean',
  category: 'vessel',
  standardItems: [...VESSEL_HULL, ...VESSEL_ENGINE, ...NAV_SAFETY, ...EMERGENCY_WARNING, ...CONSUMABLES] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const INSHORE_RESCUE_VESSEL: VehicleType = {
  id: 'std-inshore-rescue-vessel',
  organizationId: undefined,
  isStandard: true,
  agency: 'Marine Rescue NSW',
  code: 'inshore-rescue-vessel',
  name: 'Inshore Rescue Vessel',
  description: 'Marine Rescue NSW inshore rescue vessel for coastal waters',
  category: 'vessel',
  standardItems: [...VESSEL_HULL, ...VESSEL_ENGINE, ...NAV_SAFETY, ...EMERGENCY_WARNING, ...CONSUMABLES] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const RESCUE_WATER_CRAFT: VehicleType = {
  id: 'std-rescue-water-craft',
  organizationId: undefined,
  isStandard: true,
  agency: 'Marine Rescue NSW',
  code: 'rescue-water-craft',
  name: 'Rescue Water Craft (PWC)',
  description: 'Marine Rescue NSW personal water craft for rapid response',
  category: 'vessel',
  standardItems: [...VESSEL_HULL, ...VESSEL_ENGINE, ...NAV_SAFETY, ...CONSUMABLES] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// Generic templates (3)
const COMMAND_VEHICLE: VehicleType = {
  id: 'std-command-vehicle',
  organizationId: undefined,
  isStandard: true,
  agency: 'Generic',
  code: 'command-vehicle',
  name: 'Command / Incident Control Vehicle',
  description: 'Generic incident command and control vehicle',
  category: 'command',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...SUPPORT_VEHICLE, ...COMMUNICATION_EQUIPMENT, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const CREW_TRANSPORT: VehicleType = {
  id: 'std-crew-transport',
  organizationId: undefined,
  isStandard: true,
  agency: 'Generic',
  code: 'crew-transport',
  name: 'Crew Transport Vehicle',
  description: 'Generic crew and personnel transport vehicle',
  category: 'support',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...CONSUMABLES, ...LOCKERS] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const LOGISTICS_TRAILER: VehicleType = {
  id: 'std-logistics-trailer',
  organizationId: undefined,
  isStandard: true,
  agency: 'Generic',
  code: 'logistics-trailer',
  name: 'Logistics / Support Trailer',
  description: 'Generic logistics and supply support trailer',
  category: 'support',
  standardItems: [
    { name: 'Tyre Condition', description: '', itemCode: 'tyre-condition' },
    { name: 'Lighting', description: '', itemCode: 'lighting' },
    { name: 'Coupling System', description: '', itemCode: 'coupling-system' },
    { name: 'Load Secure', description: '', itemCode: 'load-secure' },
    ...CONSUMABLES,
    ...LOCKERS,
  ] as ChecklistItem[],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const STANDARD_VEHICLE_TYPES: VehicleType[] = [
  // NSW RFS
  CAT1_TANKER,
  CAT6_TANKER,
  CAT7_TANKER,
  CAT9_TANKER,
  URBAN_PUMPER,
  GROUP_PERSONNEL_VEHICLE,
  // Fire & Rescue NSW
  CLASS3_PUMPER,
  RESCUE_PUMPER,
  AERIAL_LADDER,
  HAZMAT_APPLIANCE,
  // NSW SES
  GENERAL_PURPOSE_VEHICLE,
  LIGHT_RESCUE,
  HEAVY_RESCUE,
  HIGH_CLEARANCE_VEHICLE,
  STORM_TRUCK,
  // Marine Rescue NSW
  OFFSHORE_RESCUE_VESSEL,
  INSHORE_RESCUE_VESSEL,
  RESCUE_WATER_CRAFT,
  // Generic
  COMMAND_VEHICLE,
  CREW_TRANSPORT,
  LOGISTICS_TRAILER,
];
