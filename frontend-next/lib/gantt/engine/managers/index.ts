/**
 * Gantt Engine Managers
 *
 * Extracted manager classes for the GanttCanvas engine.
 * Each manager handles a specific domain of functionality.
 */

// Core managers
export { RenderCoordinator } from './RenderCoordinator';
export type { Rect, RenderPriority, RenderRequest, RenderStats } from './RenderCoordinator';

export { SelectionManager } from './SelectionManager';
export type { SelectionChangeEvent, SelectionChangeCallback, ModifierKey } from './SelectionManager';

// Interaction manager (Day 2)
export { InteractionManager } from './InteractionManager';
export type {
  InteractionState,
  ResizeEdge,
  DragState,
  ResizeState,
  ProgressState,
  DependencyState,
  MarqueeState,
  HitTestResult,
  DragEvent,
  ResizeEvent,
  ProgressEvent,
  DependencyDragEvent,
  MarqueeEvent,
  InteractionConfig,
} from './InteractionManager';

// Dependency manager (Day 3)
export { DependencyManager } from './DependencyManager';
export type {
  DependencyType,
  DependencyValidationError,
  CascadeResult,
  DependencyChangeEvent,
  DependencyChangeCallback,
} from './DependencyManager';

// State manager (Day 5)
export { StateManager } from './StateManager';
export type {
  ViewportState,
  GanttCanvasState,
  StateSnapshot,
  StateChangeEvent,
  StateChangeCallback,
  PersistenceConfig,
} from './StateManager';

// Feature managers (to be implemented)
// export { ExportManager } from './ExportManager';
// export { FilterManager } from './FilterManager';
// export { BaselineManager } from './BaselineManager';
// export { CriticalPathManager } from './CriticalPathManager';
// export { CalendarManager } from './CalendarManager';
