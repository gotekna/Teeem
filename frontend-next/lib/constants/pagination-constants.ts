/**
 * Pagination Constants - Single Source of Truth (SSoT)
 *
 * All pagination-related constants should be imported from this file.
 * This prevents inconsistent page sizes across the codebase.
 *
 * Usage:
 *   import { TABLE_ROW_LIMIT, API_PAGE_SIZES } from '@/lib/constants/pagination-constants';
 */

// =============================================================================
// TABLE DISPLAY CONSTANTS
// =============================================================================

/**
 * Initial number of rows to display in TeeemTableView.
 * This is the batch size for progressive loading.
 * SSoT for: TeeemTableView.tsx, table-atoms.ts
 */
export const TABLE_ROW_LIMIT = 100;

/**
 * Maximum number of rows to render in the DOM at once.
 * Prevents browser from choking on large datasets (e.g. Pricebook 5000+ items).
 * Users can still search/filter to find items beyond this limit.
 * SSoT for: TeeemTableView.tsx
 */
export const MAX_RENDERED_ROWS = 200;

/**
 * Page size for data warehouse views.
 * Used in DataWarehouseTab for paginated data exploration.
 */
export const WAREHOUSE_PAGE_SIZE = 50;

// =============================================================================
// API PAGINATION SIZES
// =============================================================================

/**
 * Standard API page sizes by use case.
 * Use these for consistent API pagination across the app.
 */
export const API_PAGE_SIZES = {
  /** Search autocomplete dropdowns (contacts, jobs, etc.) */
  AUTOCOMPLETE: 10,

  /** Contact/company search results in modals */
  SEARCH_MODAL: 20,

  /** Standard list views (emails, activities, invoices) */
  LIST_VIEW: 50,

  /** Reference data lists (jobs, users, chat) */
  REFERENCE_LIST: 100,

  /** External data sync (Xero invoices, bills) */
  EXTERNAL_SYNC: 200,

  /** Large dropdown data (pricebook items, lookup values) */
  LARGE_DROPDOWN: 1000,
} as const;

// =============================================================================
// INDIVIDUAL EXPORTS (for direct imports)
// =============================================================================

/** Autocomplete dropdown results (10) */
export const PAGE_SIZE_AUTOCOMPLETE = API_PAGE_SIZES.AUTOCOMPLETE;

/** Search modal results (20) */
export const PAGE_SIZE_SEARCH = API_PAGE_SIZES.SEARCH_MODAL;

/** List view pagination (50) */
export const PAGE_SIZE_LIST = API_PAGE_SIZES.LIST_VIEW;

/** Reference data lists (100) */
export const PAGE_SIZE_REFERENCE = API_PAGE_SIZES.REFERENCE_LIST;

/** External sync batches (200) */
export const PAGE_SIZE_EXTERNAL = API_PAGE_SIZES.EXTERNAL_SYNC;

/** Large dropdown data (1000) */
export const PAGE_SIZE_LARGE = API_PAGE_SIZES.LARGE_DROPDOWN;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type PageSize = (typeof API_PAGE_SIZES)[keyof typeof API_PAGE_SIZES];
