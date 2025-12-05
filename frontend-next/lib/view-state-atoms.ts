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
 */

import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { SavedView, CascadeFilter, FilterGroup, SortColumn } from '@/components/table/types';

// ============================================================================
// CORE VIEW STATE ATOMS
// ============================================================================

/**
 * Currently active view ID
 */
export const activeViewIdAtom = atom<number | string | null>(null);

/**
 * Current cascade filters (conditions for filtering table rows)
 */
export const currentFiltersAtom = atom<CascadeFilter[]>([]);

/**
 * Filter groups for organizing filters with AND/OR logic
 */
export const currentFilterGroupsAtom = atom<FilterGroup[]>([{ id: "default", logic: "AND" }]);

/**
 * Logic operator between filter groups (AND or OR)
 */
export const currentInterGroupLogicAtom = atom<"AND" | "OR">("OR");

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
export const currentAutoFitColumnsAtom = atom<boolean>(true);

/**
 * Show totals row at bottom of table
 */
export const currentShowTotalsAtom = atom<boolean>(true);

// ============================================================================
// VIEW COLLECTION STATE
// ============================================================================

/**
 * Per-foundation view cache with TTL
 * Persisted to localStorage for faster page loads
 */
export const viewsCacheAtom = atomWithStorage<Record<number, {
  views: SavedView[];
  timestamp: number;
}>>('teeem_views_cache', {});

export const VIEWS_CACHE_TTL = 60000; // 1 minute

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
  const currentFilters = get(currentFiltersAtom);
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
 */
export const applyViewAtom = atom(
  null,
  (get, set, view: SavedView) => {
    // Atomically update ALL state in one transaction
    set(activeViewIdAtom, view.id);

    // Handle filters - may be array (legacy) or object with cascadeFilters (current)
    if (view.filters) {
      if (Array.isArray(view.filters)) {
        set(currentFiltersAtom, view.filters);
      } else if (typeof view.filters === 'object' && view.filters !== null) {
        const filtersObj = view.filters as {
          cascadeFilters?: CascadeFilter[];
          filterGroups?: FilterGroup[];
          interGroupLogic?: "AND" | "OR"
        };
        if (Array.isArray(filtersObj.cascadeFilters)) {
          set(currentFiltersAtom, filtersObj.cascadeFilters);
        }
        if (Array.isArray(filtersObj.filterGroups)) {
          set(currentFilterGroupsAtom, filtersObj.filterGroups);
        }
        if (filtersObj.interGroupLogic) {
          set(currentInterGroupLogicAtom, filtersObj.interGroupLogic);
        }
      }
    }

    // Legacy support for separate filterGroups field
    if (view.filterGroups) {
      set(currentFilterGroupsAtom, view.filterGroups);
    }
    if (view.interGroupLogic) {
      set(currentInterGroupLogicAtom, view.interGroupLogic);
    }

    // Column configuration
    if (view.visibleColumns) {
      set(currentVisibleColumnsAtom, view.visibleColumns);
    }
    if (view.columnOrder) {
      set(currentColumnOrderAtom, view.columnOrder);
    }
    if (view.columnWidths) {
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

    // Display options - check both direct property and columns object (API format varies)
    const viewAny = view as SavedView & { columns?: { autoFitColumns?: boolean; showTotals?: boolean } };

    if (typeof view.autoFitColumns === 'boolean') {
      set(currentAutoFitColumnsAtom, view.autoFitColumns);
    } else if (viewAny.columns && typeof viewAny.columns.autoFitColumns === 'boolean') {
      set(currentAutoFitColumnsAtom, viewAny.columns.autoFitColumns);
    }

    if (typeof view.showTotals === 'boolean') {
      set(currentShowTotalsAtom, view.showTotals);
    } else if (viewAny.columns && typeof viewAny.columns.showTotals === 'boolean') {
      set(currentShowTotalsAtom, viewAny.columns.showTotals);
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
      const viewData = {
        foundation_id: options.foundationId,
        name: options.name,
        view_type: "custom" as const,
        is_global: options.isGlobal,
        filters: {
          cascadeFilters: get(currentFiltersAtom),
          filterGroups: get(currentFilterGroupsAtom),
          interGroupLogic: get(currentInterGroupLogicAtom),
        },
        columns: {
          visible: get(currentVisibleColumnsAtom),
          order: get(currentColumnOrderAtom),
          widths: get(currentColumnWidthsAtom),
          autoFitColumns: get(currentAutoFitColumnsAtom),
          showTotals: get(currentShowTotalsAtom),
        },
        sort_order: get(currentSortColumnsAtom),
        group_by_columns: get(currentGroupByColumnsAtom),
        group_by_column: get(currentGroupByColumnsAtom)[0] || null,
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
  (get, set, foundationId: number) => {
    set(viewsCacheAtom, (prev) => {
      const next = { ...prev };
      delete next[foundationId];
      return next;
    });
  }
);

/**
 * Load views for a foundation (from cache or API)
 */
export const loadFoundationViewsAtom = atom(
  null,
  async (get, set, foundationId: number) => {
    set(viewsLoadingAtom, true);

    try {
      // Check cache first
      const cache = get(viewsCacheAtom);
      const cached = cache[foundationId];

      if (cached && (Date.now() - cached.timestamp < VIEWS_CACHE_TTL)) {
        set(foundationViewsAtom, cached.views);
        return { success: true, views: cached.views, source: 'cache' };
      }

      // Fetch from API
      const { api } = await import('@/lib/api');
      const response = await api.get<{ success: boolean; views: SavedView[] }>(
        `/api/v1/foundation_views?foundation_id=${foundationId}`
      );

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

          return {
            ...view,
            filters: Array.isArray(view.filters) ? view.filters : (view.filters?.cascadeFilters || []),
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

        // Update cache
        set(viewsCacheAtom, (prev) => ({
          ...prev,
          [foundationId]: {
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
