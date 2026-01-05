/**
 * Edit Station Modal
 * 
 * Modal for editing existing stations with:
 * - Pre-populated form
 * - Validation
 * - Save/cancel actions
 */

import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Station } from '../../../types';
import './EditStationModal.css';

interface EditStationModalProps {
  station: Station;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditStationModal({ station, onClose, onUpdated }: EditStationModalProps) {
  const [formData, setFormData] = useState({
    name: station.name,
    brigadeName: station.brigadeName,
    brigadeId: station.brigadeId,
    jurisdiction: station.hierarchy.jurisdiction,
    area: station.hierarchy.area,
    district: station.hierarchy.district,
    brigade: station.hierarchy.brigade,
    station: station.hierarchy.station,
    address: station.location?.address || '',
    latitude: station.location?.latitude?.toString() || '',
    longitude: station.location?.longitude?.toString() || '',
    phone: station.contactInfo?.phone || '',
    email: station.contactInfo?.email || '',
    isActive: station.isActive,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle field change
   */
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
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
      const updates: Partial<Station> = {
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
        isActive: formData.isActive,
      };

      // Add location if provided
      if (formData.address || formData.latitude || formData.longitude) {
        updates.location = {
          address: formData.address.trim() || undefined,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        };
      }

      // Add contact info if provided
      if (formData.phone || formData.email) {
        updates.contactInfo = {
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
        };
      }

      await api.updateStation(station.id, updates);
      onUpdated();
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : 'Failed to update station',
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
      <div className="modal-content edit-station-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Station</h2>
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
                  onChange={(e) => handleChange('brigadeName', e.target.value)}
                  className={errors.brigadeName ? 'error' : ''}
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
                />
                {errors.brigadeId && <span className="field-error">{errors.brigadeId}</span>}
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
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="isActive">Status</label>
                <select
                  id="isActive"
                  value={formData.isActive ? 'true' : 'false'}
                  onChange={(e) => handleChange('isActive', e.target.value === 'true')}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
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
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions">
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
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
