/**
 * Login Page Component
 * 
 * Provides authentication UI for admin users to log in.
 * Displays a simple form with username and password fields.
 * 
 * Features:
 * - Username and password input
 * - Error handling
 * - Loading state
 * - Redirect after successful login
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PageTransition } from '../../components/PageTransition';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get the redirect path from location state, or default to admin page
  const from = (location.state as { from?: string })?.from || '/admin/stations';

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

  return (
    <PageTransition variant="fade">
      <div className="login-page">
        <header className="login-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Admin Login</h1>
        </header>

        <main className="login-main">
          <div className="login-container">
            <div className="login-card">
              <div className="login-icon">🔐</div>
              <h2>Sign In</h2>
              <p className="login-description">
                Enter your credentials to access admin functions
              </p>

              <form onSubmit={handleSubmit} className="login-form">
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    autoFocus
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  className="login-button"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
