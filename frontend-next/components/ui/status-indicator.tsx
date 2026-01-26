/**
 * StatusIndicator - SSoT for status display
 *
 * Use this component for displaying status with consistent styling.
 * Supports dot-only, badge, and dot+text variants.
 *
 * Usage:
 *   import { StatusIndicator } from "@/components/ui/status-indicator";
 *
 *   <StatusIndicator status="active" />
 *   <StatusIndicator status="warning" variant="badge" label="Pending" />
 *   <StatusIndicator status="error" variant="dot-text" label="Failed" />
 *
 * @see /lib/constants/status-colors.ts for SSoT color definitions
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  type StatusType,
  getStatusClasses,
  normalizeStatus,
  isValidStatusType,
} from "@/lib/constants/status-colors";

export interface StatusIndicatorProps {
  /**
   * Status type or string that will be normalized.
   * Valid types: "active", "success", "warning", "error", "inactive", "info"
   * Also accepts aliases like "pending", "completed", "failed", etc.
   */
  status: StatusType | string;

  /**
   * Display variant:
   * - "dot": Small colored dot only
   * - "badge": Label with colored background
   * - "dot-text": Dot followed by text label
   */
  variant?: "dot" | "badge" | "dot-text";

  /** Label text (required for badge and dot-text variants) */
  label?: string;

  /** Size of the indicator */
  size?: "xs" | "sm" | "md";

  /** Additional class names */
  className?: string;

  /** Whether to show a pulse animation (for active states) */
  pulse?: boolean;
}

/**
 * StatusIndicator - THE ONE component for status displays
 *
 * Use for:
 * - Connection status (online/offline)
 * - Task/workflow status
 * - Sync status
 * - Any status that maps to success/warning/error/info/inactive
 */
export function StatusIndicator({
  status,
  variant = "dot",
  label,
  size = "sm",
  className,
  pulse = false,
}: StatusIndicatorProps) {
  // Normalize status string to StatusType
  const normalizedStatus: StatusType = isValidStatusType(status)
    ? status
    : normalizeStatus(status);

  const colors = getStatusClasses(normalizedStatus);

  // Size configurations
  const sizeConfig = {
    xs: {
      dot: "h-1.5 w-1.5",
      badge: "px-1.5 py-0 text-[10px]",
      text: "text-xs",
      gap: "gap-1",
    },
    sm: {
      dot: "h-2 w-2",
      badge: "px-2 py-0.5 text-xs",
      text: "text-sm",
      gap: "gap-1.5",
    },
    md: {
      dot: "h-2.5 w-2.5",
      badge: "px-2.5 py-1 text-sm",
      text: "text-base",
      gap: "gap-2",
    },
  };

  const config = sizeConfig[size];

  // Dot component (shared between dot and dot-text variants)
  const Dot = () => (
    <span
      className={cn(
        "rounded-full shrink-0",
        config.dot,
        colors.dot,
        pulse && "animate-pulse"
      )}
    />
  );

  // Render based on variant
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex", className)}>
        <Dot />
      </span>
    );
  }

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center font-medium",
          config.badge,
          colors.badgeDark,
          className
        )}
      >
        {label ?? normalizedStatus}
      </span>
    );
  }

  // variant === "dot-text"
  return (
    <span className={cn("inline-flex items-center", config.gap, className)}>
      <Dot />
      <span className={cn(config.text, colors.text)}>
        {label ?? normalizedStatus}
      </span>
    </span>
  );
}

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * ActiveIndicator - Shorthand for active status dot with pulse
 */
export function ActiveIndicator({
  label = "Active",
  showLabel = false,
  ...props
}: Omit<StatusIndicatorProps, "status" | "variant"> & { showLabel?: boolean }) {
  return (
    <StatusIndicator
      status="active"
      variant={showLabel ? "dot-text" : "dot"}
      label={label}
      pulse
      {...props}
    />
  );
}

/**
 * StatusBadge - Shorthand for badge variant
 */
export function StatusBadge({
  status,
  label,
  ...props
}: Omit<StatusIndicatorProps, "variant">) {
  return (
    <StatusIndicator
      status={status}
      variant="badge"
      label={label}
      {...props}
    />
  );
}
