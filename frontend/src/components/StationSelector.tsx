/**
 * Station Selector Component
 * 
 * Dropdown selector for choosing between stations.
 * Features:
 * - Search/filter by station name, brigade, district, area
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Shows station hierarchy
 * - Highlights demo stations
 * - Responsive design
 * - Accessibility support
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useStation, DEMO_STATION_ID } from '../contexts/StationContext';
import './StationSelector.css';

export function StationSelector() {
  const { selectedStation, stations, selectStation, isDemoStation } = useStation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
        station.hierarchy.area.toLowerCase().includes(query) ||
        station.hierarchy.station.toLowerCase().includes(query)
      );
    });
  }, [stations, searchQuery]);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
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
   * Reset highlighted index when filtered list changes
   */
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredStations]);

  /**
   * Scroll highlighted item into view
   */
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement && typeof highlightedElement.scrollIntoView === 'function') {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, isOpen]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredStations.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (filteredStations[highlightedIndex]) {
          handleSelectStation(filteredStations[highlightedIndex].id);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  /**
   * Handle station selection
   */
  const handleSelectStation = (stationId: string) => {
    selectStation(stationId);
    setIsOpen(false);
    setSearchQuery('');
  };

  /**
   * Toggle dropdown open/closed
   */
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setSearchQuery('');
    }
  };

  /**
   * Get display name for station (including brigade if different)
   */
  const getStationDisplayName = (station: typeof selectedStation) => {
    if (!station) return 'Select Station';
    
    // If station name equals brigade name, just show one
    if (station.name === station.brigadeName) {
      return station.name;
    }
    
    // Show both if different
    return `${station.brigadeName} - ${station.name}`;
  };

  return (
    <div className="station-selector" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        className={`station-selector-button ${isDemoStation() ? 'demo' : ''}`}
        onClick={toggleDropdown}
        aria-label="Select station"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="station-icon">📍</span>
        <span className="station-name">{getStationDisplayName(selectedStation)}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="station-dropdown" role="listbox" aria-label="Station list">
          <div className="station-search">
            <input
              ref={searchInputRef}
              type="text"
              className="station-search-input"
              placeholder="Search stations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search stations"
            />
          </div>

          <div className="station-list" ref={listRef}>
            {filteredStations.length === 0 ? (
              <div className="station-list-empty">No stations found</div>
            ) : (
              filteredStations.map((station, index) => {
                const isDemo = station.id === DEMO_STATION_ID;
                const isSelected = selectedStation?.id === station.id;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={station.id}
                    className={`station-list-item ${isSelected ? 'selected' : ''} ${isDemo ? 'demo' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => handleSelectStation(station.id)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="station-item-main">
                      <span className="station-item-name">
                        {station.name === station.brigadeName ? station.name : `${station.brigadeName} - ${station.name}`}
                      </span>
                      {isDemo && <span className="demo-badge">DEMO</span>}
                      {isSelected && <span className="selected-icon">✓</span>}
                    </div>
                    <div className="station-item-hierarchy">
                      {station.hierarchy.area} › {station.hierarchy.district}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
