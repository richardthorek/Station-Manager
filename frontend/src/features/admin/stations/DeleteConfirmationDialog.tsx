/**
 * Delete Confirmation Dialog
 * 
 * Confirmation dialog for station deletion with:
 * - Check for existing data (members, events, check-ins)
 * - Warning if station has data
 * - Soft delete only
 */

import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Station } from '../../../types';
import './DeleteConfirmationDialog.css';

interface DeleteConfirmationDialogProps {
  station: Station;
  onClose: () => void;
  onDeleted: () => void;
}

interface StationData {
  memberCount: number;
  eventCount: number;
  checkInCount: number;
}

export function DeleteConfirmationDialog({ station, onClose, onDeleted }: DeleteConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stationData, setStationData] = useState<StationData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  /**
   * Load station data to check for dependencies
   */
  useEffect(() => {
    const loadStationData = async () => {
      try {
        setLoadingData(true);
        const stats = await api.getStationStatistics(station.id);
        setStationData({
          memberCount: stats.memberCount,
          eventCount: stats.eventCount,
          checkInCount: stats.checkInCount,
        });
      } catch (err) {
        console.error('Error loading station data:', err);
        setError('Failed to check station data');
      } finally {
        setLoadingData(false);
      }
    };

    loadStationData();
  }, [station.id]);

  /**
   * Check if station has data
   */
  const hasData = stationData && (
    stationData.memberCount > 0 ||
    stationData.eventCount > 0 ||
    stationData.checkInCount > 0
  );

  /**
   * Handle delete confirmation
   */
  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.deleteStation(station.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete station');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content delete-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Delete Station</h2>
          <button
            onClick={handleClose}
            className="close-button"
            aria-label="Close"
            disabled={isDeleting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loadingData ? (
            <div className="loading-message">
              Checking station data...
            </div>
          ) : hasData ? (
            <>
              <div className="warning-message">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                  <h3>Cannot Delete Station</h3>
                  <p>
                    This station has existing data and cannot be deleted. You can deactivate it instead.
                  </p>
                </div>
              </div>

              <div className="data-summary">
                <h4>Existing Data:</h4>
                <ul>
                  {stationData.memberCount > 0 && (
                    <li>{stationData.memberCount} member{stationData.memberCount !== 1 ? 's' : ''}</li>
                  )}
                  {stationData.eventCount > 0 && (
                    <li>{stationData.eventCount} event{stationData.eventCount !== 1 ? 's' : ''}</li>
                  )}
                  {stationData.checkInCount > 0 && (
                    <li>{stationData.checkInCount} check-in{stationData.checkInCount !== 1 ? 's' : ''}</li>
                  )}
                </ul>
              </div>

              <div className="dialog-actions">
                <button
                  onClick={handleClose}
                  className="primary-button"
                  disabled={isDeleting}
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="confirm-message">
                <p>
                  Are you sure you want to delete <strong>{station.name}</strong>?
                </p>
                <p className="warning-text">
                  This action will deactivate the station. It will no longer be visible in the station list.
                </p>
              </div>

              {error && (
                <div className="error-message">{error}</div>
              )}

              <div className="dialog-actions">
                <button
                  onClick={handleClose}
                  className="secondary-button"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="danger-button"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Station'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
