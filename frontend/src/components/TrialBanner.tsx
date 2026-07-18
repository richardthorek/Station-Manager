import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './TrialBanner.css';

export function TrialBanner() {
  // Q42 (found 2026-07-17): mounted globally in App.tsx, above the route
  // tree, so it rendered — and called the authed-only billing endpoint —
  // on every page including the public marketing page for a logged-out
  // visitor. GET /api/billing/status requires authMiddleware, so that was
  // a guaranteed 401 on every anonymous page load; harmless (silently
  // caught) but pure noise. Gate on being signed in instead of firing and
  // discarding the request on every anonymous page load.
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    api.getBillingStatus()
      .then(s => {
        if (s.status === 'trialing' && s.trialEndsAt) {
          const ms = new Date(s.trialEndsAt).getTime() - Date.now();
          setDaysLeft(Math.max(0, Math.ceil(ms / 86_400_000)));
        }
      })
      .catch(() => {/* silently ignore — trial banner is non-critical */});
  }, [authLoading, isAuthenticated]);

  if (daysLeft === null) return null;

  async function handleUpgrade() {
    setLoading(true);
    try {
      const { checkoutUrl } = await api.createCheckoutSession('basic', 'monthly');
      window.location.href = checkoutUrl;
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="trial-banner" role="status">
      <span className="trial-banner__text">
        {daysLeft === 0
          ? 'Your free trial has ended.'
          : `Free trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
      </span>
      <button
        className="trial-banner__cta"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? 'Opening…' : 'Add payment method'}
      </button>
    </div>
  );
}
