"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

/**
 * Server-side group count from the /groups endpoint
 */
export interface GroupCount {
  key: string | null;
  count: number;
  displayValue: string;
}

/**
 * SSoT: Display values map keyed by column name, then by ID
 * Format: { "job_status_id": { 1: "Enquiry", 2: "Pre Contract" }, "job_type_id": { 1: "House", 2: "Kitchen" } }
 */
export type DisplayValuesMap = Record<string, Record<number, string>>;

/**
 * Cascade filter format (matches backend expectations)
 */
interface CascadeFilter {
  column: string;
  operator: string;
  value: string | number | boolean | null;
}

/**
 * Response from the groups API endpoint
 */
interface GroupsApiResponse {
  success: boolean;
  groups: Array<{
    key: string | null;
    count: number;
    display_value: string;
  }>;
  total_groups: number;
  total_records: number;
  group_by_column: string;
  group_by_columns?: string[];  // NEW: All requested columns
  display_values_map?: DisplayValuesMap;  // NEW: SSoT display values for all columns
  foundation_id: number;
  error?: string;
}

/**
 * Return type for useGroupCounts hook
 */
export interface UseGroupCountsReturn {
  /** Array of group counts from server */
  groups: GroupCount[];
  /** Total number of records across all groups */
  totalRecords: number;
  /** SSoT: Display values for ALL grouping columns, keyed by column:id */
  displayValuesMap: DisplayValuesMap;
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refetch group counts */
  refetch: () => void;
  /** Whether the hook has fetched at least once */
  hasFetched: boolean;
}

/**
 * Initial data for SSR pre-loading group counts
 */
export interface GroupCountsInitialData {
  groups: GroupCount[];
  totalRecords: number;
  displayValuesMap: DisplayValuesMap;
}

/**
 * Hook to fetch server-side group counts for a foundation
 *
 * This hook calls GET /api/v1/foundations/:id/groups?group_by=column
 * to get accurate GROUP BY counts directly from the database.
 *
 * Benefits over client-side grouping:
 * - Accurate counts (not limited by pagination)
 * - Fast (SQL aggregation, not JS iteration)
 * - Memory efficient (only counts, not full records)
 *
 * SSoT: Returns display_values_map for ALL grouping columns from server.
 * This eliminates frontend display value extraction and key collision issues.
 *
 * SSR Pre-loading:
 * When initialData is provided (from SSR), the hook uses it immediately
 * without making an API call. This eliminates CLS from group counts loading.
 *
 * @param foundationId - The foundation ID (numeric or slug string)
 * @param groupByColumn - Column name to group by (for counts)
 * @param filters - Optional cascade filters to apply
 * @param enabled - Whether to enable fetching (default: true when groupByColumn is set)
 * @param allGroupByColumns - Optional array of ALL grouping columns to get display values for
 * @param initialData - Optional pre-fetched data from SSR (eliminates CLS)
 */
export function useGroupCounts(
  foundationId: number | string | null | undefined,
  groupByColumn: string | null | undefined,
  filters?: CascadeFilter[],
  enabled: boolean = true,
  allGroupByColumns?: string[],
  initialData?: GroupCountsInitialData
): UseGroupCountsReturn {
  // SSR: Use initial data if provided to eliminate CLS
  const [groups, setGroups] = useState<GroupCount[]>(initialData?.groups ?? []);
  const [totalRecords, setTotalRecords] = useState(initialData?.totalRecords ?? 0);
  const [displayValuesMap, setDisplayValuesMap] = useState<DisplayValuesMap>(initialData?.displayValuesMap ?? {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // If initial data provided, mark as already fetched
  const [hasFetched, setHasFetched] = useState(!!initialData);

  // Track the current request to cancel stale ones
  const abortControllerRef = useRef<AbortController | null>(null);

  // SSR: Track if we should skip initial fetch (when initialData is provided)
  const skipInitialFetchRef = useRef(!!initialData);

  // Serialize filters for dependency comparison
  const filtersKey = filters ? JSON.stringify(filters) : "";
  // Serialize allGroupByColumns for dependency comparison
  const allColumnsKey = allGroupByColumns ? JSON.stringify(allGroupByColumns) : "";

  const fetchGroupCounts = useCallback(async () => {
    console.log('[useGroupCounts] fetchGroupCounts called:', { enabled, foundationId, groupByColumn, allGroupByColumns });

    // Don't fetch if disabled or missing required params
    if (!enabled || !foundationId || !groupByColumn) {
      console.log('[useGroupCounts] Skipping - disabled or missing params');
      // SSR FIX: Don't clear state if we have SSR data and haven't fetched yet
      // This prevents losing initial data during the hydration phase
      if (!skipInitialFetchRef.current) {
        setGroups([]);
        setTotalRecords(0);
        setDisplayValuesMap({});
      }
      setError(null);
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      // Build params - pass ALL grouping columns so server returns display_values_map for each
      const columnsToFetch = allGroupByColumns && allGroupByColumns.length > 0
        ? allGroupByColumns
        : [groupByColumn];

      const params: Record<string, string> = {
        group_by: columnsToFetch.join(','),  // Backend accepts comma-separated or array
      };

      // Add filters if present
      if (filters && filters.length > 0) {
        params.filters = JSON.stringify(filters);
      }

      console.log('[useGroupCounts] Calling API:', `/api/v1/foundations/${foundationId}/groups`, params);

      const response = await api.get<GroupsApiResponse>(
        `/api/v1/foundations/${foundationId}/groups`,
        { params, signal: abortController.signal }
      );

      console.log('[useGroupCounts] API response:', response);

      // Only update state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        if (response.success) {
          const mappedGroups = response.groups.map((g) => ({
            key: g.key,
            count: g.count,
            displayValue: g.display_value,
          }));
          console.log('[useGroupCounts] Setting groups:', mappedGroups.length, 'items');
          console.log('[useGroupCounts] display_values_map:', response.display_values_map);
          setGroups(mappedGroups);
          setTotalRecords(response.total_records);
          // SSoT: Store server-provided display values for ALL grouping columns
          setDisplayValuesMap(response.display_values_map || {});
          setHasFetched(true);
        } else {
          console.log('[useGroupCounts] API returned error:', response.error);
          setError(response.error || "Failed to fetch group counts");
        }
      } else {
        console.log('[useGroupCounts] Request was aborted, not updating state');
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        console.log('[useGroupCounts] Request aborted');
        return;
      }
      console.error("[useGroupCounts] Failed to fetch:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [foundationId, groupByColumn, filtersKey, enabled, allColumnsKey]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    // SSR: Skip initial fetch if we have pre-loaded data
    // Keep skipInitialFetchRef true until we actually need to fetch
    if (skipInitialFetchRef.current && enabled && foundationId && groupByColumn) {
      console.log('[useGroupCounts] Skipping initial fetch - using SSR data');
      skipInitialFetchRef.current = false; // Mark SSR data as consumed
      return;
    }

    fetchGroupCounts();

    // Cleanup: abort on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchGroupCounts]);

  return {
    groups,
    totalRecords,
    displayValuesMap,  // SSoT: Server-provided display values for ALL grouping columns
    loading,
    error,
    refetch: fetchGroupCounts,
    hasFetched,
  };
}

export default useGroupCounts;
