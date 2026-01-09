/**
 * Filtering Feature Hook
 *
 * Complete filtering feature following the Feature Hook pattern:
 * - state: Current filter configuration with source awareness
 * - actions: Imperative methods to modify filters
 * - apply: Pure function to filter rows using headless core
 *
 * Integrates with the ULTRA filter source architecture:
 * - base: From initialFilters prop (IMMUTABLE)
 * - view: From saved views (clearable)
 * - user: From column headers (clearable)
 *
 * @example
 * const filtering = useFiltering();
 * const filteredRows = filtering.apply(rows);
 * filtering.actions.addFilter({ column: 'status', operator: '=', value: 'active' });
 */

import { useCallback, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  // Source atoms
  baseFiltersAtom,
  viewFiltersAtom,
  userFiltersAtom,
  // Derived atoms
  mergedFiltersAtom,
  apiFiltersAtom,
  hasUserFiltersAtom,
  // Action atoms
  setBaseFiltersAtom,
  setViewFiltersAtom,
  addUserFilterAtom,
  setUserFiltersAtom,
  removeFilterAtom,
  clearFiltersAtom,
  clearAllUserFiltersAtom,
  // Groups
  filterGroupsAtom,
  interGroupLogicAtom,
  // UI
  showFiltersAtom,
  type FilterSource,
} from '@/lib/table-atoms';
import { filterRows } from '@/lib/table-core';
import type { CascadeFilter, FilterGroup } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface FilteringState {
  /** All filters merged (for API calls) */
  filters: CascadeFilter[];
  /** Base filters from initialFilters prop */
  baseFilters: CascadeFilter[];
  /** View filters from saved views */
  viewFilters: CascadeFilter[];
  /** User filters from column headers */
  userFilters: CascadeFilter[];
  /** Whether any user-clearable filters are active */
  hasUserFilters: boolean;
  /** Filter groups configuration */
  filterGroups: FilterGroup[];
  /** Logic between filter groups */
  interGroupLogic: 'AND' | 'OR';
  /** Total number of active filters */
  filterCount: number;
  /** UI: whether filter panel is shown */
  showFilters: boolean;
}

export interface FilteringActions {
  /** Set base filters (from initialFilters prop - usually done once) */
  setBaseFilters: (filters: CascadeFilter[]) => void;
  /** Set view filters (when loading a saved view) */
  setViewFilters: (filters: CascadeFilter[]) => void;
  /** Add a user filter */
  addFilter: (filter: Omit<CascadeFilter, 'id'> & { id?: string | number }) => void;
  /** Update an existing filter */
  updateFilter: (id: string | number, updates: Partial<CascadeFilter>) => void;
  /** Remove a filter by ID */
  removeFilter: (id: string | number) => void;
  /** Clear filters by source (never clears base) */
  clearFilters: (sources?: FilterSource[]) => void;
  /** Clear all user-clearable filters */
  clearAllUserFilters: () => void;
  /** Set filter groups */
  setFilterGroups: (groups: FilterGroup[]) => void;
  /** Set inter-group logic */
  setInterGroupLogic: (logic: 'AND' | 'OR') => void;
  /** Toggle filter panel visibility */
  toggleShowFilters: () => void;
  /** Set filter panel visibility */
  setShowFilters: (show: boolean) => void;
}

export interface UseFilteringReturn {
  state: FilteringState;
  actions: FilteringActions;
  /** Apply filtering to rows (pure function from headless core) */
  apply: <TRow extends Record<string, unknown>>(rows: TRow[]) => TRow[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Feature hook for table filtering
 *
 * Provides complete filtering functionality with source-aware state.
 * Uses the headless core for pure data processing.
 */
export function useFiltering(): UseFilteringReturn {
  // Source filters
  const baseFilters = useAtomValue(baseFiltersAtom);
  const viewFilters = useAtomValue(viewFiltersAtom);
  const userFilters = useAtomValue(userFiltersAtom);

  // Derived
  const mergedFilters = useAtomValue(mergedFiltersAtom);
  const apiFilters = useAtomValue(apiFiltersAtom);
  const hasUserFilters = useAtomValue(hasUserFiltersAtom);

  // Groups
  const [filterGroups, setFilterGroups] = useAtom(filterGroupsAtom);
  const [interGroupLogic, setInterGroupLogic] = useAtom(interGroupLogicAtom);

  // UI
  const [showFilters, setShowFilters] = useAtom(showFiltersAtom);

  // Action atoms
  const setBaseFilters = useSetAtom(setBaseFiltersAtom);
  const setViewFilters = useSetAtom(setViewFiltersAtom);
  const addUserFilter = useSetAtom(addUserFilterAtom);
  const setUserFilters = useSetAtom(setUserFiltersAtom);
  const removeFilter = useSetAtom(removeFilterAtom);
  const clearFilters = useSetAtom(clearFiltersAtom);
  const clearAllUserFilters = useSetAtom(clearAllUserFiltersAtom);

  // ============================================================================
  // STATE
  // ============================================================================

  const state = useMemo<FilteringState>(() => ({
    filters: apiFilters,
    baseFilters: baseFilters.map(f => ({ ...f, id: f.id, column: f.column, operator: f.operator, value: f.value })),
    viewFilters: viewFilters.map(f => ({ ...f, id: f.id, column: f.column, operator: f.operator, value: f.value })),
    userFilters: userFilters.map(f => ({ ...f, id: f.id, column: f.column, operator: f.operator, value: f.value })),
    hasUserFilters,
    filterGroups,
    interGroupLogic,
    filterCount: apiFilters.length,
    showFilters,
  }), [apiFilters, baseFilters, viewFilters, userFilters, hasUserFilters, filterGroups, interGroupLogic, showFilters]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const addFilter = useCallback((filter: Omit<CascadeFilter, 'id'> & { id?: string | number }) => {
    const newFilter: CascadeFilter = {
      ...filter,
      id: filter.id ?? `filter_${Date.now()}`,
    };
    addUserFilter(newFilter);
  }, [addUserFilter]);

  const updateFilter = useCallback((id: string | number, updates: Partial<CascadeFilter>) => {
    setUserFilters((prev) =>
      prev.map((f) => f.id === id ? { ...f, ...updates } : f)
    );
  }, [setUserFilters]);

  const toggleShowFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, [setShowFilters]);

  const actions = useMemo<FilteringActions>(() => ({
    setBaseFilters,
    setViewFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    clearAllUserFilters,
    setFilterGroups,
    setInterGroupLogic,
    toggleShowFilters,
    setShowFilters,
  }), [
    setBaseFilters,
    setViewFilters,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    clearAllUserFilters,
    setFilterGroups,
    setInterGroupLogic,
    toggleShowFilters,
    setShowFilters,
  ]);

  // ============================================================================
  // APPLY (data transformation using headless core)
  // ============================================================================

  const apply = useCallback(<TRow extends Record<string, unknown>>(rows: TRow[]): TRow[] => {
    if (apiFilters.length === 0) return rows;
    return filterRows(rows, apiFilters, filterGroups, interGroupLogic);
  }, [apiFilters, filterGroups, interGroupLogic]);

  return {
    state,
    actions,
    apply,
  };
}

// ============================================================================
// SELECTOR HELPERS
// ============================================================================

/**
 * Check if a specific column has any active filters
 */
export function hasColumnFilter(
  filters: CascadeFilter[],
  columnKey: string
): boolean {
  return filters.some((f) => f.column === columnKey);
}

/**
 * Get all filters for a specific column
 */
export function getColumnFilters(
  filters: CascadeFilter[],
  columnKey: string
): CascadeFilter[] {
  return filters.filter((f) => f.column === columnKey);
}

/**
 * Count filters by column
 */
export function countFiltersByColumn(
  filters: CascadeFilter[]
): Record<string, number> {
  return filters.reduce((acc, f) => {
    acc[f.column] = (acc[f.column] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
