/**
 * QR Scanner Modal Component
 *
 * Allows users to scan a QR code containing a device token.
 * Uses html5-qrcode for camera access and scanning.
 */

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { X, Smartphone } from 'lucide-react';
import './QRScannerModal.css';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (token: string, stationId: string) => void;
  isLoading?: boolean;
}

export function QRScannerModal({ isOpen, onClose, onScan, isLoading }: QRScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setScanned(false);

    const scanner = new Html5QrcodeScanner(
      'qr-scanner-container',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        disableFlip: false,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        setScanned(true);
        try {
          const [token, stationId] = decodedText.split('|');
          if (!token || !stationId) {
            setError('Invalid QR code format. Expected: token|stationId');
            return;
          }
          onScan(token.trim(), stationId.trim());
        } catch (err) {
          setError('Failed to parse QR code');
        }
      },
      (error) => {
        if (!error.includes('No QR code found')) {
          console.debug('QR scan error:', error);
        }
      }
    );

    return () => {
      scanner.clear().catch((err) => console.debug('Scanner cleanup error:', err));
      scannerRef.current = null;
    };
  }, [isOpen, onScan]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="qr-scanner-overlay" onClick={handleClose}>
      <div className="qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-scanner-header">
          <h2>Scan Device QR Code</h2>
          <button
            onClick={handleClose}
            className="qr-scanner-close"
            aria-label="Close scanner"
            disabled={isLoading}
          >
            <X size={24} strokeWidth={2} />
          </button>
        </div>

        <div className="qr-scanner-content">
          <div className="qr-scanner-icon" aria-hidden="true">
            <Smartphone size={48} strokeWidth={1.5} />
          </div>

          {error && (
            <div className="qr-scanner-error" role="alert">
              {error}
            </div>
          )}

          <div id="qr-scanner-container" className="qr-scanner-container" />

          {scanned && !isLoading && (
            <div className="qr-scanner-scanning">
              Processing...
            </div>
          )}

          {isLoading && (
            <div className="qr-scanner-loading">
              <div className="spinner" />
              <p>Activating device...</p>
            </div>
          )}

          <p className="qr-scanner-instructions">
            Hold your device's camera up to the QR code
          </p>
        </div>
      </div>
    </div>
  );
}
