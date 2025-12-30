"use client";

/**
 * VirtualizedGroupTable - Virtualized table for grouped views
 *
 * Uses @tanstack/react-virtual for efficient rendering of large datasets
 * within grouped table sections.
 */

import React, { useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectCheckbox } from "../cell-components";
import { TableColumn, TableRow as TableRowType } from "../../types";

export interface VirtualizedGroupTableProps {
  fullKey: string;
  depth: number;
  rows: TableRowType[];
  selectedRows: Set<number | string>;
  visibleColumnsInOrder: TableColumn[];
  columnWidths: Record<string, number>;
  rowIdToGlobalIndex: Map<number | string, number>;
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
  isEditMode: boolean;
}

// Row height constant
const ROW_HEIGHT = 32;
// Max container height before scrolling
const MAX_CONTAINER_HEIGHT = 400;
// Extra rows rendered above/below viewport
const OVERSCAN_COUNT = 3;

export const VirtualizedGroupTable = memo(function VirtualizedGroupTable({
  fullKey,
  depth,
  rows,
  selectedRows,
  visibleColumnsInOrder,
  columnWidths,
  rowIdToGlobalIndex,
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
  isEditMode,
}: VirtualizedGroupTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  // Calculate minimum width for a column based on header label
  // ~8px per character + 24px padding
  const getMinWidthForLabel = (label: string | undefined) => {
    if (!label) return 80;
    return Math.max(80, label.length * 8 + 24);
  };

  // Calculate total width
  const totalWidth = visibleColumnsInOrder.reduce(
    (sum, col) => {
      const configuredWidth = columnWidths[col.key] || 100;
      const minLabelWidth = getMinWidthForLabel(col.label);
      return sum + Math.max(configuredWidth, minLabelWidth);
    },
    0
  );

  // Build CSS grid template from column widths
  // Last column uses minmax to fill available space (no truncation if there's room)
  const gridTemplate = visibleColumnsInOrder
    .map((col, index) => {
      const configuredWidth = columnWidths[col.key] || 100;
      const minLabelWidth = getMinWidthForLabel(col.label);
      const width = Math.max(configuredWidth, minLabelWidth);
      // Last column expands to fill remaining space with minimum 200px
      if (index === visibleColumnsInOrder.length - 1) {
        return `minmax(${Math.max(width, 200)}px, 1fr)`;
      }
      return `${width}px`;
    })
    .join(" ");

  // Calculate container height
  const containerHeight = Math.min(rows.length * ROW_HEIGHT, MAX_CONTAINER_HEIGHT);

  // If no rows, don't render anything (group header still shows count)
  if (rows.length === 0) {
    return null;
  }

  return (
    <div
      key={`data-${fullKey}`}
      className="mb-4 overflow-x-auto"
      style={{ marginLeft: `${(depth + 1) * 24}px`, marginRight: "16px" }}
    >
      {/* Header using CSS Grid */}
      <div
        className="grid bg-muted/50 border-t border-b text-xs font-medium"
        style={{
          gridTemplateColumns: gridTemplate,
          minWidth: totalWidth,
        }}
      >
        {visibleColumnsInOrder.map((column) => (
          <div
            key={column.key}
            className={cn(
              "px-2 py-2 text-left whitespace-nowrap overflow-hidden",
              column.key === "select" && "text-center px-0"
            )}
          >
            {column.key === "select" ? "" : column.label?.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Virtualized rows container */}
      <div
        ref={parentRef}
        style={{
          height: containerHeight,
          overflow: "auto",
          minWidth: totalWidth,
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const rowIndex = virtualRow.index;
            const globalIndex = rowIdToGlobalIndex.get(row.id) ?? rowIndex;

            return (
              <div
                key={virtualRow.key}
                data-row-id={row.id}
                className={cn(
                  "grid border-b border-border/30 text-sm",
                  selectedRows.has(row.id) && "bg-muted/50",
                  isRowInDragRange(row.id) &&
                    !selectedRows.has(row.id) &&
                    "bg-blue-100 dark:bg-blue-900/30",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                style={{
                  gridTemplateColumns: gridTemplate,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => {
                  if (!isEditMode && onRowClick) {
                    onRowClick(row);
                  }
                }}
                onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
                onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
              >
                {visibleColumnsInOrder.map((column, colIndex) => {
                  const isSystemGen = isSystemGeneratedColumn(column);

                  // Get cell value for title tooltip (shows full value on hover)
                  const cellValue = row[column.key];
                  const titleText = cellValue != null && typeof cellValue !== 'object'
                    ? String(cellValue)
                    : undefined;

                  return (
                    <div
                      key={`${column.key}-${colIndex}`}
                      className={cn(
                        "flex items-center px-2 whitespace-nowrap",
                        column.key === "select" && "justify-center px-0",
                        column.key === "actions" && "justify-end"
                      )}
                      style={{
                        ...(isSystemGen &&
                          column.key !== "select" &&
                          column.key !== "actions" && {
                            backgroundColor: SYSTEM_COLUMN_BG,
                          }),
                      }}
                      title={titleText}
                      onClick={(e) => {
                        if (column.key === "select") {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {column.key === "select" ? (
                        <div
                          data-column="select"
                          onMouseDown={(e) =>
                            handleSelectMouseDown(row.id, globalIndex, e)
                          }
                        >
                          <SelectCheckbox
                            checked={selectedRows.has(row.id)}
                            onCheckedChange={getToggleCallback(row.id)}
                          />
                        </div>
                      ) : (
                        renderCellValue(row, column)
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default VirtualizedGroupTable;
