/**
 * QR Scanner Modal Component
 *
 * Allows users to scan a QR code containing a device token.
 * Uses native camera with Html5Qrcode for minimal UI and better iPad experience.
 */

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Smartphone, RefreshCw } from 'lucide-react';
import './QRScannerModal.css';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (token: string, stationId: string) => void;
  isLoading?: boolean;
}

interface CameraDevice {
  id: string;
  label: string;
}

/**
 * Extract device token from QR code content (URL or token)
 */
function extractTokenFromQR(content: string): string | null {
  try {
    if (!content) return null;

    // If it looks like a URL, try to extract brigade parameter
    if (content.includes('http://') || content.includes('https://') || content.includes('?') || content.includes('&')) {
      try {
        const url = new URL(content, window.location.origin);
        const token = url.searchParams.get('brigade');
        if (token) return token;
      } catch {
        // If URL parsing fails, fall through to token check
      }
    }

    // If it's a UUID token directly
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(content.trim())) {
      return content.trim();
    }

    return null;
  } catch {
    return null;
  }
}

export function QRScannerModal({ isOpen, onClose, onScan, isLoading }: QRScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setScanned(false);

    const initScanner = async () => {
      try {
        // Get available cameras
        const devices = await Html5Qrcode.getCameras();

        if (devices.length === 0) {
          setError('No camera available on this device');
          return;
        }

        setCameras(devices as CameraDevice[]);
        cameraIdRef.current = devices[0].id;

        const scanner = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = scanner;

        const startScanning = async () => {
          if (!cameraIdRef.current) return;

          try {
            await scanner.start(
              cameraIdRef.current,
              {
                fps: 15,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1,
              },
              (decodedText) => {
                setScanned(true);
                try {
                  const token = extractTokenFromQR(decodedText);
                  if (!token) {
                    setError('Invalid QR code format. Expected a device sign-in URL or token');
                    return;
                  }
                  onScan(token, '');
                } catch {
                  setError('Failed to parse QR code');
                }
              },
              (errorMessage) => {
                // Ignore "No QR code detected" messages to reduce noise
                if (!errorMessage.includes('No QR code found') && !errorMessage.includes('NotFoundException')) {
                  console.debug('QR scan error:', errorMessage);
                }
              }
            );
          } catch (err) {
            console.error('Error starting scanner:', err);
            setError('Failed to start camera');
          }
        };

        await startScanning();
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setError('Failed to access camera');
      }
    };

    initScanner();

    return () => {
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
          } catch (err) {
            console.debug('Scanner cleanup error:', err);
          }
        }
        scannerRef.current = null;
      };
      cleanup();
    };
  }, [isOpen, onScan]);

  const handleSwitchCamera = async () => {
    if (cameras.length < 2) return;

    const newIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(newIndex);
    cameraIdRef.current = cameras[newIndex].id;

    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.start(
          cameras[newIndex].id,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            setScanned(true);
            try {
              const token = extractTokenFromQR(decodedText);
              if (!token) {
                setError('Invalid QR code format. Expected a device sign-in URL or token');
                return;
              }
              onScan(token, '');
            } catch {
              setError('Failed to parse QR code');
            }
          },
          (errorMessage) => {
            if (!errorMessage.includes('No QR code found') && !errorMessage.includes('NotFoundException')) {
              console.debug('QR scan error:', errorMessage);
            }
          }
        );
      } catch (err) {
        console.error('Error switching camera:', err);
        setError('Failed to switch camera');
      }
    }
  };

  const handleClose = () => {
    const cleanup = async () => {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          await scannerRef.current.clear();
        } catch (err) {
          console.debug('Scanner cleanup error:', err);
        }
      }
      scannerRef.current = null;
    };
    cleanup();
    onClose();
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  };

  return (
    <div
      className="qr-scanner-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="qr-scanner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
      >
        <div className="qr-scanner-header">
          <h2 id="qr-scanner-title">Scan Device QR Code</h2>
          <div className="qr-scanner-header-actions">
            {cameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="qr-scanner-switch-camera"
                aria-label="Switch camera"
                disabled={isLoading}
                title="Switch camera"
              >
                <RefreshCw size={20} strokeWidth={2} />
              </button>
            )}
            <button
              onClick={handleClose}
              className="qr-scanner-close"
              aria-label="Close scanner"
              disabled={isLoading}
            >
              <X size={24} strokeWidth={2} />
            </button>
          </div>
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
