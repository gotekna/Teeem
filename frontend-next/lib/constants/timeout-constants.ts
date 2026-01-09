/**
 * Timeout Constants - Single Source of Truth (SSoT)
 *
 * All timeout-related constants should be imported from this file.
 * This ensures consistent timeout behavior across the codebase.
 *
 * Usage:
 *   import { API_TIMEOUT, UI_TIMEOUTS } from '@/lib/constants/timeout-constants';
 */

// =============================================================================
// API TIMEOUT CONSTANTS
// =============================================================================

/**
 * Default timeout for standard API calls (30 seconds).
 * Most API calls should complete within this time.
 * SSoT for: lib/api.ts
 */
export const API_TIMEOUT_DEFAULT = 30000;

/**
 * Timeout for email sync operations (15 seconds).
 * Email sync may involve multiple API calls.
 * SSoT for: lib/email-sync.ts
 */
export const API_TIMEOUT_EMAIL_SYNC = 15000;

/**
 * Timeout for offline email operations (10 seconds).
 * Shorter timeout for better UX when offline detection fails.
 * SSoT for: hooks/useOfflineEmails.ts, components/emails/SplitInboxTabs.tsx
 */
export const API_TIMEOUT_EMAIL_OFFLINE = 10000;

/**
 * Timeout for file upload operations (60 seconds).
 * Large files may take longer to upload.
 * SSoT for: components/jobs/JobPlansTab.tsx
 */
export const API_TIMEOUT_FILE_UPLOAD = 60000;

/**
 * Timeout for heavy sync operations (120 seconds).
 * Operations like "sync all companies" may take a while.
 * SSoT for: app/(app)/corporate/page.tsx
 */
export const API_TIMEOUT_HEAVY_SYNC = 120000;

/**
 * Base delay for retry logic (1 second).
 * Doubles with each retry attempt.
 * SSoT for: lib/api.ts
 */
export const API_RETRY_DELAY_BASE = 1000;

// =============================================================================
// UI FEEDBACK TIMEOUTS
// =============================================================================

/**
 * Duration to show copy confirmation feedback (2 seconds).
 * Used after copying text to clipboard.
 */
export const UI_COPY_FEEDBACK_MS = 2000;

/**
 * Duration to show success messages (3 seconds).
 * Standard duration for success toast/messages.
 */
export const UI_SUCCESS_MESSAGE_MS = 3000;

/**
 * Duration to show export status (5 seconds).
 * Longer duration for export completion feedback.
 */
export const UI_EXPORT_STATUS_MS = 5000;

/**
 * Duration for auto-save status indicator (2-3 seconds).
 * Shows "Saved" indicator briefly after auto-save.
 */
export const UI_AUTOSAVE_FEEDBACK_MS = 2000;

// =============================================================================
// DEBOUNCE CONSTANTS
// =============================================================================

/**
 * Standard search debounce delay (300ms).
 * Prevents excessive API calls while typing.
 * Note: CONTACT_SEARCH_DEBOUNCE_MS in email-constants.ts also uses 300ms.
 */
export const DEBOUNCE_SEARCH_MS = 300;

/**
 * Short delay for state synchronization (100ms).
 * Used for quick UI updates and state sync.
 */
export const DEBOUNCE_SHORT_MS = 100;

/**
 * Medium delay for UI transitions (200ms).
 * Used for sequential operations.
 */
export const DEBOUNCE_MEDIUM_MS = 200;

// =============================================================================
// POLLING/RETRY CONSTANTS
// =============================================================================

/**
 * Delay before retrying failed operations (2 seconds).
 */
export const RETRY_DELAY_MS = 2000;

/**
 * Delay before polling for updates (3 seconds).
 */
export const POLLING_DELAY_MS = 3000;

// =============================================================================
// GROUPED EXPORTS
// =============================================================================

/**
 * All API timeout constants grouped for convenient importing.
 */
export const API_TIMEOUTS = {
  DEFAULT: API_TIMEOUT_DEFAULT,
  EMAIL_SYNC: API_TIMEOUT_EMAIL_SYNC,
  EMAIL_OFFLINE: API_TIMEOUT_EMAIL_OFFLINE,
  FILE_UPLOAD: API_TIMEOUT_FILE_UPLOAD,
  HEAVY_SYNC: API_TIMEOUT_HEAVY_SYNC,
  RETRY_BASE: API_RETRY_DELAY_BASE,
} as const;

/**
 * All UI feedback timeout constants grouped.
 */
export const UI_TIMEOUTS = {
  COPY_FEEDBACK: UI_COPY_FEEDBACK_MS,
  SUCCESS_MESSAGE: UI_SUCCESS_MESSAGE_MS,
  EXPORT_STATUS: UI_EXPORT_STATUS_MS,
  AUTOSAVE_FEEDBACK: UI_AUTOSAVE_FEEDBACK_MS,
} as const;

/**
 * All debounce constants grouped.
 */
export const DEBOUNCE = {
  SEARCH: DEBOUNCE_SEARCH_MS,
  SHORT: DEBOUNCE_SHORT_MS,
  MEDIUM: DEBOUNCE_MEDIUM_MS,
} as const;
