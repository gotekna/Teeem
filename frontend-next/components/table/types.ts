/**
 * TeeemTableView Types
 * Core type definitions for the table component
 */

import { type LucideIcon } from "lucide-react";

// Column definition for table rendering
export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: "text" | "dropdown" | "number" | "date" | "boolean";
  tooltip?: string;
  showSum?: boolean;
  sumType?: "currency" | "number" | "percentage";
  column_type?: string;
  id?: number;
  foundation_id?: number;
  choices?: string[];
  // Lookup column configuration (matches backend API)
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  editable?: boolean; // Whether the column can be edited (default: true)
  system?: boolean; // System column like id, created_at, updated_at (default: false)
  defaultHidden?: boolean; // Whether the column is hidden by default (default: false)
  searchable?: boolean; // Whether this column is included in search (from foundation schema)
}

// Row data - generic record with id
export interface TableRow {
  id: number | string;
  [key: string]: unknown;
}

// Sort configuration
export interface SortColumn {
  column: string;
  dir: "asc" | "desc" | "custom";
  customOrder?: string[]; // Custom order of values for lookup columns
}

// Filter configuration for cascade filters
export interface CascadeFilter {
  id: string | number;
  column: string;
  value: string | number | boolean | null;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "not_contains" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty" | "between";
  label?: string;
  groupId?: string;
}

// Filter group configuration
export interface FilterGroup {
  id: string;
  logic: "AND" | "OR";
}

// Saved view configuration
export interface SavedView {
  id: number | string;
  name: string;
  view_type?: "table" | "relational"; // Display mode: table grid or relational network graph
  filters?: CascadeFilter[];
  filterGroups?: FilterGroup[];
  interGroupLogic?: "AND" | "OR";
  visibleColumns?: Record<string, boolean>;
  searchableColumns?: Record<string, boolean>; // Which columns to include in search for this view
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  sortColumns?: SortColumn[];
  groupByColumn?: string | null;
  groupByColumns?: string[];
  showFilters?: boolean;
  autoFitColumns?: boolean;
  smartFit?: boolean;
  showTotals?: boolean;
  display_order?: number;
  isDefault?: boolean;
  is_global?: boolean;
  foundation_id?: number;
}

// Props for TeeemTableView component
export interface TeeemTableViewProps {
  // Data
  entries: TableRow[];
  columns?: TableColumn[] | null;

  // Table identity
  foundationId?: string;
  foundationIdNumeric?: number | null;
  tableName?: string;

  // Event handlers
  onAddRow?: () => void; // Called when Add button clicked (auto-shown when foundationIdNumeric set)
  onEdit?: (row: TableRow) => void;
  onDelete?: (row: TableRow) => void;
  onBulkDelete?: (ids: (number | string)[]) => void;
  onBulkEdit?: (ids: (number | string)[]) => void;
  onBulkMerge?: (ids: (number | string)[]) => void;
  enableMerge?: boolean; // Enable built-in merge functionality (default: true when foundationIdNumeric is set)
  mergeDisplayColumn?: string; // Column to display in merge modal (default: 'name')
  mergeSecondaryColumns?: string[]; // Additional columns to show in merge modal
  onView?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
  onRowClick?: (row: TableRow) => void;
  onRowUpdate?: (rowId: number | string, field: string, value: unknown) => void;
  onColumnUpdate?: () => void;
  onEditRelationships?: (row: TableRow) => void;
  onRefresh?: () => void;
  onViewChange?: (view: SavedView | null) => void; // Called when active view changes

  // Import/Export
  enableImport?: boolean;
  enableExport?: boolean;
  onImport?: () => void;
  onExport?: () => void;

  // Schema editor
  enableSchemaEditor?: boolean;
  onCreateColumn?: () => void;
  onEditColumns?: () => void;
  onDeleteColumn?: () => void;
  onEditIndividual?: () => void;
  onViewSchema?: () => void;

  // Custom rendering
  leftActions?: React.ReactNode;
  customActions?: React.ReactNode;
  customBulkActions?: (selectedIds: (number | string)[], clearSelection: () => void) => React.ReactNode; // Custom bulk action buttons
  customCellRenderer?: (entry: TableRow, columnKey: string) => React.ReactNode | null;
  extraRowProps?: Record<string, unknown>;

  // View configuration
  viewOnly?: boolean;
  preloadedViews?: SavedView[] | null;
  hideUpdateViewButton?: boolean;
  initialGroupByColumn?: string | null;
  onLoadViewReady?: (loadView: (view: SavedView) => void) => void; // Callback when loadViewState is ready

  // Server-side operations
  onServerSearch?: (term: string, searchAllColumns: boolean) => void;
  serverSearchLoading?: boolean;
  onViewApiParamsChange?: (params: Record<string, unknown> | null) => void;
  loadingMore?: boolean;

  // Data Health widget
  showDataHealth?: boolean;
  onDataHealthIssueClick?: (item: unknown, check: unknown) => void;

  // Display options
  initialShowTotals?: boolean; // Initial value for showing totals row (default: true)

  // Legacy props
  stats?: Record<string, unknown>;
  category?: string | null;
}

// Column visibility state
export type VisibleColumnsState = Record<string, boolean>;

// Column widths state
export type ColumnWidthsState = Record<string, number>;

// Grouped entries structure for multi-level grouping
export interface GroupEntry {
  rows: TableRow[];
  subgroups?: Record<string, GroupEntry>;
}

export type GroupedEntries = Record<string, GroupEntry>;

// Get sort direction label based on column type
export const getSortDirectionLabel = (columnType: string | undefined, direction: "asc" | "desc"): string => {
  const numericTypes = ["number", "whole_number", "currency", "percentage", "computed"];
  if (columnType && numericTypes.includes(columnType)) {
    return direction === "asc" ? "1-9" : "9-1";
  }

  const dateTypes = ["date", "date_and_time"];
  if (columnType && dateTypes.includes(columnType)) {
    return direction === "asc" ? "Old→New" : "New→Old";
  }

  if (columnType === "boolean") {
    return direction === "asc" ? "☐→☑" : "☑→☐";
  }

  return direction === "asc" ? "A-Z" : "Z-A";
};

// Status colors for badges
export const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  fixed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  by_design: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  monitoring: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

// Severity colors for badges
export const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
