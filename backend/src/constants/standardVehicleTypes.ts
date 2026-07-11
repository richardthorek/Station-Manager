/**
 * Pre-provisioned standard vehicle type templates
 *
 * Version-controlled templates for rapid brigade onboarding. Each has a stable
 * `code` (used as the seed ID: `std-<code>`) and deterministic `itemCode`s on
 * checklist items for cross-brigade comparison. Templates are seeded idempotent
 * by the standardVehicleTypeSeeder; bump SEED_VERSION to update existing types.
 *
 * Template structure: reusable check groups (FLUIDS, TYRES, FUEL, etc.) stacked
 * per vehicle. Item `id` and `order` are assigned by normaliseStandardItems.
 */

import type { ChecklistItem, VehicleType } from '../types';

export const SEED_VERSION = 1;

// Reusable checklist item groups (mutable references merged per-template)
const FLUIDS: ChecklistItem[] = [
  { name: 'Engine Oil', itemCode: 'engine-oil' },
  { name: 'Coolant', itemCode: 'coolant' },
  { name: 'Brake Fluid', itemCode: 'brake-fluid' },
  { name: 'Power Steering', itemCode: 'power-steering' },
  { name: 'Washer Fluid', itemCode: 'washer-fluid' },
];

const TYRES: ChecklistItem[] = [
  { name: 'Tyre Condition', itemCode: 'tyre-condition' },
  { name: 'Tyre Pressure (PSI)', itemCode: 'tyre-pressure', itemType: 'numeric' },
  { name: 'Spare Tyre Present', itemCode: 'spare-tyre' },
];

const FUEL: ChecklistItem[] = [
  { name: 'Fuel Level', itemCode: 'fuel-level', itemType: 'level' },
  { name: 'AdBlue Level', itemCode: 'adblue-level', itemType: 'level' },
];

const ROAD_LIGHTS: ChecklistItem[] = [
  { name: 'Headlights', itemCode: 'headlights' },
  { name: 'Indicator Lights', itemCode: 'indicator-lights' },
  { name: 'Brake Lights', itemCode: 'brake-lights' },
  { name: 'Reverse Lights', itemCode: 'reverse-lights' },
  { name: 'Hazard Lights', itemCode: 'hazard-lights' },
];

const EMERGENCY_WARNING: ChecklistItem[] = [
  { name: 'Beacons & Lightbar', itemCode: 'beacons-lightbar' },
  { name: 'Siren', itemCode: 'siren' },
  { name: 'Scene Lights', itemCode: 'scene-lights' },
];

const CONSUMABLES: ChecklistItem[] = [
  { name: 'Spare Fuel', itemCode: 'spare-fuel' },
  { name: 'Drinking Water', itemCode: 'drinking-water' },
  { name: 'First Aid Kit', itemCode: 'first-aid-kit' },
  { name: 'PPE Stock', itemCode: 'ppe-stock' },
];

const LOCKERS: ChecklistItem[] = [
  { name: 'Locker Inventory Complete', itemCode: 'locker-inventory' },
  { name: 'Lockers Secure', itemCode: 'lockers-secure' },
];

// NSW RFS specific
const PUMP_WATER: ChecklistItem[] = [
  { name: 'Pump Prime Function', itemCode: 'pump-prime' },
  { name: 'Tank Level', itemCode: 'tank-level', itemType: 'level' },
  { name: 'Hoses & Branches', itemCode: 'hoses-branches' },
  { name: 'Foam Stock', itemCode: 'foam-stock' },
];

// NSW SES / Rescue specific
const RESCUE_EQUIPMENT: ChecklistItem[] = [
  { name: 'Hydraulic Extrication Tools', itemCode: 'hydraulic-tools' },
  { name: 'Generator', itemCode: 'generator' },
  { name: 'Portable Lighting', itemCode: 'portable-lighting' },
  { name: 'Rope & Rigging', itemCode: 'rope-rigging' },
];

// Marine Rescue specific
const VESSEL_HULL: ChecklistItem[] = [
  { name: 'Hull Integrity', itemCode: 'hull-integrity' },
  { name: 'Bilge Pump', itemCode: 'bilge-pump' },
  { name: 'Drain Plug Secure', itemCode: 'drain-plug' },
  { name: 'Seals & Gaskets', itemCode: 'seals-gaskets' },
];

const VESSEL_ENGINE: ChecklistItem[] = [
  { name: 'Engine Oil', itemCode: 'engine-oil-marine' },
  { name: 'Coolant', itemCode: 'coolant-marine' },
  { name: 'Fuel Condition', itemCode: 'fuel-condition' },
  { name: 'Battery Voltage', itemCode: 'battery-voltage', itemType: 'numeric' },
];

const NAV_SAFETY: ChecklistItem[] = [
  { name: 'Navigation Lights', itemCode: 'nav-lights' },
  { name: 'Radio / VHF', itemCode: 'radio-vhf' },
  { name: 'EPIRB & Beacons', itemCode: 'epirb-beacons' },
  { name: 'Life Jackets', itemCode: 'life-jackets' },
  { name: 'Flares & Signalling', itemCode: 'flares-signalling' },
];

const SUPPORT_VEHICLE: ChecklistItem[] = [
  { name: 'Communication Equipment', itemCode: 'comms-equipment' },
  { name: 'Maps & Reference Materials', itemCode: 'maps-materials' },
  { name: 'Portable Power', itemCode: 'portable-power' },
];

const COMMUNICATION_EQUIPMENT: ChecklistItem[] = [
  { name: 'Radio Equipment', itemCode: 'radio-equipment' },
  { name: 'Antenna System', itemCode: 'antenna-system' },
  { name: 'Power Supply', itemCode: 'power-supply' },
];

// NSW RFS templates (5)
const CAT1_TANKER: VehicleType = {
  id: 'std-cat1-tanker',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'cat1-tanker',
  name: 'Cat 1 Tanker',
  description: 'NSW RFS Category 1 tanker for rural fire suppression',
  category: 'tanker',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const GROUP_PERSONNEL_VEHICLE: VehicleType = {
  id: 'std-group-personnel-vehicle',
  organizationId: undefined,
  isStandard: true,
  agency: 'NSW RFS',
  code: 'group-personnel-vehicle',
  name: 'Group / Personnel Vehicle',
  description: 'NSW RFS group transport and personnel vehicle',
  category: 'support',
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...CONSUMABLES, ...SUPPORT_VEHICLE, ...LOCKERS],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...PUMP_WATER, ...RESCUE_EQUIPMENT, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...CONSUMABLES, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...CONSUMABLES, ...SUPPORT_VEHICLE, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...CONSUMABLES, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...EMERGENCY_WARNING, ...RESCUE_EQUIPMENT, ...CONSUMABLES, ...LOCKERS],
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
  standardItems: [...VESSEL_HULL, ...VESSEL_ENGINE, ...NAV_SAFETY, ...EMERGENCY_WARNING, ...CONSUMABLES],
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
  standardItems: [...VESSEL_HULL, ...VESSEL_ENGINE, ...NAV_SAFETY, ...EMERGENCY_WARNING, ...CONSUMABLES],
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
  standardItems: [...VESSEL_HULL, ...VESSEL_ENGINE, ...NAV_SAFETY, ...CONSUMABLES],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...SUPPORT_VEHICLE, ...COMMUNICATION_EQUIPMENT, ...LOCKERS],
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
  standardItems: [...FLUIDS, ...TYRES, ...FUEL, ...ROAD_LIGHTS, ...CONSUMABLES, ...LOCKERS],
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
    { name: 'Tyre Condition', itemCode: 'tyre-condition' },
    { name: 'Lighting', itemCode: 'lighting' },
    { name: 'Coupling System', itemCode: 'coupling-system' },
    { name: 'Load Secure', itemCode: 'load-secure' },
    ...CONSUMABLES,
    ...LOCKERS,
  ],
  seedVersion: SEED_VERSION,
  createdBy: 'system',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

export const STANDARD_VEHICLE_TYPES: VehicleType[] = [
  // NSW RFS
  CAT1_TANKER,
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
