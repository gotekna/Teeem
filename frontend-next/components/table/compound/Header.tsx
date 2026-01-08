/**
 * Table Header Compound Component
 *
 * Renders the table header with sortable, resizable columns.
 *
 * @example
 * // Simple usage
 * <Table.Header />
 *
 * @example
 * // With custom column header
 * <Table.Header
 *   renderColumn={({ column, sortDirection }) => (
 *     <CustomHeader column={column} sorted={sortDirection} />
 *   )}
 * />
 */

'use client';

import React from 'react';
import { useTableContext } from './TableContext';
import { TableHeader as UITableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface HeaderProps {
  /** Custom column header renderer */
  renderColumn?: (props: {
    column: { key: string; label: string; column_type?: string };
    sortDirection: 'asc' | 'desc' | null;
    onSort: () => void;
  }) => React.ReactNode;

  /** Enable sorting */
  sortable?: boolean;

  /** Enable selection checkbox */
  selectable?: boolean;

  /** Additional className */
  className?: string;
}

/**
 * Table header component
 */
export function Header({
  renderColumn,
  sortable = true,
  selectable = true,
  className,
}: HeaderProps) {
  const {
    visibleColumnsInOrder,
    columnWidths,
    processedRows,
    sorting,
    selection,
  } = useTableContext();

  const { sortColumns } = sorting.state;
  const { toggleSort } = sorting.actions;
  const { selectedIds } = selection.state;
  const { selectAll, clear } = selection.actions;

  // Check if all rows are selected
  const allSelected =
    processedRows.length > 0 &&
    selectedIds.size === processedRows.length;

  const someSelected =
    selectedIds.size > 0 && selectedIds.size < processedRows.length;

  // Get sort direction for a column
  const getSortDirection = (columnKey: string): 'asc' | 'desc' | null => {
    const sortCol = sortColumns.find((s) => s.column === columnKey);
    return sortCol?.dir === 'asc' || sortCol?.dir === 'desc' ? sortCol.dir : null;
  };

  // Handle select all toggle
  const handleSelectAllToggle = () => {
    if (allSelected) {
      clear();
    } else {
      const allIds = processedRows.map((r) => r.id as string | number);
      selectAll(allIds);
    }
  };

  return (
    <UITableHeader className={className}>
      <TableRow>
        {visibleColumnsInOrder.map((column) => {
          const width = columnWidths[column.key] || column.width;
          const sortDir = getSortDirection(column.key);

          // Select column
          if (column.key === 'select' && selectable) {
            return (
              <TableHead
                key={column.key}
                className="w-12 text-center sticky top-0 bg-muted z-20"
              >
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={handleSelectAllToggle}
                />
              </TableHead>
            );
          }

          // Actions column
          if (column.key === 'actions') {
            return (
              <TableHead
                key={column.key}
                className="sticky top-0 bg-muted z-20"
                style={{ width }}
              >
                {column.label}
              </TableHead>
            );
          }

          // Custom renderer
          if (renderColumn) {
            return (
              <TableHead
                key={column.key}
                className="sticky top-0 bg-muted z-20"
                style={{ width }}
              >
                {renderColumn({
                  column,
                  sortDirection: sortDir,
                  onSort: () => toggleSort(column.key),
                })}
              </TableHead>
            );
          }

          // Default sortable header
          return (
            <TableHead
              key={column.key}
              className={cn(
                'sticky top-0 bg-muted z-20',
                sortable && 'cursor-pointer select-none hover:bg-muted/80'
              )}
              style={{ width }}
              onClick={sortable ? () => toggleSort(column.key) : undefined}
            >
              <div className="flex items-center gap-1">
                <span className="truncate">{column.label}</span>
                {sortable && (
                  <SortIndicator direction={sortDir} />
                )}
              </div>
            </TableHead>
          );
        })}
      </TableRow>
    </UITableHeader>
  );
}

Header.displayName = 'Table.Header';

// ============================================================================
// SORT INDICATOR
// ============================================================================

interface SortIndicatorProps {
  direction: 'asc' | 'desc' | null;
  className?: string;
}

function SortIndicator({ direction, className }: SortIndicatorProps) {
  const Icon =
    direction === 'asc'
      ? ArrowUp
      : direction === 'desc'
      ? ArrowDown
      : ArrowUpDown;

  return (
    <Icon
      className={cn(
        'h-4 w-4 shrink-0',
        direction ? 'opacity-100' : 'opacity-30',
        className
      )}
    />
  );
}

// ============================================================================
// COLUMN HEADER
// ============================================================================

export interface ColumnHeaderProps {
  /** Column key */
  columnKey: string;

  /** Override label */
  label?: string;

  /** Enable sorting for this column */
  sortable?: boolean;

  /** Children to render */
  children?: React.ReactNode;

  /** Additional className */
  className?: string;
}

/**
 * Individual column header for custom composition
 */
export function ColumnHeader({
  columnKey,
  label,
  sortable = true,
  children,
  className,
}: ColumnHeaderProps) {
  const { visibleColumnsInOrder, columnWidths, sorting } = useTableContext();
  const column = visibleColumnsInOrder.find((c) => c.key === columnKey);
  const width = columnWidths[columnKey] || column?.width;

  const sortCol = sorting.state.sortColumns.find((s) => s.column === columnKey);
  const sortDir = sortCol?.dir === 'asc' || sortCol?.dir === 'desc' ? sortCol.dir : null;

  const displayLabel = label ?? column?.label ?? columnKey;

  return (
    <TableHead
      className={cn(
        'sticky top-0 bg-muted z-20',
        sortable && 'cursor-pointer select-none hover:bg-muted/80',
        className
      )}
      style={{ width }}
      onClick={sortable ? () => sorting.actions.toggleSort(columnKey) : undefined}
    >
      {children ?? (
        <div className="flex items-center gap-1">
          <span className="truncate">{displayLabel}</span>
          {sortable && <SortIndicator direction={sortDir} />}
        </div>
      )}
    </TableHead>
  );
}

ColumnHeader.displayName = 'Table.ColumnHeader';

export default Header;
