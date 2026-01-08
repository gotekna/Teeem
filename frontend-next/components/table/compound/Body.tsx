/**
 * Table Body Compound Component
 *
 * Renders the table body with support for virtualization and grouping.
 * Automatically uses the correct renderer based on data state.
 *
 * @example
 * // Simple usage
 * <Table.Body />
 *
 * @example
 * // With custom row renderer
 * <Table.Body
 *   renderRow={({ row, index }) => (
 *     <CustomRow key={row.id} data={row} />
 *   )}
 * />
 */

'use client';

import React from 'react';
import { useTableContext } from './TableContext';
import { Table, TableBody as UITableBody, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface BodyProps {
  /** Custom row renderer */
  renderRow?: (props: {
    row: Record<string, unknown>;
    index: number;
    isSelected: boolean;
  }) => React.ReactNode;

  /** Custom cell renderer */
  renderCell?: (props: {
    row: Record<string, unknown>;
    column: { key: string; label: string };
    value: unknown;
  }) => React.ReactNode;

  /** Additional className */
  className?: string;

  /** Show loading skeleton */
  showSkeleton?: boolean;

  /** Number of skeleton rows */
  skeletonRows?: number;
}

/**
 * Table body component
 */
export function Body({
  renderRow,
  renderCell,
  className,
  showSkeleton = true,
  skeletonRows = 10,
}: BodyProps) {
  const {
    processedRows,
    visibleColumnsInOrder,
    columnWidths,
    selection,
    isLoading,
    grouping,
  } = useTableContext();

  const { selectedIds } = selection.state;
  const { toggle: toggleSelection } = selection.actions;
  const { isGrouped } = grouping.state;

  // Loading state
  if (isLoading && showSkeleton && processedRows.length === 0) {
    return (
      <div className={cn('flex-1 overflow-auto', className)}>
        <Table>
          <UITableBody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={i}>
                {visibleColumnsInOrder.map((col) => (
                  <TableCell
                    key={col.key}
                    style={{ width: columnWidths[col.key] || col.width }}
                  >
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </UITableBody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (processedRows.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground py-12">
          <p className="text-lg">No records found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      </div>
    );
  }

  // TODO: Handle grouped data rendering
  // For now, render flat list
  return (
    <div className={cn('flex-1 overflow-auto', className)}>
      <Table>
        <UITableBody>
          {processedRows.map((row, index) => {
            const rowId = row.id as string | number;
            const isSelected = selectedIds.has(rowId);

            // Custom row renderer
            if (renderRow) {
              return renderRow({ row, index, isSelected });
            }

            // Default row rendering
            return (
              <TableRow
                key={rowId}
                data-selected={isSelected || undefined}
                className={cn(isSelected && 'bg-muted/50')}
              >
                {visibleColumnsInOrder.map((column) => {
                  const value = row[column.key];

                  // Select column
                  if (column.key === 'select') {
                    return (
                      <TableCell
                        key={column.key}
                        className="w-12 text-center"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(rowId)}
                        />
                      </TableCell>
                    );
                  }

                  // Custom cell renderer
                  if (renderCell) {
                    return (
                      <TableCell
                        key={column.key}
                        style={{ width: columnWidths[column.key] || column.width }}
                      >
                        {renderCell({ row, column, value })}
                      </TableCell>
                    );
                  }

                  // Default cell rendering
                  return (
                    <TableCell
                      key={column.key}
                      style={{ width: columnWidths[column.key] || column.width }}
                    >
                      <span className="truncate block">
                        {formatCellValue(value)}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </UITableBody>
      </Table>
    </div>
  );
}

Body.displayName = 'Table.Body';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format cell value for display
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toLocaleDateString();
    return JSON.stringify(value);
  }
  return String(value);
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

export interface RowProps {
  /** Row data */
  row: Record<string, unknown>;

  /** Row index */
  index: number;

  /** Whether row is selected */
  isSelected?: boolean;

  /** Children to render */
  children?: React.ReactNode;

  /** Additional className */
  className?: string;

  /** Click handler */
  onClick?: () => void;
}

/**
 * Table row component for custom rendering
 */
export function Row({
  row,
  index,
  isSelected,
  children,
  className,
  onClick,
}: RowProps) {
  return (
    <TableRow
      data-selected={isSelected || undefined}
      className={cn(isSelected && 'bg-muted/50', className)}
      onClick={onClick}
    >
      {children}
    </TableRow>
  );
}

Row.displayName = 'Table.Row';

export interface CellProps {
  /** Cell value */
  value?: unknown;

  /** Column key */
  column?: string;

  /** Width */
  width?: number | string;

  /** Children to render (overrides value) */
  children?: React.ReactNode;

  /** Additional className */
  className?: string;
}

/**
 * Table cell component for custom rendering
 */
export function Cell({
  value,
  width,
  children,
  className,
}: CellProps) {
  return (
    <TableCell style={{ width }} className={className}>
      {children ?? formatCellValue(value)}
    </TableCell>
  );
}

Cell.displayName = 'Table.Cell';

export default Body;
