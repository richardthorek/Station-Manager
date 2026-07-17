import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
import { api } from '../../services/api';
import { isKioskMode, generateKioskUrl } from '../../utils/kioskMode';
import './TruckCheckShareModal.css';

interface TruckCheckShareModalProps {
  applianceId: string;
  stationId: string;
  brigadeId: string;
  onClose: () => void;
}

/**
 * AC-3 — lets whoever is already checking a vehicle hand a teammate a
 * no-login link to join the same check on their own device. Reuses the
 * existing brigade/device token system (the same credential a kiosk uses):
 * a device already in kiosk mode just reuses its own token; a signed-in
 * admin mints a fresh short-lived one scoped to this station. Either way the
 * link lands on `/truckcheck/check/:applianceId`, which auto-joins the
 * active run for that vehicle.
 */
export function TruckCheckShareModal({ applianceId, stationId, brigadeId, onClose }: TruckCheckShareModalProps) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const path = `/truckcheck/check/${applianceId}`;

    if (isKioskMode()) {
      setLink(`${window.location.origin}${generateKioskUrl(path)}`);
      return;
    }

    let cancelled = false;
    api.generateBrigadeAccessToken({
      brigadeId,
      stationId,
      description: `Truck check share — ${applianceId}`,
      expiresInDays: 1,
    }).then((result) => {
      if (cancelled) return;
      setLink(`${window.location.origin}${path}?brigade=${encodeURIComponent(result.token)}`);
    }).catch(() => {
      if (!cancelled) setError('Could not generate a share link. Try again.');
    });

    return () => {
      cancelled = true;
    };
  }, [applianceId, stationId, brigadeId]);

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="truck-check-share-modal-overlay"
      role="button"
      tabIndex={0}
      aria-label="Close share dialog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Escape' || e.key === 'Enter')) onClose(); }}
    >
      <div className="truck-check-share-modal" role="dialog" aria-modal="true" aria-label="Share this check">
        <div className="truck-check-share-modal__header">
          <h2>Share this check</h2>
          <button className="truck-check-share-modal__close" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {error && <p className="truck-check-share-modal__error">{error}</p>}
        {!error && !link && <p className="truck-check-share-modal__loading">Generating link…</p>}

        {link && (
          <>
            <p className="truck-check-share-modal__hint">
              Scan or send this link so a teammate can join this check on their own phone — no login needed.
            </p>
            <div className="truck-check-share-modal__qr">
              <QRCodeSVG value={link} size={220} level="M" marginSize={4} />
            </div>
            <div className="truck-check-share-modal__link-row">
              <input
                type="text"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                aria-label="Share link"
              />
              <button type="button" onClick={handleCopy} className="truck-check-share-modal__copy-btn">
                {copied ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={2} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
