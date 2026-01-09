"use client";

/**
 * KanbanColumn - Column component for Kanban board
 *
 * THE ONE component for columns in a Kanban board.
 * Provides drop zone, header with count/WIP, and card list.
 *
 * Usage:
 * ```tsx
 * import { KanbanColumn } from "@/components/ui/kanban";
 *
 * <KanbanColumn
 *   column={{ id: "todo", title: "To Do", color: "gray" }}
 *   items={todoItems}
 *   renderCard={(item) => <TaskCard task={item} />}
 * />
 * ```
 */

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KanbanItem, KanbanColumnProps, KanbanColumnColor } from "./types";

// Color classes for column headers
const columnColorClasses: Record<KanbanColumnColor, string> = {
  default: "border-border",
  gray: "border-gray-300 dark:border-gray-600",
  blue: "border-blue-400 dark:border-blue-600",
  green: "border-green-400 dark:border-green-600",
  orange: "border-orange-400 dark:border-orange-600",
  red: "border-red-400 dark:border-red-600",
  purple: "border-purple-400 dark:border-purple-600",
};

const columnHeaderColorClasses: Record<KanbanColumnColor, string> = {
  default: "text-foreground",
  gray: "text-gray-700 dark:text-gray-300",
  blue: "text-blue-700 dark:text-blue-300",
  green: "text-green-700 dark:text-green-300",
  orange: "text-orange-700 dark:text-orange-300",
  red: "text-red-700 dark:text-red-300",
  purple: "text-purple-700 dark:text-purple-300",
};

export function KanbanColumn<T extends KanbanItem = KanbanItem>({
  column,
  items,
  isOver: isOverProp,
  isDragging,
  renderCard,
  renderHeader,
  renderEmpty,
  onCollapse,
  cardReorderable = true,
  className,
}: KanbanColumnProps<T>) {
  const { id, title, icon: Icon, color = "default", wipLimit, collapsed } = column;

  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: `column-${id}`,
    data: { type: "column", columnId: id },
  });

  const isOver = isOverProp ?? isDroppableOver;
  const itemCount = items.length;
  const isOverWipLimit = wipLimit && wipLimit > 0 && itemCount > wipLimit;

  // Get sorted item IDs for SortableContext
  const itemIds = React.useMemo(() => items.map((item) => item.id), [items]);

  // Default header renderer
  const defaultHeader = (
    <div className="flex items-center gap-2">
      {/* Collapse toggle */}
      {onCollapse && (
        <button
          onClick={() => onCollapse(!collapsed)}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          aria-label={collapsed ? "Expand column" : "Collapse column"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Icon */}
      {Icon && <Icon className="h-4 w-4" />}

      {/* Title */}
      <span className={cn("font-medium", columnHeaderColorClasses[color])}>
        {title}
      </span>

      {/* Count badge */}
      <Badge
        variant="secondary"
        className={cn(
          "ml-auto text-xs",
          isOverWipLimit && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        )}
      >
        {itemCount}
        {wipLimit && wipLimit > 0 && `/${wipLimit}`}
      </Badge>

      {/* WIP limit warning */}
      {isOverWipLimit && (
        <AlertTriangle className="h-4 w-4 text-red-500" />
      )}
    </div>
  );

  // Default empty state
  const defaultEmpty = (
    <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
      No items
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border-t-4 bg-muted/30",
        columnColorClasses[color],
        isOver && !isDragging && "ring-2 ring-primary bg-primary/5",
        className
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border/50">
        {renderHeader ? renderHeader(column, itemCount) : defaultHeader}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 p-2 min-h-[120px] overflow-y-auto">
          {items.length === 0 ? (
            renderEmpty ? renderEmpty(column) : defaultEmpty
          ) : (
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
              disabled={!cardReorderable}
            >
              <div className="space-y-2">
                {items.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderCard(item, false)}
                  </React.Fragment>
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}

      {/* Collapsed indicator */}
      {collapsed && (
        <div className="p-2 text-center text-muted-foreground text-sm">
          {itemCount} item{itemCount !== 1 && "s"}
        </div>
      )}
    </div>
  );
}
