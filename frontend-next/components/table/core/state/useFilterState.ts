/**
 * Filter State Hook (ULTRA Solution)
 *
 * Consolidates all filter-related state management with SOURCE AWARENESS:
 * - Base filters (from initialFilters prop - IMMUTABLE)
 * - View filters (from saved FoundationView - clearable)
 * - User filters (from column headers - clearable)
 * - Search filters (from search box - clearable)
 * - Quick filters (from quick filter buttons - clearable)
 *
 * Key principle: Filter sources NEVER overwrite each other.
 * Base filters from initialFilters prop are always preserved.
 *
 * @see /Users/robertharder/GitHub/teeem/frontend-next/lib/filter-atoms.ts
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  // Individual source atoms
  baseFiltersAtom,
  viewFiltersAtom,
  userFiltersAtom,
  searchFiltersAtom,
  quickFilterAtom,
  // Filter groups
  filterGroupsAtom,
  interGroupLogicAtom,
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
  // UI state
  showFiltersAtom,
  // Types
  type SourcedCascadeFilter,
  type FilterSource,
} from '@/lib/table-atoms';
import type { CascadeFilter, FilterGroup } from '@/components/table/types';

export interface FilterState {
  // Merged filters for API calls (backward compatible)
  cascadeFilters: CascadeFilter[];

  // Individual source filters (for debugging/display)
  baseFilters: SourcedCascadeFilter[];
  viewFilters: SourcedCascadeFilter[];
  userFilters: SourcedCascadeFilter[];
  searchFilters: SourcedCascadeFilter[];
  quickFilters: SourcedCascadeFilter[];

  // All filters merged with source metadata
  mergedFilters: SourcedCascadeFilter[];

  // Check if any user-clearable filters are active
  hasUserFilters: boolean;

  // Filter groups
  filterGroups: FilterGroup[];
  setFilterGroups: (value: FilterGroup[]) => void;

  // Inter-group logic
  interGroupLogic: 'AND' | 'OR';
  setInterGroupLogic: (value: 'AND' | 'OR') => void;

  // UI toggle
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;

  // ACTION FUNCTIONS (ULTRA Solution)

  /** Set base filters from initialFilters prop (IMMUTABLE once set) */
  setBaseFilters: (filters: CascadeFilter[]) => void;

  /** Set view filters from saved FoundationView */
  setViewFilters: (filters: CascadeFilter[]) => void;

  /** Add or update a user filter (from column header) */
  addUserFilter: (filter: CascadeFilter) => void;

  /** Set all user filters at once (supports functional updates) */
  setUserFilters: (filters: CascadeFilter[] | ((prev: CascadeFilter[]) => CascadeFilter[])) => void;

  /** Remove a filter by ID (only works for non-base filters) */
  removeFilter: (filterId: string | number) => void;

  /** Clear filters by source(s) - NEVER clears base filters */
  clearFilters: (sources?: FilterSource[]) => void;

  /** Clear ALL user-clearable filters (view + user + search + quickFilter) */
  clearAllUserFilters: () => void;

  /** @deprecated Use setUserFilters instead */
  setCascadeFilters: (value: CascadeFilter[]) => void;
}

/**
 * Hook for managing filter state with source awareness
 *
 * ULTRA Solution: Filters are separated by source and never overwrite each other.
 * Base filters from initialFilters prop are IMMUTABLE.
 *
 * @returns Filter state and action functions
 */
export function useFilterState(): FilterState {
  // Individual source filters (read-only)
  const baseFilters = useAtomValue(baseFiltersAtom);
  const viewFilters = useAtomValue(viewFiltersAtom);
  const userFilters = useAtomValue(userFiltersAtom);
  const searchFilters = useAtomValue(searchFiltersAtom);
  const quickFilters = useAtomValue(quickFilterAtom);

  // Derived atoms
  const mergedFilters = useAtomValue(mergedFiltersAtom);
  const cascadeFilters = useAtomValue(apiFiltersAtom);
  const hasUserFilters = useAtomValue(hasUserFiltersAtom);

  // Filter groups
  const [filterGroups, setFilterGroups] = useAtom(filterGroupsAtom);
  const [interGroupLogic, setInterGroupLogic] = useAtom(interGroupLogicAtom);

  // UI state
  const [showFilters, setShowFilters] = useAtom(showFiltersAtom);

  // Action atoms
  const setBaseFilters = useSetAtom(setBaseFiltersAtom);
  const setViewFilters = useSetAtom(setViewFiltersAtom);
  const addUserFilter = useSetAtom(addUserFilterAtom);
  const setUserFilters = useSetAtom(setUserFiltersAtom);
  const removeFilter = useSetAtom(removeFilterAtom);
  const clearFilters = useSetAtom(clearFiltersAtom);
  const clearAllUserFilters = useSetAtom(clearAllUserFiltersAtom);

  return {
    // Backward compatible - merged filters for API calls
    cascadeFilters,

    // Individual source filters
    baseFilters,
    viewFilters,
    userFilters,
    searchFilters,
    quickFilters,

    // All merged with source metadata
    mergedFilters,
    hasUserFilters,

    // Filter groups
    filterGroups,
    setFilterGroups,
    interGroupLogic,
    setInterGroupLogic,

    // UI toggle
    showFilters,
    setShowFilters,

    // ULTRA Solution action functions
    setBaseFilters,
    setViewFilters,
    addUserFilter,
    setUserFilters,
    removeFilter,
    clearFilters,
    clearAllUserFilters,

    // Deprecated - for backward compatibility
    setCascadeFilters: setUserFilters,
  };
}
