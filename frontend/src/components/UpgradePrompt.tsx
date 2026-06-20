import { useState } from 'react';
import { api } from '../services/api';
import './UpgradePrompt.css';

interface Props {
  feature: string;
  requiredPlan: 'basic' | 'ai';
  message?: string;
}

export function UpgradePrompt({ feature, requiredPlan, message }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planLabels: Record<string, string> = { basic: 'Basic', ai: 'AI Pro' };
  const planPrices: Record<string, string> = { basic: 'A$10/mo', ai: 'A$19/mo' };

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.createCheckoutSession(requiredPlan, 'monthly');
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setLoading(false);
    }
  }

  return (
    <div className="upgrade-prompt" role="region" aria-label="Plan upgrade required">
      <div className="upgrade-prompt__icon" aria-hidden="true">🔒</div>
      <h3 className="upgrade-prompt__title">
        {message ?? `${feature} requires the ${planLabels[requiredPlan]} plan`}
      </h3>
      <p className="upgrade-prompt__price">
        From {planPrices[requiredPlan]} per brigade · 14-day free trial
      </p>
      {error && <p className="upgrade-prompt__error" role="alert">{error}</p>}
      <button
        className="upgrade-prompt__cta"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? 'Opening checkout…' : `Upgrade to ${planLabels[requiredPlan]}`}
      </button>
    </div>
  );
}
