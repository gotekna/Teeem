"use client";

/**
 * KanbanSwimlane - Horizontal grouping row for Kanban board
 *
 * Groups cards by a field (e.g., assignee, priority) and displays
 * them in a horizontal lane across all columns.
 *
 * Usage:
 * ```tsx
 * import { KanbanSwimlane } from "@/components/ui/kanban";
 *
 * <KanbanSwimlane
 *   swimlane={{ id: "user-1", label: "John", items: tasks }}
 *   columns={columns}
 *   getItemColumn={(task) => task.status}
 *   renderCard={(task) => <TaskCard task={task} />}
 * />
 * ```
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KanbanColumn } from "./kanban-column";
import type { KanbanItem, KanbanSwimlaneProps } from "./types";

export function KanbanSwimlane<T extends KanbanItem = KanbanItem>({
  swimlane,
  columns,
  getItemColumn,
  renderCard,
  onCollapse,
  cardReorderable = true,
  className,
}: KanbanSwimlaneProps<T>) {
  const { id, label, icon: Icon, items, collapsed } = swimlane;

  // Group items by column
  const itemsByColumn = React.useMemo(() => {
    const grouped = new Map<string, T[]>();
    columns.forEach((col) => grouped.set(col.id, []));

    items.forEach((item) => {
      const columnId = getItemColumn(item);
      const existing = grouped.get(columnId) || [];
      existing.push(item);
      grouped.set(columnId, existing);
    });

    return grouped;
  }, [items, columns, getItemColumn]);

  return (
    <div className={cn("border-b border-border", className)}>
      {/* Swimlane header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-muted/50",
          onCollapse && "cursor-pointer hover:bg-muted/70"
        )}
        onClick={() => onCollapse?.(!collapsed)}
      >
        {/* Collapse toggle */}
        {onCollapse && (
          <span className="text-muted-foreground">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}

        {/* Icon */}
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}

        {/* Label */}
        <span className="font-medium text-sm">{label}</span>

        {/* Item count */}
        <Badge variant="secondary" className="ml-auto text-xs">
          {items.length}
        </Badge>
      </div>

      {/* Swimlane content - columns side by side */}
      {!collapsed && (
        <div className="flex gap-2 p-2 overflow-x-auto">
          {columns.map((column) => {
            const columnItems = itemsByColumn.get(column.id) || [];
            return (
              <div key={column.id} className="flex-1 min-w-[200px]">
                <KanbanColumn
                  column={{ ...column, collapsed: false }} // Swimlane columns never collapse
                  items={columnItems}
                  renderCard={renderCard}
                  cardReorderable={cardReorderable}
                  // Hide headers in swimlane mode - the swimlane header is sufficient
                  renderHeader={() => (
                    <div className="text-xs text-muted-foreground">
                      {column.title} ({columnItems.length})
                    </div>
                  )}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
