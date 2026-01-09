/**
 * Selection Feature Hook
 *
 * Complete row selection feature following the Feature Hook pattern:
 * - state: Current selection state
 * - actions: Imperative methods to modify selection
 *
 * Supports single and multi-select with shift-click range selection.
 *
 * @example
 * const selection = useSelection();
 * selection.actions.toggle(rowId);
 * selection.actions.selectAll(allRowIds);
 * const isSelected = selection.state.selectedIds.has(rowId);
 */

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { selectedRowsAtom } from '@/lib/table-atoms';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionState {
  /** Set of selected row IDs */
  selectedIds: Set<number | string>;
  /** Array form for iteration */
  selectedArray: (number | string)[];
  /** Number of selected rows */
  count: number;
  /** Whether any rows are selected */
  hasSelection: boolean;
  /** Whether all provided rows are selected */
  isAllSelected: (allIds: (number | string)[]) => boolean;
  /** Whether some (but not all) rows are selected */
  isSomeSelected: (allIds: (number | string)[]) => boolean;
}

export interface SelectionActions {
  /** Toggle selection for a single row */
  toggle: (id: number | string) => void;
  /** Select a single row (replaces selection) */
  select: (id: number | string) => void;
  /** Deselect a single row */
  deselect: (id: number | string) => void;
  /** Select multiple rows */
  selectMany: (ids: (number | string)[]) => void;
  /** Deselect multiple rows */
  deselectMany: (ids: (number | string)[]) => void;
  /** Select all provided rows */
  selectAll: (allIds: (number | string)[]) => void;
  /** Clear all selection */
  clear: () => void;
  /** Toggle all selection */
  toggleAll: (allIds: (number | string)[]) => void;
  /** Select range (for shift-click) */
  selectRange: (
    fromId: number | string,
    toId: number | string,
    allIds: (number | string)[]
  ) => void;
  /** Set selection directly */
  setSelection: (ids: Set<number | string>) => void;
}

export interface UseSelectionReturn {
  state: SelectionState;
  actions: SelectionActions;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Feature hook for table row selection
 *
 * Provides complete selection functionality with multi-select support.
 */
export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useAtom(selectedRowsAtom);

  // ============================================================================
  // STATE
  // ============================================================================

  const isAllSelected = useCallback((allIds: (number | string)[]): boolean => {
    if (allIds.length === 0) return false;
    return allIds.every((id) => selectedIds.has(id));
  }, [selectedIds]);

  const isSomeSelected = useCallback((allIds: (number | string)[]): boolean => {
    if (allIds.length === 0) return false;
    const selectedCount = allIds.filter((id) => selectedIds.has(id)).length;
    return selectedCount > 0 && selectedCount < allIds.length;
  }, [selectedIds]);

  const state = useMemo<SelectionState>(() => ({
    selectedIds,
    selectedArray: Array.from(selectedIds),
    count: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isAllSelected,
    isSomeSelected,
  }), [selectedIds, isAllSelected, isSomeSelected]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const toggle = useCallback((id: number | string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, [setSelectedIds]);

  const select = useCallback((id: number | string) => {
    setSelectedIds(new Set([id]));
  }, [setSelectedIds]);

  const deselect = useCallback((id: number | string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, [setSelectedIds]);

  const selectMany = useCallback((ids: (number | string)[]) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      ids.forEach((id) => newSet.add(id));
      return newSet;
    });
  }, [setSelectedIds]);

  const deselectMany = useCallback((ids: (number | string)[]) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      ids.forEach((id) => newSet.delete(id));
      return newSet;
    });
  }, [setSelectedIds]);

  const selectAll = useCallback((allIds: (number | string)[]) => {
    setSelectedIds(new Set(allIds));
  }, [setSelectedIds]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  const toggleAll = useCallback((allIds: (number | string)[]) => {
    setSelectedIds((prev) => {
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(allIds);
      }
    });
  }, [setSelectedIds]);

  const selectRange = useCallback((
    fromId: number | string,
    toId: number | string,
    allIds: (number | string)[]
  ) => {
    const fromIndex = allIds.indexOf(fromId);
    const toIndex = allIds.indexOf(toId);

    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = allIds.slice(start, end + 1);

    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      rangeIds.forEach((id) => newSet.add(id));
      return newSet;
    });
  }, [setSelectedIds]);

  const setSelection = useCallback((ids: Set<number | string>) => {
    setSelectedIds(ids);
  }, [setSelectedIds]);

  const actions = useMemo<SelectionActions>(() => ({
    toggle,
    select,
    deselect,
    selectMany,
    deselectMany,
    selectAll,
    clear,
    toggleAll,
    selectRange,
    setSelection,
  }), [
    toggle,
    select,
    deselect,
    selectMany,
    deselectMany,
    selectAll,
    clear,
    toggleAll,
    selectRange,
    setSelection,
  ]);

  return {
    state,
    actions,
  };
}

// ============================================================================
// SELECTOR HELPERS
// ============================================================================

/**
 * Check if a specific row is selected
 */
export function isRowSelected(
  selectedIds: Set<number | string>,
  rowId: number | string
): boolean {
  return selectedIds.has(rowId);
}

/**
 * Get intersection of selection with visible rows
 */
export function getVisibleSelection(
  selectedIds: Set<number | string>,
  visibleIds: (number | string)[]
): (number | string)[] {
  return visibleIds.filter((id) => selectedIds.has(id));
}

/**
 * Count selected rows that are visible
 */
export function countVisibleSelection(
  selectedIds: Set<number | string>,
  visibleIds: (number | string)[]
): number {
  return visibleIds.filter((id) => selectedIds.has(id)).length;
}
