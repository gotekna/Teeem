'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';
import { setStorageItem, removeStorageItem, getStorageItem, STORAGE_KEYS } from '@/lib/storage-utils';
import { clearAllCachedRecordsAsync } from '@/lib/records-cache';

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
  // SSoT: Backend provides these from CorporateSetting constants
  frontendUrl?: string;
  apiUrl?: string;
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
  canSwitchTenants?: boolean;
  defaultTenantId?: number;
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

        // FRC (Feb 2026): Detect and clear stale tenant overrides
        // Only clear if the override doesn't match EITHER the backend's current_tenant
        // OR the user's defaultTenantId. This prevents clearing valid overrides during
        // race conditions where the request goes out before the override is in localStorage.
        const storedOverride = getStorageItem<string | null>(STORAGE_KEYS.TENANT_OVERRIDE, null);
        const userDefaultTenantId = response.user?.defaultTenantId;
        if (storedOverride && response.current_tenant &&
            String(response.current_tenant.id) !== String(storedOverride) &&
            (!userDefaultTenantId || String(userDefaultTenantId) !== String(storedOverride))) {
          console.warn(`[TenantContext] Clearing stale tenant override: stored=${storedOverride}, actual=${response.current_tenant.id}, default=${userDefaultTenantId}`);
          removeStorageItem(STORAGE_KEYS.TENANT_OVERRIDE);
        }
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
  // ⚠️ DO NOT SIMPLIFY - Navigation must happen BEFORE React state updates (Mar 2026)
  // ════════════════════════════════════════════════════════════════════
  // Why: setCurrentTenant() triggers a React re-render which can interfere with
  // window.location navigation. Store in localStorage first, navigate immediately,
  // let the fresh page load pick up the new tenant from localStorage.
  // ❌ WRONG: setCurrentTenant(tenant) then navigate (re-render blocks navigation)
  // ✅ CORRECT: setStorageItem → clearCache (fire-and-forget) → navigate immediately
  // ════════════════════════════════════════════════════════════════════
  const switchTenant = useCallback(async (tenantId: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.post<SwitchResponse>(`/api/v1/admin/tenants/${tenantId}/switch`);

      if (response?.success && response?.tenant) {
        // 1. Store tenant override in localStorage FIRST - this is the SSoT for next page load
        setStorageItem(STORAGE_KEYS.TENANT_OVERRIDE, String(response.tenant.id));

        // 2. Clear cached records (fire-and-forget - don't block navigation)
        clearAllCachedRecordsAsync().catch(() => {});

        // 3. Navigate IMMEDIATELY - do NOT update React state first
        // Stay on same page (reload with new tenant context) unless on an entity-specific
        // page (e.g., /document-types/520) where the ID may not exist on the new tenant.
        // For those, navigate to the parent listing page.
        const currentPath = window.location.pathname;
        const entityDetailPattern = /\/(\d+)$/;
        const targetPath = entityDetailPattern.test(currentPath)
          ? currentPath.replace(entityDetailPattern, '')
          : currentPath;
        window.location.replace(targetPath || "/");
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
        // 1. Clear tenant override from localStorage FIRST
        removeStorageItem(STORAGE_KEYS.TENANT_OVERRIDE);
        // 2. Clear cached records (fire-and-forget)
        clearAllCachedRecordsAsync().catch(() => {});
        // 3. Navigate IMMEDIATELY (same pattern as switchTenant)
        // Stay on same page, strip entity IDs that may not exist on new tenant
        const currentPath = window.location.pathname;
        const entityDetailPattern = /\/(\d+)$/;
        const targetPath = entityDetailPattern.test(currentPath)
          ? currentPath.replace(entityDetailPattern, '')
          : currentPath;
        window.location.replace(targetPath || "/");
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
  // canSwitchTenants: TEEEM staff OR user has accounts on multiple tenants (same email)
  const canSwitchTenants = (user?.canSwitchTenants ?? isTeeemStaff) && tenants.length > 1;

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
