/**
 * Station Details View
 * 
 * Modal for viewing full station information including:
 * - Basic station details
 * - Organizational hierarchy
 * - Location information
 * - Contact information
 * - Statistics (members, events, check-ins)
 */

import { useState, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { api } from '../../../services/api';
import type { Station } from '../../../types';
import { DEMO_STATION_ID } from '../../../contexts/StationContext';
import { DemoResetButton } from './DemoResetButton';
import './StationDetailsView.css';

interface StationDetailsViewProps {
  station: Station;
  onClose: () => void;
  onEdit: () => void;
}

interface StationStatistics {
  memberCount: number;
  eventCount: number;
  checkInCount: number;
  activeCheckInCount: number;
}

export function StationDetailsView({ station, onClose, onEdit }: StationDetailsViewProps) {
  const [statistics, setStatistics] = useState<StationStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const isDemoStation = station.id === DEMO_STATION_ID;

  /**
   * Load station statistics
   */
  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoadingStats(true);
        const stats = await api.getStationStatistics();
        setStatistics(stats);
      } catch (err) {
        console.error('Error loading statistics:', err);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStatistics();
  }, []);

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close station details"
    >
      <div className="modal-content station-details-modal">
        <div className="modal-header">
          <div>
            <h2>Station Details</h2>
            {isDemoStation && (
              <span className="demo-badge-large">DEMO STATION</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Basic Information */}
          <div className="details-section">
            <h3>Basic Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Station Name</span>
                <span className="detail-value">{station.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Brigade Name</span>
                <span className="detail-value">{station.brigadeName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Brigade ID</span>
                <span className="detail-value">{station.brigadeId}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className={`status-badge ${station.isActive ? 'active' : 'inactive'}`}>
                  {station.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Organizational Hierarchy */}
          <div className="details-section">
            <h3>Organizational Hierarchy</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Jurisdiction</span>
                <span className="detail-value">{station.hierarchy.jurisdiction}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Area</span>
                <span className="detail-value">{station.hierarchy.area}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">District</span>
                <span className="detail-value">{station.hierarchy.district}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Brigade</span>
                <span className="detail-value">{station.hierarchy.brigade}</span>
              </div>
            </div>
          </div>

          {/* Location */}
          {(station.location?.address || station.location?.latitude) && (
            <div className="details-section">
              <h3>Location</h3>
              <div className="details-grid">
                {station.location.address && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{station.location.address}</span>
                  </div>
                )}
                {station.location.latitude && (
                  <div className="detail-item">
                    <span className="detail-label">Latitude</span>
                    <span className="detail-value">{station.location.latitude}</span>
                  </div>
                )}
                {station.location.longitude && (
                  <div className="detail-item">
                    <span className="detail-label">Longitude</span>
                    <span className="detail-value">{station.location.longitude}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact Information */}
          {(station.contactInfo?.phone || station.contactInfo?.email) && (
            <div className="details-section">
              <h3>Contact Information</h3>
              <div className="details-grid">
                {station.contactInfo.phone && (
                  <div className="detail-item">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{station.contactInfo.phone}</span>
                  </div>
                )}
                {station.contactInfo.email && (
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">
                      <a href={`mailto:${station.contactInfo.email}`} className="email-link">
                        {station.contactInfo.email}
                      </a>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="details-section">
            <h3>Statistics</h3>
            {loadingStats ? (
              <div className="stats-loading">Loading statistics...</div>
            ) : statistics ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{statistics.memberCount}</div>
                  <div className="stat-label">Members</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{statistics.eventCount}</div>
                  <div className="stat-label">Events</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{statistics.checkInCount}</div>
                  <div className="stat-label">Total Check-ins</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{statistics.activeCheckInCount}</div>
                  <div className="stat-label">Active Now</div>
                </div>
              </div>
            ) : (
              <div className="stats-error">Failed to load statistics</div>
            )}
          </div>

          {/* Demo Station Reset Control */}
          {isDemoStation && (
            <div className="details-section">
              <h3>Demo Controls</h3>
              <div className="demo-controls-info">
                <p>
                  Reset the demo station to restore fresh sample data. 
                  This will delete all current demo data and recreate it with new realistic samples.
                </p>
              </div>
              <DemoResetButton onResetComplete={onClose} />
            </div>
          )}

          {/* Timestamps */}
          <div className="details-section">
            <h3>Timestamps</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value">
                  {new Date(station.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Last Updated</span>
                <span className="detail-value">
                  {new Date(station.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="details-actions">
            <button
              onClick={onClose}
              className="secondary-button"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="primary-button"
            >
              Edit Station
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
