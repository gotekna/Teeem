/**
 * View Mapper Utility
 * Converts between API/SSR formats and internal ViewState format
 */

import type { ViewState, SSRViewConfig } from "../types";
import type { SavedView, CascadeFilter, SortColumn } from "@/components/table/types";

/**
 * Map SSR view config to internal ViewState format
 */
export function mapSSRViewToState(view: SSRViewConfig): Partial<ViewState> {
  const groupByColumns =
    view.group_by_columns || (view.group_by_column ? [view.group_by_column] : []);

  // Determine group view mode from display type
  const groupViewMode = view.view_display_type === "grouped" ? "panel" : "inline";

  // Map filters
  const cascadeFilters: CascadeFilter[] = (view.filters?.cascadeFilters || []).map(
    (f, i) => ({
      id: f.id || `filter-${i}`,
      column: f.column,
      operator: f.operator as CascadeFilter["operator"],
      value: f.value as CascadeFilter["value"],
    })
  );

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
export function mapSavedViewToState(view: SavedView): Partial<ViewState> {
  const groupByColumns =
    view.groupByColumns || (view.groupByColumn ? [view.groupByColumn] : []);

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

/**
 * Map internal ViewState to SavedView format for API
 */
export function mapStateToSavedView(
  state: ViewState,
  metadata: { id: number | string; name: string; slug?: string }
): SavedView {
  return {
    id: metadata.id,
    name: metadata.name,
    slug: metadata.slug,
    view_display_type:
      state.groupViewMode === "panel" && state.groupByColumns.length > 0
        ? "grouped"
        : "table",
    filters: state.cascadeFilters,
    filterGroups: state.filterGroups,
    interGroupLogic: state.interGroupLogic,
    groupByColumns: state.groupByColumns,
    groupByColumn: state.groupByColumns[0] || null,
    sortColumns: state.sortColumns,
    visibleColumns: state.visibleColumns,
    columnWidths: state.columnWidths,
    columnOrder: state.columnOrder,
    autoFitColumns: state.autoFitColumns,
    smartFit: state.smartFit,
    showTotals: state.showTotals,
    stickyActions: state.stickyActions,
    showFilters: state.showFilters,
  };
}

/**
 * Extract view slug from a view object (handles both SavedView and SSRViewConfig)
 */
export function getViewSlug(view: SavedView | SSRViewConfig): string | null {
  return view.slug || null;
}

/**
 * Check if two views are the same (by ID)
 */
export function isSameView(
  a: SavedView | SSRViewConfig | null,
  b: SavedView | SSRViewConfig | null
): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id;
}
