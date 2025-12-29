/**
 * Lookup Cache Utilities
 *
 * Module-level cache for lookup options to persist across component remounts.
 * This prevents redundant API calls when the same lookup data is needed.
 *
 * Extracted from TeeemTableView.tsx to separate concerns.
 */

import { api } from "@/lib/api";
import { PAGE_SIZE_LARGE } from "@/lib/constants/pagination-constants";

// Type definitions
export interface LookupOption {
  id: number;
  display: string;
}

// Module-level cache storage (persists across remounts)
export const lookupCache: Record<string, LookupOption[]> = {};
export const lookupFetchPromises: Record<string, Promise<LookupOption[]> | undefined> = {};

/**
 * Get lookup options from cache or fetch from API
 *
 * @param cacheKey - Unique key for this lookup (e.g., "table_123_col_name")
 * @param fetcher - Function to fetch data if not in cache
 * @returns Promise resolving to lookup options
 */
export async function getLookupOptions(
  cacheKey: string,
  fetcher: () => Promise<LookupOption[]>
): Promise<LookupOption[]> {
  // Return from cache if available
  if (lookupCache[cacheKey]) {
    return lookupCache[cacheKey];
  }

  // Return existing promise if fetch is in progress (prevents duplicate requests)
  if (lookupFetchPromises[cacheKey]) {
    return lookupFetchPromises[cacheKey]!;
  }

  // Start new fetch
  const fetchPromise = fetcher()
    .then(options => {
      lookupCache[cacheKey] = options;
      delete lookupFetchPromises[cacheKey];
      return options;
    })
    .catch(error => {
      delete lookupFetchPromises[cacheKey];
      throw error;
    });

  lookupFetchPromises[cacheKey] = fetchPromise;
  return fetchPromise;
}

/**
 * Fetch lookup options for a specific table
 *
 * @param tableId - Foundation/table ID
 * @param displayColumn - Column to use for display values
 * @returns Promise resolving to lookup options
 */
export async function fetchLookupOptionsForTable(
  tableId: number,
  displayColumn: string = "name"
): Promise<LookupOption[]> {
  const cacheKey = `table_${tableId}_${displayColumn}`;

  return getLookupOptions(cacheKey, async () => {
    // SSoT: Uses PAGE_SIZE_LARGE from pagination-constants.ts
    const response = await api.get<{ records: Record<string, unknown>[] }>(
      `/api/v1/foundations/${tableId}/records`,
      { params: { per_page: PAGE_SIZE_LARGE } }
    );

    return (response.records || []).map(record => ({
      id: Number(record.id),
      display: String(record[displayColumn] || record.id || ""),
    }));
  });
}

/**
 * Get cached lookup options (synchronous)
 *
 * @param cacheKey - Cache key
 * @returns Cached options or undefined if not in cache
 */
export function getCachedLookupOptions(cacheKey: string): LookupOption[] | undefined {
  return lookupCache[cacheKey];
}

/**
 * Check if lookup options are currently being fetched
 *
 * @param cacheKey - Cache key
 * @returns True if fetch is in progress
 */
export function isLookupFetchInProgress(cacheKey: string): boolean {
  return !!lookupFetchPromises[cacheKey];
}

/**
 * Invalidate cached lookup options
 *
 * @param cacheKey - Specific key to invalidate, or undefined to clear all
 */
export function invalidateLookupCache(cacheKey?: string): void {
  if (cacheKey) {
    delete lookupCache[cacheKey];
    delete lookupFetchPromises[cacheKey];
  } else {
    // Clear all cache
    for (const key in lookupCache) {
      delete lookupCache[key];
    }
    for (const key in lookupFetchPromises) {
      delete lookupFetchPromises[key];
    }
  }
}

/**
 * Preload lookup options for a table
 *
 * Useful for preloading options before they're needed.
 *
 * @param tableId - Foundation/table ID
 * @param displayColumn - Column to use for display values
 * @returns Promise resolving when preload is complete
 */
export async function preloadLookupOptions(
  tableId: number,
  displayColumn: string = "name"
): Promise<void> {
  await fetchLookupOptionsForTable(tableId, displayColumn);
}

/**
 * Get cache statistics (for debugging)
 *
 * @returns Object with cache statistics
 */
export function getLookupCacheStats(): {
  cachedKeys: string[];
  cacheSize: number;
  pendingFetches: string[];
} {
  return {
    cachedKeys: Object.keys(lookupCache),
    cacheSize: Object.keys(lookupCache).length,
    pendingFetches: Object.keys(lookupFetchPromises),
  };
}
