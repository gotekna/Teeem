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
 * Timeout for map/external API requests (8 seconds).
 * Used for environment maps and other external API calls.
 * SSoT for: app/(app)/dashboard/components/EnvironmentsMap.tsx
 */
export const API_TIMEOUT_EXTERNAL = 8000;

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

/**
 * Delay for cleaning up blob URLs after download (1 second).
 * Ensures browser has time to process the download before revoking the URL.
 * SSoT for: components/emails/AttachmentList.tsx
 */
export const BLOB_URL_CLEANUP_DELAY_MS = 1000;

/**
 * Delay for resetting modal state after close (300ms).
 * Allows closing animation to complete before state reset.
 * SSoT for: components/emails/EmailToContactsModal.tsx
 */
export const MODAL_RESET_DELAY_MS = 300;

/**
 * Short animation delay (100ms).
 * Used for focus management, quick UI transitions, popover delays.
 */
export const UI_ANIMATION_SHORT_MS = 100;

/**
 * Medium animation delay (200ms).
 * Used for sequential UI operations.
 */
export const UI_ANIMATION_MEDIUM_MS = 200;

/**
 * Standard animation delay (500ms).
 * Used for state resets, loading indicators.
 */
export const UI_ANIMATION_STANDARD_MS = 500;

/**
 * Countdown timer tick interval (1 second).
 * Used for email verification countdown, etc.
 */
export const COUNTDOWN_TICK_MS = 1000;

/**
 * Demo loading delay (1.5 seconds).
 * Used in UI components playground for demonstrating loading states.
 * SSoT for: app/(app)/admin/system/components/UIComponentsPlaygroundTab.tsx
 */
export const DEMO_LOADING_MS = 1500;

/**
 * Dynamic title update intervals.
 * Used for progressive title updates at different frequencies.
 */
export const TITLE_UPDATE_FAST_MS = 100;
export const TITLE_UPDATE_MEDIUM_MS = 500;
export const TITLE_UPDATE_SLOW_MS = 1000;
export const TITLE_UPDATE_SLOWEST_MS = 2000;
export const TITLE_UPDATE_INTERVAL_MS = 500;

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

/**
 * Debounce for viewport resize events (100ms).
 * SSoT for: lib/hooks/use-device-context.ts
 */
export const DEBOUNCE_RESIZE_MS = 100;

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

/**
 * Interval for auto-refresh polling (30 seconds).
 * Used for periodic data refreshes in dashboard/stats pages.
 */
export const POLLING_INTERVAL_MS = 30000;

/**
 * Inspiring banner quote refresh interval (1 hour).
 * SSoT for: components/layout/InspiringBanner.tsx
 */
export const POLLING_QUOTE_REFRESH_MS = 3600000;

/**
 * Fast polling interval for status updates (5 seconds).
 * Used for active job/sync status monitoring.
 */
export const POLLING_FAST_MS = 5000;

/**
 * Slow polling interval for background updates (60 seconds).
 * Used for badge counts, non-critical updates.
 */
export const POLLING_SLOW_MS = 60000;

/**
 * Xero sync polling interval (10 seconds).
 * Used for monitoring Xero sync job progress.
 */
export const POLLING_XERO_SYNC_MS = 10000;

/**
 * Chat message polling interval (5 seconds for entity chat, 3 seconds for guest chat).
 * Used for real-time chat updates.
 */
export const POLLING_CHAT_ENTITY_MS = 5000;
export const POLLING_CHAT_GUEST_MS = 3000;

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
  EXTERNAL: API_TIMEOUT_EXTERNAL,
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
  BLOB_URL_CLEANUP: BLOB_URL_CLEANUP_DELAY_MS,
} as const;

/**
 * All debounce constants grouped.
 */
export const DEBOUNCE = {
  SEARCH: DEBOUNCE_SEARCH_MS,
  SHORT: DEBOUNCE_SHORT_MS,
  MEDIUM: DEBOUNCE_MEDIUM_MS,
  RESIZE: DEBOUNCE_RESIZE_MS,
} as const;

/**
 * All polling constants grouped.
 */
export const POLLING = {
  DEFAULT: POLLING_INTERVAL_MS,
  FAST: POLLING_FAST_MS,
  SLOW: POLLING_SLOW_MS,
  RETRY: POLLING_DELAY_MS,
  XERO_SYNC: POLLING_XERO_SYNC_MS,
  CHAT_ENTITY: POLLING_CHAT_ENTITY_MS,
  CHAT_GUEST: POLLING_CHAT_GUEST_MS,
  QUOTE_REFRESH: POLLING_QUOTE_REFRESH_MS,
} as const;

/**
 * All animation/UI timing constants grouped.
 */
export const ANIMATION = {
  SHORT: UI_ANIMATION_SHORT_MS,
  MEDIUM: UI_ANIMATION_MEDIUM_MS,
  STANDARD: UI_ANIMATION_STANDARD_MS,
  MODAL_RESET: MODAL_RESET_DELAY_MS,
  COUNTDOWN_TICK: COUNTDOWN_TICK_MS,
} as const;

/**
 * Title update timing constants grouped.
 */
export const TITLE_UPDATE = {
  FAST: TITLE_UPDATE_FAST_MS,
  MEDIUM: TITLE_UPDATE_MEDIUM_MS,
  SLOW: TITLE_UPDATE_SLOW_MS,
  SLOWEST: TITLE_UPDATE_SLOWEST_MS,
  INTERVAL: TITLE_UPDATE_INTERVAL_MS,
} as const;
