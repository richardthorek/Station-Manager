/**
 * A1 inc 6 — Admin authoring UI for per-truck zones and equipment.
 *
 * Two-tab modal:
 *  "Walk-around Zones"  — ordered spatial areas; seed from vehicle type, add, edit, delete.
 *  "Equipment"          — per-truck inventory; add, edit, retire, restore.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import type { Appliance, ApplianceZone, ApplianceEquipment, ApplianceZoneSide } from '../../types';
import './ApplianceZonesModal.css';

interface Props {
  appliance: Appliance;
  onClose: () => void;
}

type Tab = 'zones' | 'equipment';

const SIDES: { value: ApplianceZoneSide; label: string }[] = [
  { value: 'driver',    label: 'Driver side' },
  { value: 'passenger', label: 'Passenger side' },
  { value: 'front',     label: 'Front' },
  { value: 'rear',      label: 'Rear' },
  { value: 'top',       label: 'Top / Roof' },
  { value: 'interior',  label: 'Interior / Cab' },
  { value: 'na',        label: 'N/A' },
];

function sideLabelFor(side?: ApplianceZoneSide): string {
  return SIDES.find((s) => s.value === side)?.label ?? '';
}

// ─── Zones tab ───────────────────────────────────────────────────────────────

interface ZoneFormState {
  name: string;
  side: ApplianceZoneSide | '';
  description: string;
}

const EMPTY_ZONE_FORM: ZoneFormState = { name: '', side: '', description: '' };

interface ZonesTabProps {
  appliance: Appliance;
  zones: ApplianceZone[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function ZonesTab({ appliance, zones, loading, error, onRefresh }: ZonesTabProps) {
  const [addForm, setAddForm] = useState<ZoneFormState>(EMPTY_ZONE_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ZoneFormState>(EMPTY_ZONE_FORM);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  async function handleSeed(replace: boolean) {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const result = await api.seedZones(appliance.id, replace);
      setSeedMsg(
        result.seeded > 0
          ? `Seeded ${result.seeded} zone${result.seeded !== 1 ? 's' : ''}.`
          : (result.message ?? 'No zones seeded.'),
      );
      onRefresh();
    } catch {
      setSeedMsg('Seed failed — check that this vehicle has a vehicle type assigned.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setAddError('Name is required'); return; }
    setAddError(null);
    try {
      await api.createZone(appliance.id, {
        name: addForm.name.trim(),
        side: addForm.side || undefined,
        description: addForm.description.trim() || undefined,
      });
      setAddForm(EMPTY_ZONE_FORM);
      onRefresh();
    } catch {
      setAddError('Failed to create zone');
    }
  }

  function startEdit(z: ApplianceZone) {
    setEditingId(z.id);
    setEditForm({ name: z.name, side: z.side ?? '', description: z.description ?? '' });
  }

  async function handleSaveEdit(id: string) {
    try {
      await api.updateZone(id, {
        name: editForm.name.trim() || undefined,
        side: editForm.side || undefined,
        description: editForm.description.trim() || undefined,
      });
      setEditingId(null);
      onRefresh();
    } catch {
      // keep edit open on error
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete zone "${name}"?`)) return;
    try {
      await api.deleteZone(id);
      onRefresh();
    } catch {
      alert('Failed to delete zone');
    }
  }

  const hasType = Boolean(appliance.vehicleTypeId);

  return (
    <div className="azm-zones-tab">
      {/* Seed controls */}
      <div className="azm-seed-bar">
        <button
          type="button"
          className="azm-btn azm-btn--secondary"
          onClick={() => handleSeed(false)}
          disabled={seeding || !hasType}
          title={hasType ? 'Seed default zones from this vehicle\'s type (skip if zones already exist)' : 'Assign a vehicle type to this vehicle first'}
        >
          {seeding ? 'Seeding…' : '⟳ Seed from vehicle type'}
        </button>
        {zones.length > 0 && hasType && (
          <button
            type="button"
            className="azm-btn azm-btn--danger-ghost"
            onClick={() => {
              if (confirm('Replace all current zones with the vehicle type defaults?')) handleSeed(true);
            }}
            disabled={seeding}
          >
            Replace &amp; re-seed
          </button>
        )}
        {seedMsg && <span className="azm-seed-msg" role="status">{seedMsg}</span>}
        {!hasType && <span className="azm-seed-hint">Assign a vehicle type on the vehicle to enable seeding.</span>}
      </div>

      {/* Zone list */}
      {loading && <p className="azm-loading">Loading zones…</p>}
      {error && <p className="azm-error" role="alert">{error}</p>}

      {!loading && !error && zones.length === 0 && (
        <p className="azm-empty">No zones yet. Seed from the vehicle type above, or add them manually below.</p>
      )}

      {zones.length > 0 && (
        <ol className="azm-zone-list" aria-label="Walk-around zones">
          {zones.map((z) => (
            <li key={z.id} className={`azm-zone-row${editingId === z.id ? ' azm-zone-row--editing' : ''}`}>
              {editingId === z.id ? (
                <div className="azm-zone-edit">
                  <input
                    className="azm-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Zone name"
                    aria-label="Zone name"
                  />
                  <select
                    className="azm-select"
                    value={editForm.side}
                    onChange={(e) => setEditForm({ ...editForm, side: e.target.value as ApplianceZoneSide | '' })}
                    aria-label="Side"
                  >
                    <option value="">— Side —</option>
                    {SIDES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <input
                    className="azm-input"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description (optional)"
                    aria-label="Description"
                  />
                  <div className="azm-row-actions">
                    <button type="button" className="azm-btn azm-btn--primary" onClick={() => handleSaveEdit(z.id)}>Save</button>
                    <button type="button" className="azm-btn azm-btn--secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="azm-zone-view">
                  <span className="azm-order-badge">{z.order}</span>
                  <div className="azm-zone-info">
                    <span className="azm-zone-name">{z.name}</span>
                    {z.zoneCode && <span className="azm-chip azm-chip--code">{z.zoneCode}</span>}
                    {z.side && <span className="azm-chip azm-chip--side">{sideLabelFor(z.side)}</span>}
                    {z.description && <span className="azm-zone-desc">{z.description}</span>}
                  </div>
                  <div className="azm-row-actions">
                    <button type="button" className="azm-btn azm-btn--icon" onClick={() => startEdit(z)} aria-label={`Edit ${z.name}`}>✏️</button>
                    <button type="button" className="azm-btn azm-btn--icon azm-btn--danger" onClick={() => handleDelete(z.id, z.name)} aria-label={`Delete ${z.name}`}>🗑️</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Add zone form */}
      <div className="azm-add-form" aria-label="Add zone">
        <h4 className="azm-add-title">Add zone</h4>
        <div className="azm-add-row">
          <input
            className="azm-input azm-input--grow"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            placeholder="Zone name *"
            aria-label="New zone name"
          />
          <select
            className="azm-select"
            value={addForm.side}
            onChange={(e) => setAddForm({ ...addForm, side: e.target.value as ApplianceZoneSide | '' })}
            aria-label="Side"
          >
            <option value="">— Side —</option>
            {SIDES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            className="azm-input azm-input--grow"
            value={addForm.description}
            onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            placeholder="Description (optional)"
            aria-label="New zone description"
          />
          <button type="button" className="azm-btn azm-btn--primary" onClick={handleAdd}>Add</button>
        </div>
        {addError && <p className="azm-error" role="alert">{addError}</p>}
      </div>
    </div>
  );
}

// ─── Equipment tab ────────────────────────────────────────────────────────────

interface EquipFormState {
  name: string;
  zoneId: string;
  serialNumber: string;
  notes: string;
}

const EMPTY_EQUIP_FORM: EquipFormState = { name: '', zoneId: '', serialNumber: '', notes: '' };

interface EquipTabProps {
  appliance: Appliance;
  zones: ApplianceZone[];
  equipment: ApplianceEquipment[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function EquipTab({ appliance, zones, equipment, loading, error, onRefresh }: EquipTabProps) {
  const [showRetired, setShowRetired] = useState(false);
  const [addForm, setAddForm] = useState<EquipFormState>(EMPTY_EQUIP_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EquipFormState>(EMPTY_EQUIP_FORM);

  const active = equipment.filter((e) => e.active);
  const retired = equipment.filter((e) => !e.active);
  const visible = showRetired ? equipment : active;

  function zoneNameFor(zoneId?: string) {
    return zones.find((z) => z.id === zoneId)?.name ?? '';
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setAddError('Name is required'); return; }
    setAddError(null);
    try {
      await api.createEquipment(appliance.id, {
        name: addForm.name.trim(),
        zoneId: addForm.zoneId || undefined,
        serialNumber: addForm.serialNumber.trim() || undefined,
        notes: addForm.notes.trim() || undefined,
      });
      setAddForm(EMPTY_EQUIP_FORM);
      onRefresh();
    } catch {
      setAddError('Failed to add equipment');
    }
  }

  function startEdit(eq: ApplianceEquipment) {
    setEditingId(eq.id);
    setEditForm({
      name: eq.name,
      zoneId: eq.zoneId ?? '',
      serialNumber: eq.serialNumber ?? '',
      notes: eq.notes ?? '',
    });
  }

  async function handleSaveEdit(id: string) {
    try {
      await api.updateEquipment(id, {
        name: editForm.name.trim() || undefined,
        zoneId: editForm.zoneId || undefined,
        serialNumber: editForm.serialNumber.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setEditingId(null);
      onRefresh();
    } catch {
      // keep edit open
    }
  }

  async function toggleActive(eq: ApplianceEquipment) {
    const verb = eq.active ? 'retire' : 'restore';
    if (!confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} "${eq.name}"?`)) return;
    try {
      await api.updateEquipment(eq.id, { active: !eq.active });
      onRefresh();
    } catch {
      alert(`Failed to ${verb} equipment`);
    }
  }

  async function handleDelete(eq: ApplianceEquipment) {
    if (!confirm(`Permanently delete "${eq.name}"?`)) return;
    try {
      await api.deleteEquipment(eq.id);
      onRefresh();
    } catch {
      alert('Failed to delete equipment');
    }
  }

  return (
    <div className="azm-equip-tab">
      {/* Retired toggle */}
      {retired.length > 0 && (
        <div className="azm-retired-toggle">
          <label className="azm-toggle-label">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
            />
            {' '}Show retired ({retired.length})
          </label>
        </div>
      )}

      {loading && <p className="azm-loading">Loading equipment…</p>}
      {error && <p className="azm-error" role="alert">{error}</p>}

      {!loading && !error && active.length === 0 && (
        <p className="azm-empty">No equipment yet. Add items below to build the inventory for this appliance.</p>
      )}

      {visible.length > 0 && (
        <ul className="azm-equip-list" aria-label="Equipment">
          {visible.map((eq) => (
            <li key={eq.id} className={`azm-equip-row${!eq.active ? ' azm-equip-row--retired' : ''}${editingId === eq.id ? ' azm-equip-row--editing' : ''}`}>
              {editingId === eq.id ? (
                <div className="azm-equip-edit">
                  <input
                    className="azm-input azm-input--grow"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Equipment name"
                    aria-label="Equipment name"
                  />
                  <select
                    className="azm-select"
                    value={editForm.zoneId}
                    onChange={(e) => setEditForm({ ...editForm, zoneId: e.target.value })}
                    aria-label="Zone location"
                  >
                    <option value="">— No zone —</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                  <input
                    className="azm-input"
                    value={editForm.serialNumber}
                    onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                    placeholder="Serial / asset no."
                    aria-label="Serial number"
                  />
                  <input
                    className="azm-input azm-input--grow"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Notes"
                    aria-label="Notes"
                  />
                  <div className="azm-row-actions">
                    <button type="button" className="azm-btn azm-btn--primary" onClick={() => handleSaveEdit(eq.id)}>Save</button>
                    <button type="button" className="azm-btn azm-btn--secondary" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="azm-equip-view">
                  <div className="azm-equip-info">
                    <span className={`azm-equip-name${!eq.active ? ' azm-equip-name--retired' : ''}`}>{eq.name}</span>
                    {eq.equipmentCode && <span className="azm-chip azm-chip--code">{eq.equipmentCode}</span>}
                    {eq.zoneId && <span className="azm-chip azm-chip--zone">📍 {zoneNameFor(eq.zoneId)}</span>}
                    {!eq.active && <span className="azm-chip azm-chip--retired">Retired</span>}
                    {eq.serialNumber && <span className="azm-equip-serial">#{eq.serialNumber}</span>}
                    {eq.notes && <span className="azm-equip-notes">{eq.notes}</span>}
                  </div>
                  <div className="azm-row-actions">
                    <button type="button" className="azm-btn azm-btn--icon" onClick={() => startEdit(eq)} aria-label={`Edit ${eq.name}`}>✏️</button>
                    <button
                      type="button"
                      className={`azm-btn azm-btn--icon${eq.active ? ' azm-btn--warn' : ' azm-btn--restore'}`}
                      onClick={() => toggleActive(eq)}
                      aria-label={eq.active ? `Retire ${eq.name}` : `Restore ${eq.name}`}
                      title={eq.active ? 'Retire (keeps history)' : 'Restore'}
                    >
                      {eq.active ? '📦' : '↩️'}
                    </button>
                    <button type="button" className="azm-btn azm-btn--icon azm-btn--danger" onClick={() => handleDelete(eq)} aria-label={`Delete ${eq.name}`}>🗑️</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add equipment form */}
      <div className="azm-add-form" aria-label="Add equipment">
        <h4 className="azm-add-title">Add equipment</h4>
        <div className="azm-add-row">
          <input
            className="azm-input azm-input--grow"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            placeholder="Equipment name *"
            aria-label="New equipment name"
          />
          <select
            className="azm-select"
            value={addForm.zoneId}
            onChange={(e) => setAddForm({ ...addForm, zoneId: e.target.value })}
            aria-label="Zone location"
          >
            <option value="">— Zone (optional) —</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <input
            className="azm-input"
            value={addForm.serialNumber}
            onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
            placeholder="Serial / asset no."
            aria-label="Serial number"
          />
          <button type="button" className="azm-btn azm-btn--primary" onClick={handleAdd}>Add</button>
        </div>
        {addError && <p className="azm-error" role="alert">{addError}</p>}
      </div>
    </div>
  );
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

export function ApplianceZonesModal({ appliance, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('zones');
  const [zones, setZones] = useState<ApplianceZone[]>([]);
  const [equipment, setEquipment] = useState<ApplianceEquipment[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [equipLoading, setEquipLoading] = useState(true);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [equipError, setEquipError] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    setZonesLoading(true);
    setZonesError(null);
    try {
      setZones(await api.getZones(appliance.id));
    } catch {
      setZonesError('Failed to load zones');
    } finally {
      setZonesLoading(false);
    }
  }, [appliance.id]);

  const loadEquipment = useCallback(async () => {
    setEquipLoading(true);
    setEquipError(null);
    try {
      setEquipment(await api.getEquipment(appliance.id, true));
    } catch {
      setEquipError('Failed to load equipment');
    } finally {
      setEquipLoading(false);
    }
  }, [appliance.id]);

  useEffect(() => { void loadZones(); }, [loadZones]);
  useEffect(() => { void loadEquipment(); }, [loadEquipment]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="azm-overlay"
      role="button"
      tabIndex={0}
      aria-label="Close zones and equipment panel"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Escape' || e.key === 'Enter')) onClose(); }}
    >
      <div
        className="azm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="azm-title"
      >
        <div className="azm-header">
          <h2 id="azm-title" className="azm-title">
            Zones &amp; Equipment — <span className="azm-vehicle-name">{appliance.name}</span>
          </h2>
          <button type="button" className="azm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="azm-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'zones'}
            className={`azm-tab${tab === 'zones' ? ' azm-tab--active' : ''}`}
            onClick={() => setTab('zones')}
          >
            Walk-around Zones ({zones.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === 'equipment'}
            className={`azm-tab${tab === 'equipment' ? ' azm-tab--active' : ''}`}
            onClick={() => setTab('equipment')}
          >
            Equipment ({equipment.filter((e) => e.active).length})
          </button>
        </div>

        <div className="azm-body" role="tabpanel">
          {tab === 'zones' && (
            <ZonesTab
              appliance={appliance}
              zones={zones}
              loading={zonesLoading}
              error={zonesError}
              onRefresh={loadZones}
            />
          )}
          {tab === 'equipment' && (
            <EquipTab
              appliance={appliance}
              zones={zones}
              equipment={equipment}
              loading={equipLoading}
              error={equipError}
              onRefresh={loadEquipment}
            />
          )}
        </div>
      </div>
    </div>
  );
}
