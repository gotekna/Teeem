/**
 * Gantt Chart Engine
 *
 * High-performance canvas-based Gantt chart system.
 * Part of the 3-Year Schedule Master Masterpiece Plan.
 *
 * @example
 * ```typescript
 * import { GanttCanvas } from '@/lib/gantt';
 *
 * const gantt = new GanttCanvas(containerElement, { darkMode: true });
 * gantt.setTasks(tasks);
 * gantt.setDependencies(dependencies);
 * ```
 */

// Engine exports
export { GanttCanvas } from "./engine/GanttCanvas";
export { Viewport } from "./engine/Viewport";
export { Renderer } from "./engine/Renderer";

// Type exports
export type {
  GanttTask,
  GanttDependency,
  GanttConfig,
  GanttColors,
  GanttState,
  ViewportState,
  SmScheduleMaster,
  SmTemplateRow, // @deprecated - Use SmScheduleMaster instead. Will be removed in Phase 7.
  SmTemplate,
  TaskStatus,
  LockType,
  HoldReason,
  DependencyType,
  TaskClickEvent,
  TaskDragEvent,
  DependencyClickEvent,
  CascadeResult,
  CascadeResolution,
} from "./types";

// Utility exports
export {
  convertRowToTask,
  convertRowsToTasks,
  convertToDependencies,
} from "./types";
