/**
 * Create Station Modal
 * 
 * Modal for creating new stations with:
 * - National dataset lookup integration
 * - Form validation
 * - Auto-populate from lookup results
 * - Manual entry option
 * - Default behavior: 1:1 brigade-to-station mapping
 */

import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Station, StationLookupResult } from '../../../types';
import { StationLookup } from './StationLookup';
import './CreateStationModal.css';

interface CreateStationModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateStationModal({ onClose, onCreated }: CreateStationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    brigadeId: '',
    brigadeName: '',
    jurisdiction: 'NSW',
    area: '',
    district: '',
    brigade: '',
    station: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLookup, setShowLookup] = useState(true);
  const [useCustomName, setUseCustomName] = useState(false);

  /**
   * Auto-fill station name from brigade name (1:1 default)
   */
  useEffect(() => {
    if (!useCustomName && formData.brigadeName) {
      setFormData(prev => ({ ...prev, name: prev.brigadeName }));
    }
  }, [formData.brigadeName, useCustomName]);

  /**
   * Handle field change
   */
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /**
   * Handle station name change (enables custom name mode)
   */
  const handleNameChange = (value: string) => {
    setUseCustomName(true);
    handleChange('name', value);
  };

  /**
   * Handle lookup result selection
   */
  const handleLookupSelect = (result: StationLookupResult) => {
    setFormData({
      name: result.name || result.brigade || '',
      brigadeId: generateBrigadeId(result.brigade || result.name),
      brigadeName: result.brigade || result.name || '',
      jurisdiction: result.state || 'NSW',
      area: result.area || '',
      district: result.district || '',
      brigade: result.brigade || result.name || '',
      station: result.name || result.brigade || '',
      address: result.suburb ? `${result.suburb}, ${result.state} ${result.postcode}` : '',
      latitude: result.latitude?.toString() || '',
      longitude: result.longitude?.toString() || '',
      phone: formData.phone,
      email: formData.email,
    });
    setShowLookup(false);
    setUseCustomName(false); // Reset custom name flag
  };

  /**
   * Generate brigade ID from name
   */
  const generateBrigadeId = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  /**
   * Validate form
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Station name is required';
    }

    if (!formData.brigadeName.trim()) {
      newErrors.brigadeName = 'Brigade name is required';
    }

    if (!formData.brigadeId.trim()) {
      newErrors.brigadeId = 'Brigade ID is required';
    }

    if (!formData.area.trim()) {
      newErrors.area = 'Area is required';
    }

    if (!formData.district.trim()) {
      newErrors.district = 'District is required';
    }

    if (formData.latitude && isNaN(parseFloat(formData.latitude))) {
      newErrors.latitude = 'Invalid latitude';
    }

    if (formData.longitude && isNaN(parseFloat(formData.longitude))) {
      newErrors.longitude = 'Invalid longitude';
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const stationData: Partial<Station> = {
        name: formData.name.trim(),
        brigadeId: formData.brigadeId.trim(),
        brigadeName: formData.brigadeName.trim(),
        hierarchy: {
          jurisdiction: formData.jurisdiction,
          area: formData.area.trim(),
          district: formData.district.trim(),
          brigade: formData.brigade.trim() || formData.brigadeName.trim(),
          station: formData.station.trim() || formData.name.trim(),
        },
      };

      // Add location if provided
      if (formData.address || formData.latitude || formData.longitude) {
        stationData.location = {
          address: formData.address.trim() || undefined,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        };
      }

      // Add contact info if provided
      if (formData.phone || formData.email) {
        stationData.contactInfo = {
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
        };
      }

      await api.createStation(stationData);
      onCreated();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : 'Failed to create station',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content create-station-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Station</h2>
          <button
            onClick={handleClose}
            className="close-button"
            aria-label="Close"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* National Dataset Lookup */}
          {showLookup && (
            <div className="lookup-section">
              <h3>Search National Dataset</h3>
              <p className="lookup-hint">
                Search for your station in the national RFS facilities database to auto-populate details.
              </p>
              <StationLookup onSelect={handleLookupSelect} />
              <div className="lookup-divider">
                <span>OR</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLookup(false)}
                className="secondary-button"
              >
                Enter Details Manually
              </button>
            </div>
          )}

          {/* Manual Entry Form */}
          {!showLookup && (
            <form onSubmit={handleSubmit} className="station-form">
              {errors.submit && (
                <div className="form-error">{errors.submit}</div>
              )}

              {/* Brigade Information */}
              <div className="form-section">
                <h3>Brigade Information</h3>
                
                <div className="form-group">
                  <label htmlFor="brigadeName">
                    Brigade Name <span className="required">*</span>
                  </label>
                  <input
                    id="brigadeName"
                    type="text"
                    value={formData.brigadeName}
                    onChange={(e) => {
                      handleChange('brigadeName', e.target.value);
                      handleChange('brigadeId', generateBrigadeId(e.target.value));
                    }}
                    className={errors.brigadeName ? 'error' : ''}
                    placeholder="e.g., Horsley Park Rural Fire Brigade"
                  />
                  {errors.brigadeName && <span className="field-error">{errors.brigadeName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="brigadeId">
                    Brigade ID <span className="required">*</span>
                  </label>
                  <input
                    id="brigadeId"
                    type="text"
                    value={formData.brigadeId}
                    onChange={(e) => handleChange('brigadeId', e.target.value)}
                    className={errors.brigadeId ? 'error' : ''}
                    placeholder="e.g., horsley-park-rural-fire-brigade"
                  />
                  {errors.brigadeId && <span className="field-error">{errors.brigadeId}</span>}
                  <span className="field-hint">Auto-generated from brigade name. Can be customized.</span>
                </div>
              </div>

              {/* Station Information */}
              <div className="form-section">
                <h3>Station Information</h3>
                
                <div className="form-group">
                  <label htmlFor="name">
                    Station Name <span className="required">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={errors.name ? 'error' : ''}
                    placeholder="e.g., Horsley Park Rural Fire Brigade"
                  />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                  {!useCustomName && (
                    <span className="field-hint">
                      Defaults to brigade name. Edit to customize (e.g., add "North", "South").
                    </span>
                  )}
                </div>
              </div>

              {/* Hierarchy */}
              <div className="form-section">
                <h3>Organizational Hierarchy</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="jurisdiction">Jurisdiction</label>
                    <select
                      id="jurisdiction"
                      value={formData.jurisdiction}
                      onChange={(e) => handleChange('jurisdiction', e.target.value)}
                    >
                      <option value="NSW">NSW</option>
                      <option value="VIC">VIC</option>
                      <option value="QLD">QLD</option>
                      <option value="SA">SA</option>
                      <option value="WA">WA</option>
                      <option value="TAS">TAS</option>
                      <option value="NT">NT</option>
                      <option value="ACT">ACT</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="area">
                      Area <span className="required">*</span>
                    </label>
                    <input
                      id="area"
                      type="text"
                      value={formData.area}
                      onChange={(e) => handleChange('area', e.target.value)}
                      className={errors.area ? 'error' : ''}
                      placeholder="e.g., South West"
                    />
                    {errors.area && <span className="field-error">{errors.area}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="district">
                    District <span className="required">*</span>
                  </label>
                  <input
                    id="district"
                    type="text"
                    value={formData.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    className={errors.district ? 'error' : ''}
                    placeholder="e.g., Fairfield"
                  />
                  {errors.district && <span className="field-error">{errors.district}</span>}
                </div>
              </div>

              {/* Location (Optional) */}
              <div className="form-section">
                <h3>Location (Optional)</h3>
                
                <div className="form-group">
                  <label htmlFor="address">Address</label>
                  <input
                    id="address"
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="e.g., 123 Fire Station Road, Horsley Park NSW 2175"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude</label>
                    <input
                      id="latitude"
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => handleChange('latitude', e.target.value)}
                      className={errors.latitude ? 'error' : ''}
                      placeholder="e.g., -33.8486"
                    />
                    {errors.latitude && <span className="field-error">{errors.latitude}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="longitude">Longitude</label>
                    <input
                      id="longitude"
                      type="text"
                      value={formData.longitude}
                      onChange={(e) => handleChange('longitude', e.target.value)}
                      className={errors.longitude ? 'error' : ''}
                      placeholder="e.g., 150.8694"
                    />
                    {errors.longitude && <span className="field-error">{errors.longitude}</span>}
                  </div>
                </div>
              </div>

              {/* Contact Info (Optional) */}
              <div className="form-section">
                <h3>Contact Information (Optional)</h3>
                
                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="e.g., 02 1234 5678"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={errors.email ? 'error' : ''}
                    placeholder="e.g., station@rfs.nsw.gov.au"
                  />
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowLookup(true)}
                  className="secondary-button"
                  disabled={isSubmitting}
                >
                  ← Back to Lookup
                </button>
                <div className="action-group">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="secondary-button"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Station'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
