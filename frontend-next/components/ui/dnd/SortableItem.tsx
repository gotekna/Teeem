"use client";

/**
 * SortableItem - Base sortable item component
 *
 * THE ONE component for individual items in a sortable list.
 * Provides standard drag handle, flexible badge, and action slots.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { SortableItem } from "@/components/ui/dnd";
 *
 * // With position badge (default):
 * <SortableItem
 *   id="item-1"
 *   position={1}
 *   editableBadge
 *   onPositionChange={(pos) => reorder(pos)}
 *   actions={<Button>Edit</Button>}
 * >
 *   <span>Item content</span>
 * </SortableItem>
 *
 * // With custom label:
 * <SortableItem id="item-1" badgeLabel="02a" badgeColor="purple">
 *   <span>Custom labeled item</span>
 * </SortableItem>
 *
 * // With icon badge:
 * <SortableItem id="item-1" badgeIcon={Star} badgeColor="orange">
 *   <span>Starred item</span>
 * </SortableItem>
 *
 * // With custom badge render:
 * <SortableItem id="item-1" renderBadge={() => <MyCustomBadge />}>
 *   <span>Custom badge item</span>
 * </SortableItem>
 * ```
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DragHandle } from "./DragHandle";
import { ItemBadge, type ItemBadgeColor } from "./ItemBadge";
import { DRAGGING_CLASSES, DROP_TARGET_CLASSES } from "./dnd-config";
import { type LucideIcon } from "lucide-react";

export interface SortableItemProps {
  /** Unique identifier for the item */
  id: string | number;

  // Badge content (priority: renderBadge > badgeIcon > badgeLabel > position)
  /** Position number to display (1-indexed) */
  position?: number;
  /** Custom label for badge (e.g., "02a", "A1") */
  badgeLabel?: string;
  /** Icon to show in badge */
  badgeIcon?: LucideIcon;
  /** Fully custom badge render function */
  renderBadge?: () => React.ReactNode;
  /** Badge color variant */
  badgeColor?: ItemBadgeColor;

  // Badge editing
  /** Whether the badge is editable (position or label) */
  editableBadge?: boolean;
  /** @deprecated Use editableBadge instead */
  editablePosition?: boolean;
  /** Callback when position is manually changed */
  onPositionChange?: (newPosition: number) => void;
  /** Callback when label is manually changed */
  onLabelChange?: (newLabel: string) => void;
  /** Maximum position (for validation) */
  maxPosition?: number;

  // Display options
  /** Whether this item is selected/active */
  isActive?: boolean;
  /** Whether to show the drag handle */
  showHandle?: boolean;
  /** Whether to show the badge */
  showBadge?: boolean;
  /** @deprecated Use showBadge instead */
  showPosition?: boolean;

  // Content
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
  badgeLabel,
  badgeIcon,
  renderBadge,
  badgeColor,
  editableBadge = false,
  editablePosition = false, // deprecated, maps to editableBadge
  onPositionChange,
  onLabelChange,
  maxPosition,
  isActive = false,
  showHandle = true,
  showBadge = true,
  showPosition = true, // deprecated, maps to showBadge
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

  // Backwards compatibility: map deprecated props
  const shouldShowBadge = showBadge && showPosition;
  const isEditable = editableBadge || editablePosition;

  // Determine if we have any badge content to show
  const hasBadgeContent =
    renderBadge !== undefined ||
    badgeIcon !== undefined ||
    badgeLabel !== undefined ||
    position !== undefined;

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

      {/* Badge - flexible content */}
      {shouldShowBadge && hasBadgeContent && (
        renderBadge ? (
          renderBadge()
        ) : (
          <ItemBadge
            position={position}
            label={badgeLabel}
            icon={badgeIcon}
            color={badgeColor}
            editable={isEditable}
            onPositionChange={onPositionChange}
            onLabelChange={onLabelChange}
            maxPosition={maxPosition}
          />
        )
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
