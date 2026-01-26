/**
 * Status Colors - SSoT for UI Status Indicators
 *
 * Centralized Tailwind class definitions for status colors.
 * Use this for StatusIndicator, Badges, Pills, and any status display.
 *
 * For canvas/chart rendering (hex values), use color-constants.ts instead.
 *
 * Usage:
 *   import { STATUS_COLOR_CLASSES, getStatusClasses, StatusType } from '@/lib/constants/status-colors';
 *
 *   // Get classes for a status
 *   const classes = getStatusClasses('success');
 *   // => { dot: "bg-green-500", badge: "bg-status-success text-status-success-foreground", ... }
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Supported status types for UI indicators.
 * Maps to semantic meaning per Brand Guidelines.
 */
export type StatusType =
  | "active"     // Green - Active, online, enabled
  | "success"    // Green - Completed, approved, valid
  | "warning"    // Amber - Pending, attention needed
  | "error"      // Red - Failed, invalid, blocked
  | "inactive"   // Gray - Disabled, offline, archived
  | "info";      // Blue - Processing, informational

/**
 * CSS class definitions for each status type.
 */
export interface StatusColorClasses {
  /** Solid color for dots */
  dot: string;
  /** Light background with dark text (badge style) */
  badge: string;
  /** Badge with dark mode support */
  badgeDark: string;
  /** Text color only */
  text: string;
  /** Border color */
  border: string;
}

// =============================================================================
// Status Color Definitions (SSoT)
// =============================================================================

/**
 * Status color classes mapped to semantic status types.
 *
 * Uses Tailwind's design system colors for consistency.
 * Dark mode variants included where needed.
 */
export const STATUS_COLOR_CLASSES: Record<StatusType, StatusColorClasses> = {
  active: {
    dot: "bg-green-500",
    badge: "bg-status-success text-status-success-foreground",
    badgeDark: "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-300 dark:border-green-700",
  },
  success: {
    dot: "bg-green-500",
    badge: "bg-status-success text-status-success-foreground",
    badgeDark: "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-300",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-300 dark:border-green-700",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-status-warning text-status-warning-foreground",
    badgeDark: "bg-status-warning text-status-warning-foreground dark:bg-amber-900/30 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-700",
  },
  error: {
    dot: "bg-red-500",
    badge: "bg-status-error text-status-error-foreground",
    badgeDark: "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-300",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-300 dark:border-red-700",
  },
  inactive: {
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-700",
    badgeDark: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    text: "text-gray-500 dark:text-gray-400",
    border: "border-gray-300 dark:border-gray-600",
  },
  info: {
    dot: "bg-blue-500",
    badge: "bg-status-info text-status-info-foreground",
    badgeDark: "bg-status-info text-status-info-foreground dark:bg-blue-900/30 dark:text-blue-300",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-300 dark:border-blue-700",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get status color classes for a given status type.
 *
 * @param status - The status type
 * @returns StatusColorClasses with all color definitions
 */
export function getStatusClasses(status: StatusType): StatusColorClasses {
  return STATUS_COLOR_CLASSES[status] ?? STATUS_COLOR_CLASSES.inactive;
}

/**
 * Get the dot color class for a status.
 *
 * @param status - The status type
 * @returns Tailwind class for the dot background color
 */
export function getStatusDotClass(status: StatusType): string {
  return STATUS_COLOR_CLASSES[status]?.dot ?? STATUS_COLOR_CLASSES.inactive.dot;
}

/**
 * Get badge classes for a status (with dark mode support).
 *
 * @param status - The status type
 * @returns Tailwind classes for badge styling
 */
export function getStatusBadgeClass(status: StatusType): string {
  return STATUS_COLOR_CLASSES[status]?.badgeDark ?? STATUS_COLOR_CLASSES.inactive.badgeDark;
}

// =============================================================================
// Status Aliases (Map common terms to StatusType)
// =============================================================================

/**
 * Common status string mappings to StatusType.
 * Use normalizeStatus() to convert arbitrary strings.
 */
export const STATUS_ALIASES: Record<string, StatusType> = {
  // Active/Success
  active: "active",
  enabled: "active",
  online: "active",
  connected: "active",
  success: "success",
  completed: "success",
  approved: "success",
  valid: "success",
  done: "success",
  current: "success",

  // Warning
  warning: "warning",
  pending: "warning",
  attention: "warning",
  review: "warning",
  partial: "warning",
  expiring: "warning",
  "expiring soon": "warning",

  // Error
  error: "error",
  failed: "error",
  invalid: "error",
  blocked: "error",
  rejected: "error",
  expired: "error",
  overdue: "error",

  // Inactive
  inactive: "inactive",
  disabled: "inactive",
  offline: "inactive",
  archived: "inactive",
  draft: "inactive",
  paused: "inactive",

  // Info
  info: "info",
  processing: "info",
  "in progress": "info",
  syncing: "info",
  loading: "info",
};

/**
 * Normalize a status string to a StatusType.
 *
 * @param status - Any status string (case-insensitive)
 * @returns The corresponding StatusType, defaults to "inactive"
 */
export function normalizeStatus(status: string): StatusType {
  const normalized = status.toLowerCase().trim();
  return STATUS_ALIASES[normalized] ?? "inactive";
}

/**
 * Check if a string is a valid StatusType.
 */
export function isValidStatusType(value: string): value is StatusType {
  return ["active", "success", "warning", "error", "inactive", "info"].includes(value);
}
