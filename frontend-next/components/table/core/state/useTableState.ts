/**
 * Table State Hook (Main Hook)
 *
 * Consolidates ALL table state into a single hook.
 * Wraps the specialized hooks (useColumnState, useFilterState, useEditingState)
 * plus additional state for search, views, grouping, selection, and display.
 *
 * Usage:
 *   const table = useTableState();
 *   table.columns.sortColumns // Access column state
 *   table.filters.cascadeFilters // Access filter state
 *   table.editing.isEditMode // Access editing state
 *
 * This provides a clean, organized API for all table state management.
 */

import { useAtom } from 'jotai';
import {
  searchQueryAtom,
  searchAllColumnsAtom,
  selectedRowsAtom,
  rowLimitAtom,
  showAllRowsAtom,
  currentGroupByColumnsAtom,
  collapsedGroupsAtom,
  groupViewModeAtom,
  currentShowTotalsAtom,
  healthPanelOpenAtom,
} from '@/lib/table-atoms';
import {
  foundationViewsAtom,
  activeViewIdAtom,
} from '@/lib/view-state-atoms';

import { useColumnState } from './useColumnState';
import { useFilterState } from './useFilterState';
import { useEditingState } from './useEditingState';
import type { SavedView } from '@/components/table/types';

export interface TableState {
  // Specialized state (from other hooks)
  columns: ReturnType<typeof useColumnState>;
  filters: ReturnType<typeof useFilterState>;
  editing: ReturnType<typeof useEditingState>;

  // Search state
  search: string;
  setSearch: (value: string) => void;
  searchAllColumns: boolean;
  setSearchAllColumns: (value: boolean) => void;

  // Selection state
  selectedRows: Set<number | string>;
  setSelectedRows: (value: Set<number | string>) => void;

  // View state
  savedViews: SavedView[];
  setSavedViews: (value: SavedView[]) => void;
  activeViewId: number | string | null;
  setActiveViewId: (value: number | string | null) => void;

  // Display state
  rowLimit: number;
  setRowLimit: (value: number) => void;
  showAllRows: boolean;
  setShowAllRows: (value: boolean) => void;
  showTotals: boolean;
  setShowTotals: (value: boolean) => void;

  // Grouping state
  groupByColumns: string[];
  setGroupByColumns: (value: string[]) => void;
  collapsedGroups: Set<string>;
  setCollapsedGroups: (value: Set<string>) => void;
  groupViewMode: 'inline' | 'panel';
  setGroupViewMode: (value: 'inline' | 'panel') => void;

  // Health panel state
  healthPanelOpen: boolean;
  setHealthPanelOpen: (value: boolean) => void;
}

/**
 * Main hook for managing all table state
 *
 * Provides organized access to all table state through nested objects:
 * - table.columns.* - Column state (sort, width, order, visibility)
 * - table.filters.* - Filter state (filters, groups, logic)
 * - table.editing.* - Editing state (edit mode, data, validation)
 * - table.search* - Search state
 * - table.selectedRows* - Selection state
 * - table.savedViews* - View state
 * - table.groupBy* - Grouping state
 *
 * @returns Comprehensive table state
 */
export function useTableState(): TableState {
  // Specialized state hooks
  const columns = useColumnState();
  const filters = useFilterState();
  const editing = useEditingState();

  // Search state
  const [search, setSearch] = useAtom(searchQueryAtom);
  const [searchAllColumns, setSearchAllColumns] = useAtom(searchAllColumnsAtom);

  // Selection state
  const [selectedRows, setSelectedRows] = useAtom(selectedRowsAtom);

  // View state
  const [savedViews, setSavedViews] = useAtom(foundationViewsAtom);
  const [activeViewId, setActiveViewId] = useAtom(activeViewIdAtom);

  // Display state
  const [rowLimit, setRowLimit] = useAtom(rowLimitAtom);
  const [showAllRows, setShowAllRows] = useAtom(showAllRowsAtom);
  const [showTotals, setShowTotals] = useAtom(currentShowTotalsAtom);

  // Grouping state
  const [groupByColumns, setGroupByColumns] = useAtom(currentGroupByColumnsAtom);
  const [collapsedGroups, setCollapsedGroups] = useAtom(collapsedGroupsAtom);
  const [groupViewMode, setGroupViewMode] = useAtom(groupViewModeAtom);

  // Health panel state
  const [healthPanelOpen, setHealthPanelOpen] = useAtom(healthPanelOpenAtom);

  return {
    columns,
    filters,
    editing,
    search,
    setSearch,
    searchAllColumns,
    setSearchAllColumns,
    selectedRows,
    setSelectedRows,
    savedViews,
    setSavedViews,
    activeViewId,
    setActiveViewId,
    rowLimit,
    setRowLimit,
    showAllRows,
    setShowAllRows,
    showTotals,
    setShowTotals,
    groupByColumns,
    setGroupByColumns,
    collapsedGroups,
    setCollapsedGroups,
    groupViewMode,
    setGroupViewMode,
    healthPanelOpen,
    setHealthPanelOpen,
  };
}
