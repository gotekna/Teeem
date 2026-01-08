/**
 * Table Core Types
 *
 * Pure TypeScript types for the headless table data processing engine.
 * No React dependencies - can be used in Node.js, tests, or any JS environment.
 *
 * SSoT: These types are re-exported from components/table/types.ts for backward compatibility.
 */

// Re-export from the canonical location for backward compatibility
export type {
  TableColumn,
  TableRow,
  CascadeFilter,
  FilterGroup,
  SortColumn,
  SavedView,
} from "@/components/table/types";

/**
 * Search modes supported by the table
 */
export type SearchMode = "contains" | "exact" | "starts_with" | "fuzzy" | "regex";

/**
 * Options for search operations
 */
export interface SearchOptions {
  search: string;
  searchMode: SearchMode;
  columns: { key: string; column_type?: string }[];
  searchableColumns: Record<string, boolean>;
  searchAllColumns: boolean;
}

/**
 * Nested group structure for hierarchical grouping
 */
export interface NestedGroup<TRow = Record<string, unknown>> {
  rows: TRow[];
  subgroups?: Record<string, NestedGroup<TRow>>;
}

/**
 * Root structure for grouped entries
 */
export type GroupedEntries<TRow = Record<string, unknown>> = Record<string, NestedGroup<TRow>>;

/**
 * Server-provided group count for lazy loading
 */
export interface ServerGroupCount {
  key: string | null;
  count: number;
}

/**
 * Filter operator types
 */
export type FilterOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "array_contains"
  | "array_not_contains";

/**
 * Table state that can be serialized and restored
 */
export interface SerializedTableState {
  sortColumns: { column: string; dir: "asc" | "desc" | "custom"; customOrder?: string[] }[];
  filters: {
    column: string;
    operator: string;
    value: unknown;
    groupId?: string;
  }[];
  filterGroups: { id: string; logic: "AND" | "OR" }[];
  interGroupLogic: "AND" | "OR";
  groupByColumns: string[];
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  columnOrder: string[];
  search: string;
  searchMode: SearchMode;
}

/**
 * Pipeline stage result - each stage can return metadata
 */
export interface PipelineStageResult<TRow> {
  rows: TRow[];
  metadata?: {
    filteredCount?: number;
    matchedSearchTerms?: string[];
    appliedFilters?: string[];
  };
}
