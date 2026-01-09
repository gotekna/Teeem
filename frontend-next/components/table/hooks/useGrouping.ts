/**
 * Grouping Feature Hook
 *
 * Complete grouping feature following the Feature Hook pattern:
 * - state: Current grouping configuration
 * - actions: Imperative methods to modify grouping
 * - apply: Pure function to group rows using headless core
 *
 * Supports multi-level hierarchical grouping with collapse state.
 *
 * @example
 * const grouping = useGrouping();
 * const groupedData = grouping.apply(rows, sortColumns);
 * grouping.actions.setGroupBy(['status', 'priority']);
 */

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import {
  currentGroupByColumnsAtom,
  collapsedGroupsAtom,
  groupViewModeAtom,
} from '@/lib/table-atoms';
import {
  groupRows,
  getAllGroupKeys,
  getVisibleRowIdsFromGroups,
  type GroupedEntries,
  type SortColumn,
  type ServerGroupCount,
} from '@/lib/table-core';

// ============================================================================
// TYPES
// ============================================================================

export interface GroupingState {
  /** Columns to group by (in order of nesting) */
  groupByColumns: string[];
  /** First grouping column (convenience for single-group mode) */
  groupByColumn: string | null;
  /** Set of collapsed group keys */
  collapsedGroups: Set<string>;
  /** Whether any grouping is active */
  isGrouped: boolean;
  /** Number of grouping levels */
  groupDepth: number;
  /** View mode: inline or panel */
  viewMode: 'inline' | 'panel';
}

export interface GroupingActions {
  /** Set columns to group by */
  setGroupBy: (columns: string[]) => void;
  /** Set single grouping column (convenience) */
  setGroupByColumn: (column: string | null) => void;
  /** Add a grouping level */
  addGroupLevel: (column: string) => void;
  /** Remove a grouping level */
  removeGroupLevel: (column: string) => void;
  /** Clear all grouping */
  clearGrouping: () => void;
  /** Toggle collapse state for a group */
  toggleGroupCollapse: (groupKey: string) => void;
  /** Expand a specific group */
  expandGroup: (groupKey: string) => void;
  /** Collapse a specific group */
  collapseGroup: (groupKey: string) => void;
  /** Expand all groups */
  expandAll: () => void;
  /** Collapse all groups */
  collapseAll: (allGroupKeys: string[]) => void;
  /** Set collapsed groups directly */
  setCollapsedGroups: (groups: Set<string>) => void;
  /** Set view mode */
  setViewMode: (mode: 'inline' | 'panel') => void;
}

export interface UseGroupingReturn {
  state: GroupingState;
  actions: GroupingActions;
  /** Apply grouping to rows (pure function from headless core) */
  apply: <TRow extends Record<string, unknown>>(
    rows: TRow[],
    sortColumns?: SortColumn[],
    serverGroupCounts?: ServerGroupCount[],
    search?: string
  ) => GroupedEntries<TRow> | null;
  /** Get all group keys from grouped data */
  getKeys: <TRow extends Record<string, unknown>>(
    groups: GroupedEntries<TRow>
  ) => string[];
  /** Get visible row IDs respecting collapse state */
  getVisibleIds: <TRow extends Record<string, unknown> & { id: string | number }>(
    groups: GroupedEntries<TRow>
  ) => (number | string)[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Feature hook for table grouping
 *
 * Provides complete grouping functionality with hierarchical support.
 * Uses the headless core for pure data processing.
 */
export function useGrouping(): UseGroupingReturn {
  const [groupByColumns, setGroupByColumns] = useAtom(currentGroupByColumnsAtom);
  const [collapsedGroups, setCollapsedGroups] = useAtom(collapsedGroupsAtom);
  const [viewMode, setViewMode] = useAtom(groupViewModeAtom);

  // ============================================================================
  // STATE
  // ============================================================================

  const state = useMemo<GroupingState>(() => ({
    groupByColumns,
    groupByColumn: groupByColumns[0] ?? null,
    collapsedGroups,
    isGrouped: groupByColumns.length > 0,
    groupDepth: groupByColumns.length,
    viewMode,
  }), [groupByColumns, collapsedGroups, viewMode]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const setGroupBy = useCallback((columns: string[]) => {
    setGroupByColumns(columns);
    // Clear collapsed state when grouping changes
    setCollapsedGroups(new Set());
  }, [setGroupByColumns, setCollapsedGroups]);

  const setGroupByColumn = useCallback((column: string | null) => {
    setGroupByColumns(column ? [column] : []);
    setCollapsedGroups(new Set());
  }, [setGroupByColumns, setCollapsedGroups]);

  const addGroupLevel = useCallback((column: string) => {
    setGroupByColumns((prev) => {
      if (prev.includes(column)) return prev;
      return [...prev, column];
    });
  }, [setGroupByColumns]);

  const removeGroupLevel = useCallback((column: string) => {
    setGroupByColumns((prev) => prev.filter((c) => c !== column));
  }, [setGroupByColumns]);

  const clearGrouping = useCallback(() => {
    setGroupByColumns([]);
    setCollapsedGroups(new Set());
  }, [setGroupByColumns, setCollapsedGroups]);

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, [setCollapsedGroups]);

  const expandGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      newSet.delete(groupKey);
      return newSet;
    });
  }, [setCollapsedGroups]);

  const collapseGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      newSet.add(groupKey);
      return newSet;
    });
  }, [setCollapsedGroups]);

  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set());
  }, [setCollapsedGroups]);

  const collapseAll = useCallback((allGroupKeys: string[]) => {
    setCollapsedGroups(new Set(allGroupKeys));
  }, [setCollapsedGroups]);

  const actions = useMemo<GroupingActions>(() => ({
    setGroupBy,
    setGroupByColumn,
    addGroupLevel,
    removeGroupLevel,
    clearGrouping,
    toggleGroupCollapse,
    expandGroup,
    collapseGroup,
    expandAll,
    collapseAll,
    setCollapsedGroups,
    setViewMode,
  }), [
    setGroupBy,
    setGroupByColumn,
    addGroupLevel,
    removeGroupLevel,
    clearGrouping,
    toggleGroupCollapse,
    expandGroup,
    collapseGroup,
    expandAll,
    collapseAll,
    setCollapsedGroups,
    setViewMode,
  ]);

  // ============================================================================
  // APPLY (data transformation using headless core)
  // ============================================================================

  const apply = useCallback(<TRow extends Record<string, unknown>>(
    rows: TRow[],
    sortColumns: SortColumn[] = [],
    serverGroupCounts: ServerGroupCount[] = [],
    search: string = ''
  ): GroupedEntries<TRow> | null => {
    if (groupByColumns.length === 0) return null;
    return groupRows(rows, groupByColumns, sortColumns, serverGroupCounts, search);
  }, [groupByColumns]);

  const getKeys = useCallback(<TRow extends Record<string, unknown>>(
    groups: GroupedEntries<TRow>
  ): string[] => {
    return getAllGroupKeys(groups);
  }, []);

  const getVisibleIds = useCallback(<TRow extends Record<string, unknown> & { id: string | number }>(
    groups: GroupedEntries<TRow>
  ): (number | string)[] => {
    return getVisibleRowIdsFromGroups(groups, collapsedGroups);
  }, [collapsedGroups]);

  return {
    state,
    actions,
    apply,
    getKeys,
    getVisibleIds,
  };
}

// ============================================================================
// SELECTOR HELPERS
// ============================================================================

/**
 * Check if a specific group is collapsed
 */
export function isGroupCollapsed(
  collapsedGroups: Set<string>,
  groupKey: string
): boolean {
  return collapsedGroups.has(groupKey);
}

/**
 * Count total rows across all groups
 */
export function countGroupedRows<TRow extends Record<string, unknown>>(
  groups: GroupedEntries<TRow>
): number {
  let count = 0;
  for (const group of Object.values(groups)) {
    count += group.rows.length;
    if (group.subgroups) {
      count += countGroupedRows(group.subgroups as GroupedEntries<TRow>);
    }
  }
  return count;
}

/**
 * Get group count at top level
 */
export function getTopLevelGroupCount<TRow extends Record<string, unknown>>(
  groups: GroupedEntries<TRow>
): number {
  return Object.keys(groups).length;
}
