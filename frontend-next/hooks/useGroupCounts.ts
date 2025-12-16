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
 * @param foundationId - The foundation ID (numeric)
 * @param groupByColumn - Column name to group by
 * @param filters - Optional cascade filters to apply
 * @param enabled - Whether to enable fetching (default: true when groupByColumn is set)
 */
export function useGroupCounts(
  foundationId: number | null | undefined,
  groupByColumn: string | null | undefined,
  filters?: CascadeFilter[],
  enabled: boolean = true
): UseGroupCountsReturn {
  const [groups, setGroups] = useState<GroupCount[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Track the current request to cancel stale ones
  const abortControllerRef = useRef<AbortController | null>(null);

  // Serialize filters for dependency comparison
  const filtersKey = filters ? JSON.stringify(filters) : "";

  const fetchGroupCounts = useCallback(async () => {
    // Don't fetch if disabled or missing required params
    if (!enabled || !foundationId || !groupByColumn) {
      setGroups([]);
      setTotalRecords(0);
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
      const params: Record<string, string> = {
        group_by: groupByColumn,
      };

      // Add filters if present
      if (filters && filters.length > 0) {
        params.filters = JSON.stringify(filters);
      }

      const response = await api.get<GroupsApiResponse>(
        `/api/v1/foundations/${foundationId}/groups`,
        { params, signal: abortController.signal }
      );

      // Only update state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        if (response.success) {
          setGroups(
            response.groups.map((g) => ({
              key: g.key,
              count: g.count,
              displayValue: g.display_value,
            }))
          );
          setTotalRecords(response.total_records);
          setHasFetched(true);
        } else {
          setError(response.error || "Failed to fetch group counts");
        }
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("[useGroupCounts] Failed to fetch:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [foundationId, groupByColumn, filtersKey, enabled]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
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
    loading,
    error,
    refetch: fetchGroupCounts,
    hasFetched,
  };
}

export default useGroupCounts;
