/**
 * TableHeaderSection Component
 *
 * Renders the table header with resizable columns, sorting, filtering, and grouping controls.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 6 refactoring - Render Functions extraction
 */

import React from 'react';
import { TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ResizableColumnHeader } from '../../components/ResizableColumnHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TableColumn } from '../../types';

/**
 * Xero column tooltips - explains what each Xero-related field means
 */
const XERO_COLUMN_TOOLTIPS: Record<string, string> = {
  xero_linked_count: 'Number of Xero organizations this contact is linked to',
  xero_tenant_names: 'Names of the Xero organizations this contact is linked to',
  xero_contact_types: 'Whether this contact is a Customer and/or Supplier in Xero',
  xero_invoice_count: 'Total number of Xero invoices associated with this contact',
  sync_with_xero: 'Whether this contact is configured to sync with Xero',
  xero_contact_number: 'Unique contact identifier number in Xero',
  xero_account_number: 'Account number assigned in Xero',
  xero_id: 'Unique Xero contact ID (internal reference)',
  xero_link_summary: 'Summary of Xero links showing connected organizations',
};

const SYSTEM_COLUMN_BG = 'hsl(47, 100%, 96%)'; // Light yellow tint
// GOLD STANDARD: Sticky is position-based (select + position 2)
// This is only used for z-index calculation - actual sticky comes from getStickyColumnStyles
const STICKY_COLUMNS = ['select'];

export interface TableHeaderSectionProps {
  /** Visible columns in display order */
  visibleColumnsInOrder: TableColumn[];

  /** Column widths map */
  columnWidths: Record<string, number>;

  /** Selected rows */
  selectedRows: Set<number | string>;

  /** All filtered and sorted entries */
  filteredAndSortedEntries: Array<{ id: number | string; [key: string]: unknown }>;

  /** Sort configuration */
  sortColumns: Array<{ column: string; dir: 'asc' | 'desc' | 'custom'; customOrder?: string[] }>;

  /** Currently grouped column */
  groupByColumn: string | null;

  /** Whether column edit mode is active */
  columnEditMode: boolean;

  /** Toggle select all rows */
  toggleSelectAll: () => void;

  /** Column resize handler */
  handleColumnResize: (key: string, width: number) => void;

  /** Sort handler */
  handleSort: (columnKey: string) => void;

  /** Hide column handler */
  hideColumn: (columnKey: string) => void;

  /** Group by column handler */
  handleGroupByColumn: (columnKey: string | null) => void;

  /** Add filter for column handler */
  addFilterForColumn: (columnKey: string) => void;

  /** Open column edit modal */
  handleOpenColumnEdit: (columnKey: string) => void;

  /** Function to get sticky column styles */
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;

  /** Function to check if column is system-generated */
  isSystemGeneratedColumn: (column: TableColumn) => boolean;
}

/**
 * Table header component with resizable columns and controls
 */
export function TableHeaderSection({
  visibleColumnsInOrder,
  columnWidths,
  selectedRows,
  filteredAndSortedEntries,
  sortColumns,
  groupByColumn,
  columnEditMode,
  toggleSelectAll,
  handleColumnResize,
  handleSort,
  hideColumn,
  handleGroupByColumn,
  addFilterForColumn,
  handleOpenColumnEdit,
  getStickyColumnStyles,
  isSystemGeneratedColumn,
}: TableHeaderSectionProps) {
  // GOLD STANDARD: Sticky is position-based
  // Position 1 (select), Position 2 (first data column), and actions are sticky
  const isStickyColumn = (key: string, index: number) =>
    key === 'select' || index === 1 || key === 'actions';

  return (
    <TableHeader>
      <TableRow>
        {visibleColumnsInOrder.map((column, colIndex) => {
          const stickyStyles = getStickyColumnStyles(column.key, true);
          const isSticky = isStickyColumn(column.key, colIndex);
          const isSystemGen = isSystemGeneratedColumn(column);

          // Determine background color - system columns get yellow, others get muted
          const bgColor = isSystemGen && column.key !== "select" && column.key !== "actions"
            ? SYSTEM_COLUMN_BG
            : 'hsl(var(--muted))'; // Match bg-muted for solid sticky background

          return (
            <TableHead
              key={`${column.key}-${colIndex}`}
              style={{
                width: columnWidths[column.key] || column.width,
                minWidth: columnWidths[column.key] || column.width || 50,
                backgroundColor: bgColor,
                ...stickyStyles,
                ...(column.key === "select" && {
                  textAlign: 'center',
                  verticalAlign: 'middle',
                }),
              }}
              className={cn(
                "sticky top-0 relative",
                isSticky ? "z-30" : "z-20",
                column.key === "select" && "!border-r-0 !p-0 !h-full",
                column.key === "actions" && "!border-l-0"
              )}
            >
              {column.key === "select" ? (
                <div className="flex items-center justify-center w-full h-full">
                  <Checkbox
                    checked={
                      selectedRows.size === filteredAndSortedEntries.length &&
                      filteredAndSortedEntries.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </div>
              ) : column.key === "actions" ? (
                <span className="truncate">{column.label}</span>
              ) : (
                <ResizableColumnHeader
                  column={column}
                  width={columnWidths[column.key] || column.width || 150}
                  onResize={handleColumnResize}
                  onSort={handleSort}
                  onHide={hideColumn}
                  onGroupBy={handleGroupByColumn}
                  onAddFilter={addFilterForColumn}
                  onEdit={handleOpenColumnEdit}
                  sortInfo={sortColumns.find((s) => s.column === column.key)}
                  isGroupedBy={groupByColumn === column.key}
                  isEditMode={columnEditMode}
                >
                  {XERO_COLUMN_TOOLTIPS[column.key] ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate cursor-help border-b border-dashed border-gray-400 dark:border-gray-500">
                            {column.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>{XERO_COLUMN_TOOLTIPS[column.key]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="truncate">{column.label}</span>
                  )}
                </ResizableColumnHeader>
              )}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}
