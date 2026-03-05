"use client";

import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { PermissionLevel } from "@/lib/constants/permission-levels";

interface PermissionGateProps {
  /** The permission key to check (e.g. "jobs", "contacts.create") */
  permission: string;
  /** The minimum level required */
  level: PermissionLevel;
  /** Content to show when user has permission */
  children: ReactNode;
  /** Optional fallback when user lacks permission */
  fallback?: ReactNode;
}

/**
 * SSoT: Wrapper component for permission-gated UI
 * Renders children only if user has the required permission level
 *
 * Usage:
 *   <PermissionGate permission="jobs" level={PERMISSION_LEVELS.EDIT}>
 *     <Button>Edit Job</Button>
 *   </PermissionGate>
 */
export function PermissionGate({
  permission,
  level,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission } = usePermission();

  if (!hasPermission(permission, level)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
