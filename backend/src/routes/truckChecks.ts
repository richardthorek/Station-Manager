/**
 * Truck Checks Routes
 * 
 * Comprehensive vehicle inspection workflow including:
 * - Appliance management (fire trucks, bulk water carriers, command vehicles)
 * - Checklist templates with customizable items
 * - Check run creation and management (collaborative checking)
 * - Check result tracking (done, issue, skipped statuses)
 * - Photo upload support (Azure Blob Storage integration)
 * - Real-time collaboration via WebSocket
 * - Issue tracking and reporting
 * 
 * Multi-Station Support:
 * - All GET endpoints filter by stationId (from X-Station-Id header or query param)
 * - POST endpoints assign stationId to new appliances, templates, and check runs
 * - Backward compatible: defaults to DEFAULT_STATION_ID if no stationId provided
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ensureTruckChecksDatabase } from '../services/truckChecksDbFactory';
import { ensureVehicleTypeDatabase } from '../services/vehicleTypeDbFactory';
import { ensureApplianceZoneDatabase } from '../services/applianceZoneDbFactory';
import { ensureApplianceEquipmentDatabase } from '../services/applianceEquipmentDbFactory';
import type { ApplianceZoneSide } from '../types';
import { CheckStatus, ChecklistItem, EffectiveChecklist, VehicleType, ChecklistTemplate, Appliance } from '../types';
import { azureStorageService } from '../services/azureStorage';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { attachOrganization } from '../middleware/entitlements';
import { slugify } from '../utils/slug';
import { io } from '../index';
import {
  validateCreateAppliance,
  validateUpdateAppliance,
  validateApplianceId,
  validateTemplateApplianceId,
  validateUpdateTemplate,
  validateCreateCheckRun,
  validateCheckRunId,
  validateCompleteCheckRun,
  validateCheckRunQuery,
  validateCreateCheckResult,
  validateUpdateCheckResult,
  validateCheckResultId,
} from '../middleware/truckCheckValidation';
import { handleValidationErrors } from '../middleware/validationHandler';
import { stationMiddleware, getStationIdFromRequest } from '../middleware/stationMiddleware';
import { enforceVehicleLimit } from '../middleware/entitlements';
import { logger } from '../services/logger';

const router = Router();

// Apply station middleware to all routes
router.use(stationMiddleware);

// Configure multer for memory storage (we'll upload to Azure)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ============================================
// Appliance Routes
// ============================================

/**
 * GET /api/truck-checks/appliances
 * Get all appliances (filtered by station)
 */
router.get('/appliances', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const appliances = await db.getAllAppliances(stationId);
    res.json(appliances);
  } catch (error) {
    logger.error('Error fetching appliances:', error);
    res.status(500).json({ error: 'Failed to fetch appliances' });
  }
});

/**
 * GET /api/truck-checks/appliances/:id
 * Get a specific appliance
 */
router.get('/appliances/:id', validateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.getApplianceById(req.params.id);
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    res.json(appliance);
  } catch (error) {
    logger.error('Error fetching appliance:', error);
    res.status(500).json({ error: 'Failed to fetch appliance' });
  }
});

/**
 * POST /api/truck-checks/appliances
 * Create a new appliance (assigns station)
 */
router.post('/appliances', enforceVehicleLimit(), validateCreateAppliance, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { name, description, photoUrl, vehicleType } = req.body;
    const stationId = getStationIdFromRequest(req);

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.createAppliance(name, description, photoUrl, stationId, vehicleType, extractApplianceDetails(req.body));
    res.status(201).json(appliance);
  } catch (error) {
    logger.error('Error creating appliance:', error);
    res.status(500).json({ error: 'Failed to create appliance' });
  }
});

/**
 * PUT /api/truck-checks/appliances/:id
 * Update an appliance
 */
router.put('/appliances/:id', validateUpdateAppliance, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { name, description, photoUrl, vehicleType } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.updateAppliance(req.params.id, name, description, photoUrl, vehicleType, extractApplianceDetails(req.body));
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    res.json(appliance);
  } catch (error) {
    logger.error('Error updating appliance:', error);
    res.status(500).json({ error: 'Failed to update appliance' });
  }
});

/**
 * DELETE /api/truck-checks/appliances/:id
 * Delete an appliance
 */
router.delete('/appliances/:id', validateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const deleted = await db.deleteAppliance(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting appliance:', error);
    res.status(500).json({ error: 'Failed to delete appliance' });
  }
});

// ============================================
// Template Routes
// ============================================

/**
 * GET /api/truck-checks/templates/:applianceId
 * Get checklist template for an appliance
 */
router.get('/templates/:applianceId', validateTemplateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const template = await db.getTemplateByApplianceId(req.params.applianceId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * PUT /api/truck-checks/templates/:applianceId
 * Update checklist template for an appliance (assigns station)
 */
router.put('/templates/:applianceId', validateUpdateTemplate, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const template = await db.updateTemplate(req.params.applianceId, items, stationId);
    res.json(template);
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================
// Vehicle Type Routes (standard checklists, org-scoped + shared standards)
// ============================================

/** Pull the optional vehicle identity / type-link fields off a request body. */
function extractApplianceDetails(body: Record<string, unknown>) {
  const yearNum = body.year !== undefined && body.year !== null && body.year !== '' ? Number(body.year) : undefined;
  return {
    vehicleTypeId: typeof body.vehicleTypeId === 'string' ? body.vehicleTypeId : undefined,
    agencyId: typeof body.agencyId === 'string' ? body.agencyId : undefined,
    registration: typeof body.registration === 'string' ? body.registration : undefined,
    vin: typeof body.vin === 'string' ? body.vin : undefined,
    make: typeof body.make === 'string' ? body.make : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
    year: Number.isFinite(yearNum) ? yearNum : undefined,
  };
}

/**
 * Resolve the checklist an inspector actually works through for an appliance:
 * the VehicleType's locked standard items merged with the brigade's custom
 * overlay items, in the brigade's saved order. Standard items are always present
 * and immutable; type edits propagate. Falls back to the legacy per-appliance
 * template when the appliance has no vehicle type.
 */
function resolveEffectiveChecklist(
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

// All vehicle-type management requires an authenticated org admin.
const vehicleTypeAuth = [authMiddleware, attachOrganization, requireAdmin];

/**
 * GET /api/truck-checks/vehicle-types
 * List the vehicle types this org may use: its own + all published standards.
 */
router.get('/vehicle-types', authMiddleware, attachOrganization, async (req: Request, res: Response) => {
  try {
    const types = await ensureVehicleTypeDatabase().listForOrganization(req.user?.organizationId);
    res.json(types);
  } catch (error) {
    logger.error('Error listing vehicle types:', error);
    res.status(500).json({ error: 'Failed to list vehicle types' });
  }
});

/**
 * POST /api/truck-checks/vehicle-types
 * Create a vehicle type (owned by the caller's org; isStandard publishes it).
 */
router.post('/vehicle-types', vehicleTypeAuth, async (req: Request, res: Response) => {
  try {
    const { name, code, description, category, standardItems, isStandard } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!Array.isArray(standardItems)) {
      return res.status(400).json({ error: 'standardItems must be an array' });
    }
    const type = await ensureVehicleTypeDatabase().create({
      organizationId: req.user?.organizationId,
      isStandard: Boolean(isStandard),
      code: typeof code === 'string' && code.trim() ? slugify(code) : slugify(name),
      name: name.trim(),
      description: typeof description === 'string' ? description : undefined,
      category: typeof category === 'string' ? category : undefined,
      standardItems,
      createdBy: req.user?.userId,
    });
    res.status(201).json(type);
  } catch (error) {
    logger.error('Error creating vehicle type:', error);
    res.status(500).json({ error: 'Failed to create vehicle type' });
  }
});

/**
 * PUT /api/truck-checks/vehicle-types/:id
 * Update a vehicle type. You may only edit a type your org owns (standards
 * published by other orgs are read-only to you, but adoptable).
 */
router.put('/vehicle-types/:id', vehicleTypeAuth, async (req: Request, res: Response) => {
  try {
    const db = ensureVehicleTypeDatabase();
    const existing = await db.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Vehicle type not found' });
    if (existing.organizationId && existing.organizationId !== req.user?.organizationId) {
      return res.status(403).json({ error: 'You can only edit vehicle types your organisation owns' });
    }
    const { name, code, description, category, standardItems, isStandard } = req.body ?? {};
    const updated = await db.update(req.params.id, {
      ...(name !== undefined ? { name } : {}),
      ...(code !== undefined ? { code: slugify(code) } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(isStandard !== undefined ? { isStandard: Boolean(isStandard) } : {}),
      ...(standardItems !== undefined ? { standardItems } : {}),
    });
    res.json(updated);
  } catch (error) {
    logger.error('Error updating vehicle type:', error);
    res.status(500).json({ error: 'Failed to update vehicle type' });
  }
});

/**
 * DELETE /api/truck-checks/vehicle-types/:id
 * Delete a vehicle type your org owns.
 */
router.delete('/vehicle-types/:id', vehicleTypeAuth, async (req: Request, res: Response) => {
  try {
    const db = ensureVehicleTypeDatabase();
    const existing = await db.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Vehicle type not found' });
    if (existing.organizationId && existing.organizationId !== req.user?.organizationId) {
      return res.status(403).json({ error: 'You can only delete vehicle types your organisation owns' });
    }
    await db.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting vehicle type:', error);
    res.status(500).json({ error: 'Failed to delete vehicle type' });
  }
});

// ─── A1: per-truck appliance zones (spatial model) ───
// Zones are admin-authored config for one appliance. All writes require an
// authenticated org admin; reads require an authenticated session.
const zoneAuth = [authMiddleware, attachOrganization, requireAdmin];

const VALID_SIDES: ApplianceZoneSide[] = ['driver', 'passenger', 'front', 'rear', 'top', 'interior', 'na'];
function parseSide(value: unknown): ApplianceZoneSide | undefined {
  return typeof value === 'string' && (VALID_SIDES as string[]).includes(value)
    ? (value as ApplianceZoneSide)
    : undefined;
}

/**
 * GET /api/truck-checks/appliances/:applianceId/zones
 * List one appliance's zones in walk-around order.
 */
router.get('/appliances/:applianceId/zones', authMiddleware, attachOrganization, async (req: Request, res: Response) => {
  try {
    const zones = await ensureApplianceZoneDatabase().listForAppliance(req.params.applianceId);
    res.json(zones);
  } catch (error) {
    logger.error('Error listing appliance zones:', error);
    res.status(500).json({ error: 'Failed to list appliance zones' });
  }
});

/**
 * POST /api/truck-checks/appliances/:applianceId/zones
 * Create a zone on an appliance (admin). stationId is inherited from the truck.
 */
router.post('/appliances/:applianceId/zones', zoneAuth, async (req: Request, res: Response) => {
  try {
    const truckDb = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await truckDb.getApplianceById(req.params.applianceId);
    if (!appliance) return res.status(404).json({ error: 'Appliance not found' });

    const { name, zoneCode, parentZoneId, side, order, description } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const zone = await ensureApplianceZoneDatabase().create({
      applianceId: req.params.applianceId,
      stationId: appliance.stationId,
      name: name.trim(),
      zoneCode: typeof zoneCode === 'string' && zoneCode.trim() ? slugify(zoneCode) : undefined,
      parentZoneId: typeof parentZoneId === 'string' ? parentZoneId : undefined,
      side: parseSide(side),
      order: typeof order === 'number' ? order : undefined,
      description: typeof description === 'string' ? description : undefined,
    });
    res.status(201).json(zone);
  } catch (error) {
    logger.error('Error creating appliance zone:', error);
    res.status(500).json({ error: 'Failed to create appliance zone' });
  }
});

/**
 * PUT /api/truck-checks/zones/:id
 * Update a zone (admin).
 */
router.put('/zones/:id', zoneAuth, async (req: Request, res: Response) => {
  try {
    const db = ensureApplianceZoneDatabase();
    const existing = await db.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zone not found' });

    const { name, zoneCode, parentZoneId, side, order, description } = req.body ?? {};
    const updated = await db.update(req.params.id, {
      ...(name !== undefined ? { name } : {}),
      ...(zoneCode !== undefined ? { zoneCode: typeof zoneCode === 'string' && zoneCode.trim() ? slugify(zoneCode) : undefined } : {}),
      ...(parentZoneId !== undefined ? { parentZoneId: typeof parentZoneId === 'string' ? parentZoneId : undefined } : {}),
      ...(side !== undefined ? { side: parseSide(side) } : {}),
      ...(order !== undefined ? { order: typeof order === 'number' ? order : existing.order } : {}),
      ...(description !== undefined ? { description: typeof description === 'string' ? description : undefined } : {}),
    });
    res.json(updated);
  } catch (error) {
    logger.error('Error updating appliance zone:', error);
    res.status(500).json({ error: 'Failed to update appliance zone' });
  }
});

/**
 * DELETE /api/truck-checks/zones/:id
 * Delete a zone (admin).
 */
router.delete('/zones/:id', zoneAuth, async (req: Request, res: Response) => {
  try {
    const db = ensureApplianceZoneDatabase();
    const existing = await db.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zone not found' });
    await db.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting appliance zone:', error);
    res.status(500).json({ error: 'Failed to delete appliance zone' });
  }
});

// ─── A1: per-truck appliance equipment (inventory) ───
// Equipment is admin-authored config for one appliance. Writes require an
// authenticated org admin; reads require an authenticated session.
const equipmentAuth = [authMiddleware, attachOrganization, requireAdmin];

/**
 * GET /api/truck-checks/appliances/:applianceId/equipment
 * List one appliance's equipment (active only by default; ?includeInactive=true for retired).
 */
router.get('/appliances/:applianceId/equipment', authMiddleware, attachOrganization, async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const items = await ensureApplianceEquipmentDatabase().listForAppliance(req.params.applianceId, includeInactive);
    res.json(items);
  } catch (error) {
    logger.error('Error listing appliance equipment:', error);
    res.status(500).json({ error: 'Failed to list appliance equipment' });
  }
});

/**
 * POST /api/truck-checks/appliances/:applianceId/equipment
 * Add equipment to an appliance (admin). stationId is inherited from the truck.
 */
router.post('/appliances/:applianceId/equipment', equipmentAuth, async (req: Request, res: Response) => {
  try {
    const truckDb = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await truckDb.getApplianceById(req.params.applianceId);
    if (!appliance) return res.status(404).json({ error: 'Appliance not found' });

    const { name, equipmentCode, zoneId, serialNumber, notes, active } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const item = await ensureApplianceEquipmentDatabase().create({
      applianceId: req.params.applianceId,
      stationId: appliance.stationId,
      name: name.trim(),
      equipmentCode: typeof equipmentCode === 'string' && equipmentCode.trim() ? slugify(equipmentCode) : undefined,
      zoneId: typeof zoneId === 'string' ? zoneId : undefined,
      serialNumber: typeof serialNumber === 'string' ? serialNumber : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
      active: typeof active === 'boolean' ? active : undefined,
    });
    res.status(201).json(item);
  } catch (error) {
    logger.error('Error creating appliance equipment:', error);
    res.status(500).json({ error: 'Failed to create appliance equipment' });
  }
});

/**
 * PUT /api/truck-checks/equipment/:id
 * Update an equipment item (admin). Set active:false to retire without losing history.
 */
router.put('/equipment/:id', equipmentAuth, async (req: Request, res: Response) => {
  try {
    const db = ensureApplianceEquipmentDatabase();
    const existing = await db.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Equipment not found' });

    const { name, equipmentCode, zoneId, serialNumber, notes, active } = req.body ?? {};
    const updated = await db.update(req.params.id, {
      ...(name !== undefined ? { name } : {}),
      ...(equipmentCode !== undefined ? { equipmentCode: typeof equipmentCode === 'string' && equipmentCode.trim() ? slugify(equipmentCode) : undefined } : {}),
      ...(zoneId !== undefined ? { zoneId: typeof zoneId === 'string' ? zoneId : undefined } : {}),
      ...(serialNumber !== undefined ? { serialNumber: typeof serialNumber === 'string' ? serialNumber : undefined } : {}),
      ...(notes !== undefined ? { notes: typeof notes === 'string' ? notes : undefined } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    });
    res.json(updated);
  } catch (error) {
    logger.error('Error updating appliance equipment:', error);
    res.status(500).json({ error: 'Failed to update appliance equipment' });
  }
});

/**
 * DELETE /api/truck-checks/equipment/:id
 * Delete an equipment item (admin). Prefer active:false to retain history.
 */
router.delete('/equipment/:id', equipmentAuth, async (req: Request, res: Response) => {
  try {
    const db = ensureApplianceEquipmentDatabase();
    const existing = await db.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Equipment not found' });
    await db.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting appliance equipment:', error);
    res.status(500).json({ error: 'Failed to delete appliance equipment' });
  }
});

// ============================================
// Effective Checklist (standard + custom, resolved) — kiosk-friendly
// ============================================

/**
 * GET /api/truck-checks/appliances/:id/checklist
 * The resolved checklist for an appliance (standard items from its vehicle type,
 * locked, + the brigade's custom overlay, in saved order). What the check
 * workflow renders.
 */
router.get('/appliances/:id/checklist', validateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.getApplianceById(req.params.id);
    if (!appliance) return res.status(404).json({ error: 'Appliance not found' });

    const template = await db.getTemplateByApplianceId(req.params.id);
    const vehicleType = appliance.vehicleTypeId
      ? await ensureVehicleTypeDatabase().getById(appliance.vehicleTypeId)
      : null;

    res.json(resolveEffectiveChecklist(appliance, template, vehicleType));
  } catch (error) {
    logger.error('Error resolving effective checklist:', error);
    res.status(500).json({ error: 'Failed to resolve checklist' });
  }
});

/**
 * PUT /api/truck-checks/appliances/:id/checklist
 * Save the brigade's custom overlay for a type-linked appliance: custom items
 * (standard items are never sent here — they live on the type) and the preferred
 * order (keys: standard item itemCode or custom item id).
 */
router.put('/appliances/:id/checklist', validateApplianceId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { customItems, itemOrder } = req.body ?? {};
    if (!Array.isArray(customItems)) {
      return res.status(400).json({ error: 'customItems must be an array' });
    }
    const stationId = getStationIdFromRequest(req);
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const appliance = await db.getApplianceById(req.params.id);
    if (!appliance) return res.status(404).json({ error: 'Appliance not found' });

    // Persist custom items (forced isStandard:false) + order via the template overlay.
    const overlayItems: ChecklistItem[] = customItems.map((i: ChecklistItem, idx: number) => ({
      ...i,
      order: typeof i.order === 'number' ? i.order : idx,
      isStandard: false,
    }));
    const cleanOrder = Array.isArray(itemOrder)
      ? itemOrder.filter((k: unknown): k is string => typeof k === 'string')
      : undefined;
    const template = await db.updateTemplate(req.params.id, overlayItems, stationId, cleanOrder);

    const vehicleType = appliance.vehicleTypeId
      ? await ensureVehicleTypeDatabase().getById(appliance.vehicleTypeId)
      : null;
    res.json(resolveEffectiveChecklist(appliance, template, vehicleType));
  } catch (error) {
    logger.error('Error saving checklist overlay:', error);
    res.status(500).json({ error: 'Failed to save checklist' });
  }
});

// ============================================
// Check Run Routes
// ============================================

/**
 * POST /api/truck-checks/runs
 * Find or create a check run for collaborative checking (assigns station)
 * If an active check run exists for the appliance, join it; otherwise create new
 */
router.post('/runs', validateCreateCheckRun, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { applianceId, completedBy, completedByName } = req.body;
    const stationId = getStationIdFromRequest(req);
    
    if (!applianceId || !completedBy) {
      return res.status(400).json({ error: 'applianceId and completedBy are required' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    
    // Check for existing active check run
    let checkRun = await db.getActiveCheckRunForAppliance(applianceId);
    
    if (checkRun) {
      // Join existing check run
      checkRun = await db.addContributorToCheckRun(checkRun.id, completedByName || completedBy);
      
      // Ensure checkRun is not undefined after addContributorToCheckRun
      if (!checkRun) {
        return res.status(500).json({ error: 'Failed to add contributor to check run' });
      }
      
      // Emit real-time update that someone joined - station-scoped
      if (checkRun.stationId) {
        io.to(`station-${checkRun.stationId}`).emit('truck-check-update', {
          type: 'contributor-joined',
          runId: checkRun.id,
          contributorName: completedByName || completedBy,
          checkRun,
          timestamp: new Date()
        });
      }
      
      res.json({ ...checkRun, joined: true });
    } else {
      // Create new check run
      checkRun = await db.createCheckRun(applianceId, completedBy, completedByName, stationId);
      
      // Emit real-time update that check run started - station-scoped
      if (checkRun.stationId) {
        io.to(`station-${checkRun.stationId}`).emit('truck-check-update', {
          type: 'check-started',
          runId: checkRun.id,
          checkRun,
          timestamp: new Date()
        });
      }
      
      res.status(201).json({ ...checkRun, joined: false });
    }
  } catch (error) {
    logger.error('Error creating/joining check run:', error);
    res.status(500).json({ error: 'Failed to create/join check run' });
  }
});

/**
 * GET /api/truck-checks/runs/:id
 * Get a specific check run with results
 */
router.get('/runs/:id', validateCheckRunId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const checkRun = await db.getCheckRunWithResults(req.params.id);
    if (!checkRun) {
      return res.status(404).json({ error: 'Check run not found' });
    }
    res.json(checkRun);
  } catch (error) {
    logger.error('Error fetching check run:', error);
    res.status(500).json({ error: 'Failed to fetch check run' });
  }
});

/**
 * GET /api/truck-checks/runs
 * Get all check runs with optional filters (filtered by station)
 */
router.get('/runs', validateCheckRunQuery, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { applianceId, startDate, endDate, withIssues } = req.query;
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    
    let runs;
    
    if (withIssues === 'true') {
      runs = await db.getRunsWithIssues(stationId);
    } else if (applianceId) {
      const simpleRuns = await db.getCheckRunsByAppliance(applianceId as string);
      runs = await Promise.all(simpleRuns.map(async run => ({
        ...run,
        results: await db.getResultsByRunId(run.id),
      })));
    } else if (startDate && endDate) {
      const simpleRuns = await db.getCheckRunsByDateRange(
        new Date(startDate as string),
        new Date(endDate as string),
        stationId
      );
      runs = await Promise.all(simpleRuns.map(async run => ({
        ...run,
        results: await db.getResultsByRunId(run.id),
      })));
    } else {
      runs = await db.getAllRunsWithResults(stationId);
    }
    
    res.json(runs);
  } catch (error) {
    logger.error('Error fetching check runs:', error);
    res.status(500).json({ error: 'Failed to fetch check runs' });
  }
});

/**
 * PUT /api/truck-checks/runs/:id/complete
 * Complete a check run
 */
router.put('/runs/:id/complete', validateCompleteCheckRun, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { additionalComments } = req.body;
    
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const checkRun = await db.completeCheckRun(req.params.id, additionalComments);
    if (!checkRun) {
      return res.status(404).json({ error: 'Check run not found' });
    }
    
    // Emit real-time update that check run completed - station-scoped
    if (checkRun.stationId) {
      io.to(`station-${checkRun.stationId}`).emit('truck-check-update', {
        type: 'check-completed',
        runId: checkRun.id,
        checkRun,
        timestamp: new Date()
      });
    }
    
    res.json(checkRun);
  } catch (error) {
    logger.error('Error completing check run:', error);
    res.status(500).json({ error: 'Failed to complete check run' });
  }
});

// ============================================
// Check Result Routes
// ============================================

/**
 * POST /api/truck-checks/results
 * Create a check result for an item (assigns station)
 */
router.post('/results', validateCreateCheckResult, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { runId, itemId, itemName, itemDescription, status, comment, photoUrl, completedBy, itemCode, section } = req.body;
    const stationId = getStationIdFromRequest(req);

    if (!runId || !itemId || !itemName || !itemDescription || !status) {
      return res.status(400).json({
        error: 'runId, itemId, itemName, itemDescription, and status are required'
      });
    }

    if (!['done', 'issue', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const result = await db.createCheckResult(
      runId,
      itemId,
      itemName,
      itemDescription,
      status as CheckStatus,
      comment,
      photoUrl,
      completedBy,
      stationId,
      itemCode,
      section
    );
    
    // Emit real-time update for collaborative checking - station-scoped
    if (stationId) {
      io.to(`station-${stationId}`).emit('truck-check-update', {
        type: 'result-created',
        runId,
        result,
        timestamp: new Date()
      });
    }
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating check result:', error);
    res.status(500).json({ error: 'Failed to create check result' });
  }
});

/**
 * PUT /api/truck-checks/results/:id
 * Update a check result
 */
router.put('/results/:id', validateUpdateCheckResult, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { status, comment, photoUrl } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['done', 'issue', 'skipped'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const result = await db.updateCheckResult(
      req.params.id,
      status as CheckStatus,
      comment,
      photoUrl
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Check result not found' });
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error updating check result:', error);
    res.status(500).json({ error: 'Failed to update check result' });
  }
});

/**
 * DELETE /api/truck-checks/results/:id
 * Delete a check result
 */
router.delete('/results/:id', validateCheckResultId, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const deleted = await db.deleteCheckResult(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Check result not found' });
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting check result:', error);
    res.status(500).json({ error: 'Failed to delete check result' });
  }
});

// ============================================
// Issue Follow-up Routes (TC-4)
// ============================================

const ISSUE_STATUSES = ['open', 'acknowledged', 'resolved'] as const;

/**
 * GET /api/truck-checks/issues
 * Flat, station-scoped feed of issue results for an equipment-officer follow-up
 * view, enriched with appliance/run context. Optional ?status= filter
 * (open|acknowledged|resolved); defaults to all open + acknowledged (outstanding).
 */
router.get('/issues', async (req: Request, res: Response) => {
  try {
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const stationId = getStationIdFromRequest(req);
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

    const runs = await db.getAllRunsWithResults(stationId);
    const issues = runs.flatMap((run) =>
      run.results
        .filter((r) => r.status === 'issue')
        .map((r) => ({
          ...r,
          applianceId: run.applianceId,
          applianceName: run.applianceName,
          runStartTime: run.startTime,
          issueStatus: r.issueStatus ?? 'open',
        })),
    );

    const filtered = statusFilter
      ? issues.filter((i) => i.issueStatus === statusFilter)
      : issues.filter((i) => i.issueStatus !== 'resolved'); // outstanding by default

    filtered.sort((a, b) => new Date(b.runStartTime).getTime() - new Date(a.runStartTime).getTime());
    res.json(filtered);
  } catch (error) {
    logger.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

/**
 * PATCH /api/truck-checks/results/:id/issue
 * Update an issue result's follow-up lifecycle (open → acknowledged → resolved),
 * optional assignee and note. Requires runId in the body (Table Storage locates
 * the result by run partition).
 */
router.patch('/results/:id/issue', async (req: Request, res: Response) => {
  try {
    const { issueStatus, issueNote, assignedTo, resolvedBy, runId } = req.body ?? {};
    if (issueStatus !== undefined && !ISSUE_STATUSES.includes(issueStatus)) {
      return res.status(400).json({ error: 'Invalid issueStatus' });
    }
    const db = await ensureTruckChecksDatabase(req.isDemoMode);
    const result = await db.updateIssueStatus(
      req.params.id,
      { issueStatus, issueNote, assignedTo, resolvedBy },
      typeof runId === 'string' ? runId : undefined,
    );
    if (!result) {
      return res.status(404).json({ error: 'Issue result not found (include runId in the body)' });
    }

    // Notify the room so an open follow-up view stays current.
    if (result.stationId) {
      io.to(`station-${result.stationId}`).emit('truck-check-update', {
        type: 'issue-updated',
        runId: result.runId,
        result,
        timestamp: new Date(),
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('Error updating issue status:', error);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

// ============================================
// Photo Upload Routes
// ============================================

/**
 * POST /api/truck-checks/upload/reference-photo
 * Upload a reference photo for a checklist template item
 */
router.post('/upload/reference-photo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!azureStorageService.isStorageEnabled()) {
      return res.status(503).json({ 
        error: 'Photo upload is not available. Azure Storage is not configured.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoUrl = await azureStorageService.uploadReferencePhoto(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(201).json({ photoUrl });
  } catch (error) {
    logger.error('Error uploading reference photo:', error);
    res.status(500).json({ error: 'Failed to upload reference photo' });
  }
});

/**
 * POST /api/truck-checks/upload/result-photo
 * Upload a result photo for a check result
 */
router.post('/upload/result-photo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!azureStorageService.isStorageEnabled()) {
      return res.status(503).json({ 
        error: 'Photo upload is not available. Azure Storage is not configured.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoUrl = await azureStorageService.uploadResultPhoto(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(201).json({ photoUrl });
  } catch (error) {
    logger.error('Error uploading result photo:', error);
    res.status(500).json({ error: 'Failed to upload result photo' });
  }
});

/**
 * GET /api/truck-checks/storage-status
 * Check if Azure Storage is configured and available
 */
router.get('/storage-status', (req: Request, res: Response) => {
  res.json({
    enabled: azureStorageService.isStorageEnabled(),
    message: azureStorageService.isStorageEnabled() 
      ? 'Photo upload is available' 
      : 'Photo upload is not available. Configure Azure Storage to enable this feature.'
  });
});

export default router;
