/**
 * Multi-Station Selector Component
 * 
 * Allows selecting multiple stations for cross-station reports.
 * Features:
 * - Multi-select with checkboxes
 * - Search/filter by station name, brigade, district, area
 * - Select all / Clear all buttons
 * - Brigade grouping
 * - Shows selected count
 * - Responsive design
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { Station } from '../types';
import './MultiStationSelector.css';

interface MultiStationSelectorProps {
  stations: Station[];
  selectedStationIds: string[];
  onSelectionChange: (stationIds: string[]) => void;
  placeholder?: string;
}

export function MultiStationSelector({
  stations,
  selectedStationIds,
  onSelectionChange,
  placeholder = 'Select stations...',
}: MultiStationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Filter stations based on search query
   */
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) {
      return stations;
    }

    const query = searchQuery.toLowerCase();
    return stations.filter(station => {
      return (
        station.name.toLowerCase().includes(query) ||
        station.brigadeName.toLowerCase().includes(query) ||
        station.hierarchy.district.toLowerCase().includes(query) ||
        station.hierarchy.area.toLowerCase().includes(query)
      );
    });
  }, [stations, searchQuery]);

  /**
   * Group stations by brigade
   */
  const stationsByBrigade = useMemo(() => {
    const grouped = new Map<string, Station[]>();
    filteredStations.forEach(station => {
      const brigadeId = station.brigadeId;
      if (!grouped.has(brigadeId)) {
        grouped.set(brigadeId, []);
      }
      grouped.get(brigadeId)!.push(station);
    });
    return grouped;
  }, [filteredStations]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  /**
   * Focus search input when dropdown opens
   */
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  /**
   * Toggle station selection
   */
  const toggleStation = (stationId: string) => {
    if (selectedStationIds.includes(stationId)) {
      onSelectionChange(selectedStationIds.filter(id => id !== stationId));
    } else {
      onSelectionChange([...selectedStationIds, stationId]);
    }
  };

  /**
   * Select all filtered stations
   */
  const selectAll = () => {
    const allIds = filteredStations.map(s => s.id);
    const newSelection = [...new Set([...selectedStationIds, ...allIds])];
    onSelectionChange(newSelection);
  };

  /**
   * Clear all selections
   */
  const clearAll = () => {
    onSelectionChange([]);
  };

  /**
   * Select all stations in a brigade
   */
  const selectBrigade = (brigadeId: string) => {
    const brigadeStationIds = filteredStations
      .filter(s => s.brigadeId === brigadeId)
      .map(s => s.id);
    const newSelection = [...new Set([...selectedStationIds, ...brigadeStationIds])];
    onSelectionChange(newSelection);
  };

  /**
   * Get display text for selected stations
   */
  const getDisplayText = () => {
    if (selectedStationIds.length === 0) {
      return placeholder;
    }
    if (selectedStationIds.length === 1) {
      const station = stations.find(s => s.id === selectedStationIds[0]);
      return station?.name || '1 station selected';
    }
    return `${selectedStationIds.length} stations selected`;
  };

  return (
    <div className="multi-station-selector" ref={dropdownRef}>
      <button
        className="selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="selector-text">{getDisplayText()}</span>
        <span className="selector-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="selector-dropdown">
          <div className="selector-header">
            <input
              ref={searchInputRef}
              type="text"
              className="selector-search"
              placeholder="Search stations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="selector-actions">
              <button className="action-btn" onClick={selectAll}>
                Select All
              </button>
              <button className="action-btn" onClick={clearAll}>
                Clear All
              </button>
            </div>
          </div>

          <div className="selector-list">
            {filteredStations.length === 0 ? (
              <div className="no-stations">No stations found</div>
            ) : (
              Array.from(stationsByBrigade.entries()).map(([brigadeId, brigadeStations]) => (
                <div key={brigadeId} className="brigade-group">
                  <div className="brigade-header">
                    <span className="brigade-name">
                      {brigadeStations[0].brigadeName}
                      <span className="station-count">({brigadeStations.length})</span>
                    </span>
                    <button
                      className="brigade-select-btn"
                      onClick={() => selectBrigade(brigadeId)}
                      title="Select all stations in this brigade"
                    >
                      Select Brigade
                    </button>
                  </div>
                  <div className="brigade-stations">
                    {brigadeStations.map(station => (
                      <label
                        key={station.id}
                        className={`station-option ${
                          selectedStationIds.includes(station.id) ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStationIds.includes(station.id)}
                          onChange={() => toggleStation(station.id)}
                        />
                        <span className="station-info">
                          <span className="station-name">{station.name}</span>
                          <span className="station-hierarchy">
                            {station.hierarchy.district} - {station.hierarchy.area}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
