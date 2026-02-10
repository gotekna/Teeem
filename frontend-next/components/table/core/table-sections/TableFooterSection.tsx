/**
 * TableFooterSection Component
 *
 * Renders the table footer with calculated totals for numeric columns.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 6 refactoring - Render Functions extraction
 */

import React from 'react';
import type { TableColumn } from '../../types';

export interface TableFooterSectionProps {
  /** Visible columns in display order */
  visibleColumnsInOrder: TableColumn[];

  /** Column widths map */
  columnWidths: Record<string, number>;

  /** Rows to calculate totals from */
  rows: Array<{ id: number | string; [key: string]: unknown }>;

  /** Function to get sticky column styles */
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;
}

/**
 * Table footer component with calculated totals
 */
export function TableFooterSection({
  visibleColumnsInOrder,
  columnWidths,
  rows,
  getStickyColumnStyles,
}: TableFooterSectionProps) {
  // Check if any visible columns are numeric
  const numericTypes = ['number', 'whole_number', 'currency', 'percentage', 'computed'];
  const hasNumericColumns = visibleColumnsInOrder.some(
    col => col.column_type && numericTypes.includes(col.column_type)
  );

  if (!hasNumericColumns || rows.length === 0) return null;

  return (
    <tfoot className="bg-muted/50 border-t-2 font-medium">
      <tr>
        {visibleColumnsInOrder.map((column, colIndex) => {
          // Skip id column and other non-summable columns
          const skipColumns = ['id', 'select', 'actions', 'latitude', 'longitude', 'lat', 'lng', 'long', 'job_design_id', 'user_id'];
          const isNumeric = column.column_type && numericTypes.includes(column.column_type) && !skipColumns.includes(column.key);
          let total: number | null = null;

          if (isNumeric) {
            total = rows.reduce((sum, row) => {
              const val = row[column.key];
              const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
              return sum + (isNaN(num) ? 0 : num);
            }, 0);
          }

          const stickyStyles = getStickyColumnStyles(column.key, true);

          return (
            <td
              key={`footer-${column.key}-${colIndex}`}
              className="px-3 py-2 text-sm"
              style={{
                width: columnWidths[column.key] || column.width,
                ...stickyStyles,
              }}
            >
              {column.key === "select" ? (
                <span className="text-xs text-muted-foreground">Total</span>
              ) : isNumeric && total !== null ? (
                <span>
                  {column.column_type === 'currency'
                    ? `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : column.column_type === 'percentage'
                    ? `${total.toFixed(1)}%`
                    : total.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  }
                </span>
              ) : null}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}
