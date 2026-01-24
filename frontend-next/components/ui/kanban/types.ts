/**
 * Kanban Types - Type definitions for Kanban board components
 *
 * See: frontend-next/lib/component-registry.ts
 */

import type { LucideIcon } from "lucide-react";

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Base interface for Kanban items (cards)
 * Extend this interface for your specific data type
 */
export interface KanbanItem {
  id: string | number;
  /** Optional column/status identifier */
  columnId?: string;
}

/**
 * Column definition for the Kanban board
 */
export interface KanbanColumnDef<T extends KanbanItem = KanbanItem> {
  /** Unique column identifier */
  id: string;
  /** Display title for the column header */
  title: string;
  /** Optional icon for the column header */
  icon?: LucideIcon;
  /** Color variant for the column */
  color?: KanbanColumnColor;
  /** Work-in-progress limit (0 = unlimited) */
  wipLimit?: number;
  /** Whether the column is collapsed */
  collapsed?: boolean;
  /** Custom filter function for items in this column */
  filter?: (item: T) => boolean;
}

/**
 * Color variants for columns
 */
export type KanbanColumnColor =
  | "default"
  | "gray"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple";

// =============================================================================
// SWIMLANE TYPES
// =============================================================================

/**
 * Swimlane configuration for horizontal grouping
 */
export interface SwimlaneConfig<T extends KanbanItem = KanbanItem> {
  /** Field to group by (e.g., "assignee", "priority") */
  groupBy: keyof T | ((item: T) => string);
  /** Get display label for a group value */
  getLabel?: (groupValue: string) => string;
  /** Get icon for a group */
  getIcon?: (groupValue: string) => LucideIcon | undefined;
  /** Sort order for swimlanes */
  sortOrder?: string[] | ((a: string, b: string) => number);
  /** Whether swimlanes are collapsible */
  collapsible?: boolean;
  /** Label for ungrouped items */
  ungroupedLabel?: string;
}

/**
 * Computed swimlane data
 */
export interface Swimlane<T extends KanbanItem = KanbanItem> {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: T[];
  collapsed: boolean;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Event when a card moves between columns
 */
export interface CardMoveEvent<T extends KanbanItem = KanbanItem> {
  item: T;
  fromColumnId: string;
  toColumnId: string;
  /** Index in the target column */
  toIndex: number;
}

/**
 * Event when a card is reordered within a column
 */
export interface CardReorderEvent<T extends KanbanItem = KanbanItem> {
  item: T;
  columnId: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Event when columns are reordered
 */
export interface ColumnReorderEvent {
  columnId: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * Event when a column is collapsed/expanded
 */
export interface ColumnCollapseEvent {
  columnId: string;
  collapsed: boolean;
}

/**
 * Event when a swimlane is collapsed/expanded
 */
export interface SwimlaneCollapseEvent {
  swimlaneId: string;
  collapsed: boolean;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Props for KanbanBoard component
 */
export interface KanbanBoardProps<T extends KanbanItem = KanbanItem> {
  /** Column definitions */
  columns: KanbanColumnDef<T>[];
  /** Items to display (will be distributed to columns) */
  items: T[];
  /** Function to determine which column an item belongs to */
  getItemColumn: (item: T) => string;

  // Features
  /** Swimlane configuration for horizontal grouping */
  swimlanes?: SwimlaneConfig<T>;
  /** Whether columns can be reordered */
  columnReorderable?: boolean;
  /** Whether columns can be collapsed */
  columnsCollapsible?: boolean;
  /** Whether cards can be reordered within columns */
  cardReorderable?: boolean;

  // Rendering
  /** Custom card renderer */
  renderCard: (item: T, isDragging: boolean) => React.ReactNode;
  /** Optional custom column header renderer */
  renderColumnHeader?: (column: KanbanColumnDef<T>, itemCount: number) => React.ReactNode;
  /** Optional empty column content */
  renderEmptyColumn?: (column: KanbanColumnDef<T>) => React.ReactNode;

  // Events
  /** Called when a card moves between columns */
  onCardMove?: (event: CardMoveEvent<T>) => void;
  /** Called when a card is reordered within a column */
  onCardReorder?: (event: CardReorderEvent<T>) => void;
  /** Called when columns are reordered */
  onColumnReorder?: (event: ColumnReorderEvent) => void;
  /** Called when a column is collapsed/expanded */
  onColumnCollapse?: (event: ColumnCollapseEvent) => void;
  /** Called when a swimlane is collapsed/expanded */
  onSwimlaneCollapse?: (event: SwimlaneCollapseEvent) => void;

  // Styling
  /** Additional classes for the board container */
  className?: string;
  /** Gap between columns */
  columnGap?: "sm" | "md" | "lg";
  /** Minimum column width */
  minColumnWidth?: number;
}

/**
 * Props for KanbanColumn component
 */
export interface KanbanColumnProps<T extends KanbanItem = KanbanItem> {
  /** Column definition */
  column: KanbanColumnDef<T>;
  /** Items in this column */
  items: T[];
  /** Whether the column is a drop target */
  isOver?: boolean;
  /** Whether this column is being dragged */
  isDragging?: boolean;
  /** Card renderer */
  renderCard: (item: T, isDragging: boolean) => React.ReactNode;
  /** Custom header renderer */
  renderHeader?: (column: KanbanColumnDef<T>, itemCount: number) => React.ReactNode;
  /** Empty state renderer */
  renderEmpty?: (column: KanbanColumnDef<T>) => React.ReactNode;
  /** Collapse toggle handler */
  onCollapse?: (collapsed: boolean) => void;
  /** Whether cards can be reordered */
  cardReorderable?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * Props for KanbanCard component
 */
export interface KanbanCardProps {
  /** Unique identifier for the card */
  id: string | number;
  /** Children to render inside the card */
  children: React.ReactNode;
  /** Whether the card is currently being dragged */
  isDragging?: boolean;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Additional classes */
  className?: string;
  /** Click handler (fires if drag didn't activate) */
  onClick?: (e: React.MouseEvent) => void;
  /** Double-click handler (fires if drag didn't activate) */
  onDoubleClick?: (e: React.MouseEvent) => void;
}

/**
 * Props for KanbanSwimlane component
 */
export interface KanbanSwimlaneProps<T extends KanbanItem = KanbanItem> {
  /** Swimlane data */
  swimlane: Swimlane<T>;
  /** Column definitions */
  columns: KanbanColumnDef<T>[];
  /** Function to get item's column */
  getItemColumn: (item: T) => string;
  /** Card renderer */
  renderCard: (item: T, isDragging: boolean) => React.ReactNode;
  /** Collapse toggle handler */
  onCollapse?: (collapsed: boolean) => void;
  /** Whether cards can be reordered */
  cardReorderable?: boolean;
  /** Additional classes */
  className?: string;
}
