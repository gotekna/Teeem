/**
 * useSettingsAccess - Role-based access control for Settings pages
 *
 * SSoT for determining what settings sections a user can access.
 * Used by settings/layout.tsx to show/hide Organization tabs.
 *
 * Personal tabs (Profile, Notifications, Security, Preferences): All users
 * Organization tabs (Users, Roles, Company, etc.): Admin or users with settings permission
 */

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermission } from "@/hooks/usePermission";
import { SYSTEM_ROLES } from "@/lib/constants/roles";
import { PERMISSION_LEVELS } from "@/lib/constants/permission-levels";

interface SettingsAccess {
  /** User has admin role - can access organization settings */
  isAdmin: boolean;
  /** Can access organization-level settings (admin OR has settings permission) */
  canAccessOrgSettings: boolean;
  /** User is authenticated */
  isAuthenticated: boolean;
}

export function useSettingsAccess(): SettingsAccess {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();

  const isAdmin = useMemo(() => {
    if (!user) return false;

    // Check role_names array for "admin"
    if (user.role_names?.some((r) => r.toLowerCase() === SYSTEM_ROLES.ADMIN)) {
      return true;
    }

    // Check single role field
    if (typeof user.role === "string" && user.role.toLowerCase() === SYSTEM_ROLES.ADMIN) {
      return true;
    }

    return false;
  }, [user]);

  const canAccessOrgSettings = useMemo(() => {
    if (isAdmin) return true;
    // Non-admin users with settings.view_all or higher can see org settings
    return hasPermission("settings", PERMISSION_LEVELS.VIEW_ALL);
  }, [isAdmin, hasPermission]);

  return {
    isAdmin,
    canAccessOrgSettings,
    isAuthenticated,
  };
}
