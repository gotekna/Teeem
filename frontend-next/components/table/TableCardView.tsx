"use client";

/**
 * TableCardView - Mobile Card Layout for Tables
 *
 * Renders table rows as cards on mobile devices.
 * Shows key fields prominently with option to expand for full details.
 *
 * Uses column priority system to determine which fields to display:
 * - Title: First 'essential' column (name, title, company_name)
 * - Key fields: 2-3 'supporting' columns (status, date, amount)
 * - Status badge if status column present
 */

import React, { useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getColumnPriority, type ColumnPriority } from "@/lib/column-priority";
import { type TableColumn, type TableRow } from "./types";
import { renderCell as renderCellWithRegistry } from "./core/column-renderer/ColumnRenderer";
import { formatValue } from "@/lib/formatters/display-formatters";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface TableCardViewProps {
  /** Rows to display as cards */
  rows: TableRow[];
  /** Column definitions */
  columns: TableColumn[];
  /** Selected row IDs */
  selectedRows?: Set<number | string>;
  /** Toggle row selection */
  onSelectRow?: (id: number | string) => void;
  /** View row details */
  onView?: (row: TableRow) => void;
  /** Edit row */
  onEdit?: (row: TableRow) => void;
  /** Delete row */
  onDelete?: (row: TableRow) => void;
  /** Row click handler */
  onRowClick?: (row: TableRow) => void;
  /** Row double click handler */
  onRowDoubleClick?: (row: TableRow) => void;
  /** View only mode (no edit/delete) */
  viewOnly?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Search term for highlighting */
  searchTerm?: string;
  /** Custom cell renderer override */
  customCellRenderer?: (entry: TableRow, columnKey: string) => React.ReactNode | null;
  /** Maximum key fields to show (default: 3) */
  maxKeyFields?: number;
  /** Empty state message */
  emptyMessage?: string;
}

interface CardColumn {
  column: TableColumn;
  priority: ColumnPriority;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Categorize columns by priority for card display
 */
function categorizeColumns(columns: TableColumn[]): {
  titleColumn: TableColumn | null;
  keyColumns: TableColumn[];
  statusColumn: TableColumn | null;
  allColumns: CardColumn[];
} {
  const categorized: CardColumn[] = columns
    .filter(col => col.key !== "id" && !col.system && !col.defaultHidden)
    .map(col => ({
      column: col,
      priority: getColumnPriority(col.key, col.column_type),
    }));

  // Find title column (first essential column, preferring name/title)
  const essentialCols = categorized.filter(c => c.priority === "essential");
  const titleColumn = essentialCols.find(c =>
    /^(name|title|display_name|subject)$/i.test(c.column.key)
  )?.column || essentialCols[0]?.column || null;

  // Find status column
  const statusColumn = columns.find(col =>
    col.key === "status" ||
    col.column_type === "status" ||
    /status$/i.test(col.key)
  ) || null;

  // Get key columns (supporting priority, excluding status and title)
  const keyColumns = categorized
    .filter(c =>
      c.priority === "supporting" &&
      c.column.key !== statusColumn?.key &&
      c.column.key !== titleColumn?.key
    )
    .map(c => c.column)
    .slice(0, 5); // Get up to 5 for selection

  return {
    titleColumn,
    keyColumns,
    statusColumn,
    allColumns: categorized,
  };
}

/**
 * Get display value for a cell - returns React.ReactNode for rendering
 */
function getDisplayValue(
  row: TableRow,
  column: TableColumn,
  customCellRenderer?: (entry: TableRow, columnKey: string) => React.ReactNode | null
): React.ReactNode {
  // Check for custom renderer first
  if (customCellRenderer) {
    const customValue = customCellRenderer(row, column.key);
    if (customValue !== null && customValue !== undefined) {
      return customValue as React.ReactNode;
    }
  }

  const value = row[column.key];

  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Use the column renderer for complex types
  if (column.column_type) {
    try {
      const rendered = renderCellWithRegistry(value, column, row, "display");
      if (rendered !== null && rendered !== undefined) {
        return rendered as React.ReactNode;
      }
    } catch {
      // Fall back to simple display
    }
  }

  // Simple string display using formatValue
  const formatted = formatValue(value, column.column_type || "single_line_text");
  return formatted as React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════
// Card Component
// ═══════════════════════════════════════════════════════════════════════════

interface TableCardProps {
  row: TableRow;
  titleColumn: TableColumn | null;
  keyColumns: TableColumn[];
  statusColumn: TableColumn | null;
  allColumns: CardColumn[];
  isSelected: boolean;
  onSelect?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  viewOnly?: boolean;
  customCellRenderer?: (entry: TableRow, columnKey: string) => React.ReactNode | null;
  maxKeyFields: number;
}

function TableCard({
  row,
  titleColumn,
  keyColumns,
  statusColumn,
  allColumns,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onClick,
  onDoubleClick,
  viewOnly,
  customCellRenderer,
  maxKeyFields,
}: TableCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Get title - either from title column or use default fallback
  // Cast required due to TS strict mode with React 19 types
  const titleNode = (titleColumn
    ? getDisplayValue(row, titleColumn, customCellRenderer)
    : String(row.id ? `Record #${row.id}` : "Untitled")) as React.ReactNode;

  // Get status value and color
  const statusValue = statusColumn ? row[statusColumn.key] : null;
  const statusColor = useMemo(() => {
    if (!statusValue || typeof statusValue !== "string") return null;
    const status = statusValue.toLowerCase();
    if (status.includes("complet") || status.includes("done") || status.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
    if (status.includes("pending") || status.includes("wait") || status.includes("progress")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
    if (status.includes("cancel") || status.includes("fail") || status.includes("error")) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }, [statusValue]);

  // Handle card tap
  const handleTap = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (onView) {
      onView();
    }
  }, [onClick, onView]);

  // Visible key fields (limited)
  const visibleKeyColumns = keyColumns.slice(0, maxKeyFields);

  // Expanded columns (all non-hidden, non-technical)
  const expandedColumns = useMemo(() => {
    if (!expanded) return [];
    return allColumns
      .filter(c =>
        c.priority !== "hidden" &&
        c.priority !== "technical" &&
        c.column.key !== titleColumn?.key &&
        c.column.key !== statusColumn?.key &&
        !visibleKeyColumns.some(kc => kc.key === c.column.key)
      )
      .map(c => c.column);
  }, [expanded, allColumns, titleColumn, statusColumn, visibleKeyColumns]);

  return (
    <div
      className={cn(
        "bg-card border rounded-lg p-4 transition-all duration-200",
        "active:scale-[0.98] touch-manipulation",
        isSelected && "ring-2 ring-primary border-primary",
        !viewOnly && "cursor-pointer"
      )}
      onClick={handleTap}
      onDoubleClick={onDoubleClick}
    >
      {/* Header: Title + Status + Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-base truncate">{titleNode}</h3>

          {/* Status badge */}
          {statusValue !== null && statusValue !== undefined && statusColor && (
            <Badge
              className={cn("mt-1 text-xs", statusColor)}
              variant="secondary"
            >
              {String(statusValue)}
            </Badge>
          )}
        </div>

        {/* Actions dropdown */}
        {(!viewOnly && (onView || onEdit || onDelete)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Key Fields */}
      <div className="space-y-2">
        {visibleKeyColumns.map(column => (
          <div key={column.key} className="flex justify-between items-start gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">{column.label}</span>
            <span className="text-right truncate font-medium">
              {getDisplayValue(row, column, customCellRenderer)}
            </span>
          </div>
        ))}
      </div>

      {/* Expand/Collapse for more fields */}
      {allColumns.length > visibleKeyColumns.length + 2 && (
        <button
          className={cn(
            "flex items-center justify-center w-full mt-3 pt-2",
            "border-t text-sm text-muted-foreground",
            "hover:text-foreground transition-colors"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-4 w-4 mr-1" />
              Show more ({expandedColumns.length + (expanded ? 0 : allColumns.length - visibleKeyColumns.length - 2)} fields)
            </>
          )}
        </button>
      )}

      {/* Expanded Fields */}
      {expanded && expandedColumns.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {expandedColumns.map(column => (
            <div key={column.key} className="flex justify-between items-start gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">{column.label}</span>
              <span className="text-right truncate">
                {getDisplayValue(row, column, customCellRenderer)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function TableCardView({
  rows,
  columns,
  selectedRows = new Set(),
  onSelectRow,
  onView,
  onEdit,
  onDelete,
  onRowClick,
  onRowDoubleClick,
  viewOnly = false,
  loading = false,
  searchTerm,
  customCellRenderer,
  maxKeyFields = 3,
  emptyMessage = "No records found",
}: TableCardViewProps) {
  // Categorize columns for card display
  const { titleColumn, keyColumns, statusColumn, allColumns } = useMemo(
    () => categorizeColumns(columns),
    [columns]
  );

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border rounded-lg p-4 animate-pulse">
            <div className="h-5 bg-muted rounded w-3/4 mb-3" />
            <div className="h-4 bg-muted rounded w-1/4 mb-3" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {rows.map(row => (
        <TableCard
          key={row.id}
          row={row}
          titleColumn={titleColumn}
          keyColumns={keyColumns}
          statusColumn={statusColumn}
          allColumns={allColumns}
          isSelected={selectedRows.has(row.id)}
          onSelect={onSelectRow ? () => onSelectRow(row.id) : undefined}
          onView={onView ? () => onView(row) : undefined}
          onEdit={onEdit ? () => onEdit(row) : undefined}
          onDelete={onDelete ? () => onDelete(row) : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
          viewOnly={viewOnly}
          customCellRenderer={customCellRenderer}
          maxKeyFields={maxKeyFields}
        />
      ))}
    </div>
  );
}

export default TableCardView;
