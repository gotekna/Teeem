"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Check,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import type { ColumnPriority } from "@/lib/column-priority";
import { getColumnTypeLabel, getColumnTypeIcon } from "@/lib/column-types";

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
  onToggleVisibility: () => void;
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
  onToggleVisibility,
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
  const [isEditingPosition, setIsEditingPosition] = React.useState(false);
  const [positionValue, setPositionValue] = React.useState(String(index || 1));
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditingPosition && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingPosition]);

  const handlePositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReorder && index !== undefined) {
      setPositionValue(String(index));
      setIsEditingPosition(true);
    }
  };

  const handlePositionSubmit = () => {
    const newPos = parseInt(positionValue, 10);
    if (!isNaN(newPos) && newPos >= 1 && newPos <= (totalVisible || 999) && onReorder) {
      onReorder(newPos);
    }
    setIsEditingPosition(false);
  };

  const handlePositionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePositionSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingPosition(false);
      setPositionValue(String(index || 1));
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all relative",
        isVisible ? "bg-background border-border" : "bg-muted/30 border-border",
        isSystemColumn && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50",
        isDragging && "opacity-50 shadow-lg scale-105 z-50 border-primary bg-primary/10",
        shouldShowDropIndicator && !isDragging && "border-t-4 border-t-primary pt-3 mt-1"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      {index !== undefined && (
        isEditingPosition ? (
          <input
            ref={inputRef}
            type="text"
            value={positionValue}
            onChange={(e) => setPositionValue(e.target.value)}
            onBlur={handlePositionSubmit}
            onKeyDown={handlePositionKeyDown}
            className="w-6 h-5 text-[10px] font-medium text-center bg-background border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            onClick={handlePositionClick}
            className="flex items-center justify-center w-5 h-5 text-[9px] font-medium bg-muted hover:bg-primary/20 hover:text-primary rounded cursor-pointer transition-colors"
            title="Click to change position"
          >
            {index}
          </button>
        )
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
