/**
 * My Account (/account) — the personal-settings home for a signed-in user:
 * their own details (username, email), password, passkeys, and which
 * organisations they belong to. Deliberately separate from:
 * - Organization (/admin/organization): org-level settings (billing/plan,
 *   branding, members, modules) — a different tenant-scoped concern.
 * - Station Management (/admin/stations, /admin/brigade-access): station and
 *   device administration.
 * Reached via AccountMenu (replaces the old bare "Logout" button).
 */

import { useState } from 'react';
import { Building2, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import { PageTransition } from '../../components/PageTransition';
import { PageHeader } from '../../components/PageHeader';
import { PasskeysSection } from '../../components/PasskeysSection';
import './AccountPage.css';

export function AccountPage() {
  const { user, organization, memberships, switchOrg, refreshOrganization, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState(user?.email ?? '');
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await api.updateProfile({ email });
      await refreshOrganization();
      flash('success', 'Email saved');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not save email');
    } finally {
      setSavingEmail(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      flash('error', 'New password and confirmation do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flash('success', 'Password changed');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSwitchOrg(organizationId: string) {
    if (organizationId === organization?.id) return;
    setSwitchingOrgId(organizationId);
    try {
      await switchOrg(organizationId);
      flash('success', 'Switched organisation');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not switch organisation');
    } finally {
      setSwitchingOrgId(null);
    }
  }

  if (!user) {
    return (
      <div className="account-page">
        <PageHeader title="My Account" backTo="/" backLabel="StationKit" />
        <main className="account-main" id="main-content" tabIndex={-1}>
          <p>You need to sign in to view your account.</p>
        </main>
      </div>
    );
  }

  return (
    <PageTransition variant="fade">
      <div className="account-page">
        <PageHeader
          title="My Account"
          backTo="/"
          backLabel="StationKit"
          actions={[{
            key: 'theme',
            label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
            icon: theme === 'light' ? <Moon size={20} strokeWidth={2} aria-hidden /> : <Sun size={20} strokeWidth={2} aria-hidden />,
            onClick: toggleTheme,
          }]}
        />

        <main className="account-main" id="main-content" tabIndex={-1}>
          {message && (
            <div className={`account-message account-message--${message.type}`} role="status">
              {message.text}
            </div>
          )}

          <section className="account-section">
            <h2>My details</h2>
            <div className="account-field">
              <span className="account-field-label">Username</span>
              <span className="account-field-value">{user.username}</span>
            </div>
            <form className="account-form" onSubmit={saveEmail}>
              <label htmlFor="account-email">Email</label>
              <div className="account-form-row">
                <input
                  id="account-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button className="account-btn" type="submit" disabled={savingEmail}>
                  {savingEmail ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </section>

          <section className="account-section">
            <h2>Password</h2>
            <form className="account-form account-form--stacked" onSubmit={changePassword}>
              <label htmlFor="account-current-password">Current password</label>
              <input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <label htmlFor="account-new-password">New password</label>
              <input
                id="account-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <label htmlFor="account-confirm-password">Confirm new password</label>
              <input
                id="account-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button className="account-btn" type="submit" disabled={changingPassword}>
                {changingPassword ? 'Changing…' : 'Change password'}
              </button>
            </form>
          </section>

          <PasskeysSection />

          <section className="account-section">
            <h2>Organisations</h2>
            {memberships.length <= 1 ? (
              <p className="account-hint">
                You belong to <strong>{organization?.name ?? 'one organisation'}</strong>.
              </p>
            ) : (
              <ul className="account-org-list">
                {memberships.map((m) => (
                  <li key={m.organizationId} className="account-org-row">
                    <span className="account-org-name">
                      <Building2 size={16} strokeWidth={2} aria-hidden="true" />
                      {m.organizationName}
                      <span className="account-org-role">{m.role}</span>
                    </span>
                    {m.organizationId === organization?.id ? (
                      <span className="account-org-current">Current</span>
                    ) : (
                      <button
                        type="button"
                        className="account-btn account-btn--secondary"
                        disabled={switchingOrgId === m.organizationId}
                        onClick={() => void handleSwitchOrg(m.organizationId)}
                      >
                        {switchingOrgId === m.organizationId ? 'Switching…' : 'Switch'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button type="button" className="account-signout-btn" onClick={logout}>
            Sign out
          </button>
        </main>
      </div>
    </PageTransition>
  );
}
