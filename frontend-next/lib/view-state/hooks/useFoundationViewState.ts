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

import { useCallback, useEffect, useRef } from "react";
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
  /** Set collapsed groups */
  setCollapsedGroups: (groups: Set<string>) => void;
  /** Toggle a specific group's collapsed state */
  toggleGroup: (groupKey: string) => void;
  /** Clear all collapsed groups */
  clearCollapsedGroups: () => void;
  /** Check if a group is collapsed */
  isGroupCollapsed: (groupKey: string) => boolean;
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

  // Foundation-scoped state
  const [viewState, setViewState] = useAtom(viewStateFamily(foundationId));
  const [collapsedGroups, setCollapsedGroupsAtom] = useAtom(collapsedGroupsFamily(foundationId));
  const clearCollapsedGroupsAtom = useSetAtom(clearCollapsedGroupsFamily(foundationId));

  // Path sync
  const { viewSlug: pathSlug, setViewSlug } = useViewFromPath({ foundationSlug });

  // Effective view slug (props override path)
  const activeSlug = propsViewSlug || pathSlug;

  // Track if initial view has been applied
  const initializedRef = useRef(false);
  const lastFoundationRef = useRef<string | null>(null);

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

  // Collapsed groups management
  const setCollapsedGroups = useCallback(
    (groups: Set<string>) => {
      setCollapsedGroupsAtom(groups);
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
    ...viewState,
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
  };
}

export default useFoundationViewState;
