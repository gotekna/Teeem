"use client";

/**
 * SortableList - DnD context wrapper for sortable lists
 *
 * THE ONE component for wrapping sortable items with drag-and-drop context.
 * Provides standard sensors, collision detection, and sorting strategy.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage (flat list):
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
 *
 * Usage (nested hierarchy):
 * ```tsx
 * <SortableList
 *   items={tabs}
 *   nested={true}
 *   defaultExpanded={true}
 *   indentSize={2.5}
 *   onReorder={handleReorder}
 *   renderItem={(tab, depth, isExpanded, toggleExpand) => (
 *     <div className="flex items-center gap-2">
 *       <span>{tab.display_name}</span>
 *       {tab.children?.length > 0 && (
 *         <Badge>{tab.children.length} sub-tabs</Badge>
 *       )}
 *     </div>
 *   )}
 * />
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
import { SortableItem } from "./SortableItem";

/** Interface for items that can have nested children */
export interface NestedSortableItem {
  id: string | number;
  children?: NestedSortableItem[];
}

export interface SortableListProps<T extends { id: string | number }> {
  /** Array of items with id property */
  items: T[];
  /** Callback when items are reordered */
  onReorder: (newItems: T[]) => void;
  /** Sorting strategy: vertical (default), horizontal, or grid */
  strategy?: "vertical" | "horizontal" | "grid";
  /** Children (should be SortableItem components) - used in flat mode */
  children?: React.ReactNode;
  /** Optional drag overlay content renderer */
  renderDragOverlay?: (activeItem: T | null) => React.ReactNode;
  /** Additional class names for the container */
  className?: string;
  /** Callback when drag starts */
  onDragStart?: (item: T) => void;
  /** Callback when drag ends (before reorder) */
  onDragEnd?: (item: T) => void;

  // === NESTED MODE PROPS ===
  /** Enable nested/hierarchical mode (default: false) */
  nested?: boolean;
  /** Render function for item content in nested mode */
  renderItem?: (
    item: T,
    depth: number,
    isExpanded: boolean,
    toggleExpand: () => void
  ) => React.ReactNode;
  /** Auto-expand all items with children on load (default: true) */
  defaultExpanded?: boolean;
  /** Indent size per nesting level in rem (default: 2.5) */
  indentSize?: number;
  /** Maximum nesting depth allowed (default: 10) */
  maxDepth?: number;
  /** Optional custom SortableItem props to pass through */
  itemProps?: Partial<React.ComponentProps<typeof SortableItem>>;
}

const strategyMap = {
  vertical: verticalListSortingStrategy,
  horizontal: horizontalListSortingStrategy,
  grid: rectSortingStrategy,
};

export function SortableList<T extends { id: string | number; children?: T[] }>({
  items,
  onReorder,
  strategy = "vertical",
  children,
  renderDragOverlay,
  className,
  onDragStart,
  onDragEnd,
  // Nested mode props
  nested = false,
  renderItem,
  defaultExpanded = true,
  indentSize = 2.5,
  maxDepth = 10,
  itemProps,
}: SortableListProps<T>) {
  const sensors = createDndSensors();
  const [activeId, setActiveId] = React.useState<string | number | null>(null);
  const [expandedItems, setExpandedItems] = React.useState<Set<string | number>>(new Set());

  // Auto-expand all items with children on mount
  React.useEffect(() => {
    if (nested && defaultExpanded) {
      const collectItemsWithChildren = (itemList: T[]): (string | number)[] => {
        return itemList.flatMap((item) => {
          const ids: (string | number)[] = [];
          if (item.children && item.children.length > 0) {
            ids.push(item.id);
            ids.push(...collectItemsWithChildren(item.children as T[]));
          }
          return ids;
        });
      };
      const idsWithChildren = collectItemsWithChildren(items);
      if (idsWithChildren.length > 0) {
        setExpandedItems(new Set(idsWithChildren));
      }
    }
  }, [items, nested, defaultExpanded]);

  // Toggle item expansion
  const toggleExpand = React.useCallback((itemId: string | number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

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

  // Collect all item IDs including nested children (for DnD context)
  const collectAllIds = React.useCallback((itemList: T[]): (string | number)[] => {
    return itemList.flatMap((item) => [
      item.id,
      ...(item.children ? collectAllIds(item.children as T[]) : []),
    ]);
  }, []);

  const itemIds = nested ? collectAllIds(items) : items.map((item) => item.id);

  // Recursive render function for nested items
  const renderItemWithChildren = React.useCallback(
    (item: T, index: number, depth: number): React.ReactNode => {
      if (depth > maxDepth) return null;

      const isExpanded = expandedItems.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      const handleToggleExpand = () => toggleExpand(item.id);

      return (
        <React.Fragment key={item.id}>
          <SortableItem
            id={item.id}
            position={index + 1}
            depth={depth}
            indentSize={indentSize}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            {...itemProps}
          >
            {renderItem?.(item, depth, isExpanded, handleToggleExpand)}
          </SortableItem>

          {isExpanded && hasChildren && (
            <div className="space-y-1">
              {(item.children as T[]).map((child, childIndex) =>
                renderItemWithChildren(child, childIndex, depth + 1)
              )}
            </div>
          )}
        </React.Fragment>
      );
    },
    [expandedItems, maxDepth, indentSize, renderItem, itemProps, toggleExpand]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={defaultCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={strategyMap[strategy]}>
        <div className={cn("space-y-1", className)}>
          {nested && renderItem
            ? items.map((item, index) => renderItemWithChildren(item, index, 0))
            : children}
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
