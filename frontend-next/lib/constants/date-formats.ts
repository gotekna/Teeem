/**
 * Date Formats - Single Source of Truth (SSoT)
 *
 * Australian company (Brisbane timezone).
 * Uses date-fns format tokens: https://date-fns.org/docs/format
 *
 * IMPORTANT: These are date-fns format strings, NOT moment.js.
 * - dd = day of month (01-31)
 * - MM = month (01-12)
 * - yyyy = full year
 * - HH = 24-hour (00-23)
 * - mm = minutes
 * - ss = seconds
 */

/** "15/02/2026" - Standard Australian date */
export const DATE_DISPLAY = "dd/MM/yyyy";

/** "15/02/2026 14:30" - Australian date with time */
export const DATETIME_DISPLAY = "dd/MM/yyyy HH:mm";

/** "15/02/26 14:30" - Compact for tight spaces (tables, lists) */
export const DATETIME_COMPACT = "dd/MM/yy HH:mm";

/** "2026-02-15" - ISO format for API/storage/sorting */
export const DATE_ISO = "yyyy-MM-dd";

/** "2026-02-15T14:30:00" - ISO datetime */
export const DATETIME_ISO = "yyyy-MM-dd'T'HH:mm:ss";

/** "Feb 15, 2026" - Human-readable medium format */
export const DATE_MEDIUM = "MMM d, yyyy";

/** "Saturday, February 15, 2026" - Full format for headers */
export const DATE_FULL = "EEEE, MMMM d, yyyy";

/** "14:30" - Time only (24hr) */
export const TIME_DISPLAY = "HH:mm";

/** "14:30:00" - Time with seconds */
export const TIME_WITH_SECONDS = "HH:mm:ss";

/** "Feb 15, 2026 2:30 PM" - Human-readable with 12-hour time (for user-facing timestamps) */
export const DATETIME_MEDIUM_12H = "MMM d, yyyy h:mm a";

/** "Feb 15, 2026, 2:30:45 PM" - Detailed with seconds and 12-hour time */
export const DATETIME_FULL_12H = "MMM d, yyyy, h:mm:ss a";
