/**
 * Facility search — used by the signup flow to claim (or record a custom)
 * emergency-services facility from the Digital Atlas of Australia dataset.
 *
 * Two modes:
 *  - Dataset search: debounced lookup across all service types, with a
 *    type filter and an "already claimed" badge on taken facilities.
 *  - Custom entry ("my unit isn't listed"): free-text name + service type,
 *    which still runs the same lookup underneath to nudge the user toward a
 *    known facility ("Did you mean…") before they commit to an unlisted org.
 */

import { useEffect, useState } from 'react';
import { Search, MapPin, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { FacilitySearchResult, FacilitySelection, FacilityServiceType } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import './FacilitySearch.css';

const SERVICE_TYPE_LABELS: Record<FacilityServiceType, string> = {
  'rural-fire': 'Rural / country fire',
  'metro-fire': 'Fire & Rescue',
  ses: 'SES',
  ambulance: 'Ambulance',
  police: 'Police',
  other: 'Other',
};

const FILTER_CHIPS: Array<{ label: string; value: FacilityServiceType | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Rural fire', value: 'rural-fire' },
  { label: 'Fire & Rescue', value: 'metro-fire' },
  { label: 'SES', value: 'ses' },
  { label: 'Ambulance', value: 'ambulance' },
  { label: 'Police', value: 'police' },
  { label: 'Other', value: 'other' },
];

interface FacilitySearchProps {
  onSelect: (selection: FacilitySelection, label: string) => void;
}

export function FacilitySearch({ onSelect }: FacilitySearchProps) {
  const [query, setQuery] = useState('');
  const [serviceType, setServiceType] = useState<FacilityServiceType | undefined>(undefined);
  const [results, setResults] = useState<FacilitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customServiceType, setCustomServiceType] = useState<FacilityServiceType>('rural-fire');
  const [customState, setCustomState] = useState('');

  const debouncedQuery = useDebounce(query, 300);
  const debouncedCustomName = useDebounce(customName, 300);

  const activeQuery = showCustomForm ? debouncedCustomName : debouncedQuery;

  useEffect(() => {
    if (activeQuery.trim().length < 2) {
      setResults([]);
      setErrorMessage('');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage('');
    api
      .lookupFacilities({ q: activeQuery.trim(), serviceType, limit: 10 })
      .then((data) => {
        if (!cancelled) setResults(data.results);
      })
      .catch((err) => {
        if (!cancelled) {
          setResults([]);
          setErrorMessage(err instanceof Error ? err.message : 'Search failed');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeQuery, serviceType]);

  const handlePick = (facility: FacilitySearchResult) => {
    if (facility.claimed) return;
    setSelectedKey(facility.facilityKey);
    onSelect(
      { facilityKey: facility.facilityKey },
      `${facility.name} — ${facility.suburb}, ${facility.state}`,
    );
  };

  const handleCustomSuggestionPick = (facility: FacilitySearchResult) => {
    setShowCustomForm(false);
    handlePick(facility);
  };

  const handleUseCustom = () => {
    if (!customName.trim()) return;
    setSelectedKey(null);
    onSelect(
      {
        custom: {
          name: customName.trim(),
          serviceType: customServiceType,
          state: customState.trim() || undefined,
        },
      },
      customName.trim(),
    );
  };

  return (
    <div className="facility-search">
      {!showCustomForm ? (
        <>
          <div className="facility-search__input-row">
            <Search size={18} className="facility-search__icon" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedKey(null);
              }}
              placeholder="Search by brigade/unit name, suburb or postcode"
              aria-label="Search for your unit"
            />
          </div>

          <div className="facility-search__filters" role="group" aria-label="Filter by service type">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className={`facility-search__chip${serviceType === chip.value ? ' facility-search__chip--active' : ''}`}
                onClick={() => setServiceType(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {isLoading && <p className="facility-search__status">Searching…</p>}
          {errorMessage && (
            <p className="facility-search__status facility-search__status--error">
              <AlertCircle size={16} aria-hidden="true" /> {errorMessage}
            </p>
          )}

          {!isLoading && !errorMessage && query.trim().length >= 2 && results.length === 0 && (
            <p className="facility-search__status">No matches. Try a different search, or enter your unit manually below.</p>
          )}

          <ul className="facility-search__results">
            {results.map((facility) => (
              <li key={facility.facilityKey}>
                <button
                  type="button"
                  className={`facility-search__result${facility.claimed ? ' facility-search__result--claimed' : ''}${
                    selectedKey === facility.facilityKey ? ' facility-search__result--selected' : ''
                  }`}
                  onClick={() => handlePick(facility)}
                  disabled={facility.claimed}
                >
                  <span className="facility-search__result-name">{facility.name}</span>
                  <span className="facility-search__result-meta">
                    <MapPin size={14} aria-hidden="true" />
                    {facility.suburb}, {facility.state} {facility.postcode}
                  </span>
                  <span className="facility-search__result-type">{SERVICE_TYPE_LABELS[facility.serviceType]}</span>
                  {facility.claimed && (
                    <span className="facility-search__claimed-badge">
                      Already claimed — discuss with your brigade members or contact support
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="facility-search__custom-link" onClick={() => setShowCustomForm(true)}>
            My unit isn't listed
          </button>
        </>
      ) : (
        <div className="facility-search__custom-form">
          <div className="form-group">
            <label htmlFor="customFacilityName">Unit / brigade name</label>
            <input
              id="customFacilityName"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Riverside Fire Brigade"
              required
            />
          </div>

          {/* Nudge: keep searching underneath so a known facility can still be picked. */}
          {isLoading && <p className="facility-search__status">Checking for a match…</p>}
          {!isLoading && results.length > 0 && (
            <div className="facility-search__nudge">
              <p>Did you mean one of these?</p>
              <ul className="facility-search__results">
                {results.map((facility) => (
                  <li key={facility.facilityKey}>
                    <button
                      type="button"
                      className={`facility-search__result${facility.claimed ? ' facility-search__result--claimed' : ''}`}
                      onClick={() => handleCustomSuggestionPick(facility)}
                      disabled={facility.claimed}
                    >
                      <span className="facility-search__result-name">{facility.name}</span>
                      <span className="facility-search__result-meta">
                        <MapPin size={14} aria-hidden="true" />
                        {facility.suburb}, {facility.state}
                      </span>
                      <span className="facility-search__result-type">{SERVICE_TYPE_LABELS[facility.serviceType]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="customServiceType">Service type</label>
            <select
              id="customServiceType"
              value={customServiceType}
              onChange={(e) => setCustomServiceType(e.target.value as FacilityServiceType)}
            >
              {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="customState">State (optional)</label>
            <input
              id="customState"
              type="text"
              value={customState}
              onChange={(e) => setCustomState(e.target.value)}
              placeholder="e.g. NSW"
            />
          </div>

          <div className="facility-search__custom-actions">
            <button type="button" className="facility-search__custom-link" onClick={() => setShowCustomForm(false)}>
              Back to search
            </button>
            <button
              type="button"
              className="facility-search__use-custom-button"
              onClick={handleUseCustom}
              disabled={!customName.trim()}
            >
              Use this unit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
