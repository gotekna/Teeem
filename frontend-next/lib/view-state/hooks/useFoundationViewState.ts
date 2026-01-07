/**
 * useFoundationViewState Hook
 * Main hook for foundation-scoped view state management
 *
 * This is the single entry point for view state in TeeemTableView.
 * It provides:
 * - Foundation-scoped state (no pollution between pages)
 * - URL path synchronization
 * - SSR hydration support
 * - Atomic view application
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, type SetStateAction, type Dispatch } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  viewStateFamily,
  collapsedGroupsFamily,
  clearCollapsedGroupsFamily,
} from "../atoms";
import {
  type ViewState,
  type SSRViewConfig,
  type UseFoundationViewStateOptions,
  type CascadeFilter,
  type FilterGroup,
  type GroupViewMode,
  createDefaultViewState,
} from "../types";
import { useViewFromPath } from "./useViewFromPath";
import type { SavedView, SortColumn } from "@/components/table/types";

/**
 * Map SSR view config to internal ViewState format
 */
function mapSSRViewToState(view: SSRViewConfig): Partial<ViewState> {
  const groupByColumns = view.group_by_columns ||
    (view.group_by_column ? [view.group_by_column] : []);

  // Determine group view mode from display type
  const groupViewMode = view.view_display_type === "grouped" ? "panel" : "inline";

  // Map filters
  const cascadeFilters: CascadeFilter[] = (view.filters?.cascadeFilters || []).map((f, i) => ({
    id: f.id || `filter-${i}`,
    column: f.column,
    operator: f.operator as CascadeFilter["operator"],
    value: f.value as CascadeFilter["value"],
  }));

  return {
    activeViewId: view.id,
    activeViewSlug: view.slug || null,
    groupByColumns,
    groupViewMode,
    cascadeFilters,
    filterGroups: view.filters?.filterGroups || [],
    interGroupLogic: view.filters?.interGroupLogic || "AND",
    sortColumns: (view.sort_order || []) as SortColumn[],
    visibleColumns: view.columns?.visible || {},
    columnWidths: view.columns?.widths || {},
    columnOrder: view.columns?.order || [],
    autoFitColumns: view.columns?.autoFitColumns || false,
    smartFit: view.columns?.smartFit || false,
    showTotals: view.columns?.showTotals ?? true,
    stickyActions: view.columns?.stickyActions || false,
  };
}

/**
 * Map SavedView to internal ViewState format
 */
function mapSavedViewToState(view: SavedView): Partial<ViewState> {
  const groupByColumns = view.groupByColumns ||
    (view.groupByColumn ? [view.groupByColumn] : []);

  // Determine group view mode from display type
  const groupViewMode = view.view_display_type === "grouped" ? "panel" : "inline";

  return {
    activeViewId: view.id,
    activeViewSlug: view.slug || null,
    groupByColumns,
    groupViewMode,
    cascadeFilters: view.filters || [],
    filterGroups: view.filterGroups || [],
    interGroupLogic: view.interGroupLogic || "AND",
    sortColumns: view.sortColumns || [],
    visibleColumns: view.visibleColumns || {},
    columnWidths: view.columnWidths || {},
    columnOrder: view.columnOrder || [],
    autoFitColumns: view.autoFitColumns || false,
    smartFit: view.smartFit || false,
    showTotals: view.showTotals ?? true,
    stickyActions: view.stickyActions || false,
  };
}

export interface UseFoundationViewStateReturn extends ViewState {
  /** Apply a saved view atomically */
  applyView: (view: SavedView | SSRViewConfig) => void;
  /** Navigate to a different view by slug */
  setViewSlug: (slug: string | null) => void;
  /** Clear all cascade filters */
  clearFilters: () => void;
  /** Update specific view state fields */
  updateState: (update: Partial<ViewState>) => void;
  /** Reset to default state */
  resetState: () => void;
  /** Set collapsed groups (supports direct value or callback) */
  setCollapsedGroups: Dispatch<SetStateAction<Set<string>>>;
  /** Toggle a specific group's collapsed state */
  toggleGroup: (groupKey: string) => void;
  /** Clear all collapsed groups */
  clearCollapsedGroups: () => void;
  /** Check if a group is collapsed */
  isGroupCollapsed: (groupKey: string) => boolean;
  // Convenience setters for individual fields (compatible with existing atom patterns)
  /** Set groupBy columns */
  setGroupByColumns: (columns: string[]) => void;
  /** Set group view mode (inline/panel) */
  setGroupViewMode: (mode: GroupViewMode) => void;
  /** Set active view ID */
  setActiveViewId: (id: number | string | null) => void;
  /** Set cascade filters */
  setCascadeFilters: (filters: CascadeFilter[]) => void;
  /** Set filter groups */
  setFilterGroups: (groups: FilterGroup[]) => void;
  /** Set visible columns */
  setVisibleColumns: (visible: Record<string, boolean>) => void;
  /** Set column order */
  setColumnOrder: (order: string[]) => void;
  /** Set column widths */
  setColumnWidths: (widths: Record<string, number>) => void;
  /** Set sort columns */
  setSortColumns: (sort: SortColumn[]) => void;
}

/**
 * Main hook for foundation-scoped view state
 *
 * @example
 * ```tsx
 * const {
 *   activeViewId,
 *   groupByColumns,
 *   groupViewMode,
 *   cascadeFilters,
 *   applyView,
 *   setViewSlug,
 * } = useFoundationViewState("jobs", {
 *   initialView,
 *   views: preloadedViews,
 *   viewSlug: "live",
 *   foundationSlug: "jobs",
 * });
 * ```
 */
export function useFoundationViewState(
  foundationId: string,
  options?: UseFoundationViewStateOptions
): UseFoundationViewStateReturn {
  const {
    initialView,
    views = [],
    viewSlug: propsViewSlug,
    foundationSlug = foundationId,
  } = options || {};

  // Foundation-scoped state (atom)
  const [viewState, setViewState] = useAtom(viewStateFamily(foundationId));
  const [collapsedGroups, setCollapsedGroupsAtom] = useAtom(collapsedGroupsFamily(foundationId));
  const clearCollapsedGroupsAtom = useSetAtom(clearCollapsedGroupsFamily(foundationId));

  // Path sync
  const { viewSlug: pathSlug, setViewSlug } = useViewFromPath({ foundationSlug });

  // Effective view slug (props override path)
  const activeSlug = propsViewSlug || pathSlug;

  // Track if initial view has been applied to atom
  const initializedRef = useRef(false);
  const lastFoundationRef = useRef<string | null>(null);

  // ==========================================================================
  // CRITICAL: SSR FIRST-RENDER FIX
  // ==========================================================================
  // The atom starts with default values. Effects run AFTER first render.
  // To avoid flash (wrong groupViewMode on first paint), we compute SSR values
  // in useMemo and merge them with atom state for the return value.
  //
  // This means:
  // - First render: Returns SSR values (before effect runs)
  // - After effect: Returns atom values (synced with SSR)
  // - No flash, no timing issues
  // ==========================================================================

  // Compute SSR-derived state ONCE (stable across renders until initialView changes)
  const ssrDerivedState = useMemo(() => {
    if (initialView) {
      return mapSSRViewToState(initialView);
    }
    return null;
    // Only recompute if initialView identity changes
  }, [initialView]);

  // Determine if we should use SSR values (before atom is synced)
  const useSSRValues = !initializedRef.current && ssrDerivedState !== null;

  // Merge SSR values into effective state for FIRST RENDER
  // After initialization, atom values take over
  const effectiveViewState = useMemo(() => {
    if (useSSRValues && ssrDerivedState) {
      // First render with SSR data: merge SSR values over defaults
      return {
        ...viewState,
        ...ssrDerivedState,
      };
    }
    // After initialization or no SSR: use atom directly
    return viewState;
  }, [useSSRValues, ssrDerivedState, viewState]);

  // Apply a view atomically (all state changes in one update)
  const applyView = useCallback(
    (view: SavedView | SSRViewConfig) => {
      // Detect if it's SSRViewConfig or SavedView
      const isSSR = "view_display_type" in view || "group_by_columns" in view;
      const stateUpdate = isSSR
        ? mapSSRViewToState(view as SSRViewConfig)
        : mapSavedViewToState(view as SavedView);

      setViewState((current) => ({
        ...current,
        ...stateUpdate,
      }));

      // Clear collapsed groups when switching views
      clearCollapsedGroupsAtom();
    },
    [setViewState, clearCollapsedGroupsAtom]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setViewState((current) => ({
      ...current,
      cascadeFilters: [],
      filterGroups: [],
    }));
  }, [setViewState]);

  // Update specific fields
  const updateState = useCallback(
    (update: Partial<ViewState>) => {
      setViewState((current) => ({
        ...current,
        ...update,
      }));
    },
    [setViewState]
  );

  // Reset to defaults
  const resetState = useCallback(() => {
    setViewState(createDefaultViewState());
    clearCollapsedGroupsAtom();
  }, [setViewState, clearCollapsedGroupsAtom]);

  // Collapsed groups management (supports direct value or callback pattern)
  // Type matches Dispatch<SetStateAction<Set<string>>> for compatibility with existing code
  const setCollapsedGroups: Dispatch<SetStateAction<Set<string>>> = useCallback(
    (value: SetStateAction<Set<string>>) => {
      if (typeof value === 'function') {
        // Callback pattern: (prev) => next
        setCollapsedGroupsAtom((current: Set<string>) => value(current));
      } else {
        // Direct value
        setCollapsedGroupsAtom(value);
      }
    },
    [setCollapsedGroupsAtom]
  );

  const toggleGroup = useCallback(
    (groupKey: string) => {
      setCollapsedGroupsAtom((current: Set<string>) => {
        const next = new Set(current);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
    },
    [setCollapsedGroupsAtom]
  );

  const clearCollapsedGroups = useCallback(() => {
    clearCollapsedGroupsAtom();
  }, [clearCollapsedGroupsAtom]);

  const isGroupCollapsed = useCallback(
    (groupKey: string) => collapsedGroups.has(groupKey),
    [collapsedGroups]
  );

  // ==========================================================================
  // CONVENIENCE SETTERS
  // ==========================================================================
  // These wrap updateState for compatibility with existing atom patterns.
  // They allow gradual migration from individual atoms to unified state.

  const setGroupByColumns = useCallback(
    (columns: string[]) => {
      setViewState((current) => ({ ...current, groupByColumns: columns }));
    },
    [setViewState]
  );

  const setGroupViewMode = useCallback(
    (mode: GroupViewMode) => {
      setViewState((current) => ({ ...current, groupViewMode: mode }));
    },
    [setViewState]
  );

  const setActiveViewId = useCallback(
    (id: number | string | null) => {
      setViewState((current) => ({ ...current, activeViewId: id }));
    },
    [setViewState]
  );

  const setCascadeFilters = useCallback(
    (filters: CascadeFilter[]) => {
      setViewState((current) => ({ ...current, cascadeFilters: filters }));
    },
    [setViewState]
  );

  const setFilterGroups = useCallback(
    (groups: FilterGroup[]) => {
      setViewState((current) => ({ ...current, filterGroups: groups }));
    },
    [setViewState]
  );

  const setVisibleColumns = useCallback(
    (visible: Record<string, boolean>) => {
      setViewState((current) => ({ ...current, visibleColumns: visible }));
    },
    [setViewState]
  );

  const setColumnOrder = useCallback(
    (order: string[]) => {
      setViewState((current) => ({ ...current, columnOrder: order }));
    },
    [setViewState]
  );

  const setColumnWidths = useCallback(
    (widths: Record<string, number>) => {
      setViewState((current) => ({ ...current, columnWidths: widths }));
    },
    [setViewState]
  );

  const setSortColumns = useCallback(
    (sort: SortColumn[]) => {
      setViewState((current) => ({ ...current, sortColumns: sort }));
    },
    [setViewState]
  );

  // Initialize from SSR or URL on mount/foundation change
  useEffect(() => {
    const isFoundationChange = lastFoundationRef.current !== null &&
      lastFoundationRef.current !== foundationId;
    const isInitialMount = lastFoundationRef.current === null;

    // Update ref
    lastFoundationRef.current = foundationId;

    // Skip if already initialized for this foundation (unless foundation changed)
    if (initializedRef.current && !isFoundationChange) {
      return;
    }

    // If we have an initial view from SSR, apply it
    if (initialView) {
      applyView(initialView);
      initializedRef.current = true;
      return;
    }

    // If we have a view slug from URL, find and apply that view
    if (activeSlug && views.length > 0) {
      const view = views.find((v) => v.slug === activeSlug);
      if (view && "filters" in view) {
        applyView(view as SavedView);
        initializedRef.current = true;
        return;
      }
    }

    // Reset to defaults if no view specified
    if (isFoundationChange || isInitialMount) {
      resetState();
      initializedRef.current = true;
    }
  }, [foundationId, initialView, activeSlug, views, applyView, resetState]);

  return {
    // Use effectiveViewState which merges SSR values on first render
    ...effectiveViewState,
    collapsedGroups,
    applyView,
    setViewSlug,
    clearFilters,
    updateState,
    resetState,
    setCollapsedGroups,
    toggleGroup,
    clearCollapsedGroups,
    isGroupCollapsed,
    // Convenience setters for compatibility with existing patterns
    setGroupByColumns,
    setGroupViewMode,
    setActiveViewId,
    setCascadeFilters,
    setFilterGroups,
    setVisibleColumns,
    setColumnOrder,
    setColumnWidths,
    setSortColumns,
  };
}

export default useFoundationViewState;
