/**
 * Delete Confirmation Dialog
 * 
 * Confirmation dialog for station deletion with:
 * - Check for existing data (members, events, check-ins)
 * - Warning if station has data
 * - Soft delete only
 * - Focus trap for keyboard accessibility
 * - Escape key to close
 */

import { useState, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { api } from '../../../services/api';
import type { Station } from '../../../types';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
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
  const modalRef = useFocusTrap<HTMLDivElement>(true);

  /**
   * Handle Escape key to close dialog
   */
  useEffect(() => {
    const handleEscape = (event: Event) => {
      if ((event as globalThis.KeyboardEvent).key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDeleting, onClose]);

  /**
   * Load station data to check for dependencies
   */
  useEffect(() => {
    const loadStationData = async () => {
      try {
        setLoadingData(true);
        const stats = await api.getStationStatistics();
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
  }, []);

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

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close delete station dialog"
    >
      <div 
        ref={modalRef}
        className="modal-content delete-dialog" 
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <div className="modal-header">
          <h2 id="delete-dialog-title">Delete Station</h2>
          <button
            type="button"
            onClick={handleClose}
            className="close-button"
            aria-label="Close dialog"
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
