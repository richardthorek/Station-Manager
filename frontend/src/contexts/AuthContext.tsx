/**
 * Authentication Context
 *
 * Provides authentication + SaaS tenancy state throughout the application.
 * Manages JWT token storage, login/signup/logout, the current Organization,
 * and feature entitlements used to gate modules (sign-in book, truck check,
 * reports, AI).
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export type EntitlementFeature =
  | 'signInEnabled'
  | 'truckCheckEnabled'
  | 'reportsEnabled'
  | 'aiEnabled'
  | 'aarStudioEnabled'
  | 'santaRunEnabled'
  | 'fireBreakEnabled';

export interface Entitlements {
  signInEnabled: boolean;
  truckCheckEnabled: boolean;
  reportsEnabled: boolean;
  aiEnabled: boolean;
  maxStations: number;
  maxDevices: number;
  maxMembers?: number;
  maxVehicles?: number;
  aiIncludedSessions: number;
  aarStudioEnabled?: boolean;
  santaRunEnabled?: boolean;
  fireBreakEnabled?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  planCode: 'community' | 'basic' | 'ai';
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  entitlements: Entitlements;
}

interface User {
  id: string;
  username: string;
  role: 'owner' | 'admin' | 'viewer';
  organizationId?: string;
  lastLoginAt?: Date;
}

interface SignupInput {
  organizationName: string;
  billingEmail: string;
  username: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  entitlements: Entitlements | null;
  requireAuth: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
  refreshOrganization: () => Promise<void>;
  /** Feature gate. Defaults to allowed when there is no org context (single-tenant / back-compat). */
  hasFeature: (feature: EntitlementFeature) => boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [requireAuth, setRequireAuth] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /** Load the current user + organization + entitlements from /auth/me. */
  const loadMe = useCallback(async (authToken: string): Promise<boolean> => {
    const response = await fetch(`${apiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) return false;
    const me = await response.json();
    setUser({
      id: me.id,
      username: me.username,
      role: me.role,
      organizationId: me.organizationId,
      lastLoginAt: me.lastLoginAt,
    });
    setOrganization(me.organization ?? null);
    setEntitlements(me.entitlements ?? null);
    setToken(authToken);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ id: me.id, username: me.username, role: me.role, organizationId: me.organizationId }),
    );
    return true;
  }, []);

  // Check for stored token on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const configResponse = await fetch(`${apiBase()}/auth/config`);
        const configData = await configResponse.json();
        setRequireAuth(configData.requireAuth);

        // Attempt to restore a session whenever a token is present, regardless
        // of REQUIRE_AUTH — org users need their entitlements either way.
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          const ok = await loadMe(storedToken);
          if (!ok) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [loadMe]);

  const login = async (username: string, password: string) => {
    const response = await fetch(`${apiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Login failed');
    }
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    // Populate org + entitlements via /auth/me (login response omits them).
    await loadMe(data.token);
  };

  const signup = async (input: SignupInput) => {
    const response = await fetch(`${apiBase()}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Sign-up failed');
    }
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setOrganization(data.organization ?? null);
    setEntitlements(data.organization?.entitlements ?? null);
  };

  const logout = () => {
    const currentToken = token;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setOrganization(null);
    setEntitlements(null);
    if (currentToken) {
      fetch(`${apiBase()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => undefined);
    }
  };

  const refreshOrganization = useCallback(async () => {
    if (token) {
      await loadMe(token);
    }
  }, [token, loadMe]);

  const hasFeature = useCallback(
    (feature: EntitlementFeature): boolean => {
      // No entitlements loaded → single-tenant/back-compat → everything allowed.
      if (!entitlements) return true;
      return Boolean(entitlements[feature]);
    },
    [entitlements],
  );

  const isAuthenticated = token !== null && user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        organization,
        entitlements,
        requireAuth,
        isLoading,
        login,
        signup,
        logout,
        refreshOrganization,
        hasFeature,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { TOKEN_KEY };
