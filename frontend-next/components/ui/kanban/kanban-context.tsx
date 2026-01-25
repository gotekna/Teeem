"use client";

/**
 * KanbanContext - State management for Kanban board
 *
 * Provides drag-and-drop state and actions to child components.
 */

import * as React from "react";
import type { KanbanItem, KanbanColumnDef } from "./types";

interface KanbanContextValue<T extends KanbanItem = KanbanItem> {
  /** Currently dragged item ID */
  activeId: string | number | null;
  /** Set the active dragged item */
  setActiveId: (id: string | number | null) => void;
  /** Currently dragged item data */
  activeItem: T | null;
  /** Column definitions */
  columns: KanbanColumnDef<T>[];
  /** All items */
  items: T[];
  /** Get items for a specific column */
  getColumnItems: (columnId: string) => T[];
  /** Collapsed column IDs */
  collapsedColumns: Set<string>;
  /** Toggle column collapse */
  toggleColumnCollapse: (columnId: string) => void;
  /** Collapsed swimlane IDs */
  collapsedSwimlanes: Set<string>;
  /** Toggle swimlane collapse */
  toggleSwimlaneCollapse: (swimlaneId: string) => void;
}

const KanbanContext = React.createContext<KanbanContextValue | null>(null);

export interface KanbanProviderProps<T extends KanbanItem = KanbanItem> {
  children: React.ReactNode;
  columns: KanbanColumnDef<T>[];
  items: T[];
  getItemColumn: (item: T) => string;
  initialCollapsedColumns?: string[];
  initialCollapsedSwimlanes?: string[];
  onColumnCollapse?: (columnId: string, collapsed: boolean) => void;
  onSwimlaneCollapse?: (swimlaneId: string, collapsed: boolean) => void;
}

export function KanbanProvider<T extends KanbanItem = KanbanItem>({
  children,
  columns,
  items,
  getItemColumn,
  initialCollapsedColumns,
  initialCollapsedSwimlanes = [],
  onColumnCollapse,
  onSwimlaneCollapse,
}: KanbanProviderProps<T>) {
  const [activeId, setActiveId] = React.useState<string | number | null>(null);
  const [collapsedColumns, setCollapsedColumns] = React.useState<Set<string>>(
    () => {
      // If explicit initialCollapsedColumns provided, use those
      if (initialCollapsedColumns) {
        return new Set(initialCollapsedColumns);
      }
      // Otherwise, derive from column definitions that have collapsed: true
      return new Set(
        columns
          .filter((col) => col.collapsed === true)
          .map((col) => col.id)
      );
    }
  );
  const [collapsedSwimlanes, setCollapsedSwimlanes] = React.useState<Set<string>>(
    () => new Set(initialCollapsedSwimlanes)
  );

  // Find the currently dragged item
  const activeItem = React.useMemo(() => {
    if (activeId === null) return null;
    return items.find((item) => item.id === activeId) ?? null;
  }, [activeId, items]);

  // Get items for a specific column
  const getColumnItems = React.useCallback(
    (columnId: string): T[] => {
      const column = columns.find((c) => c.id === columnId);
      if (!column) return [];

      return items.filter((item) => {
        const itemColumnId = getItemColumn(item);
        if (itemColumnId !== columnId) return false;

        // Apply column's custom filter if present
        if (column.filter && !column.filter(item)) return false;

        return true;
      });
    },
    [columns, items, getItemColumn]
  );

  // Toggle column collapse
  const toggleColumnCollapse = React.useCallback(
    (columnId: string) => {
      setCollapsedColumns((prev) => {
        const next = new Set(prev);
        const isCollapsed = next.has(columnId);

        if (isCollapsed) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }

        onColumnCollapse?.(columnId, !isCollapsed);
        return next;
      });
    },
    [onColumnCollapse]
  );

  // Toggle swimlane collapse
  const toggleSwimlaneCollapse = React.useCallback(
    (swimlaneId: string) => {
      setCollapsedSwimlanes((prev) => {
        const next = new Set(prev);
        const isCollapsed = next.has(swimlaneId);

        if (isCollapsed) {
          next.delete(swimlaneId);
        } else {
          next.add(swimlaneId);
        }

        onSwimlaneCollapse?.(swimlaneId, !isCollapsed);
        return next;
      });
    },
    [onSwimlaneCollapse]
  );

  const value = React.useMemo(
    () => ({
      activeId,
      setActiveId,
      activeItem,
      columns,
      items,
      getColumnItems,
      collapsedColumns,
      toggleColumnCollapse,
      collapsedSwimlanes,
      toggleSwimlaneCollapse,
    }),
    [
      activeId,
      activeItem,
      columns,
      items,
      getColumnItems,
      collapsedColumns,
      toggleColumnCollapse,
      collapsedSwimlanes,
      toggleSwimlaneCollapse,
    ]
  );

  return (
    <KanbanContext.Provider value={value as unknown as KanbanContextValue}>
      {children}
    </KanbanContext.Provider>
  );
}

export function useKanban<T extends KanbanItem = KanbanItem>(): KanbanContextValue<T> {
  const context = React.useContext(KanbanContext);
  if (!context) {
    throw new Error("useKanban must be used within a KanbanProvider");
  }
  return context as unknown as KanbanContextValue<T>;
}
