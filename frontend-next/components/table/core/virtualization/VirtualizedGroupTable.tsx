"use client";

/**
 * VirtualizedGroupTable - Virtualized table for grouped views
 *
 * Extracted from TeeemTableView.tsx as part of Phase 2 refactoring.
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

// Row height constant (matches h-7 = 1.75rem = 28px)
const ROW_HEIGHT = 28;
// Max container height (limits visible rows before scrolling)
const MAX_CONTAINER_HEIGHT = 500;
// Extra rows rendered above/below viewport for smooth scrolling
const OVERSCAN_COUNT = 5;

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
  renderTableHeader,
  isEditMode,
}: VirtualizedGroupTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  // Calculate total width for proper column sizing
  const totalWidth = visibleColumnsInOrder.reduce(
    (sum, col) => sum + (columnWidths[col.key] || 100),
    0
  );

  // Generate colgroup for consistent column widths
  const colGroup = (
    <colgroup>
      {visibleColumnsInOrder.map((col) => (
        <col key={col.key} style={{ width: columnWidths[col.key] || 100 }} />
      ))}
    </colgroup>
  );

  return (
    <div
      key={`data-${fullKey}`}
      className="mb-4 overflow-x-auto"
      style={{ marginLeft: `${(depth + 1) * 24}px`, marginRight: "16px" }}
    >
      <Table className="border-t border-b" style={{ tableLayout: "fixed", width: totalWidth, minWidth: "100%" }}>
        {colGroup}
        {renderTableHeader()}
        <TableBody>
          <tr>
            <td colSpan={visibleColumnsInOrder.length} style={{ padding: 0 }}>
              <div
                ref={parentRef}
                style={{
                  height: `${Math.min(rows.length * ROW_HEIGHT, MAX_CONTAINER_HEIGHT)}px`,
                  overflow: "auto",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: totalWidth,
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
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <table style={{ width: totalWidth, tableLayout: "fixed" }}>
                          {colGroup}
                          <tbody>
                            <TableRow
                              data-row-id={row.id}
                              className={cn(
                                selectedRows.has(row.id) && "bg-muted/50",
                                isRowInDragRange(row.id) &&
                                  !selectedRows.has(row.id) &&
                                  "bg-blue-100 dark:bg-blue-900/30",
                                "hover:bg-muted/30 cursor-pointer"
                              )}
                              onClick={() => {
                                console.log(
                                  "🟣 TeeemTableView row clicked, isEditMode:",
                                  isEditMode,
                                  "hasOnRowClick:",
                                  !!onRowClick
                                );
                                if (!isEditMode && onRowClick) {
                                  console.log("🟣 Calling onRowClick with row:", row.id);
                                  onRowClick(row);
                                }
                              }}
                              onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
                              onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
                            >
                              {visibleColumnsInOrder.map((column, colIndex) => {
                                const stickyStyles = getStickyColumnStyles(column.key, false);
                                const isSystemGen = isSystemGeneratedColumn(column);
                                return (
                                  <TableCell
                                    key={`${column.key}-${colIndex}`}
                                    style={{
                                      width: columnWidths[column.key],
                                      minWidth: columnWidths[column.key],
                                      ...stickyStyles,
                                      ...(isSystemGen &&
                                        column.key !== "select" &&
                                        column.key !== "actions" && {
                                          backgroundColor: SYSTEM_COLUMN_BG,
                                        }),
                                    }}
                                    className={cn(
                                      "text-left", // Ensure left alignment for all cells
                                      column.key === "select" && "!border-r-0 !p-0 !h-full text-center",
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
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            </td>
          </tr>
        </TableBody>
      </Table>
    </div>
  );
});

export default VirtualizedGroupTable;
