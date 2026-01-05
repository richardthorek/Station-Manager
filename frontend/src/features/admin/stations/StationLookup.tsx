/**
 * Station Lookup Component
 * 
 * Search and lookup fire service stations from national dataset:
 * - Show closest 10 stations by default (if geolocation available)
 * - Search by station name, suburb, or brigade
 * - One-click populate from search results
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import type { StationLookupResult } from '../../../types';
import './StationLookup.css';

interface StationLookupProps {
  onSelect: (result: StationLookupResult) => void;
}

export function StationLookup({ onSelect }: StationLookupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<StationLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  /**
   * Get user's location
   */
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setLocationLoading(false);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setLocationLoading(false);
        }
      );
    }
  }, []);

  /**
   * Load closest 10 stations
   */
  const loadClosestStations = useCallback(async () => {
    if (!userLocation) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api.lookupStations(
        undefined,
        userLocation.lat,
        userLocation.lon,
        10
      );
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stations');
      console.error('Error loading closest stations:', err);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  /**
   * Load closest stations on mount (if location available)
   */
  useEffect(() => {
    if (userLocation && !searchQuery) {
      loadClosestStations();
    }
  }, [userLocation, loadClosestStations, searchQuery]);

  /**
   * Handle search
   */
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // If search is cleared, reload closest stations
      if (userLocation) {
        loadClosestStations();
      } else {
        setResults([]);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.lookupStations(
        query,
        userLocation?.lat,
        userLocation?.lon,
        20 // Show more results for search
      );
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search stations');
      console.error('Error searching stations:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format distance
   */
  const formatDistance = (distance?: number): string => {
    if (distance === undefined) return '';
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  return (
    <div className="station-lookup">
      <div className="lookup-search">
        <input
          type="text"
          placeholder="Search by station name, suburb, or brigade..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="lookup-input"
          aria-label="Search stations"
        />
      </div>

      {locationLoading && (
        <div className="lookup-info">
          <span>📍 Getting your location...</span>
        </div>
      )}

      {!searchQuery && userLocation && !locationLoading && (
        <div className="lookup-info">
          <span>📍 Showing closest 10 stations to your location</span>
        </div>
      )}

      {error && (
        <div className="lookup-error">{error}</div>
      )}

      {loading && (
        <div className="lookup-loading">Searching...</div>
      )}

      {!loading && results.length === 0 && searchQuery && (
        <div className="lookup-empty">
          No stations found. Try a different search term.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="lookup-results">
          {results.map((result, index) => (
            <div
              key={index}
              className="lookup-result"
              onClick={() => onSelect(result)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(result);
                }
              }}
            >
              <div className="result-header">
                <h4 className="result-name">{result.name}</h4>
                {result.distance !== undefined && (
                  <span className="result-distance">
                    {formatDistance(result.distance)}
                  </span>
                )}
              </div>
              <div className="result-details">
                {result.brigade && (
                  <span className="result-detail">
                    <strong>Brigade:</strong> {result.brigade}
                  </span>
                )}
                {result.district && (
                  <span className="result-detail">
                    <strong>District:</strong> {result.district}
                  </span>
                )}
                {result.suburb && (
                  <span className="result-detail">
                    <strong>Location:</strong> {result.suburb}, {result.state} {result.postcode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !searchQuery && !userLocation && (
        <div className="lookup-empty">
          Enable location services to see nearby stations, or search above.
        </div>
      )}
    </div>
  );
}
