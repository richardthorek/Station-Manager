/**
 * Brigade Access Admin Page - Modernized
 * 
 * Master admin utility for viewing and sharing station sign-in URLs with brigade tokens.
 * Provides:
 * - Modern dashboard with statistics
 * - Improved token card design
 * - Enhanced token management features
 * - Better visual hierarchy
 * - Compact layout for admin efficiency
 */

import { useState, useEffect } from 'react';
import { RefreshCw, TriangleAlert, Building2, Check, KeyRound, Moon, Sun } from 'lucide-react';
import { api } from '../../../services/api';
import { useSocket } from '../../../hooks/useSocket';
import { useTheme } from '../../../hooks/useTheme';
import { PageTransition } from '../../../components/PageTransition';
import { PageHeader } from '../../../components/PageHeader';
import { AdminNav } from '../../../components/AdminNav';
import { ConfirmationDialog } from '../../../components/ConfirmationDialog';
import { useToast } from '../../../hooks/useToast';
import type { Station, Device } from '../../../types';
import { StationTokenCard } from './StationTokenCard';
import './BrigadeAccessPage.css';

interface TokenInfo {
  token: string;
  brigadeId: string;
  stationId: string;
  description?: string;
  createdAt: string;
  expiresAt?: string;
  kioskUrl: string;
}

interface StationWithToken extends Station {
  tokens: TokenInfo[];
}

export function BrigadeAccessPage() {
  const { theme, toggleTheme } = useTheme();
  const [stations, setStations] = useState<Station[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [enrollingFor, setEnrollingFor] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [confirmingRevokeToken, setConfirmingRevokeToken] = useState<TokenInfo | null>(null);

  const socket = useSocket();
  const { showError } = useToast();

  /**
   * Load stations, tokens, and devices
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load stations, tokens, and devices in parallel. Devices is best-effort:
      // the caller may be a legacy admin without an organizationId, in which
      // case the API still returns an empty list rather than an error.
      const [stationsData, tokensData, devicesData] = await Promise.all([
        api.getStations(),
        api.getAllBrigadeAccessTokens(),
        api.getDevices().catch(() => ({ devices: [], count: 0 })),
      ]);

      setStations(stationsData);
      setTokens(tokensData.tokens);
      setDevices(devicesData.devices);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('Error loading brigade access data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Listen for real-time updates
   */
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      loadData();
    };

    socket.on('station-created', handleUpdate);
    socket.on('station-updated', handleUpdate);
    socket.on('station-deleted', handleUpdate);

    return () => {
      socket.off('station-created', handleUpdate);
      socket.off('station-updated', handleUpdate);
      socket.off('station-deleted', handleUpdate);
    };
  }, [socket]);

  /**
   * Generate a new token for a station
   */
  const handleGenerateToken = async (station: Station) => {
    try {
      setGeneratingFor(station.id);
      
      const result = await api.generateBrigadeAccessToken({
        brigadeId: station.brigadeId || station.id,
        stationId: station.id,
        description: `Kiosk access for ${station.name}`,
      });
      
      // Add new token to list
      setTokens([...tokens, {
        token: result.token,
        brigadeId: result.brigadeId,
        stationId: result.stationId,
        description: result.description,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt,
        kioskUrl: result.kioskUrl,
      }]);
      
    } catch (err) {
      console.error('Error generating token:', err);
      alert('Failed to generate token: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setGeneratingFor(null);
    }
  };

  /**
   * Revoke a token — opens the confirmation dialog (Q42, found 2026-07-17:
   * this used to be a native confirm()/alert()).
   */
  const handleRevokeToken = (token: string) => {
    const tokenInfo = tokens.find((t) => t.token === token);
    if (tokenInfo) setConfirmingRevokeToken(tokenInfo);
  };

  /** Actually revokes the token being confirmed. */
  const confirmRevokeToken = async () => {
    if (!confirmingRevokeToken) return;
    const token = confirmingRevokeToken.token;
    try {
      await api.revokeBrigadeAccessToken(token);
      setTokens(tokens.filter(t => t.token !== token));
      setConfirmingRevokeToken(null);
    } catch (err) {
      console.error('Error revoking token:', err);
      showError('Failed to revoke token: ' + (err instanceof Error ? err.message : 'Unknown error'));
      throw err; // keeps the confirmation dialog open with the error shown
    }
  };

  /**
   * Enroll a new device for a station
   */
  const handleEnrollDevice = async (stationId: string, name: string, type: Device['type']) => {
    try {
      setEnrollingFor(stationId);
      const result = await api.createDevice({ stationId, type, name });
      setDevices([...devices, result.device]);
    } catch (err) {
      console.error('Error enrolling device:', err);
      alert('Failed to enroll device: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setEnrollingFor(null);
    }
  };

  /**
   * Rename a device
   */
  const handleRenameDevice = async (id: string, name: string) => {
    try {
      const updated = await api.updateDevice(id, { name });
      setDevices(devices.map(d => (d.id === id ? updated : d)));
    } catch (err) {
      console.error('Error renaming device:', err);
      alert('Failed to rename device: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  /**
   * Revoke or reactivate a device
   */
  const handleSetDeviceStatus = async (id: string, status: Device['status']) => {
    if (status === 'revoked' && !confirm('Revoke this device? Its kiosk URL will stop working immediately.')) {
      return;
    }
    try {
      const updated = await api.updateDevice(id, { status });
      setDevices(devices.map(d => (d.id === id ? updated : d)));
    } catch (err) {
      console.error('Error updating device status:', err);
      alert('Failed to update device: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  /**
   * Remove a device
   */
  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Remove this device? This cannot be undone.')) {
      return;
    }
    try {
      await api.deleteDevice(id);
      setDevices(devices.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting device:', err);
      alert('Failed to remove device: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  /**
   * Combine stations with their tokens
   */
  const stationsWithTokens: StationWithToken[] = stations.map(station => ({
    ...station,
    tokens: tokens.filter(t => t.stationId === station.id),
  }));

  /**
   * Filter stations based on search query
   */
  const filteredStations = stationsWithTokens.filter(station => {
    const query = searchQuery.toLowerCase();
    return (
      station.name.toLowerCase().includes(query) ||
      station.brigadeName?.toLowerCase().includes(query) ||
      station.hierarchy?.brigade?.toLowerCase().includes(query) ||
      station.hierarchy?.district?.toLowerCase().includes(query)
    );
  });

  /**
   * Statistics
   */
  const stats = {
    totalStations: stations.length,
    stationsWithTokens: stationsWithTokens.filter(s => s.tokens.length > 0).length,
    stationsWithoutTokens: stationsWithTokens.filter(s => s.tokens.length === 0).length,
    totalTokens: tokens.length,
  };

  return (
    <PageTransition variant="slideFromBottom">
      <div className="brigade-access-page">
      <AdminNav />
      <PageHeader
        title="Crew Access Management"
        backTo="/"
        backLabel="Home"
        subtitle={`Manage station sign-in URLs and crew access tokens for kiosk mode. Updated ${lastRefresh.toLocaleTimeString()}.`}
        actions={[{
          key: 'refresh',
          label: 'Refresh',
          icon: <RefreshCw size={20} strokeWidth={2} aria-hidden />,
          onClick: loadData,
        }, {
          key: 'theme',
          label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
          icon: theme === 'light' ? <Moon size={20} strokeWidth={2} aria-hidden /> : <Sun size={20} strokeWidth={2} aria-hidden />,
          onClick: toggleTheme,
        }]}
      />

      <main className="page-content" id="main-content" tabIndex={-1}>
        {error && (
          <div className="error-message">
            <p><TriangleAlert size={16} strokeWidth={2} aria-hidden /> {error}</p>
            <button onClick={loadData} className="retry-button">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading stations and tokens...</p>
          </div>
        ) : (
          <>
            {/* Dashboard Statistics */}
            <div className="dashboard-stats">
              <div className="stat-card gradient-red">
                <div className="stat-icon"><Building2 size={24} strokeWidth={2} aria-hidden /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalStations}</div>
                  <div className="stat-label">Total Stations</div>
                </div>
              </div>
              
              <div className="stat-card gradient-green">
                <div className="stat-icon"><Check size={24} strokeWidth={2} aria-hidden /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.stationsWithTokens}</div>
                  <div className="stat-label">With Tokens</div>
                </div>
              </div>
              
              <div className="stat-card gradient-amber">
                <div className="stat-icon"><TriangleAlert size={24} strokeWidth={2} aria-hidden /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.stationsWithoutTokens}</div>
                  <div className="stat-label">Need Tokens</div>
                </div>
              </div>
              
              <div className="stat-card gradient-blue">
                <div className="stat-icon"><KeyRound size={24} strokeWidth={2} aria-hidden /></div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalTokens}</div>
                  <div className="stat-label">Active Tokens</div>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar-compact">
              <input
                type="text"
                className="search-input"
                placeholder="Search stations by name, brigade / unit, or district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Station List */}
            {filteredStations.length === 0 ? (
              <div className="empty-state">
                <p>No stations found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="stations-grid">
                {filteredStations.map(station => (
                  <StationTokenCard
                    key={station.id}
                    station={station}
                    tokens={station.tokens}
                    onGenerateToken={() => handleGenerateToken(station)}
                    onRevokeToken={handleRevokeToken}
                    isGenerating={generatingFor === station.id}
                    devices={devices.filter(d => d.stationId === station.id)}
                    onEnrollDevice={(name, type) => handleEnrollDevice(station.id, name, type)}
                    onRenameDevice={handleRenameDevice}
                    onSetDeviceStatus={handleSetDeviceStatus}
                    onDeleteDevice={handleDeleteDevice}
                    isEnrolling={enrollingFor === station.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>

    {confirmingRevokeToken && (
      <ConfirmationDialog
        title="Revoke Token"
        message="Are you sure you want to revoke this token?"
        description={
          confirmingRevokeToken.description
            ? `"${confirmingRevokeToken.description}" — the kiosk URL will no longer work.`
            : 'The kiosk URL will no longer work.'
        }
        confirmLabel="Revoke"
        isDangerous
        onConfirm={confirmRevokeToken}
        onCancel={() => setConfirmingRevokeToken(null)}
      />
    )}
    </PageTransition>
  );
}
