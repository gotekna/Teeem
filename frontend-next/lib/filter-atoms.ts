/**
 * Source-Aware Filter Atoms (ULTRA Solution)
 *
 * SSoT: Each filter source gets its own atom. Filters are NEVER overwritten -
 * they're merged with clear precedence rules.
 *
 * Sources:
 * - base: From initialFilters prop (parent-controlled, IMMUTABLE)
 * - view: From saved FoundationView
 * - user: From column header filters
 * - search: From search box
 * - quickFilter: From quick filter buttons
 *
 * Priority (later sources can override same column):
 * base > view > user > search > quickFilter
 */

import { atom } from 'jotai';
import type { CascadeFilter, FilterGroup } from '@/components/table/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Filter source identifies where a filter originated from
 */
export type FilterSource = 'base' | 'view' | 'user' | 'search' | 'quickFilter';

/**
 * Extended filter with source tracking
 */
export interface SourcedCascadeFilter extends CascadeFilter {
  source: FilterSource;
  locked?: boolean; // Base filters are locked (no X button in UI)
}

/**
 * Filter state by source (for debugging/inspection)
 */
export interface SourcedFilterState {
  base: SourcedCascadeFilter[];
  view: SourcedCascadeFilter[];
  user: SourcedCascadeFilter[];
  search: SourcedCascadeFilter[];
  quickFilter: SourcedCascadeFilter[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure all filters have unique IDs
 * Prevents React key conflicts when rendering filter editor
 */
const ensureFilterIds = <T extends CascadeFilter>(filters: T[], sourcePrefix: string): T[] =>
  filters.map((f, idx) => ({
    ...f,
    id: f.id || `${sourcePrefix}_${Date.now()}_${idx}`,
  }));

/**
 * Convert regular filters to sourced filters
 */
const toSourcedFilters = (
  filters: CascadeFilter[],
  source: FilterSource,
  locked: boolean = false
): SourcedCascadeFilter[] =>
  ensureFilterIds(filters, source).map(f => ({
    ...f,
    source,
    locked,
  }));

// ============================================================================
// INDIVIDUAL SOURCE ATOMS
// Each source owns its own state - they never overwrite each other
// ============================================================================

/**
 * Base filters - from initialFilters prop
 * IMMUTABLE: These are set by parent component and never cleared by user actions
 */
export const baseFiltersAtom = atom<SourcedCascadeFilter[]>([]);

/**
 * View filters - from saved FoundationView
 * Cleared when: new view selected, view cleared
 */
export const viewFiltersAtom = atom<SourcedCascadeFilter[]>([]);

/**
 * User filters - from column header filters
 * Cleared when: user clears individual filter or "Clear Filters"
 */
export const userFiltersAtom = atom<SourcedCascadeFilter[]>([]);

/**
 * Search filters - from search box
 * Cleared when: search cleared
 */
export const searchFiltersAtom = atom<SourcedCascadeFilter[]>([]);

/**
 * Quick filters - from quick filter buttons
 * Cleared when: quick filter deselected
 */
export const quickFilterAtom = atom<SourcedCascadeFilter[]>([]);

// ============================================================================
// FILTER GROUPS (shared across all sources)
// ============================================================================

/**
 * Filter groups for organizing filters with AND/OR logic
 */
export const filterGroupsAtom = atom<FilterGroup[]>([{ id: "default", logic: "AND" }]);

/**
 * Logic operator between filter groups (AND or OR)
 */
export const interGroupLogicAtom = atom<"AND" | "OR">("OR");

// ============================================================================
// DERIVED ATOMS
// ============================================================================

/**
 * Merged filters - combines all sources for API calls
 *
 * Priority: base > view > user > search > quickFilter
 * All sources are included; later sources DON'T override same column
 * (we want to AND them together, not replace)
 */
export const mergedFiltersAtom = atom<SourcedCascadeFilter[]>((get) => {
  const base = get(baseFiltersAtom);
  const view = get(viewFiltersAtom);
  const user = get(userFiltersAtom);
  const search = get(searchFiltersAtom);
  const quick = get(quickFilterAtom);

  // Combine all - base filters are marked as locked
  return [
    ...base.map(f => ({ ...f, locked: true })),
    ...view,
    ...user,
    ...search,
    ...quick,
  ];
});

/**
 * Get all filters as regular CascadeFilter array (for API calls)
 * Strips source metadata for backend compatibility
 */
export const apiFiltersAtom = atom<CascadeFilter[]>((get) => {
  const merged = get(mergedFiltersAtom);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return merged.map(({ source, locked, ...rest }) => rest);
});

/**
 * Check if any user-clearable filters are active
 * Base filters don't count since they can't be cleared
 */
export const hasUserFiltersAtom = atom<boolean>((get) => {
  const view = get(viewFiltersAtom);
  const user = get(userFiltersAtom);
  const search = get(searchFiltersAtom);
  const quick = get(quickFilterAtom);

  return view.length > 0 || user.length > 0 || search.length > 0 || quick.length > 0;
});

/**
 * Get filter state by source (for debugging)
 */
export const filterStateBySourceAtom = atom<SourcedFilterState>((get) => ({
  base: get(baseFiltersAtom),
  view: get(viewFiltersAtom),
  user: get(userFiltersAtom),
  search: get(searchFiltersAtom),
  quickFilter: get(quickFilterAtom),
}));

// ============================================================================
// ACTION ATOMS (write atoms for safe mutations)
// ============================================================================

/**
 * Set base filters (from initialFilters prop)
 * These are LOCKED and cannot be cleared by user
 */
export const setBaseFiltersAtom = atom(
  null,
  (_get, set, filters: CascadeFilter[]) => {
    set(baseFiltersAtom, toSourcedFilters(filters, 'base', true));
  }
);

/**
 * Set view filters (from saved FoundationView)
 */
export const setViewFiltersAtom = atom(
  null,
  (_get, set, filters: CascadeFilter[]) => {
    set(viewFiltersAtom, toSourcedFilters(filters, 'view'));
  }
);

/**
 * Add or update a user filter (from column header)
 * If filter for same column exists, replaces it
 */
export const addUserFilterAtom = atom(
  null,
  (get, set, filter: CascadeFilter) => {
    const current = get(userFiltersAtom);
    // Remove existing filter on same column with same operator, add new one
    // This allows multiple filters on same column with different operators
    const filtered = current.filter(
      f => !(f.column === filter.column && f.operator === filter.operator)
    );
    const sourced = toSourcedFilters([filter], 'user')[0];
    set(userFiltersAtom, [...filtered, sourced]);
  }
);

/**
 * Set all user filters at once (replaces existing)
 * Supports both direct value and functional update patterns
 */
export const setUserFiltersAtom = atom(
  null,
  (get, set, filtersOrUpdater: CascadeFilter[] | ((prev: CascadeFilter[]) => CascadeFilter[])) => {
    // Support functional update pattern for backward compatibility
    const currentUserFilters = get(userFiltersAtom);
    // Strip source metadata for the prev array
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const prevFilters = currentUserFilters.map(({ source, locked, ...rest }) => rest);

    const newFilters = typeof filtersOrUpdater === 'function'
      ? filtersOrUpdater(prevFilters)
      : filtersOrUpdater;

    set(userFiltersAtom, toSourcedFilters(newFilters, 'user'));
  }
);

/**
 * Set search filters
 */
export const setSearchFiltersAtom = atom(
  null,
  (_get, set, filters: CascadeFilter[]) => {
    set(searchFiltersAtom, toSourcedFilters(filters, 'search'));
  }
);

/**
 * Set quick filters
 */
export const setQuickFiltersAtom = atom(
  null,
  (_get, set, filters: CascadeFilter[]) => {
    set(quickFilterAtom, toSourcedFilters(filters, 'quickFilter'));
  }
);

/**
 * Remove a filter by ID
 * Only removes from non-base sources (base filters are locked)
 */
export const removeFilterAtom = atom(
  null,
  (get, set, filterId: string | number) => {
    const id = String(filterId);

    // Only remove from non-base sources (base filters are locked)
    set(viewFiltersAtom, get(viewFiltersAtom).filter(f => String(f.id) !== id));
    set(userFiltersAtom, get(userFiltersAtom).filter(f => String(f.id) !== id));
    set(searchFiltersAtom, get(searchFiltersAtom).filter(f => String(f.id) !== id));
    set(quickFilterAtom, get(quickFilterAtom).filter(f => String(f.id) !== id));
  }
);

/**
 * Clear filters by source
 * NEVER clears base filters (they are immutable)
 */
export const clearFiltersAtom = atom(
  null,
  (_get, set, sources?: FilterSource[]) => {
    const toClear = sources || ['view', 'user', 'search', 'quickFilter'];

    // NEVER clear base filters - they are immutable
    if (toClear.includes('view')) set(viewFiltersAtom, []);
    if (toClear.includes('user')) set(userFiltersAtom, []);
    if (toClear.includes('search')) set(searchFiltersAtom, []);
    if (toClear.includes('quickFilter')) set(quickFilterAtom, []);
  }
);

/**
 * Clear ALL user-clearable filters (view + user + search + quickFilter)
 * Base filters remain untouched
 */
export const clearAllUserFiltersAtom = atom(
  null,
  (_get, set) => {
    set(viewFiltersAtom, []);
    set(userFiltersAtom, []);
    set(searchFiltersAtom, []);
    set(quickFilterAtom, []);
  }
);

/**
 * Reset filter groups to default state
 */
export const resetFilterGroupsAtom = atom(
  null,
  (_get, set) => {
    set(filterGroupsAtom, [{ id: "default", logic: "AND" }]);
    set(interGroupLogicAtom, "OR");
  }
);

/**
 * Full reset - clears all filters except base and resets groups
 * Use when navigating to a new table/foundation
 */
export const resetAllFiltersAtom = atom(
  null,
  (_get, set) => {
    // Don't clear base - parent will set new base filters
    set(viewFiltersAtom, []);
    set(userFiltersAtom, []);
    set(searchFiltersAtom, []);
    set(quickFilterAtom, []);
    set(filterGroupsAtom, [{ id: "default", logic: "AND" }]);
    set(interGroupLogicAtom, "OR");
  }
);
