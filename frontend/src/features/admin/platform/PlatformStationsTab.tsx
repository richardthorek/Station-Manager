/**
 * Platform console — Stations tab (Q35).
 *
 * Stations created before Q33 tagged organizationId on creation have none, so
 * their members/vehicles don't count toward any org's plan limits. No
 * reliable automatic signal exists to map these, so this is a manual,
 * operator-reviewed backfill: list the orphans, then assign each to the
 * right organization by id.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, type PlatformOrphanedStation } from '../../../services/api';

function flash(setMessage: (m: { type: 'success' | 'error'; text: string } | null) => void, type: 'success' | 'error', text: string) {
  setMessage({ type, text });
  setTimeout(() => setMessage(null), 6000);
}

export function PlatformStationsTab() {
  const [stations, setStations] = useState<PlatformOrphanedStation[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.getOrphanedStations();
      setStations(res.stations);
    } catch {
      flash(setMessage, 'error', 'Failed to load orphaned stations');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(stationId: string) {
    if (!organizationId.trim()) {
      flash(setMessage, 'error', 'Enter a target organization ID');
      return;
    }
    try {
      await api.assignStationOrganization(stationId, organizationId.trim());
      setAssigningId(null);
      setOrganizationId('');
      await load();
      flash(setMessage, 'success', 'Station assigned to organization');
    } catch (err) {
      flash(setMessage, 'error', err instanceof Error ? err.message : 'Failed to assign station');
    }
  }

  return (
    <div className="platform-orgs">
      {message && (
        <div className={`org-message org-message--${message.type}`} role="status">
          {message.text}
        </div>
      )}

      <p className="org-hint">
        Active stations with no owning organization — their members and vehicles don't count toward any
        org's plan limits until assigned. Find the target organization's ID from the Organizations tab.
      </p>

      {stations.length === 0 && <p className="org-hint">No orphaned stations.</p>}

      <ul className="platform-org-list">
        {stations.map((s) => (
          <li key={s.id} className="platform-org-card">
            <div className="platform-org-summary">
              <span className="platform-org-name">{s.name}</span>
              <span className="platform-org-stats">
                {s.brigadeName} · {s.hierarchy.jurisdiction} · {s.memberCount} members · {s.vehicleCount} vehicles ·
                created {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </div>

            {assigningId === s.id ? (
              <div className="platform-resolve-form">
                <input
                  type="text"
                  placeholder="Target organization ID"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                />
                <button className="org-btn" type="button" onClick={() => assign(s.id)}>
                  Confirm
                </button>
                <button
                  className="org-link-btn"
                  type="button"
                  onClick={() => {
                    setAssigningId(null);
                    setOrganizationId('');
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button className="org-btn org-btn--secondary" type="button" onClick={() => setAssigningId(s.id)}>
                Assign to organization…
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
