"use client";

/**
 * SortableItem - Base sortable item component
 *
 * THE ONE component for individual items in a sortable list.
 * Provides standard drag handle, position badge, and action slots.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { SortableItem } from "@/components/ui/dnd";
 *
 * <SortableItem
 *   id="item-1"
 *   position={1}
 *   editablePosition
 *   onPositionChange={(pos) => reorder(pos)}
 *   actions={<Button>Edit</Button>}
 * >
 *   <span>Item content</span>
 * </SortableItem>
 * ```
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DragHandle } from "./DragHandle";
import { PositionBadge } from "./PositionBadge";
import { DRAGGING_CLASSES, DROP_TARGET_CLASSES } from "./dnd-config";

export interface SortableItemProps {
  /** Unique identifier for the item */
  id: string | number;
  /** Position number to display (1-indexed) */
  position?: number;
  /** Whether the position badge is editable */
  editablePosition?: boolean;
  /** Callback when position is manually changed */
  onPositionChange?: (newPosition: number) => void;
  /** Maximum position (for validation) */
  maxPosition?: number;
  /** Whether this item is selected/active */
  isActive?: boolean;
  /** Whether to show the drag handle */
  showHandle?: boolean;
  /** Whether to show the position badge */
  showPosition?: boolean;
  /** Content to render in the main area */
  children: React.ReactNode;
  /** Actions to render on the right side */
  actions?: React.ReactNode;
  /** Click handler for the entire item */
  onClick?: () => void;
  /** Additional class names for the container */
  className?: string;
  /** Variant style */
  variant?: "card" | "row" | "simple";
  /** Custom styles for different states */
  customStyles?: {
    active?: string;
    dragging?: string;
    dropTarget?: string;
  };
}

const variantClasses = {
  card: "p-2 rounded border bg-background",
  row: "px-3 py-2 border-b bg-background",
  simple: "p-1.5",
};

const variantActiveClasses = {
  card: "bg-primary/10 border-primary",
  row: "bg-primary/5",
  simple: "bg-accent",
};

const variantHoverClasses = {
  card: "hover:border-primary/50",
  row: "hover:bg-accent/50",
  simple: "hover:bg-accent/50",
};

export function SortableItem({
  id,
  position,
  editablePosition = false,
  onPositionChange,
  maxPosition,
  isActive = false,
  showHandle = true,
  showPosition = true,
  children,
  actions,
  onClick,
  className,
  variant = "card",
  customStyles,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 transition-all relative",
        variantClasses[variant],
        isActive
          ? customStyles?.active || variantActiveClasses[variant]
          : variantHoverClasses[variant],
        isDragging && (customStyles?.dragging || DRAGGING_CLASSES),
        isOver && !isDragging && (customStyles?.dropTarget || DROP_TARGET_CLASSES),
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Drag Handle */}
      {showHandle && (
        <DragHandle
          {...attributes}
          {...listeners}
          size="md"
        />
      )}

      {/* Position Badge */}
      {showPosition && position !== undefined && (
        <PositionBadge
          position={position}
          editable={editablePosition}
          onPositionChange={onPositionChange}
          maxPosition={maxPosition}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
