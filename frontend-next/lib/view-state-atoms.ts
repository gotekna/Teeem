/**
 * Centralized View State Management using Jotai Atoms
 *
 * This file provides a Single Source of Truth (SSoT) for all view-related state
 * in TeeemTableView, eliminating dual state management between ViewManagerSheet
 * and TeeemTableView components.
 *
 * Benefits:
 * - Atomic updates (all state changes together, no race conditions)
 * - No prop drilling or callback chains
 * - Better performance (only re-renders components using changed atoms)
 * - Proper cache management with invalidation
 *
 * FILTER ARCHITECTURE (ULTRA Solution):
 * - Filter state is now source-aware (base/view/user/search/quickFilter)
 * - Base filters from initialFilters prop are IMMUTABLE
 * - User filters can be cleared without affecting base filters
 * - See lib/filter-atoms.ts for the SSoT filter implementation
 */

import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { SavedView, CascadeFilter, FilterGroup, SortColumn } from '@/components/table/types';
import { CACHE_TTL_VIEWS, CACHE_TTL_LOOKUPS } from './constants/cache-constants';

// Import the actual atoms for use in applyViewAtom
import {
  viewFiltersAtom as _viewFiltersAtom,
  filterGroupsAtom as _filterGroupsAtom,
  interGroupLogicAtom as _interGroupLogicAtom,
} from './filter-atoms';
import { groupViewModeAtom } from './table-atoms';

// Re-export all filter atoms from the SSoT location
export {
  // Types
  type FilterSource,
  type SourcedCascadeFilter,
  type SourcedFilterState,
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
  filterStateBySourceAtom,
  // Action atoms
  setBaseFiltersAtom,
  setViewFiltersAtom,
  addUserFilterAtom,
  setUserFiltersAtom,
  setSearchFiltersAtom,
  setQuickFiltersAtom,
  removeFilterAtom,
  clearFiltersAtom,
  clearAllUserFiltersAtom,
  resetFilterGroupsAtom,
  resetAllFiltersAtom,
} from './filter-atoms';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure all filters have unique IDs
 * Prevents React key conflicts when rendering filter editor
 */
const ensureFilterIds = (filters: CascadeFilter[]): CascadeFilter[] =>
  filters.map((f, idx) => ({
    ...f,
    id: f.id || `filter_${Date.now()}_${idx}`,
  }));

// ============================================================================
// CORE VIEW STATE ATOMS
// ============================================================================

/**
 * Currently active view ID
 */
export const activeViewIdAtom = atom<number | string | null>(null);

/**
 * @deprecated Use apiFiltersAtom from filter-atoms.ts instead
 * Current cascade filters - now backed by merged filter sources
 * This is a compatibility alias that reads from mergedFiltersAtom
 */
export { apiFiltersAtom as currentFiltersAtom } from './filter-atoms';

/**
 * @deprecated Use filterGroupsAtom from filter-atoms.ts instead
 * Filter groups for organizing filters with AND/OR logic
 */
export { filterGroupsAtom as currentFilterGroupsAtom } from './filter-atoms';

/**
 * @deprecated Use interGroupLogicAtom from filter-atoms.ts instead
 * Logic operator between filter groups (AND or OR)
 */
export { interGroupLogicAtom as currentInterGroupLogicAtom } from './filter-atoms';

/**
 * Column visibility state (key: column name, value: visible boolean)
 */
export const currentVisibleColumnsAtom = atom<Record<string, boolean>>({});

/**
 * Column order (array of column keys in display order)
 */
export const currentColumnOrderAtom = atom<string[]>([]);

/**
 * Column widths (key: column name, value: width in pixels)
 */
export const currentColumnWidthsAtom = atom<Record<string, number>>({});

/**
 * Sort columns with direction
 */
export const currentSortColumnsAtom = atom<SortColumn[]>([]);

/**
 * Columns to group by (for grouped table view)
 */
export const currentGroupByColumnsAtom = atom<string[]>([]);

/**
 * Auto-fit columns to content
 */
export const currentAutoFitColumnsAtom = atom<boolean>(false);

/**
 * TEEEM Smart auto-fit - priority-based column widths
 * Default to true for new views
 */
export const currentSmartFitAtom = atom<boolean>(true);

/**
 * Show totals row at bottom of table
 */
export const currentShowTotalsAtom = atom<boolean>(true);

/**
 * Which columns show totals (empty array means ALL numeric columns)
 */
export const currentTotalsColumnsAtom = atom<string[]>([]);

/**
 * Pin actions column to right edge when scrolling horizontally
 * GOLD STANDARD: Part of position-based sticky columns
 */
export const currentStickyActionsAtom = atom<boolean>(true);

/**
 * Collapsed groups in grouped table view
 * SSoT: Stored in atoms so it persists with saved views
 */
export const collapsedGroupsAtom = atom<Set<string>>(new Set<string>());

// ============================================================================
// COLUMN CONFIG ATOMIC ACTION
// ============================================================================

/**
 * Column configuration update interface
 * Used by updateColumnConfigAtom to update multiple column settings atomically
 */
export interface ColumnConfigUpdate {
  widths?: Record<string, number>;
  order?: string[];
  visible?: Record<string, boolean>;
  sort?: SortColumn[];
  groupBy?: string[];
  autoFit?: boolean;
  smartFit?: boolean;
  showTotals?: boolean;
  totalsColumns?: string[];
  stickyActions?: boolean;
}

/**
 * Atomic column config update
 *
 * SSoT ARCHITECTURE: Updates multiple column-related atoms in a single transaction.
 * This prevents the drift that occurs when 4 separate atoms (widths, order, visible, sort)
 * are updated independently and one update fails, leaving state inconsistent.
 *
 * Usage:
 * ```typescript
 * setColumnConfig({
 *   widths: { name: 200, email: 150 },
 *   order: ['name', 'email', 'phone'],
 *   visible: { name: true, email: true, phone: false },
 *   sort: [{ column: 'name', direction: 'asc' }]
 * });
 * ```
 */
export const updateColumnConfigAtom = atom(
  null,
  (get, set, update: ColumnConfigUpdate) => {
    // Validate consistency if both order and visible are provided
    if (update.order && update.visible) {
      // All visible columns should exist in order
      const visibleKeys = Object.keys(update.visible).filter(k => update.visible![k]);
      const orderSet = new Set(update.order);
      const missingFromOrder = visibleKeys.filter(k => !orderSet.has(k));

      if (missingFromOrder.length > 0) {
        console.warn(
          '[updateColumnConfigAtom] Some visible columns not in order:',
          missingFromOrder
        );
        // Auto-fix: append missing columns to order
        update.order = [...update.order, ...missingFromOrder];
      }
    }

    // Atomic batch update - all or nothing
    if (update.widths !== undefined) {
      set(currentColumnWidthsAtom, update.widths);
    }
    if (update.order !== undefined) {
      set(currentColumnOrderAtom, update.order);
    }
    if (update.visible !== undefined) {
      set(currentVisibleColumnsAtom, update.visible);
    }
    if (update.sort !== undefined) {
      set(currentSortColumnsAtom, update.sort);
    }
    if (update.groupBy !== undefined) {
      set(currentGroupByColumnsAtom, update.groupBy);
    }
    if (update.autoFit !== undefined) {
      set(currentAutoFitColumnsAtom, update.autoFit);
    }
    if (update.smartFit !== undefined) {
      set(currentSmartFitAtom, update.smartFit);
    }
    if (update.showTotals !== undefined) {
      set(currentShowTotalsAtom, update.showTotals);
    }
    if (update.totalsColumns !== undefined) {
      set(currentTotalsColumnsAtom, update.totalsColumns);
    }
    if (update.stickyActions !== undefined) {
      set(currentStickyActionsAtom, update.stickyActions);
    }
  }
);

/**
 * Reset all column config to defaults
 * Useful when switching foundations or clearing custom configuration
 */
export const resetColumnConfigAtom = atom(
  null,
  (get, set) => {
    set(currentColumnWidthsAtom, {});
    set(currentColumnOrderAtom, []);
    set(currentVisibleColumnsAtom, {});
    set(currentSortColumnsAtom, []);
    set(currentGroupByColumnsAtom, []);
    set(currentAutoFitColumnsAtom, false);
    set(currentSmartFitAtom, true);
    set(currentShowTotalsAtom, true);
    set(currentTotalsColumnsAtom, []);
    set(currentStickyActionsAtom, true);
    set(collapsedGroupsAtom, new Set<string>());
  }
);

// ============================================================================
// VIEW COLLECTION STATE
// ============================================================================

/**
 * Per-foundation view cache with TTL
 * Persisted to localStorage for faster page loads
 */
// Cache key can be a number (foundationId) or string (e.g., "218_inherit_426")
export const viewsCacheAtom = atomWithStorage<Record<string | number, {
  views: SavedView[];
  timestamp: number;
}>>('teeem_views_cache', {});

// SSoT: Uses CACHE_TTL_VIEWS from cache-constants.ts
export const VIEWS_CACHE_TTL = CACHE_TTL_VIEWS;

/**
 * Current foundation's views (loaded from API or cache)
 */
export const foundationViewsAtom = atom<SavedView[]>([]);

/**
 * Loading state for view fetching
 */
export const viewsLoadingAtom = atom<boolean>(false);

/**
 * Saving state for view persistence
 */
export const viewSavingAtom = atom<boolean>(false);

// ============================================================================
// DERIVED ATOMS (computed state)
// ============================================================================

/**
 * Get the full SavedView object for the currently active view
 */
export const currentViewAtom = atom((get) => {
  const viewId = get(activeViewIdAtom);
  const views = get(foundationViewsAtom);
  return views.find(v => v.id === viewId) || null;
});

/**
 * Check if current state differs from saved view
 * Useful for showing "unsaved changes" indicator
 */
export const hasUnsavedChangesAtom = atom((get) => {
  const savedView = get(currentViewAtom);
  if (!savedView) return false;

  // Compare current state with saved view
  // Import apiFiltersAtom directly since we're inside this file
  const { apiFiltersAtom } = require('./filter-atoms');
  const currentFilters = get(apiFiltersAtom);
  const currentVisibleColumns = get(currentVisibleColumnsAtom);
  const currentColumnOrder = get(currentColumnOrderAtom);
  const currentSortColumns = get(currentSortColumnsAtom);

  // Simple JSON comparison (could be optimized with deep equality check)
  return (
    JSON.stringify(savedView.filters) !== JSON.stringify(currentFilters) ||
    JSON.stringify(savedView.visibleColumns) !== JSON.stringify(currentVisibleColumns) ||
    JSON.stringify(savedView.columnOrder) !== JSON.stringify(currentColumnOrder) ||
    JSON.stringify(savedView.sortColumns) !== JSON.stringify(currentSortColumns)
  );
});

// ============================================================================
// ATOMIC ACTIONS (write atoms that update multiple atoms atomically)
// ============================================================================

/**
 * Apply a saved view to current state
 * This replaces the loadViewState callback pattern
 *
 * All state updates happen atomically - React batches them into a single render
 *
 * ULTRA Solution: Sets VIEW filters only - base filters from initialFilters
 * prop are preserved and not affected by view changes.
 */
export const applyViewAtom = atom(
  null,
  (get, set, view: SavedView) => {
    // Atomically update ALL state in one transaction
    set(activeViewIdAtom, view.id);

    // Handle filters - may be array (legacy) or object with cascadeFilters (current)
    // Priority: cascadeFilters in object > direct array > empty
    // Always use ensureFilterIds to prevent React key conflicts
    let filters: CascadeFilter[] = [];
    let filterGroups: FilterGroup[] = [{ id: "default", logic: "AND" }];
    let interGroupLogic: "AND" | "OR" = "OR";

    if (view.filters) {
      if (Array.isArray(view.filters)) {
        // Legacy format: filters is direct array
        filters = view.filters;
      } else if (typeof view.filters === 'object' && view.filters !== null) {
        // Current format: filters is object with cascadeFilters
        const filtersObj = view.filters as {
          cascadeFilters?: CascadeFilter[];
          filterGroups?: FilterGroup[];
          interGroupLogic?: "AND" | "OR"
        };
        if (Array.isArray(filtersObj.cascadeFilters)) {
          filters = filtersObj.cascadeFilters;
        }
        if (Array.isArray(filtersObj.filterGroups)) {
          filterGroups = filtersObj.filterGroups;
        }
        if (filtersObj.interGroupLogic) {
          interGroupLogic = filtersObj.interGroupLogic;
        }
      }
    }

    // Override with top-level fields if present (legacy support)
    if (view.filterGroups && Array.isArray(view.filterGroups)) {
      filterGroups = view.filterGroups;
    }
    if (view.interGroupLogic) {
      interGroupLogic = view.interGroupLogic;
    }

    // ULTRA Solution: Set VIEW filters only (base filters are preserved)
    // Convert regular filters to sourced filters with 'view' source
    const sourcedFilters = ensureFilterIds(filters).map(f => ({
      ...f,
      source: 'view' as const,
      locked: false,
    }));

    // For "grouped" view type (By Company), auto-add entity_type = "person" filter
    // This ensures only people are shown, grouped under their company
    if (view.view_type === 'grouped') {
      const hasEntityTypeFilter = sourcedFilters.some(f => f.column === 'entity_type');
      if (!hasEntityTypeFilter) {
        sourcedFilters.push({
          id: `grouped_entity_filter_${Date.now()}`,
          column: 'entity_type',
          operator: '=' as const,
          value: 'person',
          source: 'view' as const,
          locked: true, // Lock this filter so users can't accidentally remove it
        });
      }
    }

    set(_viewFiltersAtom, sourcedFilters);
    set(_filterGroupsAtom, filterGroups);
    set(_interGroupLogicAtom, interGroupLogic);

    // Column configuration
    if (view.visibleColumns) {
      set(currentVisibleColumnsAtom, view.visibleColumns);
    }
    if (view.columnOrder) {
      set(currentColumnOrderAtom, view.columnOrder);
    }

    // Only load saved column widths if auto-fit is NOT enabled
    // Check both direct property and columns object (API format varies)
    const viewAny = view as SavedView & { columns?: { autoFitColumns?: boolean; showTotals?: boolean } };
    const viewAutoFit = view.autoFitColumns === true ||
      (viewAny.columns && viewAny.columns.autoFitColumns === true);

    if (view.columnWidths && !viewAutoFit) {
      set(currentColumnWidthsAtom, view.columnWidths);
    }

    // Sorting and grouping
    if (view.sortColumns) {
      set(currentSortColumnsAtom, view.sortColumns);
    }
    if (view.groupByColumns && view.groupByColumns.length > 0) {
      set(currentGroupByColumnsAtom, view.groupByColumns);
    } else if (view.groupByColumn) {
      set(currentGroupByColumnsAtom, view.groupByColumn ? [view.groupByColumn] : []);
    } else {
      set(currentGroupByColumnsAtom, []);
    }

    // Grouped view type (Company/Role search mode)
    // When view_type is "grouped", enable panel mode for relationship grouping
    if (view.view_type === 'grouped') {
      set(groupViewModeAtom, 'panel');
      // If no groupByColumn is set, default to "primary_company_id" for contacts
      if (!view.groupByColumns?.length && !view.groupByColumn) {
        set(currentGroupByColumnsAtom, ['primary_company_id']);
      }
    } else {
      // Reset to inline mode for table/relational views
      set(groupViewModeAtom, 'inline');
    }

    // Display options - check both direct property and columns object (API format varies)
    if (typeof view.autoFitColumns === 'boolean') {
      set(currentAutoFitColumnsAtom, view.autoFitColumns);
    } else if (viewAny.columns && typeof viewAny.columns.autoFitColumns === 'boolean') {
      set(currentAutoFitColumnsAtom, viewAny.columns.autoFitColumns);
    }

    // Smart fit - default to true if not specified
    const viewSmartFit = view as SavedView & { smartFit?: boolean; columns?: { smartFit?: boolean } };
    if (typeof viewSmartFit.smartFit === 'boolean') {
      set(currentSmartFitAtom, viewSmartFit.smartFit);
    } else if (viewSmartFit.columns && typeof viewSmartFit.columns.smartFit === 'boolean') {
      set(currentSmartFitAtom, viewSmartFit.columns.smartFit);
    } else {
      // Default to true for TEEEM Smart
      set(currentSmartFitAtom, true);
    }

    if (typeof view.showTotals === 'boolean') {
      set(currentShowTotalsAtom, view.showTotals);
    } else if (viewAny.columns && typeof viewAny.columns.showTotals === 'boolean') {
      set(currentShowTotalsAtom, viewAny.columns.showTotals);
    }

    // Totals columns - which columns show totals (empty = all numeric)
    const viewWithTotalsColumns = view as SavedView & { totalsColumns?: string[]; columns?: { totalsColumns?: string[] } };
    if (Array.isArray(viewWithTotalsColumns.totalsColumns)) {
      set(currentTotalsColumnsAtom, viewWithTotalsColumns.totalsColumns);
    } else if (viewWithTotalsColumns.columns && Array.isArray(viewWithTotalsColumns.columns.totalsColumns)) {
      set(currentTotalsColumnsAtom, viewWithTotalsColumns.columns.totalsColumns);
    } else {
      // Default to empty (all numeric columns)
      set(currentTotalsColumnsAtom, []);
    }

    // Sticky actions - default to true if not specified
    // GOLD STANDARD: Part of position-based sticky columns
    const viewStickyActions = view as SavedView & { stickyActions?: boolean; columns?: { stickyActions?: boolean } };
    if (typeof viewStickyActions.stickyActions === 'boolean') {
      set(currentStickyActionsAtom, viewStickyActions.stickyActions);
    } else if (viewStickyActions.columns && typeof viewStickyActions.columns.stickyActions === 'boolean') {
      set(currentStickyActionsAtom, viewStickyActions.columns.stickyActions);
    } else {
      // Default to true - actions column is sticky by default
      set(currentStickyActionsAtom, true);
    }

    // Collapsed groups - restore from saved view or reset
    // Handle both Array and Set formats (API returns array, we store as Set)
    const viewWithCollapsed = view as SavedView & { collapsedGroups?: string[] | Set<string> };
    if (viewWithCollapsed.collapsedGroups) {
      const groups = viewWithCollapsed.collapsedGroups;
      set(collapsedGroupsAtom, groups instanceof Set ? groups : new Set(groups));
    } else {
      // No saved collapsed state - expand all groups by default so user sees data
      // Empty set means no groups are collapsed (all expanded)
      set(collapsedGroupsAtom, new Set());
    }
  }
);

/**
 * Save current state as a view (new or update existing)
 * This replaces the ViewManagerSheet.handleSaveView pattern
 */
export const saveViewAtom = atom(
  null,
  async (get, set, options: {
    viewId?: number | string;
    name: string;
    foundationId: number;
    isGlobal: boolean;
    isNew: boolean;
  }) => {
    set(viewSavingAtom, true);

    try {
      // Convert collapsedGroups Set to Array for JSON serialization
      const collapsedGroupsSet = get(collapsedGroupsAtom);
      const collapsedGroupsArray = Array.from(collapsedGroupsSet).filter(
        g => g !== '__collapse_all_pending__' // Don't save the pending marker
      );

      // Import filter atoms for reading current state
      const { apiFiltersAtom, filterGroupsAtom, interGroupLogicAtom } = require('./filter-atoms');

      const viewData = {
        foundation_id: options.foundationId,
        name: options.name,
        view_type: "custom" as const,
        is_global: options.isGlobal,
        filters: {
          cascadeFilters: get(apiFiltersAtom),
          filterGroups: get(filterGroupsAtom),
          interGroupLogic: get(interGroupLogicAtom),
        },
        columns: {
          visible: get(currentVisibleColumnsAtom),
          order: get(currentColumnOrderAtom),
          widths: get(currentColumnWidthsAtom),
          autoFitColumns: get(currentAutoFitColumnsAtom),
          smartFit: get(currentSmartFitAtom),
          showTotals: get(currentShowTotalsAtom),
          stickyActions: get(currentStickyActionsAtom),
        },
        sort_order: get(currentSortColumnsAtom),
        group_by_columns: get(currentGroupByColumnsAtom),
        group_by_column: get(currentGroupByColumnsAtom)[0] || null,
        collapsed_groups: collapsedGroupsArray,
      };

      // Import api dynamically to avoid circular dependencies
      const { api } = await import('@/lib/api');

      let response: { success: boolean; error?: string; view?: { id: number } } | null;
      const wrappedData = { foundation_view: viewData };

      if (options.isNew) {
        const endpoint = options.isGlobal ? "/api/v1/foundation_views/save_global" : "/api/v1/foundation_views";
        response = await api.post<{ success: boolean; error?: string; view?: { id: number } }>(endpoint, wrappedData);
      } else {
        const endpoint = `/api/v1/foundation_views/${options.viewId}`;
        response = await api.patch<{ success: boolean; error?: string; view?: { id: number } }>(endpoint, wrappedData);
      }

      if (response?.success) {
        // Invalidate cache after successful save
        set(invalidateViewsCacheAtom, options.foundationId);

        // Update active view ID if this was a new view
        if (options.isNew && response.view?.id) {
          set(activeViewIdAtom, response.view.id);
        }

        return { success: true, viewId: response.view?.id };
      } else {
        throw new Error(response?.error || "Failed to save view");
      }
    } catch (error) {
      console.error('[saveViewAtom] Failed to save view:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save view"
      };
    } finally {
      set(viewSavingAtom, false);
    }
  }
);

/**
 * Invalidate views cache for a specific foundation
 * Forces a fresh load from API on next request
 */
export const invalidateViewsCacheAtom = atom(
  null,
  (get, set, foundationId: number | string) => {
    set(viewsCacheAtom, (prev) => {
      const next = { ...prev };
      delete next[foundationId];
      return next;
    });
  }
);

/**
 * Load views for a foundation (from cache or API)
 * Optional includeViewsFrom parameter inherits global views from related foundations
 * Example: SM Tasks (218) can inherit global views from Schedule Master (426)
 */
export const loadFoundationViewsAtom = atom(
  null,
  async (get, set, foundationId: number | string, includeViewsFrom?: number | string | (number | string)[]) => {
    set(viewsLoadingAtom, true);

    // Build cache key that includes related foundations
    const includeFromArray = includeViewsFrom
      ? (Array.isArray(includeViewsFrom) ? includeViewsFrom : [includeViewsFrom])
      : [];
    const cacheKey = includeFromArray.length > 0
      ? `${foundationId}_inherit_${includeFromArray.join(',')}`
      : foundationId;

    try {
      // Check cache first (using extended key for inherited views)
      const cache = get(viewsCacheAtom);
      const cached = cache[cacheKey];

      if (cached && (Date.now() - cached.timestamp < VIEWS_CACHE_TTL)) {
        set(foundationViewsAtom, cached.views);
        return { success: true, views: cached.views, source: 'cache' };
      }

      // Build API URL with optional include_views_from param
      let apiUrl = `/api/v1/foundation_views?foundation_id=${foundationId}`;
      if (includeFromArray.length > 0) {
        apiUrl += `&include_views_from=${includeFromArray.join(',')}`;
      }

      // Fetch from API
      const { api } = await import('@/lib/api');
      const response = await api.get<{ success: boolean; views: SavedView[] }>(apiUrl);

      if (response.success && response.views) {
        // Map API response to frontend format
        const mappedViews = (response.views as unknown[]).map((v: unknown) => {
          const view = v as {
            filters?: { cascadeFilters?: CascadeFilter[]; filterGroups?: FilterGroup[]; interGroupLogic?: "AND" | "OR" } | CascadeFilter[];
            columns?: { visible?: Record<string, boolean>; order?: string[]; widths?: Record<string, number>; autoFitColumns?: boolean; showTotals?: boolean };
            sort_order?: SortColumn[];
            group_by_columns?: string[];
            [key: string]: unknown;
          };

          // Extract filters and ensure they have IDs
          const rawFilters = Array.isArray(view.filters)
            ? view.filters
            : (view.filters?.cascadeFilters || []);

          return {
            ...view,
            view_type: (view as any).view_display_type || "table", // Map backend field to frontend field
            filters: ensureFilterIds(rawFilters),
            filterGroups: Array.isArray(view.filters) ? [{ id: "default", logic: "AND" as const }] : (view.filters?.filterGroups || [{ id: "default", logic: "AND" as const }]),
            interGroupLogic: Array.isArray(view.filters) ? "OR" as const : (view.filters?.interGroupLogic || "OR" as const),
            visibleColumns: view.columns?.visible || {},
            columnOrder: view.columns?.order || [],
            columnWidths: view.columns?.widths || {},
            autoFitColumns: view.columns?.autoFitColumns === true,
            showTotals: view.columns?.showTotals !== false,
            sortColumns: Array.isArray(view.sort_order) ? view.sort_order : [],
            groupByColumns: view.group_by_columns || [],
          } as SavedView;
        });

        // Update cache (using extended key for inherited views)
        set(viewsCacheAtom, (prev) => ({
          ...prev,
          [cacheKey]: {
            views: mappedViews,
            timestamp: Date.now(),
          },
        }));

        set(foundationViewsAtom, mappedViews);
        return { success: true, views: mappedViews, source: 'api' };
      } else {
        throw new Error('Failed to load views');
      }
    } catch (error) {
      console.error('[loadFoundationViewsAtom] Failed to load views:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to load views' };
    } finally {
      set(viewsLoadingAtom, false);
    }
  }
);

// ============================================================================
// LOOKUP CACHE ATOMS (with TTL support)
// ============================================================================

export interface LookupOption {
  id: number;
  display: string;
}

interface LookupCacheEntry {
  options: LookupOption[];
  timestamp: number;
}

/**
 * TTL for lookup cache entries
 * SSoT: Uses CACHE_TTL_LOOKUPS from cache-constants.ts
 */
export const LOOKUP_CACHE_TTL = CACHE_TTL_LOOKUPS;

/**
 * Lookup cache with TTL
 * Key format: `${foundationId}` or `${foundationId}:${columnId}`
 */
export const lookupCacheAtom = atom<Record<string, LookupCacheEntry>>({});

/**
 * Track pending lookup fetches to prevent duplicate concurrent requests
 */
export const pendingLookupFetchesAtom = atom<Record<string, Promise<LookupOption[]>>>({});

/**
 * Get cached lookup options (returns null if expired or not cached)
 */
export const getCachedLookupAtom = atom(
  (get) => (key: string): LookupOption[] | null => {
    const cache = get(lookupCacheAtom);
    const entry = cache[key];

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > LOOKUP_CACHE_TTL) {
      return null;
    }

    return entry.options;
  }
);

/**
 * Set lookup cache entry
 */
export const setLookupCacheAtom = atom(
  null,
  (get, set, params: { key: string; options: LookupOption[] }) => {
    set(lookupCacheAtom, (prev) => ({
      ...prev,
      [params.key]: {
        options: params.options,
        timestamp: Date.now(),
      },
    }));
  }
);

/**
 * Invalidate lookup cache for a specific foundation or all lookups
 */
export const invalidateLookupCacheAtom = atom(
  null,
  (get, set, foundationId?: number) => {
    if (foundationId === undefined) {
      // Clear all cache
      set(lookupCacheAtom, {});
    } else {
      // Clear only entries for this foundation
      set(lookupCacheAtom, (prev) => {
        const next = { ...prev };
        const prefix = `${foundationId}`;
        for (const key of Object.keys(next)) {
          if (key === prefix || key.startsWith(`${prefix}:`)) {
            delete next[key];
          }
        }
        return next;
      });
    }
  }
);

/**
 * Clean up expired cache entries (call periodically)
 */
export const cleanupLookupCacheAtom = atom(
  null,
  (get, set) => {
    const cache = get(lookupCacheAtom);
    const now = Date.now();

    const validEntries: Record<string, LookupCacheEntry> = {};
    let hasExpired = false;

    for (const [key, entry] of Object.entries(cache)) {
      if (now - entry.timestamp <= LOOKUP_CACHE_TTL) {
        validEntries[key] = entry;
      } else {
        hasExpired = true;
      }
    }

    // Only update if we removed something
    if (hasExpired) {
      set(lookupCacheAtom, validEntries);
    }
  }
);
