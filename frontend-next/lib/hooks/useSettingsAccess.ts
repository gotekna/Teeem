/**
 * useSettingsAccess - Role-based access control for Settings pages
 *
 * SSoT for determining what settings sections a user can access.
 * Used by settings/layout.tsx to show/hide Organization tabs.
 *
 * Personal tabs (Profile, Notifications, Security, Preferences): All users
 * Organization tabs (Users, Roles, Company, etc.): Admin role only
 */

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SettingsAccess {
  /** User has admin role - can access organization settings */
  isAdmin: boolean;
  /** Alias for isAdmin - can access organization-level settings */
  canAccessOrgSettings: boolean;
  /** User is authenticated */
  isAuthenticated: boolean;
}

export function useSettingsAccess(): SettingsAccess {
  const { user, isAuthenticated } = useAuth();

  const isAdmin = useMemo(() => {
    if (!user) return false;

    // Check permissions array for "admin"
    if (user.permissions?.includes("admin")) {
      return true;
    }

    // Check role_names array for "admin" (case-insensitive)
    const roleNames = (user as { role_names?: string[] }).role_names;
    if (Array.isArray(roleNames)) {
      return roleNames.some((r) => r.toLowerCase() === "admin");
    }

    // Check single role field
    const role = (user as { role?: string }).role;
    if (typeof role === "string") {
      return role.toLowerCase() === "admin";
    }

    return false;
  }, [user]);

  return {
    isAdmin,
    canAccessOrgSettings: isAdmin,
    isAuthenticated,
  };
}
