/**
 * Organization Management Page (/admin/organization)
 *
 * Owner/admin screen to manage the SaaS tenant:
 * - View plan + status; owners upgrade via Stripe Checkout.
 * - Toggle modules on/off (e.g. hide the sign-in book for a maintenance-only
 *   brigade). AI can only be enabled on the AI plan (clamped server-side).
 * - List org users and invite new admin/viewer accounts.
 * - Manage subscription via Stripe Customer Portal.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, type EntitlementFeature } from '../../../contexts/AuthContext';
import { api, type PlanDefinition, type OrganizationUser, type AiUsage, type BillingStatus } from '../../../services/api';
import { PageTransition } from '../../../components/PageTransition';
import './OrganizationPage.css';

const MODULES: { key: EntitlementFeature; label: string; help: string }[] = [
  { key: 'signInEnabled', label: 'Sign-in book', help: 'Member check-in / events' },
  { key: 'truckCheckEnabled', label: 'Truck check', help: 'Vehicle inspections' },
  { key: 'reportsEnabled', label: 'Reports & analytics', help: 'Dashboards + CSV export' },
  { key: 'aiEnabled', label: 'AI maintenance agent', help: 'Requires the AI plan' },
];

export function OrganizationPage() {
  const { organization, user, refreshOrganization } = useAuth();
  const isOwner = user?.role === 'owner';
  const isAdmin = isOwner || user?.role === 'admin';
  const [searchParams] = useSearchParams();

  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');

  const load = useCallback(async () => {
    try {
      const [orgRes, usersRes] = await Promise.all([
        api.getCurrentOrganization(),
        isAdmin ? api.getOrganizationUsers() : Promise.resolve({ users: [] }),
      ]);
      setPlans(orgRes.plans);
      setUsers(usersRes.users);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load organization' });
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // AI session usage + billing status — only relevant when AI module is on.
  const aiEnabled = organization?.entitlements.aiEnabled ?? false;
  useEffect(() => {
    if (!aiEnabled) {
      setAiUsage(null);
      setBillingStatus(null);
      return;
    }
    api.getAiUsage().then(setAiUsage).catch(() => setAiUsage(null));
    api.getBillingStatus().then(setBillingStatus).catch(() => setBillingStatus(null));
  }, [aiEnabled]);

  // Show feedback for Stripe redirect outcomes
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (billing === 'success') {
      flash('success', 'Payment successful! Your plan has been upgraded.');
      refreshOrganization();
    } else if (billing === 'cancelled') {
      flash('error', 'Checkout cancelled — no changes were made.');
    }
    const topup = searchParams.get('topup');
    if (topup === 'success') {
      flash('success', 'Top-up purchased! Your bonus sessions have been credited.');
      refreshOrganization();
      api.getAiUsage().then(setAiUsage).catch(() => undefined);
    } else if (topup === 'cancelled') {
      flash('error', 'Top-up checkout cancelled — no sessions were added.');
    }
  }, [searchParams, refreshOrganization]);

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  }

  async function toggleModule(key: EntitlementFeature, value: boolean) {
    if (!isOwner) return;
    setSaving(true);
    try {
      const { organization: updated } = await api.updateOrganization({ moduleToggles: { [key]: value } });
      await refreshOrganization();
      if (Boolean(updated.entitlements[key]) !== value) {
        flash('error', 'This module is not available on your current plan. Upgrade to enable it.');
      } else {
        flash('success', 'Updated');
      }
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout(planCode: 'basic' | 'ai') {
    if (!isOwner) return;
    setBillingLoading(true);
    try {
      const { checkoutUrl } = await api.createCheckoutSession(planCode, billingInterval);
      window.location.href = checkoutUrl;
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not start checkout');
      setBillingLoading(false);
    }
  }

  async function openPortal() {
    if (!isOwner) return;
    setBillingLoading(true);
    try {
      const { portalUrl } = await api.createPortalSession();
      window.location.href = portalUrl;
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not open billing portal');
      setBillingLoading(false);
    }
  }

  async function startTopup() {
    if (!isOwner) return;
    setTopupLoading(true);
    try {
      const { checkoutUrl } = await api.createTopupSession();
      window.location.href = checkoutUrl;
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not start top-up checkout');
      setTopupLoading(false);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createOrganizationUser({ username: newUsername, password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      const usersRes = await api.getOrganizationUsers();
      setUsers(usersRes.users);
      flash('success', 'User added');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not add user');
    } finally {
      setSaving(false);
    }
  }

  if (!organization) {
    return (
      <div className="org-page">
        <header className="org-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Organization</h1>
        </header>
        <main className="org-main" id="main-content" tabIndex={-1}>
          <p>No organization is associated with this account.</p>
        </main>
      </div>
    );
  }

  const ent = organization.entitlements;
  const isPaid = organization.planCode !== 'community';
  const isTrialing = organization.status === 'trialing';

  return (
    <PageTransition variant="fade">
      <div className="org-page">
        <header className="org-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>{organization.name}</h1>
          <p className="org-subtitle">
            Plan: <strong>{organization.planCode}</strong>
            {' · '}
            Status: <span className={`org-status org-status--${organization.status}`}>{organization.status}</span>
          </p>
        </header>

        <main className="org-main" id="main-content" tabIndex={-1}>
          {message && (
            <div className={`org-message org-message--${message.type}`} role="status">
              {message.text}
            </div>
          )}

          {isTrialing && (
            <div className="org-trial-notice" role="status">
              Your 14-day free trial is active.{' '}
              {isOwner && (
                <button className="org-link-btn" onClick={openPortal} disabled={billingLoading}>
                  Add a payment method
                </button>
              )}{' '}
              to keep access after the trial ends.
            </div>
          )}

          <section className="org-section">
            <h2>Plan</h2>

            {isOwner && (
              <div className="org-interval-toggle">
                <button
                  className={`org-interval-btn ${billingInterval === 'monthly' ? 'active' : ''}`}
                  onClick={() => setBillingInterval('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={`org-interval-btn ${billingInterval === 'annual' ? 'active' : ''}`}
                  onClick={() => setBillingInterval('annual')}
                >
                  Annual <span className="org-interval-badge">2 months free</span>
                </button>
              </div>
            )}

            <div className="org-plans">
              {plans.map((p) => {
                const isCurrent = p.code === organization.planCode;
                const price = billingInterval === 'annual' && p.priceAnnualAud
                  ? `A$${p.priceAnnualAud}/yr`
                  : p.priceMonthlyAud === 0
                  ? 'Free'
                  : `A$${p.priceMonthlyAud}/mo`;

                return (
                  <div key={p.code} className={`org-plan ${isCurrent ? 'current' : ''}`}>
                    <div className="org-plan-name">{p.name}</div>
                    <div className="org-plan-price">{price}</div>
                    <p className="org-plan-desc">{p.description}</p>
                    {isCurrent ? (
                      <span className="org-plan-current">Current plan</span>
                    ) : p.code === 'community' ? (
                      <span className="org-plan-downgrade-hint">Manage via billing portal</span>
                    ) : (
                      <button
                        className="org-btn"
                        disabled={!isOwner || billingLoading}
                        onClick={() => startCheckout(p.code as 'basic' | 'ai')}
                      >
                        {billingLoading ? 'Opening…' : `Upgrade to ${p.name}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {isPaid && isOwner && (
              <div className="org-billing-actions">
                <button className="org-btn org-btn--secondary" onClick={openPortal} disabled={billingLoading}>
                  Manage billing & invoices
                </button>
              </div>
            )}

            {!isOwner && <p className="org-hint">Only the owner can change the plan.</p>}
          </section>

          {aiEnabled && aiUsage && (
            <section className="org-section">
              <h2>AI usage this month</h2>
              {(() => {
                const bonus = aiUsage.bonus ?? 0;
                const total = aiUsage.included + bonus;
                const pct = total > 0
                  ? Math.min(100, Math.round((aiUsage.used / total) * 100))
                  : 100;
                const low = aiUsage.remaining <= Math.max(1, Math.ceil(total * 0.1));
                const exhausted = aiUsage.remaining === 0;
                const resetDate = new Date(aiUsage.resetAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
                const showTopup = isOwner && billingStatus?.topupAvailable;
                return (
                  <>
                    <p className="org-ai-usage-count">
                      <strong>{aiUsage.used}</strong> of <strong>{aiUsage.included}</strong> monthly sessions used
                      {bonus > 0 && (
                        <> · <strong>{bonus}</strong> bonus session{bonus === 1 ? '' : 's'} remaining</>
                      )}
                      {' · '}<span className="org-hint">resets {resetDate}</span>
                    </p>
                    <div
                      className="org-ai-meter"
                      role="img"
                      aria-label={`${aiUsage.used} of ${total} sessions used`}
                    >
                      <div className={`org-ai-meter-fill ${exhausted ? 'low' : low ? 'low' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                    {exhausted ? (
                      <p className="org-ai-nudge">
                        You've used all your AI sessions for this month.{' '}
                        {isOwner
                          ? 'Top up for more sessions, or upgrade your plan.'
                          : 'Ask your owner to top up or upgrade your plan.'}
                      </p>
                    ) : low ? (
                      <p className="org-ai-nudge">
                        Only {aiUsage.remaining} AI session{aiUsage.remaining === 1 ? '' : 's'} remaining.
                      </p>
                    ) : null}
                    {showTopup && (exhausted || low) && (
                      <button
                        className="org-btn org-btn--secondary"
                        onClick={startTopup}
                        disabled={topupLoading}
                      >
                        {topupLoading
                          ? 'Opening…'
                          : `Buy ${billingStatus.topupPackSize ?? 25} more sessions`}
                      </button>
                    )}
                  </>
                );
              })()}
            </section>
          )}

          <section className="org-section">
            <h2>Modules</h2>
            <p className="org-hint">
              Turn modules on or off for your brigade — e.g. hide the sign-in book on a
              maintenance-only deployment. The AI agent is only available on the AI plan.
            </p>
            <ul className="org-modules">
              {MODULES.map((m) => {
                const aiLocked = m.key === 'aiEnabled' && organization.planCode !== 'ai';
                return (
                  <li key={m.key} className="org-module">
                    <label>
                      <input
                        type="checkbox"
                        checked={ent[m.key]}
                        disabled={!isOwner || saving || aiLocked}
                        onChange={(e) => toggleModule(m.key, e.target.checked)}
                      />
                      <span className="org-module-label">{m.label}</span>
                    </label>
                    <span className="org-module-help">{aiLocked ? 'Upgrade to the AI plan' : m.help}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {isAdmin && (
            <section className="org-section">
              <h2>Users</h2>
              <table className="org-users">
                <thead>
                  <tr><th>Username</th><th>Role</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.role}</td>
                      <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <form className="org-adduser" onSubmit={addUser}>
                <h3>Add a user</h3>
                <input
                  type="text"
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password (min 8)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'viewer')}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="org-btn" type="submit" disabled={saving}>Add user</button>
              </form>
            </section>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
