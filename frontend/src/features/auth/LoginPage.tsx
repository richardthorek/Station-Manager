/**
 * Login Page Component
 *
 * Provides authentication UI for admin users to log in.
 * Supports both username/password and QR code device scanning.
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LockKeyhole, QrCode, HelpCircle } from 'lucide-react';
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
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

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

  const handleQRScan = async (token: string, stationId: string) => {
    setError('');
    setIsProcessingQR(true);

    try {
      const response = await fetch(`${API_BASE}/devices/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...(stationId && { stationId }) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Device not found');
      }

      const data = await response.json();
      localStorage.setItem('deviceToken', token);
      localStorage.setItem('stationId', data.stationId);
      localStorage.setItem('deviceContext', JSON.stringify(data.device));

      setShowQRScanner(false);
      navigate('/signin', { replace: true });
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
                    autoComplete="username"
                    disabled={isLoading || isProcessingQR}
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
                    disabled={isLoading || isProcessingQR}
                  />
                </div>

                <button
                  type="submit"
                  className="login-button"
                  disabled={isLoading || isProcessingQR}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="login-divider">
                <span>Or</span>
              </div>

              <button
                type="button"
                className="qr-scan-button"
                onClick={() => setShowQRScanner(true)}
                disabled={isLoading || isProcessingQR}
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
