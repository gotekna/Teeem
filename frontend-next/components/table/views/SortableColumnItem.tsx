"use client";

/**
 * SortableColumnItem - Sortable item for table columns
 *
 * Uses DnD primitives from @/components/ui/dnd for consistency.
 * See: frontend-next/lib/component-registry.ts
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  EyeOff,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import type { ColumnPriority } from "@/lib/column-priority";
import { getColumnTypeLabel, getColumnTypeIcon } from "@/lib/column-types";

// DnD Primitives - SSoT for drag and drop UI
import { DragHandle, PositionBadge, DRAGGING_CLASSES, DROP_TARGET_CLASSES } from "@/components/ui/dnd";

interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
  position?: number;
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  available_choices?: { id: number; value: string }[] | string[];
}

interface SortableColumnItemProps {
  id: string;
  column: Column;
  isVisible: boolean;
  isSearchable?: boolean;
  onToggleVisibility: () => void;
  onToggleSearchable?: () => void;
  index?: number;
  totalVisible?: number;
  onReorder?: (newIndex: number) => void;
  showWidthInput?: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
  isOver?: boolean;
  smartFit?: boolean;
  priority?: ColumnPriority;
  smartWidth?: number;
  lookupFoundationName?: string; // Name of the foundation this lookup links to
}

export function SortableColumnItem({
  id,
  column,
  isVisible,
  isSearchable,
  onToggleVisibility,
  onToggleSearchable,
  index,
  totalVisible,
  onReorder,
  showWidthInput,
  width,
  onWidthChange,
  isOver,
  smartFit,
  priority,
  smartWidth,
  lookupFoundationName,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver: isSortableOver,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Use the passed isOver prop or fallback to sortable's isOver
  const shouldShowDropIndicator = isOver ?? isSortableOver;

  const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(column.column_name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all relative",
        isVisible ? "bg-background border-border" : "bg-muted/30 border-border",
        isSystemColumn && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50",
        isDragging && DRAGGING_CLASSES,
        shouldShowDropIndicator && !isDragging && DROP_TARGET_CLASSES
      )}
    >
      {/* DnD Primitive: DragHandle */}
      <DragHandle {...attributes} {...listeners} size="sm" />

      {/* DnD Primitive: PositionBadge - editable when onReorder is provided */}
      {index !== undefined && (
        <PositionBadge
          position={index}
          editable={!!onReorder}
          onPositionChange={onReorder}
          maxPosition={totalVisible}
          size="sm"
        />
      )}
      <button
        onClick={onToggleVisibility}
        className="flex flex-col gap-0.5 flex-1 text-left hover:opacity-70 min-w-0"
      >
        <div className="flex items-center gap-1">
          {isVisible ? (
            <Check className="h-3 w-3 text-primary shrink-0" />
          ) : (
            <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className={cn("text-xs font-medium truncate", !isVisible && "text-muted-foreground font-normal")}>
            {column.name || column.column_name}
          </span>
        </div>

        {/* Column type and lookup info */}
        <div className="flex items-center gap-1 ml-4 text-[10px] text-muted-foreground">
          <span className="truncate">{getColumnTypeLabel(column.column_type)}</span>
          {(column.column_type === 'lookup' || column.column_type === 'multiple_lookups') && lookupFoundationName && (
            <span className="truncate">→ {lookupFoundationName}</span>
          )}
          {column.column_type === 'choice' && column.available_choices && (
            <span className="truncate">({Array.isArray(column.available_choices) ? column.available_choices.length : 0} options)</span>
          )}
        </div>
      </button>

      {/* Search toggle - shows if column is included in search */}
      {onToggleSearchable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSearchable();
          }}
          className={cn(
            "shrink-0 p-0.5 rounded transition-colors",
            isSearchable
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
          )}
          title={isSearchable ? "Click to exclude from search" : "Click to include in search"}
        >
          <Search className="h-3 w-3" />
        </button>
      )}

      {/* Priority badge when TEEEM Smart is enabled */}
      {smartFit && priority && (
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1 py-0 h-4",
              priority === 'essential' && "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
              priority === 'supporting' && "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
              priority === 'technical' && "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
            )}
          >
            {priority === 'essential' && '⭐ Key'}
            {priority === 'supporting' && '📊 Data'}
            {priority === 'technical' && '🔧 ID'}
          </Badge>
          {smartWidth && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {smartWidth}px
            </span>
          )}
        </div>
      )}

      {showWidthInput && isVisible && (
        <input
          type="number"
          value={width || ""}
          onChange={(e) => onWidthChange?.(parseInt(e.target.value, 10) || 0)}
          placeholder="150"
          className="w-14 h-5 text-[10px] text-center bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          title="Column width in pixels"
          onClick={(e) => e.stopPropagation()}
          min={40}
          max={500}
        />
      )}
    </div>
  );
}
