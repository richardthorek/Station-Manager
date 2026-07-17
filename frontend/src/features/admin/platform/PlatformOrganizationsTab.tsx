/**
 * Platform console — Organizations tab (Q32).
 *
 * Cross-org visibility (aggregate counts only — never row-level tenant data)
 * plus management: plan/status/entitlements, membership, facility-claim
 * clearing, and destructive delete (soft-deactivate by default; hard delete
 * requires typing the org's slug/username to confirm).
 */

import { useCallback, useEffect, useState } from 'react';
import { api, type PlatformOrganizationSummary, type PlatformOrganizationDetail, type PlatformOrgMember, type PlanDefinition } from '../../../services/api';

type OrgRole = 'owner' | 'admin' | 'viewer';

function flash(setMessage: (m: { type: 'success' | 'error'; text: string } | null) => void, type: 'success' | 'error', text: string) {
  setMessage({ type, text });
  setTimeout(() => setMessage(null), 6000);
}

export function PlatformOrganizationsTab() {
  const [organizations, setOrganizations] = useState<PlatformOrganizationSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlatformOrganizationDetail | null>(null);
  const [members, setMembers] = useState<PlatformOrgMember[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await api.getPlatformOrganizations();
      setOrganizations(res.organizations);
    } catch {
      flash(setMessage, 'error', 'Failed to load organizations');
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getPlatformOrganization(id);
      setDetail(res.organization);
      setMembers(res.members);
      setPlans(res.plans);
      setExpandedId(id);
    } catch {
      flash(setMessage, 'error', 'Failed to load organization detail');
    } finally {
      setLoading(false);
    }
  }

  async function refreshDetail(id: string) {
    const res = await api.getPlatformOrganization(id);
    setDetail(res.organization);
    setMembers(res.members);
  }

  async function changePlan(id: string, planCode: string) {
    try {
      await api.updatePlatformOrganization(id, { planCode: planCode as PlatformOrganizationDetail['planCode'] });
      await refreshDetail(id);
      await loadList();
      flash(setMessage, 'success', 'Plan updated');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to update plan');
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      await api.updatePlatformOrganization(id, { status: status as PlatformOrganizationDetail['status'] });
      await refreshDetail(id);
      await loadList();
      flash(setMessage, 'success', 'Status updated');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function clearFacilityClaim(id: string) {
    try {
      await api.updatePlatformOrganization(id, { clearFacilityClaim: true });
      await refreshDetail(id);
      await loadList();
      flash(setMessage, 'success', 'Facility claim cleared');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to clear facility claim');
    }
  }

  async function changeMemberRole(orgId: string, userId: string, role: OrgRole) {
    try {
      await api.changePlatformOrgMemberRole(orgId, userId, role);
      await refreshDetail(orgId);
      flash(setMessage, 'success', 'Role updated');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to change role');
    }
  }

  async function removeMember(orgId: string, userId: string) {
    try {
      await api.removePlatformOrgMember(orgId, userId);
      await refreshDetail(orgId);
      flash(setMessage, 'success', 'Member removed');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function deactivateOrg(orgId: string) {
    try {
      await api.deletePlatformOrganization(orgId);
      await refreshDetail(orgId);
      await loadList();
      flash(setMessage, 'success', 'Organization deactivated');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to deactivate organization');
    }
  }

  async function hardDeleteOrg(orgId: string, slug: string, confirmText: string) {
    if (confirmText !== slug) {
      flash(setMessage, 'error', `Type "${slug}" exactly to confirm`);
      return;
    }
    try {
      await api.deletePlatformOrganization(orgId, { hard: true, confirm: confirmText });
      setExpandedId(null);
      setDetail(null);
      await loadList();
      flash(setMessage, 'success', 'Organization permanently deleted');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to delete organization');
    }
  }

  return (
    <div className="platform-orgs">
      {message && (
        <div className={`org-message org-message--${message.type}`} role="status">
          {message.text}
        </div>
      )}

      {organizations.length === 0 && <p className="org-hint">No organizations yet.</p>}

      <ul className="platform-org-list">
        {organizations.map((org) => (
          <li key={org.id} className="platform-org-card">
            <button type="button" className="platform-org-summary" onClick={() => toggleExpand(org.id)}>
              <span className="platform-org-name">{org.name}</span>
              <span className="platform-org-badges">
                <span className="platform-badge">{org.planCode}</span>
                <span className={`platform-badge platform-badge--${org.status}`}>{org.status}</span>
              </span>
              <span className="platform-org-stats">
                {org.stationCount} stations · {org.memberCount} members · {org.vehicleCount} vehicles · {org.aiSessionsUsedThisMonth} AI sessions this month
              </span>
            </button>

            {expandedId === org.id && detail && (
              <div className="platform-org-detail">
                {loading && <p className="org-hint">Loading…</p>}

                <div className="platform-detail-row">
                  <label htmlFor={`plan-${org.id}`}>Plan</label>
                  <select id={`plan-${org.id}`} value={detail.planCode} onChange={(e) => changePlan(org.id, e.target.value)}>
                    {plans.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>

                  <label htmlFor={`status-${org.id}`}>Status</label>
                  <select id={`status-${org.id}`} value={detail.status} onChange={(e) => changeStatus(org.id, e.target.value)}>
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>

                <div className="platform-detail-row">
                  <span className="platform-conflict-label">Billing email:</span> {detail.billingEmail}
                </div>
                {detail.facilityName && (
                  <div className="platform-detail-row">
                    <span className="platform-conflict-label">Facility:</span> {detail.facilityName}{' '}
                    <button className="org-link-btn" type="button" onClick={() => clearFacilityClaim(org.id)}>
                      Clear claim
                    </button>
                  </div>
                )}

                <h3 className="platform-detail-heading">Members</h3>
                <ul className="platform-member-list">
                  {members.map((m) => (
                    <li key={m.userId} className="platform-member-row">
                      <span>{m.username}{m.email ? ` (${m.email})` : ''}</span>
                      <select value={m.role} onChange={(e) => changeMemberRole(org.id, m.userId, e.target.value as OrgRole)}>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button className="org-link-btn" type="button" onClick={() => removeMember(org.id, m.userId)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <AddMemberForm orgId={org.id} onAdded={() => refreshDetail(org.id)} onError={(msg) => flash(setMessage, 'error', msg)} />

                <div className="platform-danger-zone">
                  <h3 className="platform-detail-heading">Danger zone</h3>
                  {detail.status !== 'canceled' && (
                    <button className="org-btn org-btn--secondary" type="button" onClick={() => deactivateOrg(org.id)}>
                      Deactivate organization
                    </button>
                  )}
                  <HardDeleteControl slug={org.slug} onConfirm={(text) => hardDeleteOrg(org.id, org.slug, text)} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddMemberForm({ orgId, onAdded, onError }: { orgId: string; onAdded: () => void; onError: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<OrgRole>('viewer');

  async function submit() {
    try {
      await api.addPlatformOrgMember(orgId, { username, password, role });
      setUsername('');
      setPassword('');
      setRole('viewer');
      setOpen(false);
      onAdded();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add member');
    }
  }

  if (!open) {
    return (
      <button className="org-btn org-btn--secondary" type="button" onClick={() => setOpen(true)}>
        Add member
      </button>
    );
  }

  return (
    <div className="platform-resolve-form">
      <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
        <option value="owner">Owner</option>
        <option value="admin">Admin</option>
        <option value="viewer">Viewer</option>
      </select>
      <button className="org-btn" type="button" onClick={submit}>Add</button>
      <button className="org-link-btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

function HardDeleteControl({ slug, onConfirm }: { slug: string; onConfirm: (confirmText: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  if (!open) {
    return (
      <button className="org-btn org-btn--danger" type="button" onClick={() => setOpen(true)}>
        Permanently delete…
      </button>
    );
  }

  return (
    <div className="platform-resolve-form">
      <span className="org-hint">Type <strong>{slug}</strong> to permanently delete this organization:</span>
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="org-btn org-btn--danger" type="button" onClick={() => onConfirm(text)}>
        Confirm permanent delete
      </button>
      <button className="org-link-btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
