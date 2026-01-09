"use client";

/**
 * KanbanBoard - Main Kanban board component
 *
 * THE ONE component for Kanban boards. Provides:
 * - Drag-and-drop cards between columns
 * - Optional swimlanes (horizontal grouping)
 * - WIP limits per column
 * - Collapsible columns
 * - Column reordering
 *
 * Usage:
 * ```tsx
 * import { KanbanBoard } from "@/components/ui/kanban";
 *
 * const columns = [
 *   { id: "todo", title: "To Do", color: "gray" },
 *   { id: "active", title: "Active", color: "blue" },
 *   { id: "done", title: "Done", color: "green" },
 * ];
 *
 * <KanbanBoard
 *   columns={columns}
 *   items={tasks}
 *   getItemColumn={(task) => task.status}
 *   renderCard={(task, isDragging) => (
 *     <KanbanCard id={task.id}>
 *       <div className="p-3">{task.name}</div>
 *     </KanbanCard>
 *   )}
 *   onCardMove={({ item, toColumnId }) => {
 *     updateTask(item.id, { status: toColumnId });
 *   }}
 * />
 * ```
 */

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { createDndSensors } from "@/components/ui/dnd";
import { KanbanProvider, useKanban } from "./kanban-context";
import { KanbanColumn } from "./kanban-column";
import { KanbanSwimlane } from "./kanban-swimlane";
import type {
  KanbanItem,
  KanbanBoardProps,
  KanbanColumnDef,
  Swimlane,
  SwimlaneConfig,
} from "./types";

// Custom collision detection that prioritizes column containers
const kanbanCollisionDetection: CollisionDetection = (args) => {
  // First check pointer within (most precise)
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  // Fall back to rect intersection
  return rectIntersection(args);
};

// Gap classes
const gapClasses = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

function KanbanBoardInner<T extends KanbanItem = KanbanItem>({
  columns,
  items,
  getItemColumn,
  swimlanes: swimlaneConfig,
  columnReorderable = false,
  columnsCollapsible = true,
  cardReorderable = true,
  renderCard,
  renderColumnHeader,
  renderEmptyColumn,
  onCardMove,
  onCardReorder,
  onColumnReorder,
  onColumnCollapse,
  onSwimlaneCollapse,
  className,
  columnGap = "md",
  minColumnWidth = 280,
}: KanbanBoardProps<T>) {
  const sensors = createDndSensors({ touchDelay: 200 });
  const {
    activeId,
    setActiveId,
    activeItem,
    collapsedColumns,
    toggleColumnCollapse,
    collapsedSwimlanes,
    toggleSwimlaneCollapse,
  } = useKanban<T>();

  // Track which column we're over for highlighting
  const [overColumnId, setOverColumnId] = React.useState<string | null>(null);

  // Compute swimlanes if configured
  const swimlanes = React.useMemo((): Swimlane<T>[] | null => {
    if (!swimlaneConfig) return null;

    const { groupBy, getLabel, getIcon, sortOrder, ungroupedLabel = "Ungrouped" } = swimlaneConfig;

    // Group items
    const groups = new Map<string, T[]>();

    items.forEach((item) => {
      const value =
        typeof groupBy === "function"
          ? groupBy(item)
          : String(item[groupBy] ?? "");
      const groupKey = value || "__ungrouped__";

      const existing = groups.get(groupKey) || [];
      existing.push(item);
      groups.set(groupKey, existing);
    });

    // Convert to swimlane objects
    let lanes: Swimlane<T>[] = Array.from(groups.entries()).map(
      ([key, groupItems]) => ({
        id: key,
        label: key === "__ungrouped__" ? ungroupedLabel : (getLabel?.(key) ?? key),
        icon: getIcon?.(key),
        items: groupItems,
        collapsed: collapsedSwimlanes.has(key),
      })
    );

    // Sort swimlanes
    if (sortOrder) {
      if (Array.isArray(sortOrder)) {
        lanes.sort((a, b) => {
          const aIdx = sortOrder.indexOf(a.id);
          const bIdx = sortOrder.indexOf(b.id);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      } else {
        lanes.sort((a, b) => sortOrder(a.id, b.id));
      }
    }

    return lanes;
  }, [items, swimlaneConfig, collapsedSwimlanes]);

  // Handle drag start
  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id);
    },
    [setActiveId]
  );

  // Handle drag over - track column for highlighting
  const handleDragOver = React.useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    // Check if over a column
    const overData = over.data.current;
    if (overData?.type === "column") {
      setOverColumnId(overData.columnId as string);
    } else {
      // Over an item - find its column
      const overItem = items.find((item) => item.id === over.id);
      if (overItem) {
        setOverColumnId(getItemColumn(overItem));
      }
    }
  }, [items, getItemColumn]);

  // Handle drag end
  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setOverColumnId(null);

      if (!over) return;

      const activeItemData = items.find((item) => item.id === active.id);
      if (!activeItemData) return;

      const activeColumnId = getItemColumn(activeItemData);

      // Determine target column
      let targetColumnId: string;
      let targetIndex: number;

      const overData = over.data.current;
      if (overData?.type === "column") {
        // Dropped directly on a column
        targetColumnId = overData.columnId as string;
        const columnItems = items.filter(
          (item) => getItemColumn(item) === targetColumnId
        );
        targetIndex = columnItems.length; // Add to end
      } else {
        // Dropped on another item
        const overItem = items.find((item) => item.id === over.id);
        if (!overItem) return;

        targetColumnId = getItemColumn(overItem);
        const columnItems = items.filter(
          (item) => getItemColumn(item) === targetColumnId
        );
        targetIndex = columnItems.findIndex((item) => item.id === over.id);
      }

      // Same column - reorder
      if (activeColumnId === targetColumnId) {
        const columnItems = items.filter(
          (item) => getItemColumn(item) === activeColumnId
        );
        const fromIndex = columnItems.findIndex(
          (item) => item.id === active.id
        );

        if (fromIndex !== targetIndex && fromIndex !== -1) {
          onCardReorder?.({
            item: activeItemData,
            columnId: activeColumnId,
            fromIndex,
            toIndex: targetIndex,
          });
        }
      } else {
        // Different column - move
        onCardMove?.({
          item: activeItemData,
          fromColumnId: activeColumnId,
          toColumnId: targetColumnId,
          toIndex: targetIndex,
        });
      }
    },
    [items, getItemColumn, setActiveId, onCardMove, onCardReorder]
  );

  // Merge column defs with collapse state
  const columnsWithState = React.useMemo(
    () =>
      columns.map((col) => ({
        ...col,
        collapsed: collapsedColumns.has(col.id),
      })),
    [columns, collapsedColumns]
  );

  // Render columns (without swimlanes)
  const renderColumns = () => (
    <div
      className={cn("flex overflow-x-auto", gapClasses[columnGap])}
      style={{ minWidth: columns.length * minColumnWidth }}
    >
      {columnsWithState.map((column) => {
        const columnItems = items.filter(
          (item) => getItemColumn(item) === column.id
        );

        return (
          <div
            key={column.id}
            className="flex-1"
            style={{ minWidth: minColumnWidth }}
          >
            <KanbanColumn
              column={column}
              items={columnItems}
              isOver={overColumnId === column.id}
              renderCard={renderCard}
              renderHeader={renderColumnHeader}
              renderEmpty={renderEmptyColumn}
              onCollapse={
                columnsCollapsible
                  ? () => {
                      toggleColumnCollapse(column.id);
                      onColumnCollapse?.({
                        columnId: column.id,
                        collapsed: !column.collapsed,
                      });
                    }
                  : undefined
              }
              cardReorderable={cardReorderable}
            />
          </div>
        );
      })}
    </div>
  );

  // Render swimlanes
  const renderSwimlanes = () => (
    <div className="space-y-0">
      {swimlanes!.map((swimlane) => (
        <KanbanSwimlane
          key={swimlane.id}
          swimlane={swimlane}
          columns={columnsWithState}
          getItemColumn={getItemColumn}
          renderCard={renderCard}
          cardReorderable={cardReorderable}
          onCollapse={(collapsed) => {
            toggleSwimlaneCollapse(swimlane.id);
            onSwimlaneCollapse?.({
              swimlaneId: swimlane.id,
              collapsed,
            });
          }}
        />
      ))}
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("relative", className)}>
        {swimlanes ? renderSwimlanes() : renderColumns()}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 shadow-xl">
            {renderCard(activeItem, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function KanbanBoard<T extends KanbanItem = KanbanItem>(
  props: KanbanBoardProps<T>
) {
  return (
    <KanbanProvider
      columns={props.columns}
      items={props.items}
      getItemColumn={props.getItemColumn}
      onColumnCollapse={(columnId, collapsed) =>
        props.onColumnCollapse?.({ columnId, collapsed })
      }
      onSwimlaneCollapse={(swimlaneId, collapsed) =>
        props.onSwimlaneCollapse?.({ swimlaneId, collapsed })
      }
    >
      <KanbanBoardInner {...props} />
    </KanbanProvider>
  );
}
