/**
 * Platform Administration (/admin/platform)
 *
 * Not a per-org admin screen — this is for the operator of the whole
 * deployment. Self-gates on `isPlatformAdmin` from AuthContext; the real
 * enforcement is the backend's PLATFORM_ADMIN_USERNAMES allowlist, so this
 * page is a convenience gate, not a security boundary.
 *
 * Sections: the organizations console (cross-org visibility + management —
 * Q32's launch-requirement scope), facility claim-conflict review (original
 * scope), the station→organization backfill tool (Q35), and the
 * platform-admin audit log.
 */

import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../hooks/useTheme';
import { api, type ClaimConflict } from '../../../services/api';
import { PageTransition } from '../../../components/PageTransition';
import { PageHeader } from '../../../components/PageHeader';
import { AdminNav } from '../../../components/AdminNav';
import { WikiDocument } from '../../../components/WikiDocument';
import { PlatformOrganizationsTab } from './PlatformOrganizationsTab';
import { PlatformStationsTab } from './PlatformStationsTab';
import { PlatformAuditLogTab } from './PlatformAuditLogTab';
import './PlatformAdminPage.css';

/**
 * The platform-admin wiki (docs/wiki/platform-admin/) — operator-only
 * documentation for this console. Deliberately embedded only here: never
 * linked from the regular HelpButton/WikiPanel, which only ever reads
 * docs/wiki/user-guide.
 */
function PlatformDocsTab() {
  return (
    <div className="platform-docs-tab">
      <WikiDocument section="platform-admin" />
    </div>
  );
}

function ClaimConflictsTab() {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [conflicts, setConflicts] = useState<ClaimConflict[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'dismissed' | 'contacted' | 'reassigned'>('dismissed');
  const [notes, setNotes] = useState('');
  const [reassignToOrganizationId, setReassignToOrganizationId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.getClaimConflicts(tab);
      setConflicts(res.conflicts);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load claim conflicts' });
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  }

  async function submitResolution(conflictId: string) {
    try {
      await api.resolveClaimConflict(conflictId, {
        resolution,
        notes: notes.trim() || undefined,
        reassignToOrganizationId: resolution === 'reassigned' ? reassignToOrganizationId.trim() : undefined,
      });
      setResolvingId(null);
      setNotes('');
      setReassignToOrganizationId('');
      await load();
      flash('success', 'Conflict resolved');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not resolve conflict');
    }
  }

  return (
    <>
      {message && (
        <div className={`org-message org-message--${message.type}`} role="status">
          {message.text}
        </div>
      )}

      <div className="platform-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'open'}
          className={`platform-tab${tab === 'open' ? ' platform-tab--active' : ''}`}
          onClick={() => setTab('open')}
        >
          Open
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'resolved'}
          className={`platform-tab${tab === 'resolved' ? ' platform-tab--active' : ''}`}
          onClick={() => setTab('resolved')}
        >
          Resolved
        </button>
      </div>

      {conflicts.length === 0 && <p className="org-hint">No {tab} conflicts.</p>}

      <ul className="platform-conflict-list">
        {conflicts.map((conflict) => (
          <li key={conflict.id} className="platform-conflict-card">
            <div className="platform-conflict-facility">
              <strong>{conflict.facilityName}</strong> ({conflict.facilityKey})
            </div>
            <div className="platform-conflict-row">
              <span className="platform-conflict-label">Currently held by:</span>{' '}
              {conflict.existingOrganization?.name ?? conflict.existingOrganizationId}
              {conflict.existingOrganization?.billingEmail && ` (${conflict.existingOrganization.billingEmail})`}
            </div>
            <div className="platform-conflict-row">
              <span className="platform-conflict-label">Attempted by:</span>{' '}
              {conflict.attemptedOrgName} — {conflict.attemptedByUsername} ({conflict.attemptedByEmail})
            </div>
            <div className="platform-conflict-row">
              <span className="platform-conflict-label">Reported:</span>{' '}
              {new Date(conflict.createdAt).toLocaleString()}
            </div>

            {conflict.status === 'resolved' ? (
              <div className="platform-conflict-row">
                <span className="platform-conflict-label">Resolution:</span> {conflict.resolution}
                {conflict.resolutionNotes && ` — ${conflict.resolutionNotes}`}
              </div>
            ) : resolvingId === conflict.id ? (
              <div className="platform-resolve-form">
                <select value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)}>
                  <option value="dismissed">Dismiss</option>
                  <option value="contacted">Mark as contacted</option>
                  <option value="reassigned">Reassign facility</option>
                </select>
                {resolution === 'reassigned' && (
                  <input
                    type="text"
                    placeholder="Target organisation ID"
                    value={reassignToOrganizationId}
                    onChange={(e) => setReassignToOrganizationId(e.target.value)}
                  />
                )}
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button className="org-btn" type="button" onClick={() => submitResolution(conflict.id)}>
                  Confirm
                </button>
                <button className="org-link-btn" type="button" onClick={() => setResolvingId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="org-btn org-btn--secondary" type="button" onClick={() => setResolvingId(conflict.id)}>
                Resolve
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const SECTIONS = ['organizations', 'conflicts', 'stations', 'audit', 'docs'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABELS: Record<Section, string> = {
  organizations: 'Organizations',
  conflicts: 'Claim conflicts',
  stations: 'Orphaned stations',
  audit: 'Audit log',
  docs: 'Help',
};

export function PlatformAdminPage() {
  const { theme, toggleTheme } = useTheme();
  const { isPlatformAdmin } = useAuth();
  const [section, setSection] = useState<Section>('organizations');

  if (!isPlatformAdmin) {
    return (
      <div className="platform-page">
        <AdminNav />
        <main className="platform-main" id="main-content" tabIndex={-1}>
          <p>Not authorised.</p>
        </main>
      </div>
    );
  }

  return (
    <PageTransition variant="fade">
      <div className="platform-page">
        <AdminNav />
        <PageHeader
          title="Platform administration"
          backTo="/"
          backLabel="Home"
          subtitle="Operator console — every organization, no tenant content"
          actions={[{
            key: 'theme',
            label: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
            icon: theme === 'light' ? <Moon size={20} strokeWidth={2} aria-hidden /> : <Sun size={20} strokeWidth={2} aria-hidden />,
            onClick: toggleTheme,
          }]}
        />

        <main className="platform-main" id="main-content" tabIndex={-1}>
          <div className="platform-tabs" role="tablist">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={section === s}
                className={`platform-tab${section === s ? ' platform-tab--active' : ''}`}
                onClick={() => setSection(s)}
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>

          {section === 'organizations' && <PlatformOrganizationsTab />}
          {section === 'conflicts' && <ClaimConflictsTab />}
          {section === 'stations' && <PlatformStationsTab />}
          {section === 'audit' && <PlatformAuditLogTab />}
          {section === 'docs' && <PlatformDocsTab />}
        </main>
      </div>
    </PageTransition>
  );
}
