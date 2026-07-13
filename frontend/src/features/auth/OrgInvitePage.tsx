/**
 * Org Invite acceptance page — /invite/:token.
 *
 * Two paths depending on auth state:
 *  - Signed in: preview the org + role, "Join" calls accept then switches the
 *    active org.
 *  - Signed out: create a new account directly into the org, or sign in first
 *    (preserving this page as the post-login redirect via router state, the
 *    same `from` pattern LoginPage already reads).
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { isValidEmail } from '../../utils/emailValidation';
import './ActivatePage.css';

export function OrgInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, switchOrg } = useAuth();
  const { showSuccess } = useToast();

  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenError('No invite token provided.');
      setValidating(false);
      return;
    }
    api
      .getInviteInfo(token)
      .then((data) => {
        setOrganizationName(data.organizationName);
        setRole(data.role);
      })
      .catch((err: Error) => setTokenError(err.message))
      .finally(() => setValidating(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await api.acceptInvite(token);
      await switchOrg(result.membership.organizationId);
      showSuccess(`Joined ${organizationName ?? 'the organisation'}`);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);

    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setFormError('A valid email address is required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.signupViaInvite(token, { username: username.trim(), password, email: email.trim() });
      localStorage.setItem('auth_token', result.token);
      showSuccess(`Welcome to ${result.organization.name}!`);
      // Full reload so AuthContext picks up the freshly-stored token via /auth/me.
      window.location.href = '/';
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="activate-page">
        <div className="activate-card">
          <div className="activate-spinner" aria-label="Validating invite..." />
          <p className="activate-status">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="activate-page">
        <div className="activate-card">
          <div className="activate-logo" aria-hidden="true">🔒</div>
          <h1 className="activate-title">Invite not available</h1>
          <p className="activate-error-msg">{tokenError}</p>
          <button className="activate-btn" onClick={() => navigate('/')}>Go to Home</button>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="activate-page">
        <div className="activate-card">
          <div className="activate-logo" aria-hidden="true">🤝</div>
          <h1 className="activate-title">Join {organizationName}</h1>
          <p className="activate-welcome">You've been invited to join as <strong>{role}</strong>.</p>
          {formError && <p className="activate-error-msg" role="alert">{formError}</p>}
          <button className="activate-btn" onClick={handleAccept} disabled={submitting}>
            {submitting ? 'Joining…' : `Join ${organizationName}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="activate-page">
      <div className="activate-card">
        <div className="activate-logo" aria-hidden="true">🤝</div>
        <h1 className="activate-title">Join {organizationName}</h1>
        <p className="activate-welcome">You've been invited to join as <strong>{role}</strong>.</p>

        <div className="activate-form" style={{ flexDirection: 'row', gap: '0.5rem' }}>
          <button
            type="button"
            className="activate-btn"
            style={{ opacity: mode === 'create' ? 1 : 0.6 }}
            onClick={() => setMode('create')}
          >
            Create account
          </button>
          <button
            type="button"
            className="activate-btn"
            style={{ opacity: mode === 'signin' ? 1 : 0.6 }}
            onClick={() => setMode('signin')}
          >
            Sign in first
          </button>
        </div>

        {mode === 'create' ? (
          <form className="activate-form" onSubmit={handleCreateAccount} noValidate>
            <div className="activate-field">
              <label htmlFor="invite-username">Username</label>
              <input
                id="invite-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                required
                minLength={3}
              />
            </div>
            <div className="activate-field">
              <label htmlFor="invite-email">Email</label>
              <input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div className="activate-field">
              <label htmlFor="invite-password">Password</label>
              <input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
                minLength={8}
              />
            </div>

            {formError && <p className="activate-error-msg" role="alert">{formError}</p>}

            <button className="activate-btn" type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account & join'}
            </button>
          </form>
        ) : (
          <p className="activate-login-hint">
            <Link to="/login" state={{ from: location.pathname }}>
              Sign in with your existing account
            </Link>{' '}
            and come back to this link to join.
          </p>
        )}
      </div>
    </div>
  );
}
