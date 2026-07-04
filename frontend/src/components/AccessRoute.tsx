/**
 * AccessRoute
 *
 * Gates the walk-up sign-in surfaces so the app can only be reached with a
 * legitimate access credential — not by typing the bare URL. Access is allowed
 * when the visitor:
 *   - is signed in (a manager/member account), OR
 *   - arrived on a brigade device via its unique code (kiosk mode,
 *     `?brigade=<token>`), OR
 *   - is in the public demo (`?demo=true`, sticky for the session).
 *
 * Anyone else — a bare visit to `/signin` with no code and no account — is sent
 * to the front door (`/`), which shows the marketing page when logged out.
 *
 * This is intentionally *stricter* than FeatureRoute (which is default-open
 * with no org context). FeatureRoute answers "does this brigade's plan include
 * the module?"; AccessRoute answers "is this visitor allowed in at all?".
 * Compose them: AccessRoute (outer) → FeatureRoute (inner).
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingFallback } from './LoadingFallback';
import { isKioskMode } from '../utils/kioskMode';
import { isDemoActive } from '../utils/demoMode';

interface AccessRouteProps {
  children: ReactNode;
}

export function AccessRoute({ children }: AccessRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  const allowed = isAuthenticated || isKioskMode() || isDemoActive();
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
