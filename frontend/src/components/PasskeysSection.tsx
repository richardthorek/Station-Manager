/**
 * Passkeys section (personal account settings) — Station Manager is the
 * suite's sole identity provider, so credential registration/management
 * lives only here. A passkey added here can then be used to sign in from
 * any StationKit app's own login screen (they share the same WebAuthn
 * relying-party ID), not just this one. Additive to username/password —
 * never a replacement. Rendered on the personal `/account` page — not
 * Organization (org-level settings) or Station Management, since a passkey
 * is a credential for this one person, not the org.
 */

import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { KeyRound, Trash2, Plus } from 'lucide-react';
import { api, type Passkey } from '../services/api';
import './PasskeysSection.css';

function formatDate(iso: string | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PasskeysSection() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPasskeys(await api.getPasskeys());
    } catch {
      setError('Could not load your passkeys.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    setAdding(true);
    setError(null);
    try {
      const options = await api.getPasskeyRegistrationOptions();
      const response = await startRegistration({ optionsJSON: options });
      await api.verifyPasskeyRegistration(response);
      await load();
    } catch (err) {
      // A cancelled OS prompt throws a NotAllowedError — not a real failure.
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setAdding(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to add passkey');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this passkey? You can no longer sign in with it afterwards.')) return;
    try {
      await api.deletePasskey(id);
      setPasskeys((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch {
      setError('Failed to remove passkey');
    }
  }

  return (
    <section className="passkeys-section">
      <h2>
        <KeyRound size={18} strokeWidth={2} aria-hidden style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
        Passkeys
      </h2>
      <p>
        Sign in faster and more securely with your device's built-in passkey support (Face ID, Touch
        ID, Windows Hello, or your password manager) — on this app and on any other StationKit app.
        Your password still works as a fallback.
      </p>

      {error && <div className="passkeys-message passkeys-message--error" role="alert">{error}</div>}

      {passkeys === null ? (
        <p>Loading…</p>
      ) : passkeys.length === 0 ? (
        <p>No passkeys registered yet.</p>
      ) : (
        <ul className="passkeys-list">
          {passkeys.map((p) => (
            <li key={p.id} className="passkeys-row">
              <span>
                {p.name} <span className="passkeys-meta">— added {formatDate(p.createdAt)}, last used {formatDate(p.lastUsedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(p.id)}
                aria-label={`Remove passkey ${p.name}`}
                className="passkeys-remove"
              >
                <Trash2 size={16} strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={() => void handleAdd()} disabled={adding} className="passkeys-btn">
        <Plus size={16} strokeWidth={2} aria-hidden /> {adding ? 'Adding…' : 'Add a passkey'}
      </button>
    </section>
  );
}
