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
import './FeatureRoute.css';

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
      <div className="feature-gate">
        <div className="feature-gate__icon" aria-hidden="true">🔒</div>
        <h1 className="feature-gate__title">{title} isn't on your plan</h1>
        <p className="feature-gate__body">
          This module isn't available on your current plan, or has been turned off for your brigade.
          An owner can enable it on the Organization screen.
        </p>
        <div className="feature-gate__actions">
          <Link to="/admin/organization" className="feature-gate__link feature-gate__link--primary">
            View upgrade options →
          </Link>
          <Link to="/" className="feature-gate__link feature-gate__link--secondary">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
