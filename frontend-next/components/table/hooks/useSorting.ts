/**
 * Sorting Feature Hook
 *
 * Complete sorting feature following the Feature Hook pattern:
 * - state: Current sort configuration
 * - actions: Imperative methods to modify sorting
 * - apply: Pure function to sort rows using headless core
 *
 * @example
 * const sorting = useSorting();
 * const sortedRows = sorting.apply(rows, columns);
 * sorting.actions.toggleSort('name');
 */

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { currentSortColumnsAtom } from '@/lib/table-atoms';
import { sortRows } from '@/lib/table-core';
import type { SortColumn, TableColumn } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface SortingState {
  /** Current sort columns configuration */
  sortColumns: SortColumn[];
  /** Whether any sorting is active */
  isSorted: boolean;
  /** Number of sort columns */
  sortCount: number;
}

export interface SortingActions {
  /** Toggle sort on a column (cycles: none -> asc -> desc -> none) */
  toggleSort: (columnKey: string) => void;
  /** Single-column sort: replaces all existing sorts with this column (cycles: none -> asc -> desc -> none) */
  singleSort: (columnKey: string) => void;
  /** Set sort to specific direction */
  setSort: (columnKey: string, direction: 'asc' | 'desc') => void;
  /** Add a column to multi-sort */
  addSort: (columnKey: string, direction?: 'asc' | 'desc') => void;
  /** Remove sort from a column */
  removeSort: (columnKey: string) => void;
  /** Clear all sorting */
  clearSort: () => void;
  /** Set custom sort order for a column */
  setCustomOrder: (columnKey: string, order: string[]) => void;
  /** Replace entire sort configuration */
  setSortColumns: (columns: SortColumn[]) => void;
}

export interface UseSortingReturn {
  state: SortingState;
  actions: SortingActions;
  /** Apply sorting to rows (pure function from headless core) */
  apply: <TRow extends Record<string, unknown>>(
    rows: TRow[],
    columns?: TableColumn[]
  ) => TRow[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Feature hook for table sorting
 *
 * Provides complete sorting functionality with state, actions, and data transformation.
 * Uses the headless core for pure data processing.
 */
export function useSorting(): UseSortingReturn {
  const [sortColumns, setSortColumns] = useAtom(currentSortColumnsAtom);

  // ============================================================================
  // STATE (derived)
  // ============================================================================

  const state = useMemo<SortingState>(() => ({
    sortColumns,
    isSorted: sortColumns.length > 0,
    sortCount: sortColumns.length,
  }), [sortColumns]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const toggleSort = useCallback((columnKey: string) => {
    setSortColumns((prev) => {
      const existing = prev.find((s) => s.column === columnKey);
      if (existing) {
        if (existing.dir === 'asc') {
          // asc -> desc
          return prev.map((s) =>
            s.column === columnKey ? { ...s, dir: 'desc' as const } : s
          );
        } else {
          // desc -> remove
          return prev.filter((s) => s.column !== columnKey);
        }
      } else {
        // none -> asc
        return [...prev, { column: columnKey, dir: 'asc' as const }];
      }
    });
  }, [setSortColumns]);

  // Single-column sort: replaces all existing sorts, cycles: none -> asc -> desc -> none
  const singleSort = useCallback((columnKey: string) => {
    setSortColumns((prev) => {
      const existing = prev.find((s) => s.column === columnKey);
      if (existing) {
        if (existing.dir === 'asc') {
          // asc -> desc (single column only)
          return [{ column: columnKey, dir: 'desc' as const }];
        } else {
          // desc -> remove all sorting
          return [];
        }
      } else {
        // none -> asc (single column only, clears any other sorts)
        return [{ column: columnKey, dir: 'asc' as const }];
      }
    });
  }, [setSortColumns]);

  const setSort = useCallback((columnKey: string, direction: 'asc' | 'desc') => {
    setSortColumns((prev) => {
      const filtered = prev.filter((s) => s.column !== columnKey);
      return [...filtered, { column: columnKey, dir: direction }];
    });
  }, [setSortColumns]);

  const addSort = useCallback((columnKey: string, direction: 'asc' | 'desc' = 'asc') => {
    setSortColumns((prev) => {
      if (prev.some((s) => s.column === columnKey)) {
        return prev; // Already sorting by this column
      }
      return [...prev, { column: columnKey, dir: direction }];
    });
  }, [setSortColumns]);

  const removeSort = useCallback((columnKey: string) => {
    setSortColumns((prev) => prev.filter((s) => s.column !== columnKey));
  }, [setSortColumns]);

  const clearSort = useCallback(() => {
    setSortColumns([]);
  }, [setSortColumns]);

  const setCustomOrder = useCallback((columnKey: string, order: string[]) => {
    setSortColumns((prev) => {
      const existing = prev.find((s) => s.column === columnKey);
      if (existing) {
        return prev.map((s) =>
          s.column === columnKey
            ? { ...s, dir: 'custom' as const, customOrder: order }
            : s
        );
      } else {
        return [...prev, { column: columnKey, dir: 'custom' as const, customOrder: order }];
      }
    });
  }, [setSortColumns]);

  const actions = useMemo<SortingActions>(() => ({
    toggleSort,
    singleSort,
    setSort,
    addSort,
    removeSort,
    clearSort,
    setCustomOrder,
    setSortColumns,
  }), [toggleSort, singleSort, setSort, addSort, removeSort, clearSort, setCustomOrder, setSortColumns]);

  // ============================================================================
  // APPLY (data transformation using headless core)
  // ============================================================================

  const apply = useCallback(<TRow extends Record<string, unknown>>(
    rows: TRow[],
    columns: TableColumn[] = []
  ): TRow[] => {
    if (sortColumns.length === 0) return rows;
    return sortRows(rows, sortColumns, columns);
  }, [sortColumns]);

  return {
    state,
    actions,
    apply,
  };
}

// ============================================================================
// SELECTOR HELPERS (MUI DataGrid inspired)
// ============================================================================

/**
 * Get the sort direction for a specific column
 */
export function getSortDirection(
  sortColumns: SortColumn[],
  columnKey: string
): 'asc' | 'desc' | 'custom' | null {
  const sort = sortColumns.find((s) => s.column === columnKey);
  return sort?.dir ?? null;
}

/**
 * Get the sort index for a column (for multi-sort display)
 */
export function getSortIndex(
  sortColumns: SortColumn[],
  columnKey: string
): number {
  return sortColumns.findIndex((s) => s.column === columnKey);
}

/**
 * Check if a column is being sorted
 */
export function isColumnSorted(
  sortColumns: SortColumn[],
  columnKey: string
): boolean {
  return sortColumns.some((s) => s.column === columnKey);
}
