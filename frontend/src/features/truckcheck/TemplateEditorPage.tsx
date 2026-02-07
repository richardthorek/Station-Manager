import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { ChecklistTemplate, ChecklistItem } from '../../types';
import './TemplateEditor.css';

export function TemplateEditorPage() {
  const { applianceId } = useParams<{ applianceId: string }>();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<(Omit<ChecklistItem, 'id'> & { id?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [storageEnabled, setStorageEnabled] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    loadTemplate();
    checkStorageStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applianceId]);

  const checkStorageStatus = async () => {
    try {
      const status = await api.getStorageStatus();
      setStorageEnabled(status.enabled);
    } catch (err) {
      console.error('Failed to check storage status:', err);
    }
  };

  const loadTemplate = async () => {
    if (!applianceId) return;
    
    try {
      setLoading(true);
      const templateData = await api.getTemplate(applianceId);
      setTemplate(templateData);
      setItems(templateData.items);
    } catch (err) {
      setError('Failed to load template');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const newItem = {
      name: 'New Check Item',
      description: 'Enter description here',
      order: items.length + 1,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // Reorder remaining items
    const reorderedItems = newItems.map((item, i) => ({ ...item, order: i + 1 }));
    setItems(reorderedItems);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    // Update order numbers
    const reorderedItems = newItems.map((item, i) => ({ ...item, order: i + 1 }));
    setItems(reorderedItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
    // Update order numbers
    const reorderedItems = newItems.map((item, i) => ({ ...item, order: i + 1 }));
    setItems(reorderedItems);
  };

  const handleUpdateItem = (index: number, field: 'name' | 'description', value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handlePhotoUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!storageEnabled) {
      alert('Photo upload is not available. Azure Storage is not configured.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file must be smaller than 10MB');
      return;
    }

    try {
      setUploadingIndex(index);
      const response = await api.uploadReferencePhoto(file);
      
      const newItems = [...items];
      newItems[index] = { ...newItems[index], referencePhotoUrl: response.photoUrl };
      setItems(newItems);
    } catch (err) {
      console.error('Failed to upload photo:', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], referencePhotoUrl: undefined };
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!applianceId) return;

    try {
      setSaving(true);
      setError(null);
      await api.updateTemplate(applianceId, items);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save template');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="template-editor">
        <div className="loading-message">Loading template...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="template-editor">
        <div className="error-message">Template not found</div>
      </div>
    );
  }

  return (
    <div className="template-editor">
      <header className="template-editor-header">
        <Link to="/truckcheck" className="back-link">← Back to Truck Checks</Link>
        <div className="header-content">
          <h1>Edit Checklist Template</h1>
          <h2>{template.applianceName}</h2>
        </div>
        <button 
          className="save-button" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">Template saved successfully!</div>}
      {!storageEnabled && (
        <div className="warning-banner">
          Photo uploads are not available. Configure Azure Storage to enable this feature.
        </div>
      )}

      <main className="template-editor-main" id="main-content" tabIndex={-1}>
        <div className="items-list">
          {items.map((item, index) => (
            <div key={index} className="item-card">
              <div className="item-header">
                <span className="item-number">{index + 1}</span>
                <div className="item-controls">
                  <button
                    className="control-button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    className="control-button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    className="control-button delete-button"
                    onClick={() => handleRemoveItem(index)}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="item-content">
                <div className="form-group">
                  <label htmlFor={`name-${index}`}>Item Name</label>
                  <input
                    id={`name-${index}`}
                    type="text"
                    className="item-name-input"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                    placeholder="e.g., Tyre Condition"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`description-${index}`}>Description</label>
                  <textarea
                    id={`description-${index}`}
                    className="item-description-input"
                    value={item.description}
                    onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                    placeholder="Enter detailed instructions for this check..."
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>Reference Photo (Optional)</label>
                  {item.referencePhotoUrl ? (
                    <div className="photo-preview">
                      <img src={item.referencePhotoUrl} alt="Reference" />
                      <button
                        className="remove-photo-button"
                        onClick={() => handleRemovePhoto(index)}
                      >
                        Remove Photo
                      </button>
                    </div>
                  ) : (
                    <div className="photo-upload">
                      <input
                        type="file"
                        id={`photo-${index}`}
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(index, e)}
                        disabled={!storageEnabled || uploadingIndex === index}
                      />
                      <label htmlFor={`photo-${index}`} className="upload-label">
                        {uploadingIndex === index ? 'Uploading...' : 'Choose Photo'}
                      </label>
                      {!storageEnabled && (
                        <span className="disabled-text">
                          (Photo upload not configured)
                        </span>
                      )}
                    </div>
                  )}
                  <p className="help-text">
                    Add a reference photo to guide users on what to check
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="add-item-button" onClick={handleAddItem}>
          + Add New Check Item
        </button>
      </main>

      <footer className="template-editor-footer">
        <button 
          className="save-button primary" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <Link to="/truckcheck" className="cancel-link">
          Cancel
        </Link>
      </footer>
    </div>
  );
}
