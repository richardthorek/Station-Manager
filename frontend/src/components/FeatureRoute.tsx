/**
 * FeatureRoute
 *
 * Gates a route behind a SaaS feature entitlement. When the current
 * organization does not have the feature, renders a friendly "not on your plan"
 * panel with a link to the Organization screen instead of the page.
 *
 * Back-compatible: when there is no organization context (single-tenant /
 * kiosk / demo), `hasFeature` returns true and children render normally.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type EntitlementFeature } from '../contexts/AuthContext';
import { LoadingFallback } from './LoadingFallback';

interface FeatureRouteProps {
  feature: EntitlementFeature;
  title: string;
  children: ReactNode;
}

export function FeatureRoute({ feature, title, children }: FeatureRouteProps) {
  const { hasFeature, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!hasFeature(feature)) {
    return (
      <div style={{ maxWidth: 560, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }} aria-hidden="true">🔒</div>
        <h1>{title} isn’t enabled</h1>
        <p>
          This module isn’t available on your current plan, or has been turned off for your brigade.
          An owner can change this on the Organization screen.
        </p>
        <p style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <Link to="/admin/organization" className="feature-link">Manage organization →</Link>
          <Link to="/" className="feature-link">Back to home</Link>
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
