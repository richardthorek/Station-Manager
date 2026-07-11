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
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

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
      if (templateData) {
        setTemplate(templateData);
        setItems(templateData.items);
      }
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
    const newItems = [...items, newItem];
    setItems(newItems);
    setSelectedItemIndex(newItems.length - 1);
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
        <Link to="/truckcheck" className="back-link">← Back to Vehicle Checks</Link>
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
        <div className="editor-layout">
          {/* Left pane: item list */}
          <div className="editor-sidebar">
            <div className="items-list-compact">
              {items.length === 0 ? (
                <div className="empty-list-message">
                  <p>No check items yet.</p>
                  <p className="secondary-text">Click "Add New Check Item" to get started.</p>
                </div>
              ) : (
                items.map((item, index) => (
                  <button
                    key={index}
                    className={`item-list-entry ${selectedItemIndex === index ? 'selected' : ''}`}
                    onClick={() => setSelectedItemIndex(index)}
                  >
                    <span className="item-list-number">{index + 1}</span>
                    <span className="item-list-title">{item.name || 'Untitled'}</span>
                  </button>
                ))
              )}
            </div>
            <button className="add-item-button-sidebar" onClick={handleAddItem}>
              + Add Check Item
            </button>
          </div>

          {/* Right pane: editor */}
          <div className="editor-pane">
            {selectedItemIndex !== null && selectedItemIndex < items.length ? (
              <div className="item-editor">
                <div className="editor-header">
                  <h3>Check Item #{selectedItemIndex + 1}</h3>
                  <div className="editor-actions">
                    <button
                      className="control-button-sm"
                      onClick={() => handleMoveUp(selectedItemIndex)}
                      disabled={selectedItemIndex === 0}
                      title="Move up"
                      aria-label="Move item up"
                    >
                      ▲
                    </button>
                    <button
                      className="control-button-sm"
                      onClick={() => handleMoveDown(selectedItemIndex)}
                      disabled={selectedItemIndex === items.length - 1}
                      title="Move down"
                      aria-label="Move item down"
                    >
                      ▼
                    </button>
                    <button
                      className="control-button-sm delete-button"
                      onClick={() => {
                        handleRemoveItem(selectedItemIndex);
                        setSelectedItemIndex(null);
                      }}
                      title="Remove item"
                      aria-label="Delete item"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="item-editor-form">
                  <div className="form-group-large">
                    <label htmlFor="editor-name">Item Name</label>
                    <input
                      id="editor-name"
                      type="text"
                      className="item-name-input-large"
                      value={items[selectedItemIndex].name}
                      onChange={(e) => handleUpdateItem(selectedItemIndex, 'name', e.target.value)}
                      placeholder="e.g., Tyre Condition"
                    />
                  </div>

                  <div className="form-group-large">
                    <label htmlFor="editor-description">Description</label>
                    <textarea
                      id="editor-description"
                      className="item-description-input-large"
                      value={items[selectedItemIndex].description}
                      onChange={(e) => handleUpdateItem(selectedItemIndex, 'description', e.target.value)}
                      placeholder="Enter detailed instructions for this check..."
                    />
                  </div>

                  <div className="form-group-large">
                    <p className="form-label">Reference Photo (Optional)</p>
                    {items[selectedItemIndex].referencePhotoUrl ? (
                      <div className="photo-preview-large">
                        <img src={items[selectedItemIndex].referencePhotoUrl} alt="Reference" />
                        <button
                          className="remove-photo-button"
                          onClick={() => handleRemovePhoto(selectedItemIndex)}
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <div className="photo-upload-large">
                        <input
                          type="file"
                          id="editor-photo"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(selectedItemIndex, e)}
                          disabled={!storageEnabled || uploadingIndex === selectedItemIndex}
                        />
                        <label htmlFor="editor-photo" className="upload-label-large">
                          {uploadingIndex === selectedItemIndex ? (
                            <>Uploading...</>
                          ) : (
                            <>📷 Choose Reference Photo</>
                          )}
                        </label>
                        {!storageEnabled && (
                          <span className="disabled-text">
                            Photo upload not configured
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
            ) : (
              <div className="editor-empty">
                <p className="empty-state-icon">👆</p>
                <p>Select a check item from the list to edit it</p>
              </div>
            )}
          </div>
        </div>
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
