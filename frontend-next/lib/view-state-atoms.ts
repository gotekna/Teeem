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
 * Collapsed groups in grouped table view
 * SSoT: Stored in atoms so it persists with saved views
 */
export const collapsedGroupsAtom = atom<Set<string>>(new Set<string>());

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

    // Apply with ensureFilterIds to prevent React key conflicts
    set(currentFiltersAtom, ensureFilterIds(filters));
    set(currentFilterGroupsAtom, filterGroups);
    set(currentInterGroupLogicAtom, interGroupLogic);

    // Column configuration
    if (view.visibleColumns) {
      const visibleCount = Object.values(view.visibleColumns).filter(v => v === true).length;
      console.log('[applyViewAtom] Setting visibleColumns:', visibleCount, 'visible of', Object.keys(view.visibleColumns).length, 'total');
      set(currentVisibleColumnsAtom, view.visibleColumns);
    } else {
      console.log('[applyViewAtom] No visibleColumns in view:', view.name || view.id);
    }
    if (view.columnOrder) {
      console.log('[applyViewAtom] Setting columnOrder:', view.columnOrder);
      set(currentColumnOrderAtom, view.columnOrder);
    } else {
      console.log('[applyViewAtom] No columnOrder in view:', view);
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

    // Collapsed groups - restore from saved view or reset
    // Handle both Array and Set formats (API returns array, we store as Set)
    const viewWithCollapsed = view as SavedView & { collapsedGroups?: string[] | Set<string> };
    if (viewWithCollapsed.collapsedGroups) {
      const groups = viewWithCollapsed.collapsedGroups;
      set(collapsedGroupsAtom, groups instanceof Set ? groups : new Set(groups));
    } else {
      // No saved collapsed state - collapse all groups by default for performance
      // Use special marker that TeeemTableView will detect and expand to all keys
      set(collapsedGroupsAtom, new Set(['__collapse_all_pending__']));
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
 * TTL for lookup cache entries (5 minutes)
 * Lookups change less frequently than views, so longer TTL is appropriate
 */
export const LOOKUP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
