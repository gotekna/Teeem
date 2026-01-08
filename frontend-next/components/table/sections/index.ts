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
 * import { TableToolbar } from '@/components/table/sections';
 *
 * <TableToolbar
 *   title="Jobs"
 *   totalCount={150}
 *   onAdd={() => setShowCreateModal(true)}
 *   onRefresh={handleRefresh}
 * />
 */

// Toolbar section
export { TableToolbar } from './TableToolbar';
export type { TableToolbarProps } from './TableToolbar';
