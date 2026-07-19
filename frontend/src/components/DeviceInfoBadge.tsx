/**
 * DeviceInfoBadge — shown instead of an account menu when the current
 * session is a locked kiosk/tablet device (a brigade access token), not a
 * signed-in admin user. A device has no "profile" of its own — no passkeys,
 * no org membership to switch — so rather than a personal account menu it
 * surfaces what a device operator actually needs to know: which device this
 * is, and when its access expires.
 */

import { useEffect, useRef, useState } from 'react';
import { Tablet, ChevronDown } from 'lucide-react';
import { isKioskMode, validateKioskToken } from '../utils/kioskMode';
import './DeviceInfoBadge.css';

interface DeviceInfo {
  name?: string;
  type?: string;
  stationName?: string;
  expiresAt?: string;
}

function formatExpiry(expiresAt?: string): string {
  if (!expiresAt) return 'No expiry';
  const date = new Date(expiresAt);
  const isPast = date.getTime() < Date.now();
  const formatted = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return isPast ? `Expired ${formatted}` : `Expires ${formatted}`;
}

export function DeviceInfoBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isKioskMode()) return;
    validateKioskToken()
      .then((result) => {
        if (result.valid) {
          setDevice({ name: result.name, type: result.type, stationName: result.stationName, expiresAt: result.expiresAt });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!isKioskMode()) return null;

  const label = device?.name || 'This device';

  return (
    <div className="device-info-badge" ref={containerRef}>
      <button
        type="button"
        className="device-info-badge__trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Device info for ${label}`}
      >
        <Tablet size={16} strokeWidth={2} aria-hidden="true" />
        <span className="device-info-badge__label">{label}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="device-info-badge__dropdown" role="menu">
          <dl className="device-info-badge__details">
            <dt>Device</dt>
            <dd>{device?.name || 'Unnamed device'}{device?.type ? ` (${device.type})` : ''}</dd>
            {device?.stationName && (
              <>
                <dt>Station</dt>
                <dd>{device.stationName}</dd>
              </>
            )}
            <dt>Access</dt>
            <dd>{formatExpiry(device?.expiresAt)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
