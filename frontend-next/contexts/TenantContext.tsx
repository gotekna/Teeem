'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

// Tenant types
export interface Tenant {
  id: number;
  name: string;
  slug: string;
  tier: 'shared' | 'dedicated';
  environment: 'staging' | 'beta' | 'production';
  isMasterTenant: boolean;
  loginUrl: string;
  logoUrl?: string;
  primaryColor?: string;
  stats?: {
    usersCount: number;
    jobsCount: number;
    contactsCount: number;
  };
}

interface TenantUser {
  id: number;
  email: string;
  name: string;
  isTeeemStaff: boolean;
}

interface TenantContextType {
  // State
  tenants: Tenant[];
  currentTenant: Tenant | null;
  user: TenantUser | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  switchTenant: (tenantId: number) => Promise<boolean>;
  clearTenantOverride: () => Promise<boolean>;
  refreshTenants: () => Promise<void>;

  // Helpers
  isTeeemStaff: boolean;
  canSwitchTenants: boolean;
}

interface TenantsResponse {
  success: boolean;
  tenants: Tenant[];
  current_tenant: Tenant | null;
  user: TenantUser;
  error?: string;
}

interface SwitchResponse {
  success: boolean;
  tenant?: Tenant;
  message?: string;
  error?: string;
}

const TenantContext = createContext<TenantContextType | null>(null);

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

// Optional hook that doesn't throw if outside provider
export const useTenantOptional = (): TenantContextType | null => {
  return useContext(TenantContext);
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider = ({ children }: TenantProviderProps) => {
  const { user: authUser, isAuthenticated } = useAuth();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [user, setUser] = useState<TenantUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tenants when authenticated
  const loadTenants = useCallback(async () => {
    if (!isAuthenticated) {
      setTenants([]);
      setCurrentTenant(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get<TenantsResponse>('/api/v1/admin/tenants');

      if (response.success) {
        setTenants(response.tenants || []);
        setCurrentTenant(response.current_tenant);
        setUser(response.user);
      } else {
        setError(response.error || 'Failed to load tenants');
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
      // Don't set error for non-TEEEM staff (they just won't see tenants)
      setTenants([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Load tenants on auth state change
  useEffect(() => {
    loadTenants();
  }, [loadTenants, authUser?.id]);

  // Switch to a different tenant
  const switchTenant = useCallback(async (tenantId: number): Promise<boolean> => {
    console.log('[TenantSwitch] Attempting to switch to tenant:', tenantId);
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.post<SwitchResponse>(`/api/v1/admin/tenants/${tenantId}/switch`);
      console.log('[TenantSwitch] API response:', response);

      if (response?.success && response?.tenant) {
        const targetEnv = response.tenant.environment;
        const currentHost = window.location.hostname;

        // ════════════════════════════════════════════════════════════════════
        // CROSS-ENVIRONMENT REDIRECT
        // When switching to a tenant in a different environment, redirect to
        // that environment's frontend URL instead of just reloading.
        // ════════════════════════════════════════════════════════════════════

        // Determine current environment from hostname
        const isOnStaging = currentHost.includes('staging') || currentHost.includes('localhost');
        const isOnBeta = currentHost.includes('beta');
        const isOnProduction = currentHost === 'teeem.vercel.app' ||
                              (currentHost.includes('teeem') && !isOnStaging && !isOnBeta);

        // Environment frontend URLs (SSoT: CorporateCompanySetting::FRONTEND_ENVIRONMENT_URLS)
        const FRONTEND_URLS: Record<string, string> = {
          staging: 'https://teeem-staging.vercel.app',
          beta: 'https://teeem-beta.vercel.app',
          production: 'https://teeem.vercel.app',
        };

        // Check if we need to redirect to a different environment
        const needsRedirect = (
          (targetEnv === 'staging' && !isOnStaging) ||
          (targetEnv === 'beta' && !isOnBeta) ||
          (targetEnv === 'production' && !isOnProduction)
        );

        if (needsRedirect) {
          const targetBaseUrl = FRONTEND_URLS[targetEnv] || FRONTEND_URLS.production;
          console.log(`[TenantSwitch] Environment change: ${targetEnv} - redirecting to ${targetBaseUrl}`);

          // Get the current token from localStorage to pass to the new frontend
          // (localStorage is per-domain, so we need to pass the token in the URL)
          const currentToken = localStorage.getItem('token');

          // Build redirect URL with token for cross-domain authentication
          const redirectUrl = new URL('/login', targetBaseUrl);
          if (currentToken) {
            redirectUrl.searchParams.set('token', currentToken);
          }
          redirectUrl.searchParams.set('redirect', window.location.pathname);

          // Also pass the target API URL for the new environment
          const API_URLS: Record<string, string> = {
            staging: 'https://teeem-staging-d60a657ed68a.herokuapp.com',
            beta: 'https://teeem-beta-6e3e9cb59225.herokuapp.com',
            production: 'https://teeem-production-121159e1ff9d.herokuapp.com',
          };
          const targetApiUrl = API_URLS[targetEnv];
          if (targetApiUrl) {
            redirectUrl.searchParams.set('api_url', targetApiUrl);
          }
          redirectUrl.searchParams.set('environment', targetEnv);

          console.log(`[TenantSwitch] Redirecting to: ${redirectUrl.toString()}`);
          window.location.href = redirectUrl.toString();
          return true;
        }

        // Same environment - just reload
        console.log('[TenantSwitch] Same environment - reloading page');
        setCurrentTenant(response.tenant);
        window.location.reload();
        return true;
      } else {
        console.error('[TenantSwitch] Failed:', response?.error);
        setError(response?.error || 'Failed to switch tenant');
        return false;
      }
    } catch (err) {
      console.error('[TenantSwitch] Exception:', err);
      setError('Failed to switch tenant');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear tenant override (return to default)
  const clearTenantOverride = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.delete<SwitchResponse>('/api/v1/admin/tenants/switch');

      if (response?.success) {
        // Reload to get default tenant context
        window.location.reload();
        return true;
      } else {
        setError(response?.error || 'Failed to clear tenant override');
        return false;
      }
    } catch (err) {
      console.error('Failed to clear tenant override:', err);
      setError('Failed to clear tenant override');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh tenants list
  const refreshTenants = useCallback(async () => {
    await loadTenants();
  }, [loadTenants]);

  // Derived state
  const isTeeemStaff = user?.isTeeemStaff ?? false;
  const canSwitchTenants = isTeeemStaff && tenants.length > 1;

  const value: TenantContextType = {
    tenants,
    currentTenant,
    user,
    isLoading,
    error,
    switchTenant,
    clearTenantOverride,
    refreshTenants,
    isTeeemStaff,
    canSwitchTenants,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
