"use client";

/**
 * KanbanCard - Draggable card component for Kanban board
 *
 * THE ONE component for cards in a Kanban board.
 * Wraps content with drag-and-drop functionality.
 *
 * Usage:
 * ```tsx
 * import { KanbanCard } from "@/components/ui/kanban";
 *
 * <KanbanCard id={task.id} onClick={handleClick} onDoubleClick={handleDoubleClick}>
 *   <div className="p-3">
 *     <h4>{task.name}</h4>
 *     <p>{task.description}</p>
 *   </div>
 * </KanbanCard>
 * ```
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import type { KanbanCardProps } from "./types";

export function KanbanCard({
  id,
  children,
  isDragging: isDraggingProp,
  disabled = false,
  className,
  onClick,
  onDoubleClick,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id,
    disabled,
  });

  const isDragging = isDraggingProp ?? isSortableDragging;

  // Track if drag occurred to prevent click after drag
  const dragOccurredRef = React.useRef(false);
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Handle pointer down - track start position
  const handlePointerDown = (e: React.PointerEvent) => {
    dragOccurredRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    // Call dnd-kit's pointer down handler
    listeners?.onPointerDown?.(e);
  };

  // Handle pointer move - detect if drag threshold exceeded
  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartRef.current) {
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 5 || dy > 5) {
        dragOccurredRef.current = true;
      }
    }
  };

  // Handle click - only fire if drag didn't occur
  const handleClick = (e: React.MouseEvent) => {
    if (!dragOccurredRef.current && onClick) {
      onClick(e);
    }
    pointerStartRef.current = null;
  };

  // Handle double-click - browser only fires dblclick for actual double-clicks (not drags)
  // No need to check dragOccurredRef since the browser handles this distinction
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (onDoubleClick) {
      e.preventDefault();
      e.stopPropagation();
      onDoubleClick(e);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group relative rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-all duration-200 touch-none",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50",
        !disabled && "cursor-grab active:cursor-grabbing",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {/* Drag handle indicator - visible on hover */}
      {!disabled && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground pointer-events-none"
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Card content */}
      <div className={cn(!disabled && "pl-1")}>
        {children}
      </div>
    </div>
  );
}
