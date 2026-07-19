/**
 * Login Page Component
 *
 * Provides authentication UI for admin users to log in.
 * Supports both username/password and QR code device scanning.
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LockKeyhole, QrCode, HelpCircle, KeyRound } from 'lucide-react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useAuth } from '../../contexts/AuthContext';
import { PageTransition } from '../../components/PageTransition';
import { DeviceSetupGuide } from '../../components/DeviceSetupGuide';
import './LoginPage.css';

// The QR scanner drags in the ~350 KB html5-qrcode library; only fetch it
// when the visitor actually opens the scanner, not on every login view.
const QRScannerModal = lazy(() =>
  import('../../components/QRScannerModal').then((m) => ({ default: m.QRScannerModal }))
);

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithPasskey, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const passkeySupported = browserSupportsWebAuthn();

  // Get the redirect path from location state, or default to the app picker
  // (the post-login home) — a deep link that required auth sets `from`.
  const from = (location.state as { from?: string })?.from || '/';

  // An already-authenticated visitor (e.g. an old bookmark) shouldn't see the
  // login form — send them straight to where they were headed.
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setIsPasskeyLoading(true);
    try {
      await loginWithPasskey();
      navigate(from, { replace: true });
    } catch (err) {
      // A cancelled OS prompt throws NotAllowedError — not a real failure,
      // the visitor just backed out or has no passkey and picked "cancel".
      if (err instanceof Error && err.name === 'NotAllowedError') return;
      setError(err instanceof Error ? err.message : 'Passkey sign-in failed');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleQRScan = async (token: string) => {
    setError('');
    setIsProcessingQR(true);

    try {
      // The QR scanned here encodes a kiosk sign-in URL (`/signin?brigade=<token>`,
      // see StationTokenCard's kioskUrl/deviceKioskUrl) — the same token space
      // AccessRoute/StationContext already know how to activate when it arrives
      // as a URL param. Validate through the same endpoint they use
      // (`/api/brigade-access/validate`, which resolves both device and legacy
      // brigade tokens) rather than `/api/devices/validate`, and hand off to
      // `/signin?brigade=<token>` instead of writing ad-hoc localStorage keys —
      // otherwise isKioskMode()/hasMemberSession() find nothing and AccessRoute
      // bounces the visitor straight back to '/'.
      const response = await fetch(`${API_BASE}/brigade-access/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      if (!response.ok || !data.valid) {
        throw new Error(data.error || 'Device not found');
      }

      setShowQRScanner(false);
      navigate(`/signin?brigade=${encodeURIComponent(token)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate device');
      setIsProcessingQR(false);
    }
  };

  return (
    <PageTransition variant="fade">
      <div className="login-page">
        <header className="login-header">
          <div className="login-header-left">
            <Link to="/" className="back-link">← Back to Home</Link>
          </div>
          <h1>Admin Login</h1>
          <button
            type="button"
            className="setup-guide-btn"
            onClick={() => setShowSetupGuide(true)}
            aria-label="Open device setup guide"
            title="How to set up a device"
          >
            <HelpCircle size={20} strokeWidth={2} aria-hidden />
            <span className="sr-only">Setup Guide</span>
          </button>
        </header>

        <main className="login-main">
          <div className="login-container">
            <div className="login-card">
              <div className="login-icon"><LockKeyhole size={32} strokeWidth={2} aria-hidden /></div>
              <h2>Sign In</h2>
              <p className="login-description">
                Enter your credentials to access admin functions
              </p>

              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username webauthn"
                    disabled={isLoading || isProcessingQR || isPasskeyLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading || isProcessingQR || isPasskeyLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="login-button"
                  disabled={isLoading || isProcessingQR || isPasskeyLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {passkeySupported && (
                <button
                  type="button"
                  className="passkey-login-button"
                  onClick={() => void handlePasskeyLogin()}
                  disabled={isLoading || isProcessingQR || isPasskeyLoading}
                >
                  <KeyRound size={20} strokeWidth={2} aria-hidden />
                  <span>{isPasskeyLoading ? 'Waiting for passkey…' : 'Sign in with a passkey'}</span>
                </button>
              )}

              <div className="login-divider">
                <span>Or</span>
              </div>

              <button
                type="button"
                className="qr-scan-button"
                onClick={() => setShowQRScanner(true)}
                disabled={isLoading || isProcessingQR || isPasskeyLoading}
              >
                <QrCode size={24} strokeWidth={2} aria-hidden />
                <span>Scan Device QR Code</span>
              </button>
            </div>
          </div>
        </main>

        {showQRScanner && (
          <Suspense fallback={null}>
            <QRScannerModal
              isOpen={showQRScanner}
              onClose={() => setShowQRScanner(false)}
              onScan={handleQRScan}
              isLoading={isProcessingQR}
            />
          </Suspense>
        )}

        <DeviceSetupGuide
          isOpen={showSetupGuide}
          onClose={() => setShowSetupGuide(false)}
        />
      </div>
    </PageTransition>
  );
}
