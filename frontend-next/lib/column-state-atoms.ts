/**
 * Foundation Columns State Management using Jotai Atoms
 *
 * Provides centralized column state with cache invalidation,
 * matching the pattern from view-state-atoms.ts
 *
 * Benefits:
 * - Single source of truth for foundation columns
 * - Automatic cache invalidation after column operations
 * - Eliminates duplicate API calls
 * - Consistent with view state management pattern
 */

import { atom, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
  position?: number;
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  available_choices?: { id: number; value: string }[] | string[];
}

interface ColumnsCacheEntry {
  columns: Column[];
  timestamp: number;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * TTL for columns cache (1 minute)
 * Columns change less frequently than data, but we want updates to appear quickly
 */
export const COLUMNS_CACHE_TTL = 60000; // 1 minute

/**
 * Columns cache with TTL
 * Key format: foundationId
 */
export const columnsCacheAtom = atom<Record<number, ColumnsCacheEntry>>({});

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Invalidate columns cache for a specific foundation
 * Forces a fresh load from API on next request
 */
export const invalidateColumnsCacheAtom = atom(
  null,
  (get, set, foundationId: number) => {
    set(columnsCacheAtom, (prev) => {
      const next = { ...prev };
      delete next[foundationId];
      return next;
    });
  }
);

/**
 * Load columns for a foundation (from cache or API)
 * Returns columns array and source indicator
 */
export const loadFoundationColumnsAtom = atom(
  null,
  async (get, set, foundationId: number) => {
    try {
      // Check cache first
      const cache = get(columnsCacheAtom);
      const cached = cache[foundationId];

      if (cached && (Date.now() - cached.timestamp < COLUMNS_CACHE_TTL)) {
        return { success: true, columns: cached.columns, source: 'cache' as const };
      }

      // Fetch from API
      const { api } = await import('@/lib/api');
      const response = await api.get<{ success: boolean; foundation: { columns: Column[] } }>(
        `/api/v1/foundations/${foundationId}`
      );

      if (response?.success && response.foundation?.columns) {
        const columns = response.foundation.columns;

        // Update cache
        set(columnsCacheAtom, (prev) => ({
          ...prev,
          [foundationId]: {
            columns,
            timestamp: Date.now(),
          },
        }));

        return { success: true, columns, source: 'api' as const };
      } else {
        throw new Error('Failed to load columns');
      }
    } catch (error) {
      console.error('[loadFoundationColumnsAtom] Failed to load columns:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load columns',
        columns: [],
        source: 'error' as const,
      };
    }
  }
);

/**
 * Clean up expired cache entries (call periodically if needed)
 */
export const cleanupColumnsCacheAtom = atom(
  null,
  (get, set) => {
    const cache = get(columnsCacheAtom);
    const now = Date.now();

    const validEntries: Record<number, ColumnsCacheEntry> = {};
    let hasExpired = false;

    for (const [foundationIdStr, entry] of Object.entries(cache)) {
      if (now - entry.timestamp <= COLUMNS_CACHE_TTL) {
        validEntries[Number(foundationIdStr)] = entry;
      } else {
        hasExpired = true;
      }
    }

    // Only update if we removed something
    if (hasExpired) {
      set(columnsCacheAtom, validEntries);
    }
  }
);

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * Hook for loading foundation columns with cache
 *
 * @param foundationId - Foundation ID to load columns for (null to skip loading)
 * @returns Object with columns array, loading state, and error
 *
 * @example
 * const { columns, loading, error } = useFoundationColumns(123);
 */
export function useFoundationColumns(foundationId: number | null) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadColumns = useSetAtom(loadFoundationColumnsAtom);

  useEffect(() => {
    if (!foundationId) {
      setColumns([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchColumns = async () => {
      setLoading(true);
      setError(null);

      const result = await loadColumns(foundationId);

      if (!mounted) return;

      if (result.success) {
        setColumns(result.columns);
        setError(null);
      } else {
        setColumns([]);
        setError(result.error || 'Failed to load columns');
      }

      setLoading(false);
    };

    fetchColumns();

    return () => {
      mounted = false;
    };
  }, [foundationId, loadColumns]);

  return { columns, loading, error };
}
