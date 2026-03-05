"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSION_LEVELS, type PermissionLevel } from "@/lib/constants/permission-levels";
import { SYSTEM_ROLES } from "@/lib/constants/roles";

/**
 * SSoT: Frontend permission check hook
 * Uses the current user's section_permissions from the auth context
 *
 * Usage:
 *   const { hasPermission, permissionLevel } = usePermission();
 *   if (hasPermission("jobs", PERMISSION_LEVELS.EDIT)) { ... }
 */
export function usePermission() {
  const { user: currentUser } = useAuth();

  const permissionLevel = useCallback(
    (permissionKey: string): PermissionLevel => {
      // Admin bypasses all checks
      if (currentUser?.role_names?.includes(SYSTEM_ROLES.ADMIN)) {
        return PERMISSION_LEVELS.FULL;
      }

      // Check section_permissions on user object (populated by auth)
      const sectionPerms = (currentUser as Record<string, unknown>)
        ?.section_permissions as Record<string, number> | undefined;

      if (!sectionPerms) return PERMISSION_LEVELS.NO_ACCESS;

      return (sectionPerms[permissionKey] ?? PERMISSION_LEVELS.NO_ACCESS) as PermissionLevel;
    },
    [currentUser]
  );

  const hasPermission = useCallback(
    (permissionKey: string, requiredLevel: PermissionLevel): boolean => {
      return permissionLevel(permissionKey) >= requiredLevel;
    },
    [permissionLevel]
  );

  return { hasPermission, permissionLevel };
}
