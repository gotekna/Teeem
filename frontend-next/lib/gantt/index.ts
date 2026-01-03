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
  SmScheduleMasterTemplate,
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
  isHeaderRow,  // SSoT: Use this for ALL header detection
  convertRowToTask,
  convertRowsToTasks,
  // SSoT: convertToDependencies removed - backend GanttDataService is SSoT for dependency conversion
} from "./types";
