"use client";

/**
 * SortableList - DnD context wrapper for sortable lists
 *
 * THE ONE component for wrapping sortable items with drag-and-drop context.
 * Provides standard sensors, collision detection, and sorting strategy.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { SortableList, SortableItem } from "@/components/ui/dnd";
 *
 * <SortableList
 *   items={items}
 *   onReorder={(newOrder) => setItems(newOrder)}
 * >
 *   {items.map((item, index) => (
 *     <SortableItem key={item.id} id={item.id} position={index + 1}>
 *       {item.name}
 *     </SortableItem>
 *   ))}
 * </SortableList>
 * ```
 */

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { createDndSensors, defaultCollisionDetection } from "./dnd-config";

export interface SortableListProps<T extends { id: string | number }> {
  /** Array of items with id property */
  items: T[];
  /** Callback when items are reordered */
  onReorder: (newItems: T[]) => void;
  /** Sorting strategy: vertical (default), horizontal, or grid */
  strategy?: "vertical" | "horizontal" | "grid";
  /** Children (should be SortableItem components) */
  children: React.ReactNode;
  /** Optional drag overlay content renderer */
  renderDragOverlay?: (activeItem: T | null) => React.ReactNode;
  /** Additional class names for the container */
  className?: string;
  /** Callback when drag starts */
  onDragStart?: (item: T) => void;
  /** Callback when drag ends (before reorder) */
  onDragEnd?: (item: T) => void;
}

const strategyMap = {
  vertical: verticalListSortingStrategy,
  horizontal: horizontalListSortingStrategy,
  grid: rectSortingStrategy,
};

export function SortableList<T extends { id: string | number }>({
  items,
  onReorder,
  strategy = "vertical",
  children,
  renderDragOverlay,
  className,
  onDragStart,
  onDragEnd,
}: SortableListProps<T>) {
  const sensors = createDndSensors();
  const [activeId, setActiveId] = React.useState<string | number | null>(null);

  const activeItem = React.useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [items, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    const item = items.find((i) => i.id === active.id);
    if (item) {
      onDragStart?.(item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }

    const item = items.find((i) => i.id === active.id);
    if (item) {
      onDragEnd?.(item);
    }
  };

  const itemIds = items.map((item) => item.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={defaultCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={strategyMap[strategy]}>
        <div className={cn("space-y-1", className)}>
          {children}
        </div>
      </SortableContext>

      {renderDragOverlay && (
        <DragOverlay>
          {activeItem ? renderDragOverlay(activeItem) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}

// =============================================================================
// UTILITY: Reorder helper
// =============================================================================

/**
 * Helper function to reorder items by moving an item to a new position.
 * Useful when handling manual position changes via PositionBadge.
 *
 * @param items - Array of items
 * @param fromIndex - Current index (0-indexed)
 * @param toIndex - Target index (0-indexed)
 * @returns New array with item moved
 */
export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  return arrayMove(items, fromIndex, toIndex);
}

/**
 * Helper function to reorder by position number (1-indexed).
 *
 * @param items - Array of items with id property
 * @param itemId - ID of item to move
 * @param newPosition - New position (1-indexed)
 * @returns New array with item moved
 */
export function reorderByPosition<T extends { id: string | number }>(
  items: T[],
  itemId: string | number,
  newPosition: number
): T[] {
  const fromIndex = items.findIndex((item) => item.id === itemId);
  if (fromIndex === -1) return items;

  // Convert 1-indexed position to 0-indexed
  const toIndex = Math.max(0, Math.min(newPosition - 1, items.length - 1));

  return arrayMove(items, fromIndex, toIndex);
}
