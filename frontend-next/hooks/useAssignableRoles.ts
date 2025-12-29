import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * SSoT: Assignable roles for task/schedule assignment
 *
 * Fetches from /api/v1/sm_settings/assignable_roles (backend SSoT: User::ASSIGNABLE_ROLES)
 * Falls back to defaults if API call fails.
 *
 * Usage:
 *   const { roles, isLoading } = useAssignableRoles();
 *   // roles = [{ value: 'admin', label: 'Admin' }, ...]
 */

export interface AssignableRole {
  value: string;
  label: string;
  description?: string;
}

// Fallback defaults in case API fails
const DEFAULT_ASSIGNABLE_ROLES: AssignableRole[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'site', label: 'Site' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'builder', label: 'Builder' },
  { value: 'estimator', label: 'Estimator' },
];

// Module-level cache to avoid refetching
let cachedRoles: AssignableRole[] | null = null;
let fetchPromise: Promise<AssignableRole[]> | null = null;

async function fetchRoles(): Promise<AssignableRole[]> {
  try {
    const response = await api.get<{
      success: boolean;
      assignable_roles: Array<{ value: string; label: string }>
    }>('/api/v1/sm_settings/assignable_roles');

    if (response?.assignable_roles) {
      return response.assignable_roles;
    }
  } catch (err) {
    console.warn('Failed to fetch assignable roles, using defaults:', err);
  }
  return DEFAULT_ASSIGNABLE_ROLES;
}

export function useAssignableRoles(): {
  roles: AssignableRole[];
  isLoading: boolean;
  /** Roles with "None" option prepended - useful for optional fields */
  rolesWithNone: AssignableRole[];
} {
  const [roles, setRoles] = useState<AssignableRole[]>(cachedRoles || DEFAULT_ASSIGNABLE_ROLES);
  const [isLoading, setIsLoading] = useState(!cachedRoles);

  useEffect(() => {
    // If already cached, no need to fetch
    if (cachedRoles) {
      setRoles(cachedRoles);
      setIsLoading(false);
      return;
    }

    // If already fetching, wait for it
    if (fetchPromise) {
      fetchPromise.then(result => {
        cachedRoles = result;
        setRoles(result);
        setIsLoading(false);
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
    });
  }, []);

  const rolesWithNone: AssignableRole[] = [
    { value: '', label: 'None', description: 'No group assignment' },
    ...roles,
  ];

  return { roles, isLoading, rolesWithNone };
}

// For components that just need the static list without hook overhead
export { DEFAULT_ASSIGNABLE_ROLES };
