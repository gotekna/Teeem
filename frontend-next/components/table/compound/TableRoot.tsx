/**
 * Table Root Component
 *
 * The root provider for compound table components.
 * Sets up the table context with all features from useTableCore.
 *
 * Inspired by Radix UI's Root pattern - provides context for all children.
 *
 * @example
 * // Basic usage
 * <Table.Root columns={columns} rows={rows}>
 *   <Table.Toolbar />
 *   <Table.Body />
 *   <Table.Footer />
 * </Table.Root>
 *
 * @example
 * // With Foundation API
 * <Table.Root foundationId="jobs" autoFetch>
 *   <Table.Toolbar />
 *   <Table.Body />
 * </Table.Root>
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useTableCore } from '../hooks/useTableCore';
import { TableContextProvider, type TableContextValue } from './TableContext';
import type { TableColumn, TableRow } from '../types';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface TableRootProps {
  /** Column definitions */
  columns?: TableColumn[];

  /** Data rows */
  rows?: TableRow[];

  /** Foundation ID for auto-fetching */
  foundationId?: string | number;

  /** Table title */
  title?: string;

  /** Loading state */
  isLoading?: boolean;

  /** Error state */
  error?: Error | null;

  /** Refresh handler */
  onRefresh?: () => void;

  /** View only mode */
  viewOnly?: boolean;

  /** Initial column widths */
  initialColumnWidths?: Record<string, number>;

  /** Children components */
  children: React.ReactNode;

  /** Container className */
  className?: string;

  /** Container style */
  style?: React.CSSProperties;

  /** Use as child element (Radix asChild pattern) */
  asChild?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Table root component - provides context for all compound children
 */
export function TableRoot({
  columns = [],
  rows = [],
  foundationId,
  title,
  isLoading = false,
  error = null,
  onRefresh,
  viewOnly = false,
  initialColumnWidths = {},
  children,
  className,
  style,
}: TableRootProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialColumnWidths);

  const setColumnWidth = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: width }));
  }, []);

  // ============================================================================
  // HOOKS
  // ============================================================================

  // Master table hook with all features
  const tableCore = useTableCore({ columns });

  // Process data through the pipeline
  const { processedRows, groupedData, groupKeys, visibleRowIds, counts } = useMemo(
    () => tableCore.processData(rows),
    [tableCore, rows]
  );

  // ============================================================================
  // COMPUTED
  // ============================================================================

  // Visible columns in display order
  const visibleColumnsInOrder = useMemo(() => {
    // For now, return all columns that aren't defaultHidden
    // This will be enhanced when column visibility is added to tableCore
    return columns.filter((col) => !col.defaultHidden);
  }, [columns]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue = useMemo<TableContextValue>(() => ({
    // From useTableCore
    ...tableCore,

    // Data
    columns,
    rows,
    processedRows,
    visibleRowIds,

    // Column widths
    columnWidths,
    setColumnWidth,
    visibleColumnsInOrder,

    // Metadata
    title,
    foundationId,
    isLoading,
    error,
    onRefresh,
    viewOnly,
  }), [
    tableCore,
    columns,
    rows,
    processedRows,
    visibleRowIds,
    columnWidths,
    setColumnWidth,
    visibleColumnsInOrder,
    title,
    foundationId,
    isLoading,
    error,
    onRefresh,
    viewOnly,
  ]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <TableContextProvider value={contextValue}>
      <div
        className={cn('flex flex-col h-full', className)}
        style={style}
        data-table-root=""
        data-loading={isLoading || undefined}
      >
        {children}
      </div>
    </TableContextProvider>
  );
}

TableRoot.displayName = 'Table.Root';

export default TableRoot;
