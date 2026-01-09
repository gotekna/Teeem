/**
 * View Defaults Utility
 * Factory functions for creating default view configurations
 */

import type { ViewState, GroupViewMode, ViewDisplayType } from "../types";
import type { CascadeFilter, SortColumn } from "@/components/table/types";

/**
 * Create a default ViewState with optional overrides
 */
export function createViewState(overrides?: Partial<ViewState>): ViewState {
  return {
    activeViewId: null,
    activeViewSlug: null,
    groupByColumns: [],
    groupViewMode: "inline",
    cascadeFilters: [],
    filterGroups: [],
    interGroupLogic: "AND",
    sortColumns: [],
    visibleColumns: {},
    columnWidths: {},
    columnOrder: [],
    autoFitColumns: false,
    smartFit: false,
    showTotals: true,
    stickyActions: false,
    collapsedGroups: new Set(),
    showFilters: false,
    ...overrides,
  };
}

/**
 * Determine group view mode from display type
 */
export function getGroupViewMode(displayType?: ViewDisplayType | null): GroupViewMode {
  if (displayType === "grouped") {
    return "panel";
  }
  return "inline";
}

/**
 * Create default column visibility from column list
 * All columns visible by default except those marked defaultHidden
 */
export function createDefaultVisibility(
  columns: Array<{ key: string; defaultHidden?: boolean }>
): Record<string, boolean> {
  return columns.reduce(
    (acc, col) => {
      acc[col.key] = !col.defaultHidden;
      return acc;
    },
    {} as Record<string, boolean>
  );
}

/**
 * Create default column order from column list
 */
export function createDefaultColumnOrder(
  columns: Array<{ key: string }>
): string[] {
  return columns.map((col) => col.key);
}

/**
 * Default quick filters for common foundation types
 */
export const DEFAULT_QUICK_FILTERS: Record<string, CascadeFilter[]> = {
  jobs: [
    {
      id: "live-status",
      column: "job_status_id",
      operator: "!=",
      value: null, // Will need to be set based on "completed" status ID
      label: "LIVE",
    },
  ],
  contacts: [],
  purchase_orders: [],
};

/**
 * Default sort orders for common foundation types
 */
export const DEFAULT_SORT_ORDERS: Record<string, SortColumn[]> = {
  jobs: [{ column: "created_at", dir: "desc" }],
  contacts: [{ column: "name", dir: "asc" }],
  purchase_orders: [{ column: "created_at", dir: "desc" }],
};
