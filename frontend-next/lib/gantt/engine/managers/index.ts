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

// Export manager (Day 7)
export { ExportManager } from './ExportManager';
export type {
  PDFExportOptions,
  ImageExportOptions,
  CSVExportOptions,
  JSONExportData,
  ExportEvent,
} from './ExportManager';

// Filter manager (Day 7)
export { FilterManager } from './FilterManager';
export type {
  TaskFilterConfig,
  FilterStats,
  FilterChangeEvent,
} from './FilterManager';

// Baseline manager (Day 7)
export { BaselineManager } from './BaselineManager';
export type {
  BaselineSnapshot,
  TaskVariance,
  BaselineChangeEvent,
} from './BaselineManager';

// Critical path manager (Day 7)
export { CriticalPathManager } from './CriticalPathManager';
export type {
  CriticalPathChangeEvent,
} from './CriticalPathManager';

// Calendar manager (Day 7)
export { CalendarManager } from './CalendarManager';
export type {
  CalendarChangeEvent,
  ResourceCalendar,
} from './CalendarManager';
