'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

/**
 * Table ID mappings from the API
 * NOTE: Only includes Foundation-based tables. Corporate entities (Companies, Assets)
 * use Rails models directly and are NOT included here.
 *
 * SSoT: These IDs come ONLY from the API. No fallbacks - if API fails, we fail loudly.
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
let fetchError: Error | null = null;

/**
 * Fetch table IDs from the API
 * SSoT: No fallbacks - throws if API fails
 */
async function fetchTableIds(): Promise<TableIdMappings> {
  if (cachedTableIds) return cachedTableIds;
  if (fetchError) throw fetchError;

  try {
    const data = await api.get<TableIdsResponse>('/api/v1/foundations/table_ids');

    if (!data.success || !data.TABLE_IDS) {
      throw new Error('API returned invalid response for table_ids');
    }

    // Validate all required fields are present
    const required = ['GOLD_STANDARD', 'JOBS', 'TASKS', 'PRICEBOOK', 'CONTACTS', 'FEATURES_TRACKING'] as const;
    for (const key of required) {
      if (data.TABLE_IDS[key] === undefined) {
        throw new Error(`Missing required table ID: ${key}`);
      }
    }

    cachedTableIds = {
      GOLD_STANDARD: data.TABLE_IDS.GOLD_STANDARD!,
      JOBS: data.TABLE_IDS.JOBS!,
      TASKS: data.TABLE_IDS.TASKS!,
      PRICEBOOK: data.TABLE_IDS.PRICEBOOK!,
      CONTACTS: data.TABLE_IDS.CONTACTS!,
      FEATURES_TRACKING: data.TABLE_IDS.FEATURES_TRACKING!,
    };

    // Build slug mappings from API response
    cachedTableSlugs = {};
    for (const [id, info] of Object.entries(data.tables_by_id)) {
      cachedTableSlugs[parseInt(id)] = info.slug;
    }

    return cachedTableIds;
  } catch (error) {
    fetchError = error instanceof Error ? error : new Error('Failed to fetch table IDs');
    console.error('CRITICAL: Failed to fetch table IDs from API:', fetchError);
    throw fetchError;
  }
}

/**
 * Hook to get table ID mappings
 * Fetches from API on first use, then uses cached values
 * SSoT: No fallbacks - shows error state if API fails
 */
export function useTableIds(): {
  tableIds: TableIdMappings | null;
  isLoading: boolean;
  error: Error | null;
  getSlug: (tableId: number) => string | null;
} {
  const [tableIds, setTableIds] = useState<TableIdMappings | null>(cachedTableIds);
  const [isLoading, setIsLoading] = useState(!cachedTableIds && !fetchError);
  const [error, setError] = useState<Error | null>(fetchError);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (cachedTableIds || fetchError || fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;

    if (!fetchPromise) {
      fetchPromise = fetchTableIds();
    }

    fetchPromise
      .then((ids) => {
        setTableIds(ids);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, []);

  const getSlug = (tableId: number): string | null => {
    if (cachedTableSlugs && cachedTableSlugs[tableId]) {
      return cachedTableSlugs[tableId];
    }
    // SSoT: No fallbacks - return null if not loaded
    return null;
  };

  return { tableIds, isLoading, error, getSlug };
}

/**
 * Get table IDs synchronously (uses cached values only)
 * SSoT: Returns null if not loaded - no fallbacks
 */
export function getTableIds(): TableIdMappings | null {
  return cachedTableIds;
}

/**
 * Get slug for a table ID synchronously
 * SSoT: Returns null if not loaded - no fallbacks
 */
export function getTableSlug(tableId: number): string | null {
  if (cachedTableSlugs && cachedTableSlugs[tableId]) {
    return cachedTableSlugs[tableId];
  }
  return null;
}

/**
 * Initialize table IDs (call early in app lifecycle)
 * Returns a promise that resolves when IDs are loaded
 * Throws if API fails - no silent fallbacks
 */
export async function initTableIds(): Promise<void> {
  if (!fetchPromise) {
    fetchPromise = fetchTableIds();
  }
  await fetchPromise;
}

export default useTableIds;
