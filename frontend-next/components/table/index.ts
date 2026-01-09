/**
 * Table Components
 *
 * 4-Layer Architecture:
 * - Layer 1: lib/table-core (headless data processing)
 * - Layer 2: components/table/hooks (feature hooks)
 * - Layer 3: components/table/compound (composable UI)
 * - Layer 4: TeeemTableView / SimpleTable (orchestrators)
 *
 * Quick Start:
 * - TeeemTableView: Full-featured table (87 props, all features)
 * - SimpleTable: Lightweight table using new architecture
 * - Table.*: Compound components for custom composition
 */

// Layer 4: Full-featured orchestrators
export { default as TeeemTableView } from "./TeeemTableView";
export { SimpleTableView, type SimpleTableViewProps, type SimpleColumn, type SimpleColumnType } from "./SimpleTableView";
export { SimpleTable, type SimpleTableProps } from "./SimpleTable";

// Layer 3: Compound components
export { Table } from "./compound";
export * from "./compound";

// Layer 2: Feature hooks
export * from "./hooks";

// Context (for TeeemTableView integration - different from compound/TableContext)
// Use selective exports to avoid collision with compound/TableContext
export {
  TableProvider,
  useTable,
  useTableMaybe,
  useTableSorting,
  useTableFiltering,
  useTableGrouping,
  useTableSearch,
  useTableSelection,
  useTableData,
  useTableColumns,
  useTableMeta,
  useTableCallbacks,
  createTableContextValue,
  type TableContextValue as TeeemTableContextValue,
  type TableProviderProps,
  type TableCallbacks,
  type TableMeta,
} from "./context";

// Supporting components
export { DataHealthWidget } from "./DataHealthWidget";
export { SchemaTab } from "./SchemaTab";
export { ConnectionsTab } from "./ConnectionsTab";
export { CreateRecordDialog } from "./CreateRecordDialog";

// Types
export * from "./types";
