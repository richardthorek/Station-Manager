import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { api } from '../../services/api';
import type { Appliance, ChecklistTemplate, ChecklistItem } from '../../types';
import { ITEM_CODES, SECTIONS, resolveVocabSlug } from './checklistVocabulary';
import { ApplianceZonesModal } from './ApplianceZonesModal';
import { VehicleFormModal } from './VehicleFormModal';
import './VehicleManagement.css';

interface VehicleManagementProps {
  appliances: Appliance[];
  onUpdate: () => void;
}

export function VehicleManagement({ appliances, onUpdate }: VehicleManagementProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Appliance | null>(null);
  const [zonesModalVehicle, setZonesModalVehicle] = useState<Appliance | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  // Standard items from the linked VehicleType, shown read-only in the template editor.
  const [standardItemsForEditor, setStandardItemsForEditor] = useState<ChecklistItem[]>([]);

  const handleTemplateOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setShowTemplateEditor(false);
    }
  };

  const handleTemplateOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setShowTemplateEditor(false);
    }
  };

  function handleNewVehicle() {
    setSelectedVehicle(null);
    setIsEditMode(false);
    setShowVehicleModal(true);
  }

  function handleEditVehicle(vehicle: Appliance) {
    setSelectedVehicle(vehicle);
    setIsEditMode(true);
    setShowVehicleModal(true);
  }

  async function handleEditTemplate(vehicle: Appliance) {
    try {
      const [templateData, effectiveChecklist] = await Promise.all([
        api.getTemplate(vehicle.id),
        vehicle.vehicleTypeId ? api.getEffectiveChecklist(vehicle.id) : Promise.resolve(null),
      ]);
      // If no custom template exists yet (404 → null), start with an empty item list so the
      // editor opens and the user can add custom items. Standard items still show read-only.
      const resolvedTemplate: ChecklistTemplate = templateData ?? {
        id: '',
        applianceId: vehicle.id,
        applianceName: vehicle.name,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplate(resolvedTemplate);
      setStandardItemsForEditor(
        effectiveChecklist ? effectiveChecklist.items.filter((i) => i.isStandard) : [],
      );
      setSelectedVehicle(vehicle);
      setShowTemplateEditor(true);
    } catch (err) {
      alert('Failed to load template');
      console.error(err);
    }
  }

  async function handleDeleteVehicle(vehicle: Appliance) {
    if (!confirm(`Are you sure you want to delete ${vehicle.name}? This will also delete its checklist template.`)) {
      return;
    }

    try {
      await api.deleteAppliance(vehicle.id);
      onUpdate();
    } catch (err) {
      alert('Failed to delete vehicle');
      console.error(err);
    }
  }

  async function handleSaveTemplate() {
    if (!template) return;

    try {
      const items = template.items.map((item, index) => ({
        name: item.name,
        description: item.description,
        referencePhotoUrl: item.referencePhotoUrl,
        order: index,
        itemCode: resolveVocabSlug(item.itemCode || '', ITEM_CODES),
        section: item.section?.trim() || undefined,
      }));

      await api.updateTemplate(template.applianceId, items);
      setShowTemplateEditor(false);
      alert('Template saved successfully');
    } catch (err) {
      alert('Failed to save template');
      console.error(err);
    }
  }

  function handleAddTemplateItem() {
    if (!template) return;
    
    setTemplate({
      ...template,
      items: [
        ...template.items,
        {
          id: `temp-${Date.now()}`,
          name: '',
          description: '',
          order: template.items.length,
        },
      ],
    });
  }

  function handleUpdateTemplateItem(index: number, field: keyof ChecklistItem, value: string) {
    if (!template) return;

    const updatedItems = [...template.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setTemplate({ ...template, items: updatedItems });
  }

  function handleRemoveTemplateItem(index: number) {
    if (!template) return;

    const updatedItems = template.items.filter((_, i) => i !== index);
    setTemplate({ ...template, items: updatedItems });
  }

  async function handleUploadItemPhoto(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !template) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      const response = await api.uploadReferencePhoto(file);
      handleUpdateTemplateItem(index, 'referencePhotoUrl' as keyof ChecklistItem, response.photoUrl);
    } catch (err) {
      alert('Failed to upload photo');
      console.error(err);
    }
  }

  return (
    <div className="vehicle-management">
      <div className="management-header">
        <h2>Vehicle Management</h2>
        <button className="btn-primary" onClick={handleNewVehicle}>
          + Add New Vehicle
        </button>
      </div>

      <div className="vehicles-grid">
        {appliances.map((vehicle) => (
          <div key={vehicle.id} className="vehicle-card">
            {vehicle.photoUrl ? (
              <img src={vehicle.photoUrl} alt={vehicle.name} className="vehicle-photo" />
            ) : (
              <div className="vehicle-placeholder">🚒</div>
            )}
            <div className="vehicle-info">
              <h3>{vehicle.name}</h3>
              {vehicle.description && <p>{vehicle.description}</p>}
              {(vehicle.make || vehicle.model || vehicle.year || vehicle.registration || vehicle.agencyId) && (
                <p className="vehicle-identity">
                  {[
                    vehicle.agencyId,
                    [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' '),
                    vehicle.registration,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="vehicle-actions">
              <button className="btn-edit" onClick={() => handleEditVehicle(vehicle)}>
                ✏️ Edit
              </button>
              <button className="btn-template" onClick={() => handleEditTemplate(vehicle)}>
                📋 Template
              </button>
              <button className="btn-zones" onClick={() => setZonesModalVehicle(vehicle)}>
                🗺️ Zones
              </button>
              <button className="btn-delete" onClick={() => handleDeleteVehicle(vehicle)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <VehicleFormModal
          vehicle={isEditMode ? selectedVehicle : null}
          onClose={() => setShowVehicleModal(false)}
          onSaved={onUpdate}
        />
      )}

      {/* Zones & Equipment Modal */}
      {zonesModalVehicle && (
        <ApplianceZonesModal
          appliance={zonesModalVehicle}
          onClose={() => setZonesModalVehicle(null)}
        />
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && template && (
        <div
          className="modal-overlay"
          onClick={handleTemplateOverlayClick}
          onKeyDown={handleTemplateOverlayKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Close template editor"
        >
          <div className="modal-content template-editor">
            <h2>Edit Checklist: {template.applianceName}</h2>
            <p className="template-editor-hint">
              Tag items with a standard code so the same check trends across brigades,
              and group them into sections to match how you walk around the vehicle.
            </p>

            {standardItemsForEditor.length > 0 && (
              <div className="template-standard-items">
                <h3 className="template-section-title">
                  🔒 Standard items <span className="template-locked-note">(inherited from vehicle type — not editable here)</span>
                </h3>
                {standardItemsForEditor.map((item, idx) => (
                  <div key={item.id} className="template-item template-item--locked">
                    <div className="item-number">{idx + 1}</div>
                    <div className="item-fields">
                      <p className="template-item-name">{item.name}</p>
                      {item.description && <p className="template-item-desc">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {standardItemsForEditor.length > 0 && (
              <h3 className="template-section-title template-section-title--custom">
                ✏️ Custom items <span className="template-locked-note">(add, edit or remove)</span>
              </h3>
            )}

            <datalist id="template-item-code-options">
              {ITEM_CODES.map((ic) => (
                <option key={ic.value} value={ic.value}>{ic.label}</option>
              ))}
            </datalist>
            <datalist id="template-section-options">
              {SECTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            <div className="template-items">
              {template.items.map((item, index) => (
                <div key={item.id} className="template-item">
                  <div className="item-number">{index + 1}</div>
                  <div className="item-fields">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateTemplateItem(index, 'name', e.target.value)}
                      placeholder="Item name"
                      className="item-name"
                    />
                    <textarea
                      value={item.description}
                      onChange={(e) => handleUpdateTemplateItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="item-description"
                      rows={2}
                    />
                    <div className="item-taxonomy">
                      <input
                        type="text"
                        list="template-item-code-options"
                        value={item.itemCode || ''}
                        onChange={(e) => handleUpdateTemplateItem(index, 'itemCode', e.target.value)}
                        placeholder="Standard item (for cross-brigade trends)"
                        className="item-code"
                        aria-label="Standard item code"
                      />
                      <input
                        type="text"
                        list="template-section-options"
                        value={item.section || ''}
                        onChange={(e) => handleUpdateTemplateItem(index, 'section', e.target.value)}
                        placeholder="Section (e.g. Engine Bay)"
                        className="item-section"
                        aria-label="Section"
                      />
                    </div>
                    <div className="item-photo-upload">
                      {item.referencePhotoUrl && (
                        <img src={item.referencePhotoUrl} alt="Reference" className="item-photo-preview" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUploadItemPhoto(index, e)}
                      />
                    </div>
                  </div>
                  <button className="btn-remove" onClick={() => handleRemoveTemplateItem(index)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button className="btn-add-item" onClick={handleAddTemplateItem}>
              + Add Item
            </button>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowTemplateEditor(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
