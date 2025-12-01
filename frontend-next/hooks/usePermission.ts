'use client';

import { useAuth } from '@/contexts/AuthContext';

/**
 * Custom hook for checking user permissions
 *
 * Usage:
 *   const { can, canAny, canAll } = usePermission()
 *
 *   if (can('edit_projects')) { ... }
 *   if (canAny('edit_projects', 'view_gantt')) { ... }
 *   if (canAll('edit_projects', 'manage_permissions')) { ... }
 */
export const usePermission = () => {
  const { user } = useAuth();

  /**
   * Check if user has a specific permission
   * @param permissionName - The permission to check (e.g., 'edit_projects')
   * @returns True if user has the permission
   */
  const can = (permissionName: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionName);
  };

  /**
   * Check if user has ANY of the given permissions
   * @param permissionNames - The permissions to check
   * @returns True if user has at least one of the permissions
   */
  const canAny = (...permissionNames: string[]): boolean => {
    return permissionNames.some(permission => can(permission));
  };

  /**
   * Check if user has ALL of the given permissions
   * @param permissionNames - The permissions to check
   * @returns True if user has all of the permissions
   */
  const canAll = (...permissionNames: string[]): boolean => {
    return permissionNames.every(permission => can(permission));
  };

  return {
    can,
    canAny,
    canAll,
    permissions: user?.permissions || []
  };
};
