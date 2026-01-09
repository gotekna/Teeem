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
 * <KanbanCard id={task.id}>
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-all duration-200",
        isDragging && "opacity-50 shadow-lg scale-[1.02] z-50",
        !disabled && "cursor-grab active:cursor-grabbing",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {/* Drag handle overlay - visible on hover */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-grab active:cursor-grabbing touch-none",
            "text-muted-foreground hover:text-foreground"
          )}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* Card content */}
      <div className={cn(!disabled && "pl-2")}>
        {children}
      </div>
    </div>
  );
}
