/**
 * Sign-up Page Component
 *
 * Self-service brigade onboarding: creates an Organization (free Community
 * plan) and its first owner account, then redirects into the app. Upgrades to
 * paid plans (and the AI add-on) happen later from the Organization screen.
 * Reuses the login page styling.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { PageTransition } from '../../components/PageTransition';
import './LoginPage.css';

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup } = useAuth();

  // A paid plan can be pre-selected from the marketing page
  // (e.g. /signup?plan=basic&interval=annual). After the account is created we
  // send the owner straight into Stripe Checkout for that plan.
  const planParam = searchParams.get('plan');
  const selectedPlan = planParam === 'basic' || planParam === 'ai' ? planParam : null;
  const selectedInterval = searchParams.get('interval') === 'annual' ? 'annual' : 'monthly';

  const [organizationName, setOrganizationName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await signup({ organizationName, billingEmail, username, password });

      // If the visitor picked a paid plan on the marketing page, take them
      // straight to Stripe Checkout. If billing isn't available, fall back to
      // the Organization screen where they can upgrade manually.
      if (selectedPlan) {
        try {
          const { checkoutUrl } = await api.createCheckoutSession(selectedPlan, selectedInterval);
          window.location.href = checkoutUrl;
          return;
        } catch {
          navigate('/admin/organization?billing=unavailable', { replace: true });
          return;
        }
      }

      navigate('/admin/organization', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition variant="fade">
      <div className="login-page">
        <header className="login-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Create your brigade account</h1>
        </header>

        <main className="login-main">
          <div className="login-container">
            <div className="login-card">
              <div className="login-icon">🚒</div>
              <h2>Sign Up</h2>
              <p className="login-description">
                {selectedPlan === 'basic' && 'Create your account, then add your payment details for the Basic plan. 14-day free trial — cancel any time.'}
                {selectedPlan === 'ai' && 'Create your account, then add your payment details for the AI Pro plan. 14-day free trial — cancel any time.'}
                {!selectedPlan && 'Start free on the Community plan — sign-in book and basic truck checks. Add reports and the AI maintenance agent any time.'}
              </p>

              <form onSubmit={handleSubmit} className="login-form">
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="organizationName">Brigade / organisation name</label>
                  <input
                    id="organizationName"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="e.g. Bungendore RFS"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="billingEmail">Contact / billing email</label>
                  <input
                    id="billingEmail"
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="username">Owner username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password (min 8 characters)</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>

                <button type="submit" className="login-button" disabled={isLoading}>
                  {isLoading
                    ? 'Creating account…'
                    : selectedPlan
                      ? 'Create account & continue to payment'
                      : 'Create account'}
                </button>

                <p className="login-description" style={{ marginTop: '1rem' }}>
                  Already have an account? <Link to="/login">Sign in</Link>
                </p>
              </form>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
