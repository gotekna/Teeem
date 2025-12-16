"use client";

import React, { useState, useRef, useCallback, useEffect, memo } from "react";
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
  X,
  Filter,
  Layers,
  EyeOff,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TableColumn, SortColumn } from "../types";

interface ResizableColumnHeaderProps {
  column: TableColumn;
  width: number;
  onResize: (key: string, width: number) => void;
  onSort: (key: string) => void;
  onHide: (key: string) => void;
  onGroupBy: (key: string | null) => void;
  onAddFilter: (key: string) => void;
  onEdit?: (key: string) => void;
  sortInfo?: SortColumn;
  isGroupedBy: boolean;
  isEditMode?: boolean;
  children: React.ReactNode;
}

export const ResizableColumnHeader = memo(function ResizableColumnHeader({
  column,
  width,
  onResize,
  onSort,
  onHide,
  onGroupBy,
  onAddFilter,
  onEdit,
  sortInfo,
  isGroupedBy,
  isEditMode,
  children,
}: ResizableColumnHeaderProps) {
  // Default width if not provided
  const effectiveWidth = width || 100;

  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(effectiveWidth);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Measure actual width from DOM when hovering (more accurate than prop)
  useEffect(() => {
    if (isHoveringHandle && containerRef.current) {
      // Get the parent TableHead cell's width
      const parentCell = containerRef.current.closest('th');
      if (parentCell) {
        setMeasuredWidth(parentCell.getBoundingClientRect().width);
      }
    }
  }, [isHoveringHandle]);

  // Sync width when prop changes (not during resize)
  useEffect(() => {
    if (!isResizing && effectiveWidth) {
      setCurrentWidth(effectiveWidth);
    }
  }, [effectiveWidth, isResizing]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Measure actual width at start of resize
      const parentCell = containerRef.current?.closest('th');
      const actualWidth = parentCell ? parentCell.getBoundingClientRect().width : effectiveWidth;
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = actualWidth;
      setCurrentWidth(actualWidth);
    },
    [effectiveWidth]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + diff);
      setCurrentWidth(newWidth);
      onResize(column.key, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Add resize cursor to body while resizing
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, column.key, onResize]);

  // Determine sort direction labels based on column type
  const getSortLabel = (dir: "asc" | "desc") => {
    const numericTypes = ["number", "whole_number", "currency", "percentage", "computed"];
    if (column.column_type && numericTypes.includes(column.column_type)) {
      return dir === "asc" ? "Sort 1 → 9" : "Sort 9 → 1";
    }
    const dateTypes = ["date", "date_and_time"];
    if (column.column_type && dateTypes.includes(column.column_type)) {
      return dir === "asc" ? "Sort Old → New" : "Sort New → Old";
    }
    if (column.column_type === "boolean") {
      return dir === "asc" ? "Sort ☐ → ☑" : "Sort ☑ → ☐";
    }
    return dir === "asc" ? "Sort A → Z" : "Sort Z → A";
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-between group relative overflow-visible w-full"
    >
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1 flex-1 min-w-0 cursor-pointer hover:text-foreground",
              sortInfo && "text-primary"
            )}
          >
            {children}
            {sortInfo && (
              sortInfo.dir === "asc" ? (
                <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
              ) : (
                <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
              )
            )}
            {isGroupedBy && (
              <Layers className="h-3 w-3 shrink-0 text-purple-500" />
            )}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {/* Sort options */}
          {column.sortable !== false && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onSort(column.key);
                  setDropdownOpen(false);
                }}
                className={cn(sortInfo?.dir === "asc" && "bg-muted")}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                {getSortLabel("asc")}
                {sortInfo?.dir === "asc" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // If already asc, click again to go desc
                  if (sortInfo?.dir === "asc") {
                    onSort(column.key);
                  } else if (!sortInfo) {
                    // Sort asc first, then desc
                    onSort(column.key);
                    onSort(column.key);
                  }
                  setDropdownOpen(false);
                }}
                className={cn(sortInfo?.dir === "desc" && "bg-muted")}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                {getSortLabel("desc")}
                {sortInfo?.dir === "desc" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              {sortInfo && (
                <DropdownMenuItem
                  onClick={() => {
                    // Clear sort by clicking until removed
                    if (sortInfo.dir === "asc") {
                      onSort(column.key); // asc -> desc
                      onSort(column.key); // desc -> removed
                    } else {
                      onSort(column.key); // desc -> removed
                    }
                    setDropdownOpen(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Sort
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Filter option */}
          {column.filterable !== false && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onAddFilter(column.key);
                  setDropdownOpen(false);
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter by this column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Group by option */}
          <DropdownMenuItem
            onClick={() => {
              onGroupBy(isGroupedBy ? null : column.key);
              setDropdownOpen(false);
            }}
            className={cn(isGroupedBy && "bg-muted")}
          >
            <Layers className="h-4 w-4 mr-2" />
            {isGroupedBy ? "Remove Grouping" : "Group by this column"}
            {isGroupedBy && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Hide column */}
          <DropdownMenuItem
            onClick={() => {
              onHide(column.key);
              setDropdownOpen(false);
            }}
          >
            <EyeOff className="h-4 w-4 mr-2" />
            Hide column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit column button - outside dropdown trigger */}
      {isEditMode && onEdit && column.key !== "id" && column.key !== "created_at" && column.key !== "updated_at" && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(column.key);
          }}
          className="p-1 rounded hover:bg-muted ml-1 flex-shrink-0 z-10"
          title="Edit column settings"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}

      {/* Resize handle - large hit area on right edge of cell */}
      {column.resizable !== false && (
        <div
          className="absolute -right-[12px] -top-2 -bottom-2 w-[24px] cursor-col-resize z-20"
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHoveringHandle(true)}
          onMouseLeave={() => setIsHoveringHandle(false)}
          title="Drag to resize column"
        >
          {/* The visible line indicator - thin line at column border */}
          <div className={cn(
            "absolute left-[11px] w-[2px] top-2 bottom-2 transition-all",
            (isHoveringHandle || isResizing)
              ? "bg-primary -top-1 -bottom-1"
              : "bg-border/50"
          )} />
        </div>
      )}

      {/* Width indicator badge - shows during resize or hover */}
      {column.resizable !== false && (isResizing || isHoveringHandle) && (
        <div
          className={cn(
            "absolute px-2 py-1 text-xs font-mono rounded shadow-lg whitespace-nowrap pointer-events-none border",
            isResizing
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground"
          )}
          style={{
            top: '100%',
            right: 0,
            marginTop: '4px',
            zIndex: 9999,
          }}
        >
          {Math.round(isResizing ? currentWidth : (measuredWidth || effectiveWidth))}px
        </div>
      )}
    </div>
  );
});
