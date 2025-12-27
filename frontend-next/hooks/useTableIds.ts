'use client';

import { useState, useEffect, useRef } from 'react';
import { api, getApiBaseUrl } from '@/lib/api';

/**
 * Table ID mappings from the API
 * NOTE: Only includes Foundation-based tables. Corporate entities (Companies, Assets)
 * use Rails models directly and are NOT included here.
 */
export interface TableIdMappings {
  GOLD_STANDARD: number;
  JOBS: number;
  TASKS: number;
  PRICEBOOK: number;
  CONTACTS: number;
  FEATURES_TRACKING: number;
}

/**
 * Table info by ID
 */
export interface TableInfo {
  slug: string;
  name: string;
}

/**
 * Full response from the table_ids endpoint
 */
interface TableIdsResponse {
  success: boolean;
  table_ids: Record<string, number>;
  tables_by_id: Record<string, TableInfo>;
  TABLE_IDS: Partial<TableIdMappings>;
}

// Cache the table IDs globally so we only fetch once
let cachedTableIds: TableIdMappings | null = null;
let cachedTableSlugs: Record<number, string> | null = null;
let fetchPromise: Promise<TableIdMappings> | null = null;

// Default fallback values (these should match the database)
// NOTE: COMPANIES removed - Foundation 353 doesn't exist. Use CorporateCompany Rails model.
const DEFAULT_TABLE_IDS: TableIdMappings = {
  GOLD_STANDARD: 1,
  JOBS: 204,
  TASKS: 218,
  PRICEBOOK: 205,
  CONTACTS: 214,
  FEATURES_TRACKING: 375,
};

/**
 * Fetch table IDs from the API
 * Returns the table IDs (either from cache or freshly fetched)
 */
async function fetchTableIds(): Promise<TableIdMappings> {
  if (cachedTableIds) return cachedTableIds;

  try {
    const data = await api.get<TableIdsResponse>('/api/v1/foundations/table_ids');

    if (data.success && data.TABLE_IDS) {
      cachedTableIds = {
        GOLD_STANDARD: data.TABLE_IDS.GOLD_STANDARD ?? DEFAULT_TABLE_IDS.GOLD_STANDARD,
        JOBS: data.TABLE_IDS.JOBS ?? DEFAULT_TABLE_IDS.JOBS,
        TASKS: data.TABLE_IDS.TASKS ?? DEFAULT_TABLE_IDS.TASKS,
        PRICEBOOK: data.TABLE_IDS.PRICEBOOK ?? DEFAULT_TABLE_IDS.PRICEBOOK,
        CONTACTS: data.TABLE_IDS.CONTACTS ?? DEFAULT_TABLE_IDS.CONTACTS,
        FEATURES_TRACKING: data.TABLE_IDS.FEATURES_TRACKING ?? DEFAULT_TABLE_IDS.FEATURES_TRACKING,
      };

      // Build slug mappings
      cachedTableSlugs = {};
      for (const [id, info] of Object.entries(data.tables_by_id)) {
        cachedTableSlugs[parseInt(id)] = info.slug;
      }

      return cachedTableIds;
    }
  } catch (error) {
    console.error('Failed to fetch table IDs, using defaults:', error);
    cachedTableIds = DEFAULT_TABLE_IDS;
  }

  return cachedTableIds || DEFAULT_TABLE_IDS;
}

/**
 * Hook to get table ID mappings
 * Fetches from API on first use, then uses cached values
 *
 * Uses React-recommended pattern to avoid setState in useEffect (PATTERN-005):
 * - Initialize with cached value if available (synchronous, no loading state)
 * - Only show loading and trigger effect if cache is empty
 */
export function useTableIds(): {
  tableIds: TableIdMappings;
  isLoading: boolean;
  getSlug: (tableId: number) => string;
} {
  // Initialize with cached value immediately if available (avoids useEffect setState)
  const [tableIds, setTableIds] = useState<TableIdMappings>(() => cachedTableIds || DEFAULT_TABLE_IDS);
  const [isLoading, setIsLoading] = useState(() => !cachedTableIds);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // If already cached, no need to fetch
    if (cachedTableIds || fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;

    // Use a shared promise to avoid multiple fetches
    if (!fetchPromise) {
      fetchPromise = fetchTableIds();
    }

    fetchPromise.then((ids) => {
      setTableIds(ids);
      setIsLoading(false);
    });
  }, []);

  const getSlug = (tableId: number): string => {
    if (cachedTableSlugs && cachedTableSlugs[tableId]) {
      return cachedTableSlugs[tableId];
    }
    // Fallback to known mappings (Foundation-based tables only)
    // NOTE: Companies (353) removed - uses CorporateCompany Rails model, not Foundation
    const fallbackSlugs: Record<number, string> = {
      1: 'components',
      204: 'jobs',
      218: 'tasks',
      205: 'pricebook',
      214: 'contacts',
      375: 'features-tracking',
    };
    return fallbackSlugs[tableId] || `table-${tableId}`;
  };

  return { tableIds, isLoading, getSlug };
}

/**
 * Get table IDs synchronously (uses cached values or defaults)
 * Useful for non-component code like url-utils.ts
 */
export function getTableIds(): TableIdMappings {
  return cachedTableIds || DEFAULT_TABLE_IDS;
}

/**
 * Get slug for a table ID synchronously
 */
export function getTableSlug(tableId: number): string {
  if (cachedTableSlugs && cachedTableSlugs[tableId]) {
    return cachedTableSlugs[tableId];
  }
  // Fallback to known mappings (Foundation-based tables only)
  const fallbackSlugs: Record<number, string> = {
    1: 'components',
    204: 'jobs',
    218: 'tasks',
    205: 'pricebook',
    214: 'contacts',
    375: 'features-tracking',
  };
  return fallbackSlugs[tableId] || `table-${tableId}`;
}

/**
 * Initialize table IDs (call early in app lifecycle)
 * Returns a promise that resolves when IDs are loaded
 */
export async function initTableIds(): Promise<void> {
  if (!fetchPromise) {
    fetchPromise = fetchTableIds();
  }
  await fetchPromise;
}

export default useTableIds;
