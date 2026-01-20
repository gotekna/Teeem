"use client";

/**
 * SimpleTableView - Lightweight view-only table component
 *
 * THE ONE component for displaying read-only table data without Foundation.
 * Looks identical to TeeemTableView but is much simpler (~400 lines vs 2500).
 * See: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - Same styling as TeeemTableView
 * - Virtualization for large datasets
 * - Single-column sorting
 * - Column resizing
 * - Custom cell rendering
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * import { SimpleTableView } from "@/components/table";
 *
 * <SimpleTableView
 *   tableName="Accounts"
 *   entries={accounts}
 *   columns={[
 *     { key: "code", label: "Code", width: 100 },
 *     { key: "name", label: "Name" },
 *     { key: "amount", label: "Amount", type: "currency", align: "right" },
 *   ]}
 *   onRowClick={(row) => console.log(row)}
 * />
 * ```
 */

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export type SimpleColumnType =
  | "single_line_text"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "date_and_time"
  | "boolean"
  | "email"
  | "phone"
  | "url";

export interface SimpleColumn {
  /** Unique key matching the data field */
  key: string;
  /** Display label for header */
  label: string;
  /** Column type for formatting (default: single_line_text) */
  type?: SimpleColumnType;
  /** Fixed width in pixels */
  width?: number;
  /** Minimum width in pixels (default: 50) */
  minWidth?: number;
  /** Text alignment (default: left) */
  align?: "left" | "center" | "right";
  /** Whether column is sortable (default: true) */
  sortable?: boolean;
}

export interface SimpleTableViewProps<T extends Record<string, unknown>> {
  /** Array of data entries */
  entries: T[];
  /** Column definitions */
  columns: SimpleColumn[];
  /** Table name displayed in header */
  tableName?: string;
  /** Show header row (default: true) */
  showHeader?: boolean;
  /** Show footer with record count (default: true) */
  showFooter?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional className */
  className?: string;
  /** Enable sorting (default: true) */
  sortable?: boolean;
  /** Enable export button (default: false) */
  enableExport?: boolean;
  /** Export handler */
  onExport?: () => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row double-click handler */
  onRowDoubleClick?: (row: T) => void;
  /** Left side actions (buttons) */
  leftActions?: React.ReactNode;
  /** Right side actions (buttons) */
  rightActions?: React.ReactNode;
  /** Custom cell renderer */
  customCellRenderer?: (
    column: SimpleColumn,
    value: unknown,
    row: T
  ) => React.ReactNode | null;
  /** Row height in pixels (default: 28) */
  rowHeight?: number;
  /** Get unique row ID (default: uses 'id' field or index) */
  getRowId?: (row: T, index: number) => string | number;
}

// =============================================================================
// CELL FORMATTERS
// =============================================================================

function formatCellValue(
  value: unknown,
  type: SimpleColumnType = "single_line_text"
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (type) {
    case "currency":
      if (typeof value === "number") {
        return `$${value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
      return String(value);

    case "number":
      if (typeof value === "number") {
        return value.toLocaleString();
      }
      return String(value);

    case "percentage":
      if (typeof value === "number") {
        return `${value.toFixed(1)}%`;
      }
      return String(value);

    case "date":
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      if (typeof value === "string") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }
      return String(value);

    case "date_and_time":
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      if (typeof value === "string") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString();
        }
      }
      return String(value);

    case "boolean":
      return value ? (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 text-[10px]"
        >
          Yes
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px]"
        >
          No
        </Badge>
      );

    case "email":
      return (
        <a
          href={`mailto:${value}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case "phone":
      return (
        <a
          href={`tel:${value}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    default:
      return String(value);
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SimpleTableView<T extends Record<string, unknown>>({
  entries,
  columns,
  tableName,
  showHeader = true,
  showFooter = true,
  emptyMessage = "No records found",
  className,
  sortable = true,
  enableExport = false,
  onExport,
  onRowClick,
  onRowDoubleClick,
  leftActions,
  rightActions,
  customCellRenderer,
  rowHeight = 28,
  getRowId,
}: SimpleTableViewProps<T>) {
  // State
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "asc"
  );
  const [columnWidths, setColumnWidths] = React.useState<
    Record<string, number>
  >({});
  const [resizingColumn, setResizingColumn] = React.useState<string | null>(
    null
  );

  // Refs
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Sort data
  const sortedEntries = React.useMemo(() => {
    if (!sortColumn || !sortable) return entries;

    return [...entries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle nulls
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      // Compare
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [entries, sortColumn, sortDirection, sortable]);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Handlers
  const handleSort = (columnKey: string) => {
    if (!sortable) return;
    const column = columns.find((c) => c.key === columnKey);
    if (column?.sortable === false) return;

    if (sortColumn === columnKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const handleResizeStart = (
    columnKey: string,
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.preventDefault();
    setResizingColumn(columnKey);

    const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const column = columns.find((c) => c.key === columnKey);
    const startWidth = columnWidths[columnKey] || column?.width || 150;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX =
        "touches" in moveEvent
          ? moveEvent.touches[0].clientX
          : moveEvent.clientX;
      const delta = currentX - startX;
      const newWidth = Math.max(
        column?.minWidth || 50,
        startWidth + delta
      );
      setColumnWidths((prev) => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleEnd = () => {
      setResizingColumn(null);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove);
    document.addEventListener("touchend", handleEnd);
  };

  const getColumnWidth = (column: SimpleColumn) => {
    return columnWidths[column.key] || column.width || 150;
  };

  const totalWidth = columns.reduce(
    (sum, col) => sum + getColumnWidth(col),
    0
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full border rounded-lg bg-background overflow-hidden",
        className
      )}
    >
      {/* Header */}
      {showHeader && (tableName || leftActions || rightActions || enableExport) && (
        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {leftActions}
            {tableName && (
              <>
                <h3 className="text-sm font-semibold">{tableName}</h3>
                <span className="text-sm text-muted-foreground">
                  {sortedEntries.length} records
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {rightActions}
            {enableExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {sortedEntries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div
            ref={parentRef}
            className="h-full overflow-auto"
            style={{ contain: "strict" }}
          >
            <div style={{ minWidth: totalWidth }}>
              {/* Column Headers */}
              <div
                className="sticky top-0 z-10 flex bg-muted/50 border-b"
                style={{ height: rowHeight }}
              >
                {columns.map((column) => {
                  const width = getColumnWidth(column);
                  const isSorted = sortColumn === column.key;
                  const canSort = sortable && column.sortable !== false;

                  return (
                    <div
                      key={column.key}
                      className={cn(
                        "relative flex items-center px-2 text-[11px] font-medium select-none border-r last:border-r-0",
                        canSort && "cursor-pointer hover:bg-muted/70",
                        column.align === "right" && "justify-end",
                        column.align === "center" && "justify-center"
                      )}
                      style={{ width, minWidth: column.minWidth || 50 }}
                      onClick={() => handleSort(column.key)}
                    >
                      <span className="truncate">{column.label}</span>
                      {canSort && (
                        <span className="ml-1 shrink-0">
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="h-3 w-3 text-primary" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-primary" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                          )}
                        </span>
                      )}
                      {/* Resize Handle */}
                      <div
                        className={cn(
                          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50",
                          resizingColumn === column.key && "bg-primary"
                        )}
                        onMouseDown={(e) => handleResizeStart(column.key, e)}
                        onTouchStart={(e) => handleResizeStart(column.key, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Virtual Rows */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = sortedEntries[virtualRow.index];
                  const rowId = getRowId
                    ? getRowId(row, virtualRow.index)
                    : (row.id as string | number) ?? virtualRow.index;

                  return (
                    <div
                      key={rowId}
                      className={cn(
                        "absolute left-0 right-0 flex border-b",
                        "hover:bg-accent/50",
                        virtualRow.index % 2 === 1 && "bg-muted/20",
                        (onRowClick || onRowDoubleClick) && "cursor-pointer"
                      )}
                      style={{
                        height: rowHeight,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => onRowClick?.(row)}
                      onDoubleClick={() => onRowDoubleClick?.(row)}
                    >
                      {columns.map((column) => {
                        const width = getColumnWidth(column);
                        const value = row[column.key];

                        // Custom renderer
                        const customContent = customCellRenderer?.(
                          column,
                          value,
                          row
                        );

                        return (
                          <div
                            key={column.key}
                            className={cn(
                              "flex items-center px-2 text-[11px] border-r last:border-r-0 overflow-hidden",
                              column.align === "right" && "justify-end",
                              column.align === "center" && "justify-center"
                            )}
                            style={{ width, minWidth: column.minWidth || 50 }}
                          >
                            <span className="truncate">
                              {customContent !== null && customContent !== undefined
                                ? customContent
                                : formatCellValue(value, column.type)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {showFooter && (
        <div className="px-4 py-2 border-t text-xs text-muted-foreground shrink-0">
          Showing {sortedEntries.length} of {entries.length} records
        </div>
      )}
    </div>
  );
}
