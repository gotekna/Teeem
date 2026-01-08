/**
 * Table Compound Components (Layer 3 - Advanced API)
 *
 * Radix-inspired composable table components for advanced use cases.
 * Use these when you need full control over table layout and behavior.
 *
 * For simple use cases, use TeeemTableView directly.
 *
 * @example
 * // Simple table with compound components
 * import { Table } from '@/components/table/compound';
 *
 * <Table.Root columns={columns} rows={rows}>
 *   <Table.Toolbar />
 *   <Table.Header />
 *   <Table.Body />
 *   <Table.Footer />
 * </Table.Root>
 *
 * @example
 * // Custom toolbar composition
 * <Table.Root columns={columns} rows={rows}>
 *   <Table.Toolbar>
 *     <Table.Title />
 *     <Table.RecordCount />
 *     <Table.Search />
 *     <Table.FilterButton onClick={openFilters} />
 *     <Button onClick={customAction}>Export</Button>
 *   </Table.Toolbar>
 *   <Table.Body />
 * </Table.Root>
 *
 * @example
 * // Custom row rendering
 * <Table.Root columns={columns} rows={rows}>
 *   <Table.Header />
 *   <Table.Body
 *     renderRow={({ row, isSelected }) => (
 *       <CustomRow data={row} selected={isSelected} />
 *     )}
 *   />
 *   <Table.Footer>
 *     <Table.SelectionInfo />
 *     <Table.Totals />
 *   </Table.Footer>
 * </Table.Root>
 */

// Context
export {
  useTableContext,
  useTableContextOptional,
  TableContextProvider,
  type TableContextValue,
} from './TableContext';

// Root component
export { TableRoot, type TableRootProps } from './TableRoot';

// Toolbar components
export {
  Toolbar,
  ToolbarSearch,
  FilterButton,
  AddButton,
  RefreshButton,
  RecordCount,
  Title,
  type ToolbarProps,
  type ToolbarSearchProps,
  type FilterButtonProps,
  type AddButtonProps,
  type RefreshButtonProps,
  type RecordCountProps,
  type TitleProps,
} from './Toolbar';

// Header components
export {
  Header,
  ColumnHeader,
  type HeaderProps,
  type ColumnHeaderProps,
} from './Header';

// Body components
export {
  Body,
  Row,
  Cell,
  type BodyProps,
  type RowProps,
  type CellProps,
} from './Body';

// Footer components
export {
  Footer,
  SelectionInfo,
  Totals,
  Pagination,
  type FooterProps,
  type SelectionInfoProps,
  type TotalsProps,
  type PaginationProps,
} from './Footer';

// ============================================================================
// NAMESPACE EXPORT (Radix-style)
// ============================================================================

import { TableRoot } from './TableRoot';
import {
  Toolbar,
  ToolbarSearch,
  FilterButton,
  AddButton,
  RefreshButton,
  RecordCount,
  Title,
} from './Toolbar';
import { Header, ColumnHeader } from './Header';
import { Body, Row, Cell } from './Body';
import { Footer, SelectionInfo, Totals, Pagination } from './Footer';

/**
 * Table namespace with all compound components
 *
 * @example
 * import { Table } from '@/components/table/compound';
 *
 * <Table.Root columns={columns} rows={rows}>
 *   <Table.Toolbar />
 *   <Table.Body />
 * </Table.Root>
 */
export const Table = {
  // Root
  Root: TableRoot,

  // Toolbar section
  Toolbar,
  Search: ToolbarSearch,
  FilterButton,
  AddButton,
  RefreshButton,
  RecordCount,
  Title,

  // Header section
  Header,
  ColumnHeader,

  // Body section
  Body,
  Row,
  Cell,

  // Footer section
  Footer,
  SelectionInfo,
  Totals,
  Pagination,
} as const;

export default Table;
