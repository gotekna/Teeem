import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * SSoT: Assignable roles for task/schedule assignment
 *
 * Fetches from /api/v1/sm_settings/assignable_roles (backend SSoT: User::ASSIGNABLE_ROLES)
 * Returns empty array while loading or on error - no hardcoded fallback to ensure SSoT.
 *
 * Usage:
 *   const { roles, isLoading, error } = useAssignableRoles();
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage />;
 *   // roles = [{ value: 'admin', label: 'Admin' }, ...]
 */

export interface AssignableRole {
  value: string;
  label: string;
  description?: string;
}

// Module-level cache to avoid refetching
let cachedRoles: AssignableRole[] | null = null;
let fetchPromise: Promise<AssignableRole[]> | null = null;
let fetchError: string | null = null;

async function fetchRoles(): Promise<AssignableRole[]> {
  try {
    const response = await api.get<{
      success: boolean;
      assignable_roles: Array<{ value: string; label: string }>
    }>('/api/v1/sm_settings/assignable_roles');

    if (response?.assignable_roles) {
      fetchError = null;
      return response.assignable_roles;
    }
    fetchError = 'Invalid response from assignable_roles API';
    return [];
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.warn('Failed to fetch assignable roles:', errorMsg);
    fetchError = errorMsg;
    return [];
  }
}

export function useAssignableRoles(): {
  roles: AssignableRole[];
  isLoading: boolean;
  error: string | null;
  /** Roles with "None" option prepended - useful for optional fields */
  rolesWithNone: AssignableRole[];
} {
  const [roles, setRoles] = useState<AssignableRole[]>(cachedRoles || []);
  const [isLoading, setIsLoading] = useState(!cachedRoles);
  const [error, setError] = useState<string | null>(fetchError);

  useEffect(() => {
    // If already cached, no need to fetch
    if (cachedRoles) {
      setRoles(cachedRoles);
      setIsLoading(false);
      setError(fetchError);
      return;
    }

    // If already fetching, wait for it
    if (fetchPromise) {
      fetchPromise.then(result => {
        cachedRoles = result;
        setRoles(result);
        setIsLoading(false);
        setError(fetchError);
      });
      return;
    }

    // Start fetch
    setIsLoading(true);
    fetchPromise = fetchRoles();
    fetchPromise.then(result => {
      cachedRoles = result;
      setRoles(result);
      setIsLoading(false);
      setError(fetchError);
    });
  }, []);

  const rolesWithNone: AssignableRole[] = [
    { value: '', label: 'None', description: 'No group assignment' },
    ...roles,
  ];

  return { roles, isLoading, error, rolesWithNone };
}
