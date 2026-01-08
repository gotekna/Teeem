/**
 * Auto-Fetch Hook for TeeemTableView
 *
 * Manages automatic record fetching with:
 * - Cursor-based pagination (infinite scroll)
 * - Cache restoration for back navigation
 * - Server-side search support
 * - SSR hydration support
 *
 * Phase 8 of TeeemTableView refactoring - extracts ~470 lines from main component.
 *
 * @example
 * const autoFetch = useAutoFetch({
 *   foundationId: 'jobs',
 *   enabled: true,
 *   initialRecords: ssrRecords,
 *   initialHasMore: true,
 *   baseFilters: [],
 * });
 *
 * // Use in component
 * const records = autoFetch.state.records;
 * autoFetch.actions.refresh();
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { getCachedRecords, setCachedRecords } from '@/lib/records-cache';
import type { CascadeFilter } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface TableRow {
  id: string | number;
  [key: string]: unknown;
}

export type SearchMode = 'contains' | 'exact' | 'starts_with' | 'fuzzy' | 'regex';

export interface UseAutoFetchOptions {
  /** Foundation ID/slug for API calls */
  foundationId: string | null | undefined;
  /** Whether auto-fetch is enabled */
  enabled: boolean;
  /** SSR-provided initial records (for hydration) */
  initialRecords?: TableRow[];
  /** SSR-provided initial hasMore state */
  initialHasMore?: boolean;
  /** Base filters (immutable, from initialFilters prop) */
  baseFilters: CascadeFilter[];
  /** Whether this is an embedded context (has initialFilters) */
  isEmbeddedContext: boolean;
  /** Whether to skip cache restoration (e.g., for embedded tables) */
  skipCacheRestore?: boolean;
  /** Parent-triggered refresh counter */
  refreshTrigger?: number;
  /** Ref to current cascade filters (for search) */
  cascadeFiltersRef: React.MutableRefObject<CascadeFilter[]>;
  /** Ref to current search value */
  searchRef: React.MutableRefObject<string>;
  /** Whether initial view has loaded (prevents flash of wrong data) */
  initialViewLoaded: boolean;
  /** Whether saved views are disabled */
  disableSavedViews?: boolean;
  /** URL search param for persistent search */
  urlSearchParam?: string | null;
  /** Initial search term */
  initialSearch?: string;
}

export interface AutoFetchState {
  /** Fetched records */
  records: TableRow[];
  /** Whether more records are available */
  hasMore: boolean;
  /** Whether currently loading more records */
  isLoadingMore: boolean;
  /** Whether currently searching */
  isSearching: boolean;
}

export interface AutoFetchActions {
  /** Trigger a refresh of records */
  refresh: () => void;
  /** Perform server-side search */
  search: (term: string, mode?: SearchMode) => Promise<void>;
  /** Manually set records (for optimistic updates) */
  setRecords: React.Dispatch<React.SetStateAction<TableRow[]>>;
  /** Manually set hasMore */
  setHasMore: (hasMore: boolean) => void;
}

export interface UseAutoFetchReturn {
  state: AutoFetchState;
  actions: AutoFetchActions;
  /** Whether auto-fetch is active (enabled AND has foundationId) */
  isActive: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAutoFetch(options: UseAutoFetchOptions): UseAutoFetchReturn {
  const {
    foundationId,
    enabled,
    initialRecords,
    initialHasMore = true,
    baseFilters,
    isEmbeddedContext,
    skipCacheRestore = false,
    refreshTrigger,
    cascadeFiltersRef,
    searchRef,
    initialViewLoaded,
    disableSavedViews = false,
    urlSearchParam,
    initialSearch,
  } = options;

  // Computed: whether auto-fetch should be active
  const isActive = enabled && !!foundationId;

  // ============================================================================
  // STATE
  // ============================================================================

  const [records, setRecords] = useState<TableRow[]>(initialRecords || []);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refs for tracking initialization
  const hasAppliedInitialRecordsRef = useRef(false);
  const hasCacheRestoredRef = useRef(false);
  const prevRefreshTriggerRef = useRef(refreshTrigger);

  // Stable key for base filters dependency
  const baseFiltersKey = useMemo(
    () => JSON.stringify(baseFilters),
    [baseFilters]
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const refresh = useCallback(() => {
    if (isActive) {
      setRefreshKey(prev => prev + 1);
    }
  }, [isActive]);

  const search = useCallback(async (searchTerm: string, mode?: SearchMode) => {
    if (!isActive || !foundationId) return;

    setIsSearching(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: Record<string, any> = {
        search: searchTerm,
        limit: 100,
      };
      if (mode) {
        params.search_mode = mode;
      }
      // Include all filters in search
      const currentFilters = cascadeFiltersRef.current;
      const allFilters = [...baseFilters, ...currentFilters];
      if (allFilters.length > 0) {
        params.filters = JSON.stringify(allFilters.map(f => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
        })));
      }
      const response = await api.get<{ records: TableRow[], has_more: boolean }>(
        `/api/v1/foundations/${foundationId}/records`,
        { params }
      );
      setRecords(response.records || []);
      setHasMore(response.has_more ?? false);
    } catch (error) {
      console.error(`[useAutoFetch] Search failed:`, error);
    } finally {
      setIsSearching(false);
    }
  }, [isActive, foundationId, baseFilters, cascadeFiltersRef]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Parent-triggered refresh via refreshTrigger prop
  useEffect(() => {
    if (prevRefreshTriggerRef.current !== undefined &&
        refreshTrigger !== undefined &&
        refreshTrigger !== prevRefreshTriggerRef.current) {
      refresh();
    }
    prevRefreshTriggerRef.current = refreshTrigger;
  }, [refreshTrigger, refresh]);

  // Cache restoration on mount
  useEffect(() => {
    if (hasCacheRestoredRef.current) return;
    if (!isActive || !foundationId) return;
    if (skipCacheRestore || isEmbeddedContext) {
      hasCacheRestoredRef.current = true;
      return;
    }

    const cached = getCachedRecords(foundationId);
    if (cached && cached.records.length > (initialRecords?.length || 0)) {
      console.log(`[useAutoFetch] Restoring ${cached.records.length} records from cache`);
      setRecords(cached.records as TableRow[]);
      setHasMore(cached.hasMore);
      hasAppliedInitialRecordsRef.current = true;
    }
    hasCacheRestoredRef.current = true;
  }, [isActive, foundationId, initialRecords?.length, skipCacheRestore, isEmbeddedContext]);

  // Initial records fetch
  useEffect(() => {
    if (!isActive || !foundationId) return;

    // Wait for base filters in embedded context
    if (isEmbeddedContext && baseFilters.length === 0) {
      return;
    }

    // Wait for initial view to load
    if (!disableSavedViews && !initialViewLoaded) {
      return;
    }

    const fetchInitialRecords = async () => {
      // Skip if search is pending (URL param or initial)
      const hasPersistedSearch = urlSearchParam || initialSearch || searchRef.current;
      if (hasPersistedSearch) {
        console.log('[useAutoFetch] Skipping fetch - search pending');
        return;
      }

      // Skip if all records already loaded
      if (!hasMore && records.length > 0) {
        console.log('[useAutoFetch] All records loaded, applying filters client-side');
        return;
      }

      // Skip if SSR data already applied
      if (hasAppliedInitialRecordsRef.current && records.length > 0 && refreshKey === 0) {
        console.log('[useAutoFetch] SSR data already applied, skipping duplicate fetch');
        return;
      }

      console.log('[useAutoFetch] Fetching initial records');
      setIsLoadingMore(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params: Record<string, any> = { limit: 100 };
        if (baseFilters.length > 0) {
          params.filters = JSON.stringify(baseFilters.map(f => ({
            column: f.column,
            operator: f.operator,
            value: f.value,
          })));
        }
        const response = await api.get<{ records: TableRow[], has_more: boolean }>(
          `/api/v1/foundations/${foundationId}/records`,
          { params }
        );
        const newRecords = response.records || [];
        setRecords(newRecords);
        setHasMore(response.has_more ?? true);
        // Cache for back navigation
        if (newRecords.length > 0) {
          setCachedRecords(foundationId, newRecords as Record<string, unknown>[], null, response.has_more ?? true);
        }
      } catch (error) {
        console.error(`[useAutoFetch] Failed to fetch records:`, error);
      } finally {
        setIsLoadingMore(false);
      }
    };

    fetchInitialRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, foundationId, refreshKey, baseFiltersKey, initialViewLoaded, disableSavedViews, isEmbeddedContext]);

  // Auto-load more records in background
  useEffect(() => {
    if (!isActive || !hasMore || isLoadingMore || records.length === 0) return;

    const timer = setTimeout(async () => {
      if (!hasMore || isLoadingMore) return;

      const lastRecord = records[records.length - 1];
      const cursor = lastRecord?.id;

      setIsLoadingMore(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params: Record<string, any> = { cursor, limit: 100 };
        if (baseFilters.length > 0) {
          params.filters = JSON.stringify(baseFilters.map(f => ({
            column: f.column,
            operator: f.operator,
            value: f.value,
          })));
        }
        const response = await api.get<{ records: TableRow[], has_more: boolean }>(
          `/api/v1/foundations/${foundationId}/records`,
          { params }
        );

        const newHasMore = response.has_more ?? false;
        setRecords(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRecords = (response.records || []).filter(r => !existingIds.has(r.id));
          const mergedRecords = [...prev, ...newRecords];
          if (foundationId) {
            setCachedRecords(foundationId, mergedRecords as Record<string, unknown>[], null, newHasMore);
          }
          return mergedRecords;
        });
        setHasMore(newHasMore);
      } catch (error) {
        console.error(`[useAutoFetch] Failed to load more records:`, error);
      } finally {
        setIsLoadingMore(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isActive, hasMore, isLoadingMore, records.length, foundationId, baseFilters]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    state: {
      records,
      hasMore,
      isLoadingMore,
      isSearching,
    },
    actions: {
      refresh,
      search,
      setRecords,
      setHasMore,
    },
    isActive,
  };
}
