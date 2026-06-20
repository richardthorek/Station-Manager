import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './TrialBanner.css';

export function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBillingStatus()
      .then(s => {
        if (s.status === 'trialing' && s.trialEndsAt) {
          const ms = new Date(s.trialEndsAt).getTime() - Date.now();
          setDaysLeft(Math.max(0, Math.ceil(ms / 86_400_000)));
        }
      })
      .catch(() => {/* silently ignore — trial banner is non-critical */});
  }, []);

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
