/**
 * Export Data Component
 * 
 * Provides export buttons for downloading data as CSV files
 * Supports date range filtering for time-based exports
 */

import { useState } from 'react';
import { api } from '../services/api';
import { downloadCSV, getTodayFormatted } from '../utils/csvUtils';
import './ExportData.css';

export function ExportData() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExportMembers = async () => {
    try {
      setLoading('members');
      setError(null);
      setSuccess(null);
      
      const blob = await api.exportMembers();
      const filename = `members-${getTodayFormatted()}.csv`;
      downloadCSV(blob, filename);
      
      setSuccess('Members exported successfully!');
    } catch (err) {
      setError('Failed to export members');
      console.error('Export error:', err);
    } finally {
      setLoading(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleExportCheckIns = async () => {
    try {
      setLoading('checkins');
      setError(null);
      setSuccess(null);
      
      const blob = await api.exportCheckIns(startDate || undefined, endDate || undefined);
      const dateRange = startDate || endDate 
        ? `-${startDate || 'all'}-to-${endDate || 'all'}`
        : '';
      const filename = `checkins${dateRange}-${getTodayFormatted()}.csv`;
      downloadCSV(blob, filename);
      
      setSuccess('Check-ins exported successfully!');
    } catch (err) {
      setError('Failed to export check-ins');
      console.error('Export error:', err);
    } finally {
      setLoading(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleExportEvents = async () => {
    try {
      setLoading('events');
      setError(null);
      setSuccess(null);
      
      const blob = await api.exportEvents(startDate || undefined, endDate || undefined);
      const dateRange = startDate || endDate 
        ? `-${startDate || 'all'}-to-${endDate || 'all'}`
        : '';
      const filename = `events${dateRange}-${getTodayFormatted()}.csv`;
      downloadCSV(blob, filename);
      
      setSuccess('Events exported successfully!');
    } catch (err) {
      setError('Failed to export events');
      console.error('Export error:', err);
    } finally {
      setLoading(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleExportTruckChecks = async () => {
    try {
      setLoading('truckcheck');
      setError(null);
      setSuccess(null);
      
      const blob = await api.exportTruckCheckResults(startDate || undefined, endDate || undefined);
      const dateRange = startDate || endDate 
        ? `-${startDate || 'all'}-to-${endDate || 'all'}`
        : '';
      const filename = `truckcheck-results${dateRange}-${getTodayFormatted()}.csv`;
      downloadCSV(blob, filename);
      
      setSuccess('Truck checks exported successfully!');
    } catch (err) {
      setError('Failed to export truck checks');
      console.error('Export error:', err);
    } finally {
      setLoading(null);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <div className="export-data">
      <h3>📊 Export Data</h3>
      
      {error && <div className="export-error">{error}</div>}
      {success && <div className="export-success">{success}</div>}
      
      <div className="export-section">
        <div className="export-group">
          <h4>Members</h4>
          <button
            className="btn-export"
            onClick={handleExportMembers}
            disabled={loading !== null}
          >
            {loading === 'members' ? 'Exporting...' : '📥 Export Members'}
          </button>
        </div>

        <div className="export-group">
          <h4>Date Range Filter</h4>
          <div className="date-range">
            <div className="date-input">
              <label>Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading !== null}
              />
            </div>
            <div className="date-input">
              <label>End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading !== null}
              />
            </div>
          </div>
          <button
            className="btn-clear-dates"
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            disabled={loading !== null}
          >
            Clear Dates
          </button>
        </div>

        <div className="export-group">
          <h4>Check-Ins</h4>
          <button
            className="btn-export"
            onClick={handleExportCheckIns}
            disabled={loading !== null}
          >
            {loading === 'checkins' ? 'Exporting...' : '📥 Export Check-Ins'}
          </button>
          <p className="export-hint">Uses date range filter above</p>
        </div>

        <div className="export-group">
          <h4>Events</h4>
          <button
            className="btn-export"
            onClick={handleExportEvents}
            disabled={loading !== null}
          >
            {loading === 'events' ? 'Exporting...' : '📥 Export Events'}
          </button>
          <p className="export-hint">Uses date range filter above</p>
        </div>

        <div className="export-group">
          <h4>Truck Checks</h4>
          <button
            className="btn-export"
            onClick={handleExportTruckChecks}
            disabled={loading !== null}
          >
            {loading === 'truckcheck' ? 'Exporting...' : '📥 Export Truck Checks'}
          </button>
          <p className="export-hint">Uses date range filter above</p>
        </div>
      </div>
    </div>
  );
}
