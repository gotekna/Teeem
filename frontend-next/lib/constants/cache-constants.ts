/**
 * Cache Constants - Single Source of Truth (SSoT)
 *
 * All cache TTL and expiry constants should be imported from this file.
 * This ensures consistent cache behavior across the codebase.
 *
 * Usage:
 *   import { CACHE_TTL, CACHE_EXPIRY } from '@/lib/constants/cache-constants';
 */

// =============================================================================
// SHORT-LIVED CACHE (Hot data, frequently changing)
// =============================================================================

/**
 * TTL for column definitions cache (1 minute).
 * Columns rarely change but should refresh periodically.
 * SSoT for: lib/column-state-atoms.ts
 */
export const CACHE_TTL_COLUMNS = 60000; // 1 minute

/**
 * TTL for saved views cache (1 minute).
 * Views may be edited by users, so keep fresh.
 * SSoT for: lib/view-state-atoms.ts, hooks/useFoundationBySlug.ts
 */
export const CACHE_TTL_VIEWS = 60000; // 1 minute

// =============================================================================
// MEDIUM-LIVED CACHE (Reference data, occasionally changing)
// =============================================================================

/**
 * TTL for lookup/dropdown options cache (5 minutes).
 * Lookup values change less frequently.
 * SSoT for: lib/view-state-atoms.ts
 */
export const CACHE_TTL_LOOKUPS = 5 * 60 * 1000; // 5 minutes

/**
 * Default TTL for records cache (30 minutes).
 * General purpose record caching.
 * SSoT for: lib/records-cache.ts
 *
 * ULTRA FIX: Increased from 5 to 30 minutes for better UX.
 * Mutations already call clearCachedRecords() to invalidate stale data.
 * Longer cache enables instant back-navigation and view switching.
 */
export const CACHE_TTL_RECORDS = 30 * 60 * 1000; // 30 minutes

// =============================================================================
// LONG-LIVED CACHE (Session/persistent data)
// =============================================================================

/**
 * TTL for session storage cache (30 minutes).
 * Survives page refreshes within a session.
 * SSoT for: lib/records-cache.ts
 */
export const CACHE_TTL_SESSION = 30 * 60 * 1000; // 30 minutes

/**
 * TTL for table session storage (24 hours).
 * Persists table state across sessions.
 * SSoT for: hooks/useTableSessionStorage.ts
 */
export const CACHE_EXPIRY_TABLE_SESSION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * TTL for PDF cache (7 days).
 * PDFs are static once generated.
 * SSoT for: lib/pdf-cache.ts
 */
export const CACHE_EXPIRY_PDF = 7 * 24 * 60 * 60 * 1000; // 7 days

// =============================================================================
// GROUPED EXPORTS
// =============================================================================

/**
 * Short-lived cache TTLs (< 5 minutes).
 */
export const CACHE_TTL_SHORT = {
  COLUMNS: CACHE_TTL_COLUMNS,
  VIEWS: CACHE_TTL_VIEWS,
} as const;

/**
 * Medium-lived cache TTLs (5-30 minutes).
 */
export const CACHE_TTL_MEDIUM = {
  LOOKUPS: CACHE_TTL_LOOKUPS,
  RECORDS: CACHE_TTL_RECORDS,
  SESSION: CACHE_TTL_SESSION,
} as const;

/**
 * Long-lived cache expiry (hours/days).
 */
export const CACHE_EXPIRY = {
  TABLE_SESSION: CACHE_EXPIRY_TABLE_SESSION,
  PDF: CACHE_EXPIRY_PDF,
} as const;

/**
 * All cache constants grouped.
 */
export const CACHE = {
  ...CACHE_TTL_SHORT,
  ...CACHE_TTL_MEDIUM,
  ...CACHE_EXPIRY,
} as const;
