/**
 * TableContext - Central state and actions for TeeemTableView
 *
 * This context enables child components to access table state and actions
 * without prop drilling. It's the foundation for the Integration Architecture.
 *
 * Architecture:
 * - Wraps all feature hooks (sorting, filtering, grouping, selection, search)
 * - Provides processed data from the pipeline
 * - Exposes callbacks from TeeemTableView props
 * - Child components use useTable() to access everything
 *
 * @example
 * // In TeeemTableView:
 * <TableProvider value={contextValue}>
 *   <TableToolbar />
 *   <TableBody />
 * </TableProvider>
 *
 * // In child component:
 * function TableToolbar() {
 *   const { sorting, filtering, search } = useTable();
 *   return <Input value={search.state.query} onChange={e => search.actions.setQuery(e.target.value)} />
 * }
 */

'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { UseSortingReturn } from '../hooks/useSorting';
import type { UseFilteringReturn } from '../hooks/useFiltering';
import type { UseGroupingReturn } from '../hooks/useGrouping';
import type { UseSearchReturn } from '../hooks/useSearch';
import type { UseSelectionReturn } from '../hooks/useSelection';
import type { UseTableCoreReturn, ProcessedData } from '../hooks/useTableCore';
import type { TableColumn, TableRow, SavedView } from '../types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Callbacks from TeeemTableView props that child components may need
 */
export interface TableCallbacks {
  // Row actions
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
  onEdit?: (row: TableRow) => void;
  onView?: (row: TableRow) => void;
  onDelete?: (row: TableRow) => void;

  // Bulk actions
  onBulkDelete?: (ids: (number | string)[]) => void;
  onBulkEdit?: (ids: (number | string)[]) => void;
  onBulkMerge?: (ids: (number | string)[]) => void;

  // Data mutations
  onRowUpdate?: (rowId: number | string, field: string, value: unknown) => void;
  onRefresh?: () => void;
  onAddRow?: () => void;

  // View management
  onViewChange?: (view: SavedView | null) => void;
}

/**
 * Table metadata and configuration
 */
export interface TableMeta {
  /** Foundation slug (e.g., "jobs", "contacts") */
  foundationId?: string;
  /** Foundation numeric ID (environment-specific) */
  foundationIdNumeric?: number | null;
  /** Display name for the table */
  tableName?: string;
  /** Whether the table is view-only */
  viewOnly?: boolean;
  /** Whether auto-fetch is enabled */
  autoFetchRecords?: boolean;
}

/**
 * Full context value provided to child components
 */
export interface TableContextValue {
  // ============================================================================
  // FEATURE HOOKS (from useTableCore)
  // ============================================================================

  /** Sorting feature */
  sorting: UseSortingReturn;
  /** Filtering feature */
  filtering: UseFilteringReturn;
  /** Grouping feature */
  grouping: UseGroupingReturn;
  /** Search feature */
  search: UseSearchReturn;
  /** Selection feature */
  selection: UseSelectionReturn;

  // ============================================================================
  // PROCESSED DATA
  // ============================================================================

  /** Column definitions */
  columns: TableColumn[];
  /** Raw data rows (before processing) */
  rows: TableRow[];
  /** Processed data from pipeline (filter -> search -> sort -> group) */
  processedData: ProcessedData;

  // ============================================================================
  // TABLE METADATA
  // ============================================================================

  meta: TableMeta;

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  callbacks: TableCallbacks;

  // ============================================================================
  // VIEWS
  // ============================================================================

  /** Available saved views */
  savedViews: SavedView[];
  /** Currently active view */
  activeView: SavedView | null;
  /** Load a saved view */
  loadView: (view: SavedView) => void;

  // ============================================================================
  // UI STATE
  // ============================================================================

  /** Whether the table is loading */
  isLoading: boolean;
  /** Whether there's an error */
  error: string | null;
  /** Whether more data is available for load-more */
  hasMore: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TableContext = createContext<TableContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface TableProviderProps {
  value: TableContextValue;
  children: ReactNode;
}

/**
 * Provider component for table context
 *
 * @example
 * <TableProvider value={contextValue}>
 *   <TableToolbar />
 *   <TableBody />
 * </TableProvider>
 */
export function TableProvider({ value, children }: TableProviderProps) {
  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  );
}

// ============================================================================
// CONSUMER HOOK
// ============================================================================

/**
 * Access the table context from any child component
 *
 * @throws Error if used outside of TableProvider
 *
 * @example
 * function SearchInput() {
 *   const { search } = useTable();
 *   return (
 *     <Input
 *       value={search.state.query}
 *       onChange={e => search.actions.setQuery(e.target.value)}
 *     />
 *   );
 * }
 */
export function useTable(): TableContextValue {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
}

/**
 * Safely access the table context (returns null if outside provider)
 *
 * Use this when you want to optionally use context features
 * but don't want to throw if context is unavailable.
 *
 * @example
 * function MaybeSearchAware() {
 *   const table = useTableMaybe();
 *   if (!table) return <FallbackUI />;
 *   return <SearchAwareUI search={table.search} />;
 * }
 */
export function useTableMaybe(): TableContextValue | null {
  return useContext(TableContext);
}

// ============================================================================
// SPECIALIZED HOOKS (for selective subscriptions)
// ============================================================================

/**
 * Access only sorting state and actions
 * Use for components that only need sorting
 */
export function useTableSorting(): UseSortingReturn {
  const { sorting } = useTable();
  return sorting;
}

/**
 * Access only filtering state and actions
 * Use for components that only need filtering
 */
export function useTableFiltering(): UseFilteringReturn {
  const { filtering } = useTable();
  return filtering;
}

/**
 * Access only grouping state and actions
 * Use for components that only need grouping
 */
export function useTableGrouping(): UseGroupingReturn {
  const { grouping } = useTable();
  return grouping;
}

/**
 * Access only search state and actions
 * Use for components that only need search
 */
export function useTableSearch(): UseSearchReturn {
  const { search } = useTable();
  return search;
}

/**
 * Access only selection state and actions
 * Use for components that only need selection
 */
export function useTableSelection(): UseSelectionReturn {
  const { selection } = useTable();
  return selection;
}

/**
 * Access processed data (rows after pipeline)
 */
export function useTableData(): ProcessedData {
  const { processedData } = useTable();
  return processedData;
}

/**
 * Access table columns
 */
export function useTableColumns(): TableColumn[] {
  const { columns } = useTable();
  return columns;
}

/**
 * Access table metadata
 */
export function useTableMeta(): TableMeta {
  const { meta } = useTable();
  return meta;
}

/**
 * Access callbacks
 */
export function useTableCallbacks(): TableCallbacks {
  const { callbacks } = useTable();
  return callbacks;
}

// ============================================================================
// HELPER: Create context value from useTableCore
// ============================================================================

/**
 * Helper to create context value from useTableCore and additional props
 *
 * This is used internally by TeeemTableView to create the context value.
 *
 * @example
 * const table = useTableCore({ columns });
 * const processedData = table.processData(rows);
 * const contextValue = createTableContextValue({
 *   tableCore: table,
 *   columns,
 *   rows,
 *   processedData,
 *   meta: { foundationId: 'jobs' },
 *   callbacks: { onRowClick },
 * });
 */
export function createTableContextValue(options: {
  tableCore: UseTableCoreReturn;
  columns: TableColumn[];
  rows: TableRow[];
  processedData: ProcessedData;
  meta: TableMeta;
  callbacks: TableCallbacks;
  savedViews?: SavedView[];
  activeView?: SavedView | null;
  loadView?: (view: SavedView) => void;
  isLoading?: boolean;
  error?: string | null;
  hasMore?: boolean;
}): TableContextValue {
  const {
    tableCore,
    columns,
    rows,
    processedData,
    meta,
    callbacks,
    savedViews = [],
    activeView = null,
    loadView = () => {},
    isLoading = false,
    error = null,
    hasMore = false,
  } = options;

  return {
    // Feature hooks
    sorting: tableCore.sorting,
    filtering: tableCore.filtering,
    grouping: tableCore.grouping,
    search: tableCore.search,
    selection: tableCore.selection,

    // Data
    columns,
    rows,
    processedData,

    // Metadata
    meta,

    // Callbacks
    callbacks,

    // Views
    savedViews,
    activeView,
    loadView,

    // UI state
    isLoading,
    error,
    hasMore,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TableContext };
export default TableProvider;
