/**
 * Platform console — Audit log tab (Q32).
 *
 * The only accountability trail for platform-admin actions — the hard
 * privacy wall means nobody can casually browse tenant data instead, so
 * every mutation under /api/platform writes a row here.
 */

import { useEffect, useState } from 'react';
import { api, type PlatformAuditLogEntry } from '../../../services/api';

export function PlatformAuditLogTab() {
  const [logs, setLogs] = useState<PlatformAuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPlatformAuditLog()
      .then((res) => setLogs(res.logs))
      .catch(() => setError('Failed to load audit log'));
  }, []);

  if (error) return <p className="org-message org-message--error">{error}</p>;
  if (logs.length === 0) return <p className="org-hint">No platform-admin actions recorded yet.</p>;

  return (
    <ul className="platform-audit-list">
      {logs.map((log) => (
        <li key={log.id} className="platform-audit-row">
          <span className="platform-audit-time">{new Date(log.createdAt).toLocaleString()}</span>
          <span className="platform-audit-actor">{log.actorUsername}</span>
          <span className="platform-audit-action">{log.action}</span>
          {log.details && <span className="platform-audit-details">{log.details}</span>}
        </li>
      ))}
    </ul>
  );
}
