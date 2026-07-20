/**
 * Vehicle Types management — author the standard checklists that vehicles adopt.
 *
 * A vehicle type owns a locked "standard" checklist (immutable for brigades that
 * adopt it, so the same checks are comparable across brigades). Marking a type
 * "standard" publishes it for other organisations to adopt. Brigades add their
 * own custom items per-vehicle elsewhere; here we manage the standard core.
 */

import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { PageHeader } from '../../components/PageHeader';
import type { VehicleType, ChecklistItem } from '../../types';
import './VehicleTypesPage.css';

interface DraftItem {
  id: string;
  name: string;
  description: string;
}

export function VehicleTypesPage() {
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<VehicleType | null>(null);
  const [viewing, setViewing] = useState<VehicleType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [agency, setAgency] = useState('');
  const [description, setDescription] = useState('');
  const [isStandard, setIsStandard] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setTypes(await api.getVehicleTypes());
    } catch (err) {
      setError('Failed to load vehicle types');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setName('');
    setCategory('');
    setAgency('');
    setDescription('');
    setIsStandard(true);
    setItems([{ id: `d-${Date.now()}`, name: '', description: '' }]);
    setShowModal(true);
  }

  function openEdit(type: VehicleType) {
    setEditing(type);
    setName(type.name);
    setCategory(type.category || '');
    setAgency(type.agency || '');
    setDescription(type.description || '');
    setIsStandard(type.isStandard);
    setItems(type.standardItems.map((i) => ({ id: i.id || `d-${Math.random()}`, name: i.name, description: i.description })));
    setShowModal(true);
  }

  function openView(type: VehicleType) {
    setViewing(type);
    setShowViewModal(true);
  }

  function updateItem(index: number, field: 'name' | 'description', value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { id: `d-${Date.now()}`, name: '', description: '' }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveItem(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      alert('Type name is required');
      return;
    }
    const standardItems: ChecklistItem[] = items
      .filter((it) => it.name.trim())
      .map((it, idx) => ({ id: it.id.startsWith('d-') ? '' : it.id, name: it.name.trim(), description: it.description.trim(), order: idx }));

    try {
      setSaving(true);
      const payload = { name: name.trim(), category: category.trim() || undefined, agency: agency.trim() || undefined, description: description.trim() || undefined, isStandard, standardItems };
      if (editing) {
        await api.updateVehicleType(editing.id, payload);
      } else {
        await api.createVehicleType(payload);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save vehicle type');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: VehicleType) {
    if (!confirm(`Delete vehicle type "${type.name}"? Vehicles linked to it will fall back to their custom checklist only.`)) return;
    try {
      await api.deleteVehicleType(type.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete vehicle type');
      console.error(err);
    }
  }

  return (
    <div className="vehicle-types-page">
      <PageHeader
        title="Vehicle Types"
        subtitle="Standard checklists vehicles inherit — the locked, comparable core"
        backTo="/truckcheck/admin"
        backLabel="Admin"
      />

      <main className="truckcheck-main" id="main-content" tabIndex={-1}>
        <div className="vt-toolbar">
          <button className="btn-primary" onClick={openNew}>+ New Vehicle Type</button>
        </div>

        {loading ? (
          <div className="loading">Loading vehicle types…</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : types.length === 0 ? (
          <p className="muted">No vehicle types yet. Create one (e.g. “Cat 1 Tanker”) and add its standard checks.</p>
        ) : (
          <div className="vt-grid">
            {types.map((t) => {
              const isBuiltIn = !t.organizationId;
              return (
                <article key={t.id} className={`vt-card ${isBuiltIn ? 'vt-card--builtin' : ''}`}>
                  <div className="vt-card__body">
                    <h3>{t.name} {isBuiltIn && <span className="vt-badge vt-badge--builtin">Built-in</span>} {t.isStandard && !isBuiltIn && <span className="vt-badge">standard</span>}</h3>
                    {t.agency && <p className="vt-card__agency">{t.agency}</p>}
                    {t.category && <p className="vt-card__meta">{t.category}</p>}
                    <p className="vt-card__stat">{t.standardItems.length} standard check{t.standardItems.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="vt-card__actions">
                    <button className="btn-view" onClick={() => openView(t)} title="View template details and checks">👁️ View</button>
                    <button className="btn-edit" onClick={() => openEdit(t)} disabled={isBuiltIn} title={isBuiltIn ? 'Built-in templates cannot be edited' : ''}>✏️ Edit</button>
                    <button className="btn-delete" onClick={() => handleDelete(t)} disabled={isBuiltIn} title={isBuiltIn ? 'Built-in templates cannot be deleted' : ''}>🗑️ Delete</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {showViewModal && viewing && (
        <div
          className="modal-overlay"
          role="button"
          tabIndex={0}
          aria-label="Close template details"
          onClick={(e) => { if (e.target === e.currentTarget) setShowViewModal(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowViewModal(false); }}
        >
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="vt-view-modal-title">
            <h2 id="vt-view-modal-title">{viewing.name} {!viewing.organizationId && <span className="vt-badge vt-badge--builtin">Built-in</span>}</h2>

            <div className="form-group">
              <p><strong>Agency</strong></p>
              <p className="vt-view-text">{viewing.agency || '(not specified)'}</p>
            </div>

            <div className="form-group">
              <p><strong>Category</strong></p>
              <p className="vt-view-text">{viewing.category || '(not specified)'}</p>
            </div>

            <div className="form-group">
              <p><strong>Description</strong></p>
              <p className="vt-view-text">{viewing.description || '(not specified)'}</p>
            </div>

            <h3 className="vt-items-title">Standard Checks ({viewing.standardItems.length})</h3>
            {viewing.standardItems.length === 0 ? (
              <p className="muted">No standard checks defined.</p>
            ) : (
              <div className="vt-items">
                {viewing.standardItems.map((it, index) => (
                  <div key={it.id || index} className="vt-item vt-item--readonly">
                    <div className="vt-item__num">{index + 1}</div>
                    <div className="vt-item__fields">
                      <strong>{it.name}</strong>
                      {it.description && <p className="vt-item__desc">{it.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-overlay"
          role="button"
          tabIndex={0}
          aria-label="Close vehicle type dialog"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setShowModal(false); }}
          onKeyDown={(e) => { if ((e.key === 'Escape' || e.key === 'Enter') && !saving) setShowModal(false); }}
        >
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="vt-modal-title">
            <h2 id="vt-modal-title">{editing ? 'Edit Vehicle Type' : 'New Vehicle Type'}</h2>

            <div className="form-group">
              <label htmlFor="vt-name">Name *</label>
              <input id="vt-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Cat 1 Tanker" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="vt-category">Category</label>
                <input id="vt-category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., tanker" />
              </div>
              <div className="form-group">
                <label htmlFor="vt-agency">Agency</label>
                <input id="vt-agency" type="text" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g., NSW RFS" />
              </div>
            </div>
            <div className="form-group vt-checkbox">
              <label htmlFor="vt-standard">
                <input id="vt-standard" type="checkbox" checked={isStandard} onChange={(e) => setIsStandard(e.target.checked)} />
                {' '}Publish as a shared standard
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="vt-desc">Description</label>
              <textarea id="vt-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
            </div>

            <h3 className="vt-items-title">Standard checks (locked for adopting brigades)</h3>
            <div className="vt-items">
              {items.map((it, index) => (
                <div key={it.id} className="vt-item">
                  <div className="vt-item__num">{index + 1}</div>
                  <div className="vt-item__fields">
                    <input type="text" value={it.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Check name (e.g. Tyre condition)" />
                    <textarea value={it.description} onChange={(e) => updateItem(index, 'description', e.target.value)} rows={2} placeholder="Guidance for the inspector" />
                  </div>
                  <div className="vt-item__controls">
                    <button className="icon-btn" aria-label="Move up" onClick={() => moveItem(index, -1)}>↑</button>
                    <button className="icon-btn" aria-label="Move down" onClick={() => moveItem(index, 1)}>↓</button>
                    <button className="icon-btn icon-btn--danger" aria-label="Remove" onClick={() => removeItem(index)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-add-item" onClick={addItem}>+ Add check</button>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
