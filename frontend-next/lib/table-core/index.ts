/**
 * Table Core - Headless Data Processing Engine
 *
 * A pure TypeScript library for table data transformations.
 * No React dependencies - can be used in:
 * - React components (via useMemo)
 * - Node.js scripts
 * - Unit tests
 * - Web workers
 * - Server-side rendering
 *
 * ## Architecture
 *
 * This is Layer 1 of the TeeemTableView architecture:
 * 1. Headless Core (this) - Pure data processing
 * 2. Feature Hooks - React state + core functions
 * 3. Compound Components - Composable UI primitives
 * 4. TeeemTableView - Backward-compatible orchestrator
 *
 * ## Usage
 *
 * ```typescript
 * import { filterRows, sortRows, searchRows, groupRows } from '@/lib/table-core';
 *
 * // Build a processing pipeline
 * let rows = data;
 * rows = filterRows(rows, filters, filterGroups, 'AND');
 * rows = searchRows(rows, searchOptions);
 * rows = sortRows(rows, sortColumns, columns);
 * const groups = groupRows(rows, groupByColumns, sortColumns);
 * ```
 */

// Types
export type {
  TableColumn,
  TableRow,
  CascadeFilter,
  FilterGroup,
  SortColumn,
  SavedView,
  SearchMode,
  SearchOptions,
  NestedGroup,
  GroupedEntries,
  ServerGroupCount,
  FilterOperator,
  SerializedTableState,
  PipelineStageResult,
} from "./types";

// Pipeline functions
export {
  // Filter
  filterRows,
  applyFilters,
  evaluateFilter,
  getFilterDisplayValue,
  // Sort
  sortRows,
  applySorting,
  // Search
  searchRows,
  applySearch,
  // Group
  groupRows,
  buildGroupedEntries,
  getAllGroupKeys,
  getVisibleRowIdsFromGroups,
  getGroupDisplayValue,
} from "./pipeline";
