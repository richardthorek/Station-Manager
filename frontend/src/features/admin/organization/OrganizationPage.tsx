/**
 * Organization Management Page (/admin/organization)
 *
 * Owner/admin screen to manage the SaaS tenant:
 * - View plan + status; owners can change plan (entitlements re-derive).
 * - Toggle modules on/off (e.g. hide the sign-in book for a maintenance-only
 *   brigade). AI can only be enabled on the AI plan (clamped server-side).
 * - List org users and invite new admin/viewer accounts.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type EntitlementFeature } from '../../../contexts/AuthContext';
import { api, type PlanDefinition, type OrganizationUser } from '../../../services/api';
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

  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New-user form
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

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function toggleModule(key: EntitlementFeature, value: boolean) {
    if (!isOwner) return;
    setSaving(true);
    try {
      await api.updateOrganization({ moduleToggles: { [key]: value } });
      await refreshOrganization();
      flash('success', 'Updated');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function changePlan(planCode: PlanDefinition['code']) {
    if (!isOwner) return;
    setSaving(true);
    try {
      await api.updateOrganization({ planCode });
      await refreshOrganization();
      flash('success', `Switched to the ${planCode} plan`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Plan change failed');
    } finally {
      setSaving(false);
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

  return (
    <PageTransition variant="fade">
      <div className="org-page">
        <header className="org-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>{organization.name}</h1>
          <p className="org-subtitle">
            Plan: <strong>{organization.planCode}</strong> · Status: {organization.status}
          </p>
        </header>

        <main className="org-main" id="main-content" tabIndex={-1}>
          {message && (
            <div className={`org-message org-message--${message.type}`} role="status">
              {message.text}
            </div>
          )}

          <section className="org-section">
            <h2>Plan</h2>
            <div className="org-plans">
              {plans.map((p) => (
                <div key={p.code} className={`org-plan ${p.code === organization.planCode ? 'current' : ''}`}>
                  <div className="org-plan-name">{p.name}</div>
                  <div className="org-plan-price">{p.priceMonthlyAud === 0 ? 'Free' : `A$${p.priceMonthlyAud}/mo`}</div>
                  <p className="org-plan-desc">{p.description}</p>
                  {p.code === organization.planCode ? (
                    <span className="org-plan-current">Current plan</span>
                  ) : (
                    <button className="org-btn" disabled={!isOwner || saving} onClick={() => changePlan(p.code)}>
                      Switch
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!isOwner && <p className="org-hint">Only the owner can change the plan.</p>}
          </section>

          <section className="org-section">
            <h2>Modules</h2>
            <p className="org-hint">
              Turn modules on or off for your brigade — e.g. hide the sign-in book on a maintenance-only
              deployment. The AI agent is only available on the AI plan.
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
