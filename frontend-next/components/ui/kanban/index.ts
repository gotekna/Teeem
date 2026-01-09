/**
 * Kanban Components - SSoT for Kanban board primitives
 *
 * This module provides standardized Kanban board components for the TEEEM application.
 * Use these components for any task board, workflow, or status-based visualization.
 *
 * See: frontend-next/lib/component-registry.ts
 *
 * Components:
 * - KanbanBoard: Main board with DnD context, columns, optional swimlanes
 * - KanbanColumn: Drop zone with header, WIP limit, card list
 * - KanbanCard: Draggable card wrapper
 * - KanbanSwimlane: Horizontal grouping row
 *
 * Usage:
 * ```tsx
 * import {
 *   KanbanBoard,
 *   KanbanCard,
 *   type KanbanColumnDef,
 * } from "@/components/ui/kanban";
 *
 * const columns: KanbanColumnDef[] = [
 *   { id: "todo", title: "To Do", color: "gray" },
 *   { id: "active", title: "Active", color: "blue", wipLimit: 5 },
 *   { id: "done", title: "Done", color: "green" },
 * ];
 *
 * function TaskBoard({ tasks, updateTask }) {
 *   return (
 *     <KanbanBoard
 *       columns={columns}
 *       items={tasks}
 *       getItemColumn={(task) => task.status}
 *       renderCard={(task, isDragging) => (
 *         <KanbanCard id={task.id}>
 *           <div className="p-3">
 *             <h4 className="font-medium">{task.name}</h4>
 *             <p className="text-sm text-muted-foreground">{task.description}</p>
 *           </div>
 *         </KanbanCard>
 *       )}
 *       onCardMove={({ item, toColumnId }) => {
 *         updateTask(item.id, { status: toColumnId });
 *       }}
 *     />
 *   );
 * }
 *
 * // With swimlanes (grouping by assignee):
 * <KanbanBoard
 *   columns={columns}
 *   items={tasks}
 *   getItemColumn={(task) => task.status}
 *   swimlanes={{
 *     groupBy: "assignee",
 *     getLabel: (id) => users.find(u => u.id === id)?.name ?? "Unassigned",
 *     collapsible: true,
 *   }}
 *   renderCard={...}
 *   onCardMove={...}
 * />
 * ```
 */

// Components
export { KanbanBoard } from "./kanban-board";
export { KanbanColumn } from "./kanban-column";
export { KanbanCard } from "./kanban-card";
export { KanbanSwimlane } from "./kanban-swimlane";

// Context
export { KanbanProvider, useKanban } from "./kanban-context";

// Types
export type {
  // Core types
  KanbanItem,
  KanbanColumnDef,
  KanbanColumnColor,
  // Swimlane types
  SwimlaneConfig,
  Swimlane,
  // Event types
  CardMoveEvent,
  CardReorderEvent,
  ColumnReorderEvent,
  ColumnCollapseEvent,
  SwimlaneCollapseEvent,
  // Component props
  KanbanBoardProps,
  KanbanColumnProps,
  KanbanCardProps,
  KanbanSwimlaneProps,
} from "./types";
