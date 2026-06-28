import { useState, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { api, ApiLimitError } from '../../services/api';
import type { Appliance, ChecklistTemplate, ChecklistItem, VehicleType } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ITEM_CODES, SECTIONS, resolveVocabSlug } from './checklistVocabulary';
import { ApplianceZonesModal } from './ApplianceZonesModal';
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
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [registration, setRegistration] = useState('');
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [vehicleModalError, setVehicleModalError] = useState<string | null>(null);
  const [vehicleModalUpgrade, setVehicleModalUpgrade] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  // Standard items from the linked VehicleType, shown read-only in the template editor.
  const [standardItemsForEditor, setStandardItemsForEditor] = useState<ChecklistItem[]>([]);
  const modalRef = useFocusTrap<HTMLDivElement>(showVehicleModal);
  const modalIdSuffix = selectedVehicle?.id ?? 'new';

  // Load the vehicle types this org can use (its own + shared standards) so a
  // vehicle can be linked to a standard checklist.
  useEffect(() => {
    api.getVehicleTypes().then(setVehicleTypes).catch(() => setVehicleTypes([]));
  }, []);

  const handleVehicleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setShowVehicleModal(false);
    }
  };

  const handleVehicleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setShowVehicleModal(false);
    }
  };

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

  /**
   * Handle Escape key to close modal
   */
  useEffect(() => {
    if (!showVehicleModal) return;

    const handleEscape = (event: Event) => {
      if ((event as globalThis.KeyboardEvent).key === 'Escape' && !uploading) {
        setShowVehicleModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showVehicleModal, uploading]);

  function resetVehicleForm() {
    setVehicleName('');
    setVehicleDescription('');
    setVehicleTypeId('');
    setAgencyId('');
    setRegistration('');
    setVin('');
    setMake('');
    setModel('');
    setYear('');
    setVehiclePhotoUrl('');
    setPhotoFile(null);
  }

  function handleNewVehicle() {
    setSelectedVehicle(null);
    resetVehicleForm();
    setVehicleModalError(null);
    setVehicleModalUpgrade(false);
    setIsEditMode(false);
    setShowVehicleModal(true);
  }

  function handleEditVehicle(vehicle: Appliance) {
    setSelectedVehicle(vehicle);
    setVehicleName(vehicle.name);
    setVehicleDescription(vehicle.description || '');
    setVehicleTypeId(vehicle.vehicleTypeId || '');
    setAgencyId(vehicle.agencyId || '');
    setRegistration(vehicle.registration || '');
    setVin(vehicle.vin || '');
    setMake(vehicle.make || '');
    setModel(vehicle.model || '');
    setYear(vehicle.year ? String(vehicle.year) : '');
    setVehiclePhotoUrl(vehicle.photoUrl || '');
    setPhotoFile(null);
    setVehicleModalError(null);
    setVehicleModalUpgrade(false);
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

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be smaller than 10MB');
      return;
    }

    setPhotoFile(file);
  }

  async function handleSaveVehicle() {
    if (!vehicleName.trim()) {
      setVehicleModalError('Vehicle name is required');
      return;
    }

    setVehicleModalError(null);
    try {
      setUploading(true);
      
      let photoUrl = vehiclePhotoUrl;
      if (photoFile) {
        const uploadResponse = await api.uploadAppliancePhoto(photoFile);
        photoUrl = uploadResponse.photoUrl;
      }

      // Keep the legacy vehicleType slug in step with the chosen type's code so
      // existing report grouping keeps working alongside the new vehicleTypeId link.
      const chosenType = vehicleTypes.find((t) => t.id === vehicleTypeId);
      const legacySlug = chosenType?.code || undefined;
      const details = {
        vehicleTypeId: vehicleTypeId || undefined,
        agencyId: agencyId.trim() || undefined,
        registration: registration.trim() || undefined,
        vin: vin.trim() || undefined,
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        year: year.trim() ? Number(year) : undefined,
      };

      if (isEditMode && selectedVehicle) {
        await api.updateAppliance(selectedVehicle.id, vehicleName, vehicleDescription || undefined, photoUrl || undefined, legacySlug, details);
      } else {
        await api.createAppliance(vehicleName, vehicleDescription || undefined, photoUrl || undefined, legacySlug, details);
      }

      setShowVehicleModal(false);
      onUpdate();
    } catch (err) {
      const fallback = `Failed to ${isEditMode ? 'update' : 'create'} vehicle`;
      if (err instanceof ApiLimitError) {
        setVehicleModalError(err.message);
        setVehicleModalUpgrade(true);
      } else {
        setVehicleModalError(err instanceof Error && err.message ? err.message : fallback);
        setVehicleModalUpgrade(false);
      }
    } finally {
      setUploading(false);
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
        <div
          className="modal-overlay"
          onClick={handleVehicleOverlayClick}
          onKeyDown={handleVehicleOverlayKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Close vehicle modal"
        >
          <div 
            ref={modalRef}
            className="modal-content" 
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-modal-title"
          >
            <h2 id="vehicle-modal-title">{isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
            
            <div className="form-group">
              <label htmlFor={`vehicle-name-${modalIdSuffix}`}>Name *</label>
              <input
                id={`vehicle-name-${modalIdSuffix}`}
                type="text"
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="e.g., Tanker 1"
              />
            </div>

            <div className="form-group">
              <label htmlFor={`vehicle-description-${modalIdSuffix}`}>Description</label>
              <textarea
                id={`vehicle-description-${modalIdSuffix}`}
                value={vehicleDescription}
                onChange={(e) => setVehicleDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor={`vehicle-type-${modalIdSuffix}`}>Vehicle Type</label>
              <select
                id={`vehicle-type-${modalIdSuffix}`}
                value={vehicleTypeId}
                onChange={(e) => setVehicleTypeId(e.target.value)}
              >
                <option value="">— No standard type (custom checklist only) —</option>
                {vehicleTypes.map((vt) => (
                  <option key={vt.id} value={vt.id}>
                    {vt.name}{vt.isStandard ? ' (standard)' : ''}
                  </option>
                ))}
              </select>
              <small>
                Link to a standard type so this vehicle inherits its locked checklist and
                its checks can be compared with the same type at other brigades. Manage
                types under “Vehicle Types”.
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`vehicle-agency-${modalIdSuffix}`}>Fleet / agency no.</label>
                <input
                  id={`vehicle-agency-${modalIdSuffix}`}
                  type="text"
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value)}
                  placeholder="e.g., RFS fleet number"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`vehicle-rego-${modalIdSuffix}`}>Registration</label>
                <input
                  id={`vehicle-rego-${modalIdSuffix}`}
                  type="text"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value)}
                  placeholder="Number plate"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`vehicle-make-${modalIdSuffix}`}>Make</label>
                <input id={`vehicle-make-${modalIdSuffix}`} type="text" value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g., Isuzu" />
              </div>
              <div className="form-group">
                <label htmlFor={`vehicle-model-${modalIdSuffix}`}>Model</label>
                <input id={`vehicle-model-${modalIdSuffix}`} type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g., FTS 800" />
              </div>
              <div className="form-group">
                <label htmlFor={`vehicle-year-${modalIdSuffix}`}>Year</label>
                <input id={`vehicle-year-${modalIdSuffix}`} type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g., 2019" min={1950} max={2100} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor={`vehicle-vin-${modalIdSuffix}`}>VIN</label>
              <input id={`vehicle-vin-${modalIdSuffix}`} type="text" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="Vehicle Identification Number (optional)" />
            </div>

            <div className="form-group">
              <label htmlFor={`vehicle-photo-${modalIdSuffix}`}>Vehicle Photo</label>
              {(vehiclePhotoUrl || photoFile) && (
                <div className="photo-preview">
                  {photoFile ? (
                    <img src={URL.createObjectURL(photoFile)} alt="Preview" />
                  ) : vehiclePhotoUrl ? (
                    <img src={vehiclePhotoUrl} alt="Current" />
                  ) : null}
                </div>
              )}
              <input
                id={`vehicle-photo-${modalIdSuffix}`}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
              <small>Optional: Upload a photo to display instead of the default icon</small>
            </div>

            {vehicleModalError && (
              <p className="vehicle-modal-error" role="alert">
                {vehicleModalError}
                {vehicleModalUpgrade && (
                  <> <a href="/admin/organization" className="vehicle-modal-upgrade-link">Upgrade plan →</a></>
                )}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowVehicleModal(false)}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveVehicle}
                disabled={uploading}
              >
                {uploading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
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
