/**
 * Email Constants - Single Source of Truth (SSoT)
 *
 * All email-related constants should be imported from this file.
 * This prevents duplication and ensures consistency across the codebase.
 */

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/**
 * Undo send delay in seconds.
 * After clicking "Send", users have this many seconds to undo before the email is actually sent.
 */
export const UNDO_DELAY_SECONDS = 5;

/**
 * Auto-save interval for email drafts in milliseconds.
 * Drafts are automatically saved to localStorage at this interval.
 */
export const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds

/**
 * Debounce delay for contact search in milliseconds.
 * Prevents excessive API calls while typing in recipient fields.
 */
export const CONTACT_SEARCH_DEBOUNCE_MS = 300;

// =============================================================================
// STORAGE CONSTANTS
// =============================================================================

/**
 * LocalStorage key for email drafts.
 * All draft management should use this key.
 */
export const DRAFTS_STORAGE_KEY = "teeem_email_drafts";

/**
 * Maximum number of drafts to keep in localStorage.
 * Oldest drafts are removed when this limit is exceeded.
 */
export const MAX_DRAFTS = 20;

// =============================================================================
// SEARCH CONSTANTS
// =============================================================================

/**
 * Minimum characters required before contact search is triggered.
 */
export const CONTACT_SEARCH_MIN_CHARS = 2;

/**
 * Maximum number of contact search results to display.
 */
export const CONTACT_SEARCH_MAX_RESULTS = 20;

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

/**
 * Supported email account types.
 * This is the SSoT for account type values across frontend and backend.
 */
export const ACCOUNT_TYPES = ["imap", "outlook", "ms365"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Type guard to check if a string is a valid AccountType.
 */
export function isValidAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.includes(value as AccountType);
}

// =============================================================================
// EMAIL CONSTANTS OBJECT (for grouped imports)
// =============================================================================

/**
 * Grouped email constants for convenient importing.
 * Usage: import { EMAIL_CONSTANTS } from '@/lib/email-constants';
 */
export const EMAIL_CONSTANTS = {
  // Timing
  UNDO_DELAY_SECONDS,
  AUTO_SAVE_INTERVAL_MS,
  CONTACT_SEARCH_DEBOUNCE_MS,

  // Storage
  DRAFTS_STORAGE_KEY,
  MAX_DRAFTS,

  // Search
  CONTACT_SEARCH_MIN_CHARS,
  CONTACT_SEARCH_MAX_RESULTS,

  // Account Types
  ACCOUNT_TYPES,
} as const;
