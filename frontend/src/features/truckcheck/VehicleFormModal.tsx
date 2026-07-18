/**
 * Add/edit vehicle modal — the CRUD core of vehicle management (Q8).
 *
 * Extracted from VehicleManagement.tsx (the Admin Dashboard's vehicle grid)
 * so the truck-check roster (TruckCheckPage.tsx) can offer the same add/edit
 * flow directly, without a trip to /truckcheck/admin. Template editing and
 * zones/equipment stay admin-only — genuinely advanced customization, not
 * basic CRUD — this modal only covers a vehicle's own fields.
 */

import { useState, useEffect, useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { api, ApiLimitError } from '../../services/api';
import type { Appliance, VehicleType } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import './VehicleManagement.css';

interface VehicleFormModalProps {
  /** null = create a new vehicle; an Appliance = edit it. */
  vehicle: Appliance | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Disambiguates the Vehicle Type dropdown (Q39, found 2026-07-17): a globally
 * seeded standard type and a brigade's own type "published" as a standard
 * (isStandard: true but organizationId still set — see VehicleType's own
 * doc comment) can share the exact same name, and both previously rendered
 * as the identical "{name} (standard)" — no way to tell them apart before
 * picking one. Distinguishes by provenance (built-in vs. brigade-published
 * vs. private custom) and item count, since those are the two things that
 * actually differ between same-named entries.
 */
function describeVehicleType(vt: VehicleType): string {
  const itemCount = vt.standardItems.length;
  const items = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  if (vt.isStandard && !vt.organizationId) {
    return `${vt.name} — ${vt.agency ? `${vt.agency} standard` : 'standard'} (${items})`;
  }
  if (vt.isStandard) {
    return `${vt.name} — published by your brigade (${items})`;
  }
  return `${vt.name} — custom (${items})`;
}

export function VehicleFormModal({ vehicle, onClose, onSaved }: VehicleFormModalProps) {
  const isEditMode = vehicle !== null;
  const modalIdSuffix = vehicle?.id ?? 'new';

  const [vehicleName, setVehicleName] = useState(vehicle?.name ?? '');
  const [vehicleDescription, setVehicleDescription] = useState(vehicle?.description ?? '');
  const [vehicleTypeId, setVehicleTypeId] = useState(vehicle?.vehicleTypeId ?? '');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [agencyId, setAgencyId] = useState(vehicle?.agencyId ?? '');
  const [registration, setRegistration] = useState(vehicle?.registration ?? '');
  const [vin, setVin] = useState(vehicle?.vin ?? '');
  const [make, setMake] = useState(vehicle?.make ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '');
  const vehiclePhotoUrl = vehicle?.photoUrl ?? '';
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeAvailable, setUpgradeAvailable] = useState(false);
  const modalRef = useFocusTrap<HTMLDivElement>(true);

  // A local preview URL for a newly-picked photo, revoked whenever the file
  // changes or the modal unmounts so it doesn't leak (createObjectURL blobs
  // are never garbage-collected on their own).
  const photoPreviewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    api.getVehicleTypes().then(setVehicleTypes).catch(() => setVehicleTypes([]));
  }, []);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [uploading, onClose]);

  function handleOverlayKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  }

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
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

  async function handleSave() {
    if (!vehicleName.trim()) {
      setError('Vehicle name is required');
      return;
    }

    setError(null);
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

      if (isEditMode && vehicle) {
        await api.updateAppliance(vehicle.id, vehicleName, vehicleDescription || undefined, photoUrl || undefined, legacySlug, details);
      } else {
        await api.createAppliance(vehicleName, vehicleDescription || undefined, photoUrl || undefined, legacySlug, details);
      }

      onSaved();
      onClose();
    } catch (err) {
      const fallback = `Failed to ${isEditMode ? 'update' : 'create'} vehicle`;
      if (err instanceof ApiLimitError) {
        setError(err.message);
        setUpgradeAvailable(true);
      } else {
        setError(err instanceof Error && err.message ? err.message : fallback);
        setUpgradeAvailable(false);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close vehicle modal"
    >
      <div ref={modalRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
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
          <select id={`vehicle-type-${modalIdSuffix}`} value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)}>
            <option value="">— No standard type (custom checklist only) —</option>
            {vehicleTypes.map((vt) => (
              <option key={vt.id} value={vt.id}>
                {describeVehicleType(vt)}
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
              {photoPreviewUrl ? (
                <img src={photoPreviewUrl} alt="Preview" />
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

        {error && (
          <p className="vehicle-modal-error" role="alert">
            {error}
            {upgradeAvailable && (
              <> <a href="/admin/organization" className="vehicle-modal-upgrade-link">Upgrade plan →</a></>
            )}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={uploading}>
            {uploading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
