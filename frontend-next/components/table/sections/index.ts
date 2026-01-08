/**
 * Table Render Sections (Layer 3)
 *
 * Composable render components for table UI.
 * These are pure presentation components that receive
 * all data and handlers via props.
 *
 * Architecture:
 * - Layer 1: lib/table-core (pure data processing)
 * - Layer 2: components/table/hooks (React state + Layer 1)
 * - Layer 3: components/table/sections (composable UI) ← HERE
 * - Layer 4: TeeemTableView (backward-compatible orchestrator)
 *
 * @example
 * import { TableToolbar, TableHeaderSection, TableFooterSection } from '@/components/table/sections';
 *
 * <TableToolbar
 *   title="Jobs"
 *   totalCount={150}
 *   onAdd={() => setShowCreateModal(true)}
 *   onRefresh={handleRefresh}
 * />
 */

// Toolbar section (new composable version)
export { TableToolbar } from './TableToolbar';
export type { TableToolbarProps } from './TableToolbar';

// Toolbar sub-components
export { ToolbarBulkActions } from './ToolbarBulkActions';
export type { ToolbarBulkActionsProps } from './ToolbarBulkActions';

export { ToolbarMoreActions } from './ToolbarMoreActions';
export type { ToolbarMoreActionsProps } from './ToolbarMoreActions';

// Re-export existing extracted sections from core/
export { TableHeaderSection } from '../core/table-sections/TableHeaderSection';
export type { TableHeaderSectionProps } from '../core/table-sections/TableHeaderSection';

export { TableFooterSection } from '../core/table-sections/TableFooterSection';
export type { TableFooterSectionProps } from '../core/table-sections/TableFooterSection';

// Re-export virtualized table components
export { VirtualizedGroupTable } from '../core/virtualization/VirtualizedGroupTable';
export { VirtualizedFlatTable } from '../core/virtualization/VirtualizedFlatTable';
