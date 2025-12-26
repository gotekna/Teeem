/**
 * Gantt Canvas Components
 *
 * High-performance canvas-based Gantt chart system.
 * Part of the 3-Year Schedule Master Masterpiece Plan.
 */

export { GanttCanvasView } from "./GanttCanvasView";
export type {
  GanttTask,
  GanttDependency,
  SmScheduleMaster,
  SmTemplateRow, // @deprecated - Use SmScheduleMaster instead. Will be removed in Phase 7.
  SmTemplate,
  TaskClickEvent,
  TaskDragEvent,
  DependencyClickEvent,
} from "@/lib/gantt/types";
