/**
 * Table Context Exports
 *
 * Central state management for TeeemTableView.
 * Enables child components to access table state without prop drilling.
 *
 * @example
 * // In child component:
 * import { useTable } from '@/components/table/context';
 *
 * function SearchInput() {
 *   const { search } = useTable();
 *   return <Input value={search.state.query} onChange={e => search.actions.setQuery(e.target.value)} />;
 * }
 */

export {
  // Context and Provider
  TableContext,
  TableProvider,
  default,

  // Main consumer hook
  useTable,
  useTableMaybe,

  // Specialized hooks (for selective subscriptions)
  useTableSorting,
  useTableFiltering,
  useTableGrouping,
  useTableSearch,
  useTableSelection,
  useTableData,
  useTableColumns,
  useTableMeta,
  useTableCallbacks,

  // Helper
  createTableContextValue,

  // Types
  type TableContextValue,
  type TableProviderProps,
  type TableCallbacks,
  type TableMeta,
} from './TableContext';
