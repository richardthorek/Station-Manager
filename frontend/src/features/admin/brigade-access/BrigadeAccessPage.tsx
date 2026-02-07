/**
 * Brigade Access Admin Page
 * 
 * Master admin utility for viewing and sharing station sign-in URLs with brigade tokens.
 * Provides:
 * - List of all stations with their active access tokens
 * - Easy copy-to-clipboard functionality for kiosk URLs
 * - QR code generation for physical distribution
 * - Token generation for stations without tokens
 * - Token management (revoke, regenerate)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api';
import { useSocket } from '../../../hooks/useSocket';
import type { Station } from '../../../types';
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
  const [stations, setStations] = useState<Station[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  
  const socket = useSocket();

  /**
   * Load stations and tokens
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load stations and tokens in parallel
      const [stationsData, tokensData] = await Promise.all([
        api.getStations(),
        api.getAllBrigadeAccessTokens(),
      ]);
      
      setStations(stationsData);
      setTokens(tokensData.tokens);
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
   * Revoke a token
   */
  const handleRevokeToken = async (token: string) => {
    if (!confirm('Are you sure you want to revoke this token? The kiosk URL will no longer work.')) {
      return;
    }
    
    try {
      await api.revokeBrigadeAccessToken(token);
      
      // Remove token from list
      setTokens(tokens.filter(t => t.token !== token));
    } catch (err) {
      console.error('Error revoking token:', err);
      alert('Failed to revoke token: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
    <div className="brigade-access-page">
      <header className="brigade-access-header">
        <div className="header-nav">
          <Link to="/" className="back-link">← Back to Home</Link>
          <Link to="/admin/stations" className="back-link">← Station Management</Link>
        </div>
        <h1>Brigade Access Management</h1>
        <p className="page-description">
          Manage station sign-in URLs and brigade access tokens for kiosk mode.
          Share these URLs with brigade members to enable locked sign-in access.
        </p>
      </header>

      <main id="main-content" tabIndex={-1}>
        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
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
            {/* Statistics Cards */}
            <section className="stats-section">
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalStations}</div>
                <div className="stat-label">Total Stations</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">✓</div>
              <div className="stat-content">
                <div className="stat-value">{stats.stationsWithTokens}</div>
                <div className="stat-label">With Tokens</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">⚠️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.stationsWithoutTokens}</div>
                <div className="stat-label">Without Tokens</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">🔑</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalTokens}</div>
                <div className="stat-label">Active Tokens</div>
              </div>
            </div>
          </section>

          {/* Search */}
          <section className="search-section">
            <input
              type="text"
              className="search-input"
              placeholder="Search stations by name, brigade, or district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </section>

          {/* Station List */}
          <section className="stations-section">
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
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
      </main>
    </div>
  );
}
