import { useState } from 'react';
import { api } from '../../services/api';
import type { Appliance, ChecklistTemplate, ChecklistItem } from '../../types';
import './VehicleManagement.css';

interface VehicleManagementProps {
  appliances: Appliance[];
  onUpdate: () => void;
}

export function VehicleManagement({ appliances, onUpdate }: VehicleManagementProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<Appliance | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  function handleNewVehicle() {
    setSelectedVehicle(null);
    setVehicleName('');
    setVehicleDescription('');
    setVehiclePhotoUrl('');
    setPhotoFile(null);
    setIsEditMode(false);
    setShowVehicleModal(true);
  }

  function handleEditVehicle(vehicle: Appliance) {
    setSelectedVehicle(vehicle);
    setVehicleName(vehicle.name);
    setVehicleDescription(vehicle.description || '');
    setVehiclePhotoUrl(vehicle.photoUrl || '');
    setPhotoFile(null);
    setIsEditMode(true);
    setShowVehicleModal(true);
  }

  async function handleEditTemplate(vehicle: Appliance) {
    try {
      const templateData = await api.getTemplate(vehicle.id);
      setTemplate(templateData);
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
      alert('Vehicle name is required');
      return;
    }

    try {
      setUploading(true);
      
      let photoUrl = vehiclePhotoUrl;
      if (photoFile) {
        const uploadResponse = await api.uploadAppliancePhoto(photoFile);
        photoUrl = uploadResponse.photoUrl;
      }

      if (isEditMode && selectedVehicle) {
        await api.updateAppliance(selectedVehicle.id, vehicleName, vehicleDescription || undefined, photoUrl || undefined);
      } else {
        await api.createAppliance(vehicleName, vehicleDescription || undefined, photoUrl || undefined);
      }

      setShowVehicleModal(false);
      onUpdate();
    } catch (err) {
      alert(`Failed to ${isEditMode ? 'update' : 'create'} vehicle`);
      console.error(err);
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
            </div>
            <div className="vehicle-actions">
              <button className="btn-edit" onClick={() => handleEditVehicle(vehicle)}>
                ✏️ Edit
              </button>
              <button className="btn-template" onClick={() => handleEditTemplate(vehicle)}>
                📋 Template
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
        <div className="modal-overlay" onClick={() => setShowVehicleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
            
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="e.g., Tanker 1"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={vehicleDescription}
                onChange={(e) => setVehicleDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Vehicle Photo</label>
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
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
              <small>Optional: Upload a photo to display instead of the default icon</small>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowVehicleModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveVehicle} disabled={uploading}>
                {uploading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {showTemplateEditor && template && (
        <div className="modal-overlay" onClick={() => setShowTemplateEditor(false)}>
          <div className="modal-content template-editor" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Checklist Template: {template.applianceName}</h2>
            
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
