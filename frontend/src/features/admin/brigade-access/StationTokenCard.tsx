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
import { QRCodeSVG } from 'qrcode.react';
import type { Station, Device } from '../../../types';

interface TokenInfo {
  token: string;
  brigadeId: string;
  stationId: string;
  description?: string;
  createdAt: string;
  expiresAt?: string;
  kioskUrl: string;
}

const DEVICE_TYPES: Device['type'][] = ['kiosk', 'tablet', 'phone', 'wearable'];
const DEVICE_TYPE_LABELS: Record<Device['type'], string> = {
  kiosk: '🖥️ Kiosk',
  tablet: '📱 Tablet',
  phone: '📞 Phone',
  wearable: '⌚ Wearable',
};

interface StationTokenCardProps {
  station: Station;
  tokens: TokenInfo[];
  onGenerateToken: () => void;
  onRevokeToken: (token: string) => void;
  isGenerating: boolean;
  devices: Device[];
  onEnrollDevice: (name: string, type: Device['type']) => void;
  onRenameDevice: (id: string, name: string) => void;
  onSetDeviceStatus: (id: string, status: Device['status']) => void;
  onDeleteDevice: (id: string) => void;
  isEnrolling: boolean;
}

export function StationTokenCard({
  station,
  tokens,
  onGenerateToken,
  onRevokeToken,
  isGenerating,
  devices,
  onEnrollDevice,
  onRenameDevice,
  onSetDeviceStatus,
  onDeleteDevice,
  isEnrolling,
}: StationTokenCardProps) {
  const [showQR, setShowQR] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showDeviceQR, setShowDeviceQR] = useState<string | null>(null);
  const [renamingDevice, setRenamingDevice] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<Device['type']>('kiosk');

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

  /** Devices don't carry a kioskUrl from GET — build it the same way the server does on create. */
  const deviceKioskUrl = (device: Device) => `${window.location.origin}/signin?brigade=${device.token}`;

  const handleEnroll = () => {
    if (!newDeviceName.trim()) return;
    onEnrollDevice(newDeviceName.trim(), newDeviceType);
    setNewDeviceName('');
  };

  const startRename = (device: Device) => {
    setRenamingDevice(device.id);
    setRenameValue(device.name);
  };

  const submitRename = (id: string) => {
    if (renameValue.trim()) onRenameDevice(id, renameValue.trim());
    setRenamingDevice(null);
  };

  return (
    <div className={`station-token-card ${!hasTokens ? 'no-token' : ''}`}>
      {/* Station Header */}
      <div className="station-header">
        <h3 className="station-name">{station.name}</h3>
        <div className="station-meta">
          {station.brigadeName && (
            <span className="station-brigade">👥 {station.brigadeName}</span>
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
                      <QRCodeSVG
                        value={token.kioskUrl}
                        size={256}
                        level="M"
                        marginSize={4}
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

      {/* Devices Section (AC-5) */}
      <div className="devices-section">
        <h4 className="devices-section-title">Devices</h4>

        {devices.length === 0 ? (
          <p className="no-devices-message">No devices enrolled for this station.</p>
        ) : (
          devices.map((device) => (
            <div key={device.id} className={`token-item device-item ${device.status === 'revoked' ? 'device-revoked' : ''}`}>
              <div className="token-info">
                <div className="token-label">
                  {renamingDevice === device.id ? (
                    <span className="device-rename-row">
                      <input
                        type="text"
                        className="device-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitRename(device.id)}
                      />
                      <button className="text-button" onClick={() => submitRename(device.id)}>Save</button>
                      <button className="text-button" onClick={() => setRenamingDevice(null)}>Cancel</button>
                    </span>
                  ) : (
                    <>
                      {device.name}{' '}
                      <span className="device-type-badge">{DEVICE_TYPE_LABELS[device.type]}</span>
                      {device.status === 'revoked' && <span className="device-status-badge">Revoked</span>}
                    </>
                  )}
                </div>
                <div className="token-details">
                  <span className="token-created">Enrolled: {formatDate(device.createdAt)}</span>
                  {device.lastSeenAt && (
                    <span className="token-expires">Last seen: {formatDate(device.lastSeenAt)}</span>
                  )}
                </div>
              </div>

              {device.status === 'active' && (
                <div className="token-url-section">
                  <div className="token-url-label">Kiosk Sign-In URL:</div>
                  <div className="token-url-container">
                    <input
                      type="text"
                      className="token-url-input"
                      value={deviceKioskUrl(device)}
                      readOnly
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      className="copy-button"
                      onClick={() => handleCopyUrl(deviceKioskUrl(device), device.token)}
                      title="Copy URL to clipboard"
                    >
                      {copiedToken === device.token ? '✓ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="token-actions">
                {renamingDevice !== device.id && (
                  <button className="secondary-button" onClick={() => startRename(device)}>✏️ Rename</button>
                )}
                {device.status === 'active' && (
                  <button
                    className="secondary-button"
                    onClick={() => setShowDeviceQR(showDeviceQR === device.id ? null : device.id)}
                  >
                    {showDeviceQR === device.id ? 'Hide QR Code' : '📱 Show QR Code'}
                  </button>
                )}
                {device.status === 'active' ? (
                  <button className="danger-button" onClick={() => onSetDeviceStatus(device.id, 'revoked')} title="Revoke this device">
                    🚫 Revoke
                  </button>
                ) : (
                  <button className="secondary-button" onClick={() => onSetDeviceStatus(device.id, 'active')} title="Reactivate this device">
                    ✅ Reactivate
                  </button>
                )}
                <button className="danger-button" onClick={() => onDeleteDevice(device.id)} title="Remove this device">
                  🗑️ Remove
                </button>
              </div>

              {showDeviceQR === device.id && device.status === 'active' && (
                <div className="qr-code-section">
                  <div className="qr-code-container">
                    <QRCodeSVG value={deviceKioskUrl(device)} size={256} level="M" marginSize={4} />
                  </div>
                  <p className="qr-code-caption">Scan with mobile device to access sign-in page</p>
                </div>
              )}
            </div>
          ))
        )}

        <div className="enroll-device-section">
          <input
            type="text"
            className="device-name-input"
            placeholder="Device name (e.g. Main shed kiosk)"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEnroll()}
          />
          <select
            className="device-type-select"
            value={newDeviceType}
            onChange={(e) => setNewDeviceType(e.target.value as Device['type'])}
          >
            {DEVICE_TYPES.map((type) => (
              <option key={type} value={type}>{DEVICE_TYPE_LABELS[type]}</option>
            ))}
          </select>
          <button
            className="primary-button"
            onClick={handleEnroll}
            disabled={isEnrolling || !newDeviceName.trim()}
          >
            {isEnrolling ? 'Enrolling...' : '+ Enroll Device'}
          </button>
        </div>
      </div>
    </div>
  );
}
