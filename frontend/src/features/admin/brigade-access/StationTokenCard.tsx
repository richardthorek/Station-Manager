/**
 * Station Token Card Component
 * 
 * Displays a station with its access tokens and provides actions:
 * - View station details
 * - Copy kiosk URL to clipboard
 * - Generate QR code
 * - Generate new token
 * - Revoke token
 */

import { useState } from 'react';
import QRCode from 'qrcode.react';
import type { Station } from '../../../types';

interface TokenInfo {
  token: string;
  brigadeId: string;
  stationId: string;
  description?: string;
  createdAt: string;
  expiresAt?: string;
  kioskUrl: string;
}

interface StationTokenCardProps {
  station: Station;
  tokens: TokenInfo[];
  onGenerateToken: () => void;
  onRevokeToken: (token: string) => void;
  isGenerating: boolean;
}

export function StationTokenCard({
  station,
  tokens,
  onGenerateToken,
  onRevokeToken,
  isGenerating,
}: StationTokenCardProps) {
  const [showQR, setShowQR] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  /**
   * Copy URL to clipboard
   */
  const handleCopyUrl = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL to clipboard');
    }
  };

  /**
   * Toggle QR code display
   */
  const handleToggleQR = (token: string) => {
    setShowQR(showQR === token ? null : token);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const hasTokens = tokens.length > 0;
  const primaryToken = hasTokens ? tokens[0] : null;

  return (
    <div className={`station-token-card ${!hasTokens ? 'no-token' : ''}`}>
      {/* Station Header */}
      <div className="station-header">
        <h3 className="station-name">{station.name}</h3>
        <div className="station-meta">
          {station.brigadeName && (
            <span className="station-brigade">🔥 {station.brigadeName}</span>
          )}
          {station.hierarchy?.district && (
            <span className="station-district">📍 {station.hierarchy.district}</span>
          )}
        </div>
      </div>

      {/* Tokens Section */}
      <div className="tokens-section">
        {!hasTokens ? (
          <div className="no-token-state">
            <p className="no-token-message">No active access token</p>
            <button
              className="primary-button"
              onClick={onGenerateToken}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : '+ Generate Token'}
            </button>
          </div>
        ) : (
          <>
            {tokens.map((token) => (
              <div key={token.token} className="token-item">
                {/* Token Info */}
                <div className="token-info">
                  <div className="token-label">
                    {token.description || 'Kiosk Access Token'}
                  </div>
                  <div className="token-details">
                    <span className="token-created">
                      Created: {formatDate(token.createdAt)}
                    </span>
                    {token.expiresAt && (
                      <span className="token-expires">
                        Expires: {formatDate(token.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Token URL */}
                <div className="token-url-section">
                  <div className="token-url-label">Kiosk Sign-In URL:</div>
                  <div className="token-url-container">
                    <input
                      type="text"
                      className="token-url-input"
                      value={token.kioskUrl}
                      readOnly
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      className="copy-button"
                      onClick={() => handleCopyUrl(token.kioskUrl, token.token)}
                      title="Copy URL to clipboard"
                    >
                      {copiedToken === token.token ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="token-actions">
                  <button
                    className="secondary-button"
                    onClick={() => handleToggleQR(token.token)}
                  >
                    {showQR === token.token ? 'Hide QR Code' : '📱 Show QR Code'}
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => onRevokeToken(token.token)}
                    title="Revoke this token"
                  >
                    🗑️ Revoke
                  </button>
                </div>

                {/* QR Code */}
                {showQR === token.token && (
                  <div className="qr-code-section">
                    <div className="qr-code-container">
                      <QRCode
                        value={token.kioskUrl}
                        size={256}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                    <p className="qr-code-caption">
                      Scan with mobile device to access sign-in page
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Generate Additional Token */}
            <div className="additional-token-section">
              <button
                className="text-button"
                onClick={onGenerateToken}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : '+ Generate Additional Token'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
