/**
 * Table Core Orchestrator Hook
 *
 * Master hook that orchestrates all feature hooks and provides the complete
 * data processing pipeline. This is Layer 2 of the architecture.
 *
 * Architecture:
 * - Composes: useSorting, useFiltering, useGrouping, useSearch, useSelection
 * - Pipeline: filter → search → sort → group
 * - Pure data flow using headless core (Layer 1)
 *
 * @example
 * const table = useTableCore({ columns });
 *
 * // Access features
 * table.sorting.actions.toggleSort('name');
 * table.filtering.actions.addFilter({ column: 'status', operator: '=', value: 'active' });
 *
 * // Get processed data
 * const { processedRows, groupedData } = table.processData(rawRows);
 */

import { useMemo, useCallback } from 'react';
import { useSorting, type UseSortingReturn } from './useSorting';
import { useFiltering, type UseFilteringReturn } from './useFiltering';
import { useGrouping, type UseGroupingReturn } from './useGrouping';
import { useSearch, type UseSearchReturn } from './useSearch';
import { useSelection, type UseSelectionReturn } from './useSelection';
import type { TableColumn, TableRow, SortColumn } from '../types';
import type { GroupedEntries, ServerGroupCount } from '@/lib/table-core';

// ============================================================================
// TYPES
// ============================================================================

export interface UseTableCoreProps {
  /** Column definitions for type-aware processing */
  columns?: TableColumn[];
  /** Server group counts for lazy loading */
  serverGroupCounts?: ServerGroupCount[];
}

export interface ProcessedData<TRow extends TableRow = TableRow> {
  /** Rows after filter → search → sort pipeline */
  processedRows: TRow[];
  /** Grouped data (null if no grouping) */
  groupedData: GroupedEntries<TRow> | null;
  /** All group keys (for expand/collapse all) */
  groupKeys: string[];
  /** Visible row IDs (respecting collapsed groups) */
  visibleRowIds: (number | string)[];
  /** Counts */
  counts: {
    total: number;
    filtered: number;
    visible: number;
  };
}

export interface UseTableCoreReturn {
  /** Sorting feature */
  sorting: UseSortingReturn;
  /** Filtering feature */
  filtering: UseFilteringReturn;
  /** Grouping feature */
  grouping: UseGroupingReturn;
  /** Search feature */
  search: UseSearchReturn;
  /** Selection feature */
  selection: UseSelectionReturn;

  /** Process raw rows through the pipeline */
  processData: <TRow extends TableRow>(
    rows: TRow[],
    options?: {
      serverGroupCounts?: ServerGroupCount[];
    }
  ) => ProcessedData<TRow>;

  /** Pipeline metadata */
  pipeline: {
    /** Whether any transformation is active */
    isTransformed: boolean;
    /** Active transformations */
    activeStages: ('filter' | 'search' | 'sort' | 'group')[];
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Master orchestrator hook for table data processing
 *
 * Composes all feature hooks and provides a unified API.
 * Data flows through: filter → search → sort → group
 */
export function useTableCore(props: UseTableCoreProps = {}): UseTableCoreReturn {
  const { columns = [], serverGroupCounts = [] } = props;

  // ============================================================================
  // FEATURE HOOKS
  // ============================================================================

  const sorting = useSorting();
  const filtering = useFiltering();
  const grouping = useGrouping();
  const search = useSearch();
  const selection = useSelection();

  // ============================================================================
  // PIPELINE METADATA
  // ============================================================================

  const pipeline = useMemo(() => {
    const activeStages: ('filter' | 'search' | 'sort' | 'group')[] = [];

    if (filtering.state.filterCount > 0) activeStages.push('filter');
    if (search.state.isSearching) activeStages.push('search');
    if (sorting.state.isSorted) activeStages.push('sort');
    if (grouping.state.isGrouped) activeStages.push('group');

    return {
      isTransformed: activeStages.length > 0,
      activeStages,
    };
  }, [
    filtering.state.filterCount,
    search.state.isSearching,
    sorting.state.isSorted,
    grouping.state.isGrouped,
  ]);

  // ============================================================================
  // DATA PROCESSING PIPELINE
  // ============================================================================

  const processData = useCallback(<TRow extends TableRow>(
    rows: TRow[],
    options: { serverGroupCounts?: ServerGroupCount[] } = {}
  ): ProcessedData<TRow> => {
    const counts = {
      total: rows.length,
      filtered: 0,
      visible: 0,
    };

    // Stage 1: Filter
    let processedRows = filtering.apply(rows);

    // Stage 2: Search
    processedRows = search.apply(processedRows, columns);

    counts.filtered = processedRows.length;

    // Stage 3: Sort
    processedRows = sorting.apply(processedRows, columns);

    // Stage 4: Group (optional)
    const effectiveServerGroupCounts = options.serverGroupCounts ?? serverGroupCounts;
    const groupedData = grouping.apply(
      processedRows,
      sorting.state.sortColumns,
      effectiveServerGroupCounts,
      search.state.query
    );

    // Get group keys and visible IDs
    let groupKeys: string[] = [];
    let visibleRowIds: (number | string)[] = [];

    if (groupedData) {
      groupKeys = grouping.getKeys(groupedData);
      visibleRowIds = grouping.getVisibleIds(groupedData as GroupedEntries<TRow & { id: string | number }>);
    } else {
      visibleRowIds = processedRows.map((r) => r.id);
    }

    counts.visible = visibleRowIds.length;

    return {
      processedRows,
      groupedData,
      groupKeys,
      visibleRowIds,
      counts,
    };
  }, [
    filtering,
    search,
    sorting,
    grouping,
    columns,
    serverGroupCounts,
  ]);

  return {
    sorting,
    filtering,
    grouping,
    search,
    selection,
    processData,
    pipeline,
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Simple hook that just returns processed rows
 * For use cases that don't need full feature access
 */
export function useProcessedRows<TRow extends TableRow>(
  rows: TRow[],
  columns: TableColumn[] = []
): TRow[] {
  const table = useTableCore({ columns });
  return useMemo(
    () => table.processData(rows).processedRows,
    [table, rows]
  );
}

// ============================================================================
// SELECTOR HELPERS
// ============================================================================

/**
 * Check if any data transformation is active
 */
export function isDataTransformed(
  sortColumns: SortColumn[],
  filterCount: number,
  searchQuery: string,
  groupByColumns: string[]
): boolean {
  return (
    sortColumns.length > 0 ||
    filterCount > 0 ||
    searchQuery.length > 0 ||
    groupByColumns.length > 0
  );
}
