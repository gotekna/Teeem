/**
 * Table Feature Hooks (Layer 2)
 *
 * Complete feature hooks following the Feature Hook pattern:
 * - state: Observable state
 * - actions: Imperative methods
 * - apply: Pure data transformation (using headless core)
 *
 * Architecture:
 * - Layer 1: lib/table-core (pure data processing)
 * - Layer 2: components/table/hooks (React state + Layer 1)
 * - Layer 3: components/table/compound (composable UI)
 * - Layer 4: TeeemTableView (backward-compatible orchestrator)
 *
 * @example
 * import { useTableCore, useSorting, useFiltering } from '@/components/table/hooks';
 *
 * // Full orchestration
 * const table = useTableCore({ columns });
 * const { processedRows, groupedData } = table.processData(rawRows);
 *
 * // Or individual features
 * const sorting = useSorting();
 * sorting.actions.toggleSort('name');
 */

// Master orchestrator
export { useTableCore, useProcessedRows, isDataTransformed } from './useTableCore';
export type { UseTableCoreProps, ProcessedData, UseTableCoreReturn } from './useTableCore';

// Sorting feature
export {
  useSorting,
  getSortDirection,
  getSortIndex,
  isColumnSorted,
} from './useSorting';
export type { SortingState, SortingActions, UseSortingReturn } from './useSorting';

// Filtering feature
export {
  useFiltering,
  hasColumnFilter,
  getColumnFilters,
  countFiltersByColumn,
} from './useFiltering';
export type { FilteringState, FilteringActions, UseFilteringReturn } from './useFiltering';

// Grouping feature
export {
  useGrouping,
  isGroupCollapsed,
  countGroupedRows,
  getTopLevelGroupCount,
} from './useGrouping';
export type { GroupingState, GroupingActions, UseGroupingReturn } from './useGrouping';

// Search feature
export {
  useSearch,
  getSearchModeLabel,
  getSearchModes,
} from './useSearch';
export type { SearchState, SearchActions, UseSearchReturn } from './useSearch';

// Selection feature
export {
  useSelection,
  isRowSelected,
  getVisibleSelection,
  countVisibleSelection,
} from './useSelection';
export type { SelectionState, SelectionActions, UseSelectionReturn } from './useSelection';

// Bulk Operations feature
export { useBulkOperations } from './useBulkOperations';
export type {
  BulkOperationsState,
  BulkOperationsActions,
  UseBulkOperationsProps,
  UseBulkOperationsReturn,
} from './useBulkOperations';
