/**
 * View State Types
 * Foundation-scoped view state management types
 */

import type { CascadeFilter, FilterGroup, SortColumn } from "@/components/table/types";

// Re-export for convenience
export type { CascadeFilter, FilterGroup, SortColumn };

/**
 * Group view mode - how grouped data is displayed
 * - inline: Groups shown as collapsible sections in table
 * - panel: Groups shown as cards/panels (Company/Role style)
 */
export type GroupViewMode = "inline" | "panel";

/**
 * View display type from database
 * - table: Standard table grid
 * - grouped: Grouped by column with panel display
 * - relational: Relationship-based grouping
 * - hierarchy: Header hierarchy display
 */
export type ViewDisplayType = "table" | "grouped" | "relational" | "hierarchy";

/**
 * Complete view state for a foundation
 * This is what gets stored in the foundation-scoped atom
 */
export interface ViewState {
  // Active view identification
  activeViewId: number | string | null;
  activeViewSlug: string | null;

  // Grouping
  groupByColumns: string[];
  groupViewMode: GroupViewMode;

  // Filtering
  cascadeFilters: CascadeFilter[];
  filterGroups: FilterGroup[];
  interGroupLogic: "AND" | "OR";

  // Sorting
  sortColumns: SortColumn[];

  // Column configuration
  visibleColumns: Record<string, boolean>;
  columnWidths: Record<string, number>;
  columnOrder: string[];

  // Display options
  autoFitColumns: boolean;
  smartFit: boolean;
  showTotals: boolean;
  stickyActions: boolean;

  // UI state
  collapsedGroups: Set<string>;
  showFilters: boolean;
}

/**
 * Default view state factory
 */
export const createDefaultViewState = (): ViewState => ({
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
});

/**
 * Partial view state for updates
 * Allows updating only specific fields
 */
export type ViewStateUpdate = Partial<Omit<ViewState, "collapsedGroups">> & {
  collapsedGroups?: Set<string>;
};

/**
 * View configuration from SSR/API
 * This is the format we receive from the server
 */
export interface SSRViewConfig {
  id: number;
  name: string;
  slug?: string;
  view_display_type?: ViewDisplayType;
  group_by_columns?: string[];
  group_by_column?: string;
  filters?: {
    cascadeFilters?: Array<{
      id?: string;
      column: string;
      operator: string;
      value: unknown;
    }>;
    filterGroups?: Array<{ id: string; logic: "AND" | "OR" }>;
    interGroupLogic?: "AND" | "OR";
  };
  columns?: {
    visible?: Record<string, boolean>;
    order?: string[];
    widths?: Record<string, number>;
    autoFitColumns?: boolean;
    smartFit?: boolean;
    showTotals?: boolean;
    stickyActions?: boolean;
  };
  sort_order?: Array<{ column: string; dir: "asc" | "desc" }>;
}

/**
 * Options for useFoundationViewState hook
 */
export interface UseFoundationViewStateOptions {
  /** SSR-provided initial view configuration */
  initialView?: SSRViewConfig | null;
  /** All available views for this foundation (Partial to support preloadedViews) */
  views?: Array<{ id?: number | string; slug?: string; name?: string; [key: string]: unknown }>;
  /** View slug from URL path (e.g., "live" from /jobs/live) */
  viewSlug?: string | null;
  /** Foundation slug for path construction */
  foundationSlug?: string;
}
