"use client";

/**
 * VirtualizedFlatTable - High-performance table for large datasets
 *
 * Extracted from TeeemTableView.tsx as part of Phase 2 refactoring.
 * Uses @tanstack/react-virtual to render only visible rows.
 * Achieves 60fps scrolling with 100K+ rows.
 *
 * Performance targets:
 * - 100 rows: <10ms render
 * - 10,000 rows: <10ms render
 * - 100,000 rows: <10ms render (same as 100!)
 */

import React, { useRef, memo, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  Table,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { SelectCheckbox } from "../cell-components";
import { TableColumn, TableRow as TableRowType } from "../../types";

// Row height constant (matches h-7 = 1.75rem = 28px)
const ROW_HEIGHT = 28;
// Extra rows rendered above/below viewport for smoother scrolling
const OVERSCAN_COUNT = 10;

// Helper to get plain text for cell tooltip (handles objects, arrays, etc.)
const getCellTooltip = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    // Handle lookup/relation objects
    if ("display" in value) return String((value as { display: string }).display) || undefined;
    if ("name" in value) return String((value as { name: string }).name) || undefined;
    if ("label" in value) return String((value as { label: string }).label) || undefined;
    // Handle arrays (multi-select)
    if (Array.isArray(value) && value.length > 0) {
      const text = value.map(v => {
        if (typeof v === "object" && v !== null) {
          if ("display" in v) return (v as { display: string }).display;
          if ("name" in v) return (v as { name: string }).name;
          return JSON.stringify(v);
        }
        return String(v);
      }).join(", ");
      return text || undefined;
    }
  }
  return undefined;
};

export interface VirtualizedFlatTableProps {
  rows: TableRowType[];
  selectedRows: Set<number | string>;
  visibleColumnsInOrder: TableColumn[];
  columnWidths: Record<string, number>;
  editingRowIds: Set<number | string>;
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;
  isSystemGeneratedColumn: (column: TableColumn) => boolean;
  SYSTEM_COLUMN_BG: string;
  getToggleCallback: (id: number | string) => () => void;
  handleSelectMouseDown: (rowId: number | string, rowIndex: number, e: React.MouseEvent) => void;
  handleRowMouseEnter: (rowId: number | string, rowIndex: number) => void;
  isRowInDragRange: (rowId: number | string) => boolean;
  onRowClick?: (row: TableRowType) => void;
  onRowDoubleClick?: (row: TableRowType) => void;
  renderCellValue: (row: TableRowType, column: TableColumn) => React.ReactNode;
  renderTableHeader: () => React.ReactNode;
  renderTableFooter?: () => React.ReactNode;
  isEditMode: boolean;
  showTotals: boolean;
  tableHeight?: number; // Default 600px
  // Keyboard navigation props
  focusedRowIndex?: number;
  onFocusRow?: (index: number) => void;
  tableHasFocus?: boolean;
}

export const VirtualizedFlatTable = memo(function VirtualizedFlatTable({
  rows,
  selectedRows,
  visibleColumnsInOrder,
  columnWidths,
  editingRowIds,
  getStickyColumnStyles,
  isSystemGeneratedColumn,
  SYSTEM_COLUMN_BG,
  getToggleCallback,
  handleSelectMouseDown,
  handleRowMouseEnter,
  isRowInDragRange,
  onRowClick,
  onRowDoubleClick,
  renderCellValue,
  renderTableHeader,
  renderTableFooter,
  isEditMode,
  showTotals,
  tableHeight = 600,
  // Keyboard navigation props
  focusedRowIndex = -1,
  onFocusRow,
  tableHasFocus = false,
}: VirtualizedFlatTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // Note: scrollbarWidth detection removed - was causing forced reflows
  // and the value wasn't being used anywhere in the render

  // Sync horizontal scroll between body and header
  const handleBodyScroll = useCallback(() => {
    if (parentRef.current && headerRef.current) {
      headerRef.current.scrollLeft = parentRef.current.scrollLeft;
    }
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  // Calculate total table width for proper scrolling
  const totalWidth = useMemo(() => {
    return visibleColumnsInOrder.reduce((sum, col) => {
      // Match colgroup width calculation: select is always 40px
      return sum + (col.key === "select" ? 40 : (columnWidths[col.key] || col.width || 150));
    }, 0);
  }, [visibleColumnsInOrder, columnWidths]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed header - scrolls horizontally in sync with body, no scrollbar */}
      <div ref={headerRef} className="overflow-hidden shrink-0">
        <Table style={{ tableLayout: "fixed", width: totalWidth, minWidth: totalWidth }}>
          <colgroup>
            {visibleColumnsInOrder.map((column) => (
              <col
                key={column.key}
                style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
              />
            ))}
          </colgroup>
          {renderTableHeader()}
        </Table>
      </div>

      {/* Virtualized scrollable body - fills remaining flex space */}
      {/* scrollbar-gutter: stable reserves space for scrollbar to prevent header/body misalignment */}
      <div
        ref={parentRef}
        className="overflow-auto flex-1 min-h-0"
        style={{ scrollbarGutter: 'stable' }}
        onScroll={handleBodyScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
            minWidth: totalWidth,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const rowIndex = virtualRow.index;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Table style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
                  <colgroup>
                    {visibleColumnsInOrder.map((column) => (
                      <col
                        key={column.key}
                        style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
                      />
                    ))}
                  </colgroup>
                  <tbody>
                    <TableRow
                      data-row-id={row.id}
                      className={cn(
                        selectedRows.has(row.id) && "bg-muted/50",
                        isRowInDragRange(row.id) && !selectedRows.has(row.id) && "bg-blue-100 dark:bg-blue-900/30",
                        editingRowIds.has(row.id) && "bg-blue-50 dark:bg-blue-950/20",
                        focusedRowIndex === rowIndex && tableHasFocus && "ring-2 ring-inset ring-primary/50 bg-primary/5",
                        "hover:bg-muted/30 cursor-pointer"
                      )}
                      onClick={() => {
                        // Single click toggles selection (standard behavior)
                        if (!isEditMode && !editingRowIds.has(row.id)) {
                          getToggleCallback(row.id)();
                        }
                        onFocusRow?.(rowIndex);
                      }}
                      onDoubleClick={() => {
                        // Double click opens detail/edit
                        if (!isEditMode && !editingRowIds.has(row.id)) {
                          if (onRowClick) {
                            onRowClick(row);
                          } else {
                            onRowDoubleClick?.(row);
                          }
                        }
                      }}
                      onMouseEnter={() => handleRowMouseEnter(row.id, rowIndex)}
                    >
                      {visibleColumnsInOrder.map((column, colIndex) => {
                        const isSystemGen = isSystemGeneratedColumn(column);
                        const stickyStyles = getStickyColumnStyles(column.key, false);
                        return (
                          <TableCell
                            key={`${column.key}-${colIndex}`}
                            title={column.key !== "select" && column.key !== "actions" ? getCellTooltip(row[column.key]) : undefined}
                            style={{
                              width: columnWidths[column.key] || column.width,
                              minWidth: columnWidths[column.key] || column.width,
                              ...stickyStyles,
                              ...(column.key === "select" && {
                                textAlign: "center",
                                verticalAlign: "middle"
                              }),
                              ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                                backgroundColor: SYSTEM_COLUMN_BG,
                              })
                            }}
                            className={cn(
                              column.key === "select" && "!border-r-0 !p-0 !h-full",
                              column.key === "actions" && "!border-l-0"
                            )}
                            onClick={(e) => {
                              if (column.key === "select") {
                                e.stopPropagation();
                              }
                            }}
                          >
                            {column.key === "select" ? (
                              <div
                                data-column="select"
                                onMouseDown={(e) => handleSelectMouseDown(row.id, rowIndex, e)}
                              >
                                <SelectCheckbox
                                  checked={selectedRows.has(row.id)}
                                  onCheckedChange={getToggleCallback(row.id)}
                                />
                              </div>
                            ) : column.key === "actions" ? (
                              renderCellValue(row, column)
                            ) : (
                              <div
                                className="truncate"
                                title={getCellTooltip(row[column.key])}
                              >
                                {renderCellValue(row, column)}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </tbody>
                </Table>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed footer (totals) */}
      {showTotals && renderTableFooter && (
        <div className="overflow-x-auto border-t">
          <Table className="w-full" style={{ tableLayout: "fixed", minWidth: totalWidth }}>
            <colgroup>
              {visibleColumnsInOrder.map((column) => (
                <col
                  key={column.key}
                  style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
                />
              ))}
            </colgroup>
            {renderTableFooter()}
          </Table>
        </div>
      )}
    </div>
  );
});

export default VirtualizedFlatTable;
