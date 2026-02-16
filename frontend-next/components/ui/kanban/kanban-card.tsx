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
import { ItemBadge } from "@/components/ui/dnd";
import type { KanbanCardProps } from "./types";

export function KanbanCard({
  id,
  children,
  isDragging: isDraggingProp,
  disabled = false,
  className,
  onClick,
  onDoubleClick,
  // Position badge props (SSoT)
  position,
  maxPosition,
  positionEditable = false,
  onPositionChange,
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
    data: { type: "card", cardId: id },
  });

  const isDragging = isDraggingProp ?? isSortableDragging;

  // Track if drag occurred to prevent click after drag
  const dragOccurredRef = React.useRef(false);
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // ⚠️ DO NOT SIMPLIFY - PointerDown-based double-click detection (Feb 2026)
  // ════════════════════════════════════════════════════════════════════════
  // Why: dnd-kit's useSortable captures pointer events and can call
  //      preventDefault(), which prevents the browser from generating
  //      click/dblclick events ~20% of the time. By detecting double-click
  //      from pointerDown timing ourselves, we bypass this entirely.
  // ❌ WRONG: Rely on browser onDoubleClick event (blocked by dnd-kit)
  // ✅ CORRECT: Track pointerDown timestamps, detect double-tap ourselves
  // ════════════════════════════════════════════════════════════════════════
  const lastPointerDownRef = React.useRef<number>(0);
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Handle pointer down - track start position AND detect double-click
  const handlePointerDown = (e: React.PointerEvent) => {
    dragOccurredRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    // Detect double-click from pointerDown timing (bypass browser dblclick)
    const now = Date.now();
    const timeSinceLast = now - lastPointerDownRef.current;
    lastPointerDownRef.current = now;

    if (timeSinceLast < 400 && onDoubleClick) {
      // Double-click detected! Cancel pending single-click and fire immediately
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      // Fire double-click handler (synthesize a MouseEvent-like object)
      onDoubleClick(e as unknown as React.MouseEvent);
      // Reset to prevent triple-click from firing another double-click
      lastPointerDownRef.current = 0;
      // Don't forward to dnd-kit - this is a double-click, not a drag
      return;
    }

    // Call dnd-kit's pointer down handler (single click / potential drag)
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

  // Handle click - delay to distinguish from double-click
  const handleClick = (e: React.MouseEvent) => {
    if (dragOccurredRef.current) {
      pointerStartRef.current = null;
      return;
    }

    // Clear any pending click timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    // Delay single-click to allow double-click detection from pointerDown
    if (onClick) {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        onClick(e);
      }, 250);
    }
    pointerStartRef.current = null;
  };

  // Keep onDoubleClick handler as fallback (fires when browser does generate the event)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

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
      {/* Drag handle indicator - always visible */}
      {!disabled && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center",
            "text-muted-foreground/50 pointer-events-none"
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Card content with optional position badge */}
      <div className={cn("flex items-center gap-1", !disabled && "pl-1")}>
        {/* Position badge (SSoT) - shown when position is provided */}
        {position !== undefined && (
          <div className="shrink-0 pl-4">
            <ItemBadge
              position={position}
              size="sm"
              editable={positionEditable}
              onPositionChange={onPositionChange}
              maxPosition={maxPosition}
            />
          </div>
        )}
        {/* Card children content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
