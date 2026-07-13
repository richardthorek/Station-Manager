import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ActivatePage.css';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

export function ActivatePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [memberName, setMemberName] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('No activation token provided.');
      setValidating(false);
      return;
    }
    fetch(`${API_BASE}/members/activate/${token}`)
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Invalid invite'); });
        return res.json();
      })
      .then((data: { memberName: string; orgName?: string; inviteEmail?: string }) => {
        setMemberName(data.memberName);
        setOrgName(data.orgName ?? null);
        if (data.inviteEmail) setEmail(data.inviteEmail);
      })
      .catch((err: Error) => setTokenError(err.message))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('A valid email address is required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/members/activate/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation failed');
      setSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Activation failed');
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
          <h1 className="activate-title">Invite not found</h1>
          <p className="activate-error-msg">{tokenError}</p>
          <button className="activate-btn" onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="activate-page">
        <div className="activate-card">
          <div className="activate-logo" aria-hidden="true">✅</div>
          <h1 className="activate-title">Account created!</h1>
          <p className="activate-success-msg">
            Your account has been set up. You can now log in with your new credentials.
          </p>
          <button className="activate-btn" onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="activate-page">
      <div className="activate-card">
        <div className="activate-logo" aria-hidden="true">🔑</div>
        <h1 className="activate-title">Set up your account</h1>
        {orgName && <p className="activate-org">{orgName}</p>}
        <p className="activate-welcome">
          Welcome, <strong>{memberName}</strong>. Choose a username and password to activate your account.
        </p>

        <form className="activate-form" onSubmit={handleSubmit} noValidate>
          <div className="activate-field">
            <label htmlFor="activate-username">Username</label>
            <input
              id="activate-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={submitting}
              required
              minLength={3}
            />
          </div>
          <div className="activate-field">
            <label htmlFor="activate-email">Email</label>
            <input
              id="activate-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="activate-field">
            <label htmlFor="activate-password">Password</label>
            <input
              id="activate-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={submitting}
              required
              minLength={8}
            />
          </div>
          <div className="activate-field">
            <label htmlFor="activate-confirm">Confirm Password</label>
            <input
              id="activate-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {formError && <p className="activate-error-msg" role="alert">{formError}</p>}

          <button className="activate-btn" type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="activate-login-hint">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
