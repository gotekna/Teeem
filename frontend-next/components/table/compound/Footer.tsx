/**
 * Table Footer Compound Component
 *
 * Renders the table footer with totals, pagination, and selection info.
 *
 * @example
 * // Simple usage - shows totals for numeric columns
 * <Table.Footer />
 *
 * @example
 * // Custom footer content
 * <Table.Footer>
 *   <Table.SelectionInfo />
 *   <Table.Pagination />
 * </Table.Footer>
 */

'use client';

import React, { useMemo } from 'react';
import { useTableContext } from './TableContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// FOOTER ROOT
// ============================================================================

export interface FooterProps {
  /** Children to render (if provided, replaces default content) */
  children?: React.ReactNode;

  /** Show totals row */
  showTotals?: boolean;

  /** Show selection info */
  showSelectionInfo?: boolean;

  /** Additional className */
  className?: string;
}

/**
 * Table footer container
 */
export function Footer({
  children,
  showTotals = true,
  showSelectionInfo = true,
  className,
}: FooterProps) {
  const { processedRows, selection } = useTableContext();
  const hasSelection = selection.state.selectedIds.size > 0;

  // If children provided, render custom content
  if (children) {
    return (
      <div className={cn('border-t bg-muted/30 px-4 py-2', className)} data-table-footer="">
        {children}
      </div>
    );
  }

  // Don't render if nothing to show
  if (!showTotals && !showSelectionInfo) return null;
  if (!hasSelection && processedRows.length === 0) return null;

  return (
    <div className={cn('border-t bg-muted/30 px-4 py-2', className)} data-table-footer="">
      <div className="flex items-center justify-between">
        {/* Left side - selection info */}
        {showSelectionInfo && hasSelection && <SelectionInfo />}

        {/* Right side - row count */}
        <div className="ml-auto text-sm text-muted-foreground">
          {processedRows.length} row{processedRows.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

Footer.displayName = 'Table.Footer';

// ============================================================================
// SELECTION INFO
// ============================================================================

export interface SelectionInfoProps {
  /** Additional className */
  className?: string;

  /** Show clear button */
  showClearButton?: boolean;
}

/**
 * Display selected row count with clear button
 */
export function SelectionInfo({
  className,
  showClearButton = true,
}: SelectionInfoProps) {
  const { selection } = useTableContext();
  const count = selection.state.selectedIds.size;

  if (count === 0) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant="secondary">
        {count} selected
      </Badge>
      {showClearButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={selection.actions.clear}
          className="h-7 text-xs"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

SelectionInfo.displayName = 'Table.SelectionInfo';

// ============================================================================
// TOTALS ROW
// ============================================================================

export interface TotalsProps {
  /** Columns to show totals for (defaults to all numeric) */
  columns?: string[];

  /** Additional className */
  className?: string;
}

/**
 * Display totals for numeric columns
 */
export function Totals({ columns: includeColumns, className }: TotalsProps) {
  const { processedRows, visibleColumnsInOrder, columnWidths } = useTableContext();

  // Calculate totals for numeric columns
  const totals = useMemo(() => {
    const numericTypes = ['number', 'whole_number', 'currency', 'percentage', 'computed'];
    const skipColumns = ['id', 'select', 'actions', 'latitude', 'longitude'];

    const result: Record<string, { total: number; type: string }> = {};

    visibleColumnsInOrder.forEach((col) => {
      const isNumeric =
        col.column_type &&
        numericTypes.includes(col.column_type) &&
        !skipColumns.includes(col.key);

      const shouldInclude = !includeColumns || includeColumns.includes(col.key);

      if (isNumeric && shouldInclude) {
        const total = processedRows.reduce((sum, row) => {
          const val = row[col.key];
          const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
          return sum + (isNaN(num) ? 0 : num);
        }, 0);

        result[col.key] = { total, type: col.column_type! };
      }
    });

    return result;
  }, [processedRows, visibleColumnsInOrder, includeColumns]);

  // Don't render if no totals
  if (Object.keys(totals).length === 0) return null;

  return (
    <div className={cn('flex items-center gap-4 py-1', className)}>
      <span className="text-sm font-medium text-muted-foreground">Totals:</span>
      {Object.entries(totals).map(([key, { total, type }]) => {
        const column = visibleColumnsInOrder.find((c) => c.key === key);
        const label = column?.label || key;

        let formattedTotal: string;
        if (type === 'currency') {
          formattedTotal = `$${total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        } else if (type === 'percentage') {
          formattedTotal = `${total.toFixed(1)}%`;
        } else {
          formattedTotal = total.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }

        return (
          <div key={key} className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium">{formattedTotal}</span>
          </div>
        );
      })}
    </div>
  );
}

Totals.displayName = 'Table.Totals';

// ============================================================================
// PAGINATION (placeholder for future)
// ============================================================================

export interface PaginationProps {
  /** Current page */
  page?: number;

  /** Total pages */
  totalPages?: number;

  /** Page change handler */
  onPageChange?: (page: number) => void;

  /** Additional className */
  className?: string;
}

/**
 * Pagination controls (placeholder)
 */
export function Pagination({
  page = 1,
  totalPages = 1,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(page + 1)}
        disabled={page >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}

Pagination.displayName = 'Table.Pagination';

export default Footer;
