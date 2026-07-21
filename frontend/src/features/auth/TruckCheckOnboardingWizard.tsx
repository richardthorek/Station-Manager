/**
 * Truck Check Onboarding Wizard
 *
 * Post-signup flow that collects:
 * 1. Jurisdiction (state)
 * 2. Agency/organisation (with "other" free text option)
 * 3. Vehicle types the brigade operates (multi-select from standard templates)
 *
 * This data seeds initial appliances based on selected vehicle types.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { api } from '../../services/api';
import { PageTransition } from '../../components/PageTransition';
import { markTruckCheckOnboardingComplete } from '../../utils/onboardingUtils';
import { VEHICLE_TEMPLATES } from './vehicleTemplates';
import './TruckCheckOnboardingWizard.css';

// NSW RFS & partner agencies
const AGENCIES = [
  { id: 'nsw-rfs', label: 'NSW Rural Fire Service (RFS)' },
  { id: 'frnsw', label: 'Fire & Rescue NSW (FRNSW)' },
  { id: 'nsw-ses', label: 'NSW State Emergency Service (SES)' },
  { id: 'nswpf', label: 'NSW Police Force' },
  { id: 'other', label: 'Other (please specify)' },
];

const JURISDICTIONS = [
  { id: 'NSW', label: 'New South Wales (NSW)' },
  { id: 'VIC', label: 'Victoria (VIC)' },
  { id: 'QLD', label: 'Queensland (QLD)' },
  { id: 'WA', label: 'Western Australia (WA)' },
  { id: 'SA', label: 'South Australia (SA)' },
  { id: 'TAS', label: 'Tasmania (TAS)' },
  { id: 'NT', label: 'Northern Territory (NT)' },
  { id: 'ACT', label: 'Australian Capital Territory (ACT)' },
];


type Step = 'jurisdiction' | 'agency' | 'vehicles' | 'confirm';

export function TruckCheckOnboardingWizard() {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const [step, setStep] = useState<Step>('jurisdiction');
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [jurisdiction, setJurisdiction] = useState('NSW');
  const [agency, setAgency] = useState('nsw-rfs');
  const [agencyCustom, setAgencyCustom] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleJurisdictionSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!jurisdiction) {
      setError('Please select a jurisdiction');
      return;
    }
    setStep('agency');
  };

  const handleAgencySubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agency) {
      setError('Please select an agency');
      return;
    }

    if (agency === 'other' && !agencyCustom.trim()) {
      setError('Please specify your agency/organisation');
      return;
    }

    setStep('vehicles');
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const newSet = new Set(selectedVehicles);
    if (newSet.has(vehicleId)) {
      newSet.delete(vehicleId);
    } else {
      newSet.add(vehicleId);
    }
    setSelectedVehicles(newSet);
  };

  const handleVehiclesSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedVehicles.size === 0) {
      setError('Please select at least one vehicle type');
      return;
    }

    setStep('confirm');
  };

  const handleConfirmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Create appliances for each selected vehicle type
      const selectedVehicleArray = Array.from(selectedVehicles);
      const vehicleNames = selectedVehicleArray
        .map((id) => VEHICLE_TEMPLATES.find((v) => v.id === id)?.label)
        .filter(Boolean);

      // Create initial appliances (one per selected vehicle type)
      for (const vehicleTypeId of selectedVehicleArray) {
        const template = VEHICLE_TEMPLATES.find((v) => v.id === vehicleTypeId);
        if (template) {
          await api.createAppliance(
            template.label, // name
            template.description, // description
            undefined, // no photo
            undefined, // vehicle type string
            { vehicleTypeId } // vehicle type ID
          );
        }
      }

      // Mark onboarding as complete
      markTruckCheckOnboardingComplete();

      showSuccess(
        `Great! Created ${vehicleNames.length} vehicle${vehicleNames.length === 1 ? '' : 's'} for truck checks.`
      );

      // Redirect to the truck checks page
      navigate('/truckcheck');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vehicles');
    } finally {
      setIsLoading(false);
    }
  };

  const getAgencyDisplay = () => {
    if (agency === 'other') {
      return agencyCustom || 'Custom agency';
    }
    return AGENCIES.find((a) => a.id === agency)?.label || agency;
  };

  return (
    <PageTransition variant="fade">
      <div className="truck-check-onboarding">
        <header className="onboarding-header">
          <h1>Set up truck checks</h1>
          <p className="onboarding-subtitle">
            {step === 'jurisdiction' && 'Where does your brigade operate?'}
            {step === 'agency' && 'Which agency or organisation?'}
            {step === 'vehicles' && 'Which vehicles do you operate?'}
            {step === 'confirm' && 'Review and confirm'}
          </p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  step === 'jurisdiction'
                    ? 25
                    : step === 'agency'
                      ? 50
                      : step === 'vehicles'
                        ? 75
                        : 100
                }%`,
              }}
            />
          </div>
        </header>

        <main className="onboarding-main">
          <div className="onboarding-card card">
            {/* Step 1: Jurisdiction */}
            {step === 'jurisdiction' && (
              <form onSubmit={handleJurisdictionSubmit} className="onboarding-form">
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <fieldset className="jurisdiction-grid">
                  <legend className="sr-only">Select your jurisdiction</legend>
                  {JURISDICTIONS.map((j) => (
                    <label key={j.id} className="jurisdiction-option">
                      <input
                        type="radio"
                        name="jurisdiction"
                        value={j.id}
                        checked={jurisdiction === j.id}
                        onChange={(e) => setJurisdiction(e.target.value)}
                        className="sr-only"
                      />
                      <span className="jurisdiction-label">{j.label}</span>
                    </label>
                  ))}
                </fieldset>

                <button type="submit" className="btn-primary onboarding-button">
                  Next →
                </button>
              </form>
            )}

            {/* Step 2: Agency */}
            {step === 'agency' && (
              <form onSubmit={handleAgencySubmit} className="onboarding-form">
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <fieldset className="agency-list">
                  <legend className="sr-only">Select your agency</legend>
                  {AGENCIES.map((a) => (
                    <label key={a.id} className="agency-option">
                      <input
                        type="radio"
                        name="agency"
                        value={a.id}
                        checked={agency === a.id}
                        onChange={(e) => setAgency(e.target.value)}
                        className="sr-only"
                      />
                      <span className="agency-label">{a.label}</span>
                    </label>
                  ))}
                </fieldset>

                {agency === 'other' && (
                  <div className="form-group">
                    <label htmlFor="agencyCustom" className="form-label">
                      Please specify your agency or organisation
                    </label>
                    <input
                      id="agencyCustom"
                      type="text"
                      value={agencyCustom}
                      onChange={(e) => setAgencyCustom(e.target.value)}
                      placeholder="e.g. Local Volunteer Rescue Squad"
                      className="form-input"
                      disabled={isLoading}
                    />
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary onboarding-button"
                    onClick={() => setStep('jurisdiction')}
                    disabled={isLoading}
                  >
                    ← Back
                  </button>
                  <button type="submit" className="btn-primary onboarding-button" disabled={isLoading}>
                    Next →
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Vehicle Types */}
            {step === 'vehicles' && (
              <form onSubmit={handleVehiclesSubmit} className="onboarding-form">
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <fieldset className="vehicles-grid">
                  <legend>Which vehicles do you operate? (select at least one)</legend>
                  {VEHICLE_TEMPLATES.map((vehicle) => (
                    // eslint-disable-next-line jsx-a11y/label-has-associated-control
                    <label key={vehicle.id} className="vehicle-option" htmlFor={`vehicle-${vehicle.id}`}>
                      <input
                        id={`vehicle-${vehicle.id}`}
                        type="checkbox"
                        value={vehicle.id}
                        checked={selectedVehicles.has(vehicle.id)}
                        onChange={() => handleVehicleSelect(vehicle.id)}
                        className="sr-only"
                        disabled={isLoading}
                      />
                      <div className="vehicle-card">
                        <div className="vehicle-checkbox" />
                        <h3 className="vehicle-title">{vehicle.label}</h3>
                        <p className="vehicle-description">{vehicle.description}</p>
                        <span className="vehicle-agency">{vehicle.agency}</span>
                      </div>
                    </label>
                  ))}
                </fieldset>

                <p className="vehicles-hint">
                  Select the vehicles your brigade operates. You can add more later.
                </p>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary onboarding-button"
                    onClick={() => setStep('agency')}
                    disabled={isLoading}
                  >
                    ← Back
                  </button>
                  <button type="submit" className="btn-primary onboarding-button" disabled={isLoading}>
                    Review →
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Confirm */}
            {step === 'confirm' && (
              <form onSubmit={handleConfirmSubmit} className="onboarding-form">
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <div className="confirm-summary">
                  <div className="summary-section">
                    <h3 className="summary-title">Jurisdiction</h3>
                    <p className="summary-value">
                      {JURISDICTIONS.find((j) => j.id === jurisdiction)?.label}
                    </p>
                  </div>

                  <div className="summary-section">
                    <h3 className="summary-title">Agency / Organisation</h3>
                    <p className="summary-value">{getAgencyDisplay()}</p>
                  </div>

                  <div className="summary-section">
                    <h3 className="summary-title">Vehicles</h3>
                    <ul className="summary-list">
                      {Array.from(selectedVehicles).map((vehicleId) => {
                        const vehicle = VEHICLE_TEMPLATES.find((v) => v.id === vehicleId);
                        return (
                          <li key={vehicleId} className="summary-item">
                            {vehicle?.label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary onboarding-button"
                    onClick={() => setStep('vehicles')}
                    disabled={isLoading}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary onboarding-button"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Setting up vehicles…' : 'Create vehicles & continue'}
                  </button>
                </div>

                <p className="confirm-note">
                  You can edit these vehicles, add more, or skip truck checks later from the admin panel.
                </p>
              </form>
            )}
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
