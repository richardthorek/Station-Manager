/**
 * Station Management Page
 * 
 * Admin UI for managing stations with CRUD operations:
 * - List all stations with search and filter
 * - Create new stations with national dataset lookup
 * - Edit existing stations
 * - View station details and statistics
 * - Soft delete stations
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSocket } from '../../../hooks/useSocket';
import { useStation, DEMO_STATION_ID } from '../../../contexts/StationContext';
import type { Station } from '../../../types';
import { CreateStationModal } from './CreateStationModal';
import { EditStationModal } from './EditStationModal';
import { StationDetailsView } from './StationDetailsView';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import './StationManagementPage.css';

type SortField = 'name' | 'brigade' | 'district' | 'area';
type SortDirection = 'asc' | 'desc';

export function StationManagementPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [viewingStation, setViewingStation] = useState<Station | null>(null);
  const [deletingStation, setDeletingStation] = useState<Station | null>(null);
  
  const itemsPerPage = 10;
  const socket = useSocket();
  const { refreshStations } = useStation();

  /**
   * Load stations from API
   */
  const loadStations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStations();
      setStations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stations');
      console.error('Error loading stations:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initialize page
   */
  useEffect(() => {
    loadStations();
  }, []);

  /**
   * Listen for real-time updates
   */
  useEffect(() => {
    if (!socket) return;

    const handleStationCreated = () => {
      loadStations();
      refreshStations();
    };

    const handleStationUpdated = () => {
      loadStations();
      refreshStations();
    };

    const handleStationDeleted = () => {
      loadStations();
      refreshStations();
    };

    socket.on('station-created', handleStationCreated);
    socket.on('station-updated', handleStationUpdated);
    socket.on('station-deleted', handleStationDeleted);

    return () => {
      socket.off('station-created', handleStationCreated);
      socket.off('station-updated', handleStationUpdated);
      socket.off('station-deleted', handleStationDeleted);
    };
  }, [socket, refreshStations]);

  /**
   * Filter and sort stations
   */
  const filteredAndSortedStations = useMemo(() => {
    let result = [...stations];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(station =>
        station.name.toLowerCase().includes(query) ||
        station.brigadeName.toLowerCase().includes(query) ||
        station.hierarchy.district.toLowerCase().includes(query) ||
        station.hierarchy.area.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'brigade':
          aValue = a.brigadeName;
          bValue = b.brigadeName;
          break;
        case 'district':
          aValue = a.hierarchy.district;
          bValue = b.hierarchy.district;
          break;
        case 'area':
          aValue = a.hierarchy.area;
          bValue = b.hierarchy.area;
          break;
      }

      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [stations, searchQuery, sortField, sortDirection]);

  /**
   * Paginate stations
   */
  const paginatedStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedStations.slice(startIndex, endIndex);
  }, [filteredAndSortedStations, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedStations.length / itemsPerPage);

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /**
   * Handle station creation
   */
  const handleStationCreated = async () => {
    setIsCreateModalOpen(false);
    await loadStations();
    refreshStations();
  };

  /**
   * Handle station update
   */
  const handleStationUpdated = async () => {
    setEditingStation(null);
    await loadStations();
    refreshStations();
  };

  /**
   * Handle station deletion
   */
  const handleStationDeleted = async () => {
    setDeletingStation(null);
    await loadStations();
    refreshStations();
  };

  /**
   * Check if station is demo station
   */
  const isDemoStation = (station: Station) => station.id === DEMO_STATION_ID;

  if (loading) {
    return (
      <div className="station-management-page">
        <header className="page-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Station Management</h1>
        </header>
        <div className="loading-message">Loading stations...</div>
      </div>
    );
  }

  return (
    <div className="station-management-page">
      <header className="page-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Station Management</h1>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadStations} className="retry-button">Retry</button>
        </div>
      )}

      <div className="page-content" id="main-content" tabIndex={-1}>
        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search stations..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="search-input"
              aria-label="Search stations"
            />
          </div>
          <div className="toolbar-actions">
            <Link to="/admin/brigade-access" className="secondary-button">
              🔑 Brigade Access
            </Link>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="primary-button"
              aria-label="Create new station"
            >
              + Create Station
            </button>
          </div>
        </div>

        {/* Station List */}
        {filteredAndSortedStations.length === 0 ? (
          <div className="empty-state">
            <p>No stations found</p>
            {searchQuery && <p className="hint">Try a different search term</p>}
          </div>
        ) : (
          <>
            <div className="station-table-container">
              <table className="station-table">
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('name')}
                      className={`sortable ${sortField === 'name' ? 'sorted' : ''}`}
                    >
                      Station Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('brigade')}
                      className={`sortable ${sortField === 'brigade' ? 'sorted' : ''}`}
                    >
                      Brigade {sortField === 'brigade' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('district')}
                      className={`sortable ${sortField === 'district' ? 'sorted' : ''}`}
                    >
                      District {sortField === 'district' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('area')}
                      className={`sortable ${sortField === 'area' ? 'sorted' : ''}`}
                    >
                      Area {sortField === 'area' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStations.map((station) => (
                    <tr key={station.id} className={!station.isActive ? 'inactive' : ''}>
                      <td>
                        <div className="station-name-cell">
                          {station.name}
                          {isDemoStation(station) && (
                            <span className="demo-badge" title="Demo Station">DEMO</span>
                          )}
                        </div>
                      </td>
                      <td>{station.brigadeName}</td>
                      <td>{station.hierarchy.district}</td>
                      <td>{station.hierarchy.area}</td>
                      <td>
                        <span className={`status-badge ${station.isActive ? 'active' : 'inactive'}`}>
                          {station.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => setViewingStation(station)}
                            className="action-button view-button"
                            aria-label={`View ${station.name}`}
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => setEditingStation(station)}
                            className="action-button edit-button"
                            aria-label={`Edit ${station.name}`}
                            title="Edit Station"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setDeletingStation(station)}
                            className="action-button delete-button"
                            aria-label={`Delete ${station.name}`}
                            title="Delete Station"
                            disabled={!station.isActive}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="pagination-button"
                  aria-label="Previous page"
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages} ({filteredAndSortedStations.length} stations)
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateStationModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleStationCreated}
        />
      )}

      {editingStation && (
        <EditStationModal
          station={editingStation}
          onClose={() => setEditingStation(null)}
          onUpdated={handleStationUpdated}
        />
      )}

      {viewingStation && (
        <StationDetailsView
          station={viewingStation}
          onClose={() => setViewingStation(null)}
          onEdit={() => {
            setEditingStation(viewingStation);
            setViewingStation(null);
          }}
        />
      )}

      {deletingStation && (
        <DeleteConfirmationDialog
          station={deletingStation}
          onClose={() => setDeletingStation(null)}
          onDeleted={handleStationDeleted}
        />
      )}
    </div>
  );
}
