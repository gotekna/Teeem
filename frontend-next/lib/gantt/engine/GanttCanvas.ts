/**
 * GanttCanvas - Pure Canvas Gantt Chart Engine
 *
 * A high-performance canvas-based Gantt chart renderer designed to handle
 * 10,000+ tasks at 60fps. No external dependencies. Pure craftsmanship.
 *
 * Part of the 3-Year Schedule Master Masterpiece Plan.
 */

import { Viewport, ViewportState } from './Viewport';
import { Renderer } from './Renderer';
import { UndoManager, Command } from './UndoManager';
import { WorkingDaysCalendar, Holiday, WorkingDaysConfig } from './WorkingDaysCalendar';
import { calculateCriticalPath, CriticalPathResult, TaskSchedule } from './CriticalPath';

// Re-export Command type for external use
export type { Command } from './UndoManager';
export {
  createMoveTaskCommand,
  createResizeTaskCommand,
  createAddDependencyCommand,
  createRemoveDependencyCommand,
  createDeleteTaskCommand,
} from './UndoManager';

// Re-export working days calendar types
export type { Holiday, WorkingDaysConfig } from './WorkingDaysCalendar';
export { WorkingDaysCalendar, getAustralianHolidays } from './WorkingDaysCalendar';

// Re-export critical path types
export type { CriticalPathResult, TaskSchedule } from './CriticalPath';
export { calculateCriticalPath, getCriticalPathSummary } from './CriticalPath';

// ============================================================================
// Types
// ============================================================================

/** Hold reason types for paused jobs */
export type HoldReason =
  | 'whs_incident'
  | 'weather_delay'
  | 'permit_delay'
  | 'client_request'
  | 'material_delay'
  | 'subcontractor_issue'
  | 'other';

/** Hold state information for paused tasks */
export interface HoldState {
  reason: HoldReason;
  notes?: string;
  heldAt: Date;
  heldBy?: string;
}

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress?: number;
  status?: 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'at-risk';
  locked?: 'supplierConfirmed' | 'started' | 'manuallyPositioned';
  predecessorIds?: string[];
  /** IDs of broken dependencies (predecessor moved/deleted but link preserved) */
  brokenPredecessorIds?: string[];
  supplierId?: number;
  supplierName?: string;
  /** Hold state for paused tasks */
  holdState?: HoldState;
}

/**
 * Baseline data for schedule comparison
 * Stores the original planned dates for a task
 */
export interface GanttBaseline {
  taskId: string;
  startDate: Date;
  endDate: Date;
  /** Name at time of baseline (optional, for reference) */
  name?: string;
  /** When this baseline was captured */
  capturedAt?: Date;
}

export interface GanttDependency {
  id: string;
  fromId: string;
  toId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag?: number;
}

export interface GanttConfig {
  rowHeight: number;
  headerHeight: number;
  taskBarHeight: number;
  taskBarPadding: number;
  dayWidth: number;
  minDayWidth: number;
  maxDayWidth: number;
  colors: GanttColors;
  darkMode: boolean;
}

export interface GanttColors {
  background: string;
  gridLines: string;
  todayMarker: string;
  weekendBackground: string;
  taskBar: {
    notStarted: string;
    inProgress: string;
    completed: string;
    onHold: string;
    atRisk: string;
  };
  taskBarBorder: string;
  taskBarText: string;
  headerBackground: string;
  headerText: string;
  selectedRow: string;
  hoverRow: string;
}

export interface GanttState {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  selectedTaskIds: Set<string>;
  lastSelectedTaskId: string | null; // For shift+click range selection
  hoveredTaskId: string | null;
  hoveredEdge: 'left' | 'right' | null; // For resize handle highlighting
  viewportState: ViewportState;
}

export interface ContextMenuItem {
  id: string;
  label?: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  danger?: boolean;
  type?: 'divider';
  separator?: boolean;
}

// ============================================================================
// Feature 6: Tooltip Types
// ============================================================================

export interface TooltipConfig {
  enabled: boolean;
  delay: number;
  maxWidth: number;
  showProgress: boolean;
  showDates: boolean;
  showDuration: boolean;
  showDependencies: boolean;
  showSupplier: boolean;
  showStatus: boolean;
  position: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  customFields?: string[];
}

export interface TooltipLine {
  type?: string;
  label: string;
  value?: string;
  color?: string;
  bold?: boolean;
  progress?: number;
  icon?: string;
}

export interface TooltipContent {
  title?: string;
  lines: TooltipLine[];
  footer?: string;
  maxWidth?: number;
}

// ============================================================================
// Feature 7: Animation Types
// ============================================================================

export type EasingFunction =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeOutBounce'
  | 'easeOutElastic'
  | 'easeOutBack'
  | 'easeInOutSine'
  | 'spring';

export interface Animation {
  id: string;
  type?: string;
  targetId?: string;
  startTime: number;
  duration: number;
  easing: EasingFunction;
  from: Record<string, number>;
  to: Record<string, number>;
  onUpdate?: (progress: number, values: Record<string, number>) => void;
  onComplete?: () => void;
  repeat?: number;
  yoyo?: boolean;
  data?: Record<string, unknown>;
}

// ============================================================================
// Feature 8: Task Notes Types
// ============================================================================

export type TaskNoteType = 'note' | 'warning' | 'issue' | 'question' | 'info' | 'comment';

export interface TaskNote {
  id: string;
  taskId: string;
  content: string;
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  type: TaskNoteType;
}

// ============================================================================
// Feature 9: Milestone Types
// ============================================================================

export type MilestoneShape = 'diamond' | 'circle' | 'square' | 'triangle';
export type MilestoneLabelPosition = 'top' | 'bottom' | 'left' | 'right';

export interface MilestoneConfig {
  shape: MilestoneShape;
  size: number;
  color: string;
  showLabel: boolean;
  labelPosition: MilestoneLabelPosition;
}

// ============================================================================
// Feature 10: Summary Task Types
// ============================================================================

export interface SummaryTaskConfig {
  barHeight: number;
  barColor: string;
  endCaps: boolean;
  showProgress: boolean;
  progressColor: string;
  showDateRange: boolean;
  autoCalculateDates: boolean;
}

export interface SummaryTaskInfo {
  taskId: string;
  childCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  averageProgress: number;
  minStart?: Date;
  maxEnd?: Date;
}

// ============================================================================
// Additional Types for Features
// ============================================================================

export interface TaskFilterConfig {
  status?: GanttTask['status'][];
  supplierIds?: number[];
  dateRange?: { start: Date; end: Date };
  progressRange?: { min: number; max: number };
  locked?: boolean;
  searchText?: string;
  customPredicate?: (task: GanttTask) => boolean;
  criticalPathOnly?: boolean;
  onHoldOnly?: boolean;
  brokenDependenciesOnly?: boolean;
}

export interface FilterStats {
  total: number;
  visible: number;
  hidden: number;
  percentage: number;
}

export interface MarqueeBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selectedCount: number;
}

export interface ContextMenuTheme {
  backgroundColor: string;
  textColor: string;
  hoverBackgroundColor: string;
  borderColor: string;
  dividerColor: string;
  dangerColor: string;
  disabledColor: string;
  shortcutColor: string;
  borderRadius: number;
  itemPadding: number;
  minWidth: number;
  maxWidth: number;
  shadowBlur: number;
  shadowColor: string;
}

export interface ScheduleVariance {
  taskId: string;
  startVarianceDays: number;
  endVarianceDays: number;
  durationVariance: number;
  isDelayed: boolean;
  isAhead: boolean;
  hasSlipped: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const defaultLightColors: GanttColors = {
  background: '#ffffff',
  gridLines: '#e5e7eb',
  todayMarker: '#ef4444',
  weekendBackground: '#f9fafb',
  taskBar: {
    notStarted: '#9ca3af',
    inProgress: '#3b82f6',
    completed: '#22c55e',
    onHold: '#f59e0b',
    atRisk: '#ef4444',
  },
  taskBarBorder: '#374151',
  taskBarText: '#ffffff',
  headerBackground: '#f3f4f6',
  headerText: '#374151',
  selectedRow: '#dbeafe',
  hoverRow: '#f3f4f6',
};

const defaultDarkColors: GanttColors = {
  background: '#1f2937',
  gridLines: '#374151',
  todayMarker: '#ef4444',
  weekendBackground: '#111827',
  taskBar: {
    notStarted: '#6b7280',
    inProgress: '#3b82f6',
    completed: '#22c55e',
    onHold: '#f59e0b',
    atRisk: '#ef4444',
  },
  taskBarBorder: '#9ca3af',
  taskBarText: '#ffffff',
  headerBackground: '#111827',
  headerText: '#e5e7eb',
  selectedRow: '#1e3a5f',
  hoverRow: '#374151',
};

const defaultConfig: GanttConfig = {
  rowHeight: 40,
  headerHeight: 60,
  taskBarHeight: 24,
  taskBarPadding: 8,
  dayWidth: 40,
  minDayWidth: 10,
  maxDayWidth: 100,
  colors: defaultLightColors,
  darkMode: false,
};

// ============================================================================
// GanttCanvas Class
// ============================================================================

export class GanttCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private config: GanttConfig;
  private state: GanttState;
  private viewport: Viewport;
  private renderer: Renderer;
  private animationFrameId: number | null = null;
  private isDirty: boolean = true;
  private containerWidth: number = 0;
  private containerHeight: number = 0;

  // Drag state
  private isDragging: boolean = false;
  private dragTask: GanttTask | null = null;
  private dragStartX: number = 0;
  private dragStartDate: Date | null = null;
  private dragCurrentDate: Date | null = null;
  private dragThreshold: number = 5; // pixels before drag starts

  // Resize state
  private isResizing: boolean = false;
  private resizeTask: GanttTask | null = null;
  private resizeEdge: 'left' | 'right' | null = null;
  private resizeStartX: number = 0;
  private resizeOriginalStart: Date | null = null;
  private resizeOriginalEnd: Date | null = null;
  private resizeCurrentStart: Date | null = null;
  private resizeCurrentEnd: Date | null = null;
  private resizeHandleWidth: number = 8; // pixels for edge detection

  // Progress drag state
  private isDraggingProgress: boolean = false;
  private progressDragTask: GanttTask | null = null;
  private progressDragStartX: number = 0;
  private progressDragOriginal: number = 0;
  private progressDragCurrent: number = 0;

  // Marquee selection state
  private isMarqueeSelecting: boolean = false;
  private marqueeStartX: number = 0;
  private marqueeStartY: number = 0;
  private marqueeEndX: number = 0;
  private marqueeEndY: number = 0;
  private marqueeSelectedIds: Set<string> = new Set();

  // Clipboard for copy/paste
  private clipboardTask: GanttTask | null = null;
  private clipboardIsCut: boolean = false;

  // Mouse position for tooltip
  private mouseX: number = 0;
  private mouseY: number = 0;

  // Dependency creation state
  private isCreatingDependency: boolean = false;
  private dependencyFromTask: GanttTask | null = null;
  private dependencyFromEdge: 'start' | 'end' | null = null;
  private dependencyTargetTask: GanttTask | null = null;
  private dependencyLineEndX: number = 0;
  private dependencyLineEndY: number = 0;
  private connectorRadius: number = 5;

  // Undo/Redo manager
  private undoManager: UndoManager;

  // Working days calendar
  private calendar: WorkingDaysCalendar;

  // Context menu state
  private contextMenuVisible: boolean = false;
  private contextMenuX: number = 0;
  private contextMenuY: number = 0;
  private contextMenuTask: GanttTask | null = null;
  private contextMenuItems: ContextMenuItem[] = [];
  private contextMenuHoveredItem: string | null = null;

  // Minimap state
  private minimapVisible: boolean = true;
  private minimapBounds: { x: number; y: number; width: number; height: number; viewportRect: { x: number; y: number; width: number; height: number } } | null = null;
  private isDraggingMinimap: boolean = false;
  private minimapDragStartX: number = 0;
  private minimapDragStartY: number = 0;
  private minimapDragStartScrollX: number = 0;
  private minimapDragStartScrollY: number = 0;

  // Critical path state
  private criticalPathEnabled: boolean = false;
  private criticalPathResult: CriticalPathResult | null = null;

  // Baseline comparison state
  private baselineEnabled: boolean = false;
  private baselineData: Map<string, GanttBaseline> = new Map();

  // Dependency highlighting animation state
  private highlightedDeps: Set<string> = new Set();
  private highlightPhase: number = 0;
  private highlightAnimationId: number | null = null;

  // Performance: Anti-flicker render suppression
  // When true, markDirty() calls are ignored to prevent flickering during drag operations
  private suppressRender: boolean = false;
  private pendingUpdates: Map<string, GanttTask> = new Map(); // Deduplicate updates
  private cascadeInProgress: boolean = false; // Prevent cascade loops

  // Performance: Debounced state persistence
  private statePersistenceKey: string = 'gantt-canvas-state';
  private statePersistenceDebounceMs: number = 1000;
  private statePersistenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private statePersistenceEnabled: boolean = false;

  // Event handlers
  private onTaskClick?: (task: GanttTask) => void;
  private onTaskDoubleClick?: (task: GanttTask) => void;
  private onTaskDrag?: (task: GanttTask, newStartDate: Date) => void;
  private onTaskDelete?: (task: GanttTask) => void;
  private onTaskResize?: (task: GanttTask, newStartDate: Date, newEndDate: Date) => void;
  private onDependencyCreate?: (fromTaskId: string, toTaskId: string, type: 'FS' | 'SS' | 'FF' | 'SF') => void;
  private onUndoStateChange?: (canUndo: boolean, canRedo: boolean) => void;
  private onContextMenuAction?: (actionId: string, task: GanttTask | null) => void;
  private onTaskUpdate?: (task: GanttTask) => void;
  private onProgressChange?: (task: GanttTask, newProgress: number) => void;
  private onSelectionChange?: (selectedTaskIds: string[]) => void;

  constructor(container: HTMLElement, options?: Partial<GanttConfig>) {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    // Get 2D context
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Get device pixel ratio for sharp rendering
    this.dpr = window.devicePixelRatio || 1;

    // Merge config with defaults
    this.config = {
      ...defaultConfig,
      ...options,
      colors: options?.darkMode ? defaultDarkColors : defaultLightColors,
    };

    // Initialize state
    this.state = {
      tasks: [],
      dependencies: [],
      selectedTaskIds: new Set(),
      lastSelectedTaskId: null,
      hoveredTaskId: null,
      hoveredEdge: null,
      viewportState: {
        scrollX: 0,
        scrollY: 0,
        zoom: 1,
        startDate: new Date(),
      },
    };

    // Create viewport manager
    this.viewport = new Viewport(this.config, this.state.viewportState);

    // Create renderer
    this.renderer = new Renderer(this.ctx, this.config, this.viewport);

    // Create undo manager with listener
    this.undoManager = new UndoManager(10);
    this.undoManager.subscribe((canUndo, canRedo) => {
      this.onUndoStateChange?.(canUndo, canRedo);
    });

    // Create working days calendar
    this.calendar = new WorkingDaysCalendar();

    // Set up canvas size
    this.resize();

    // Set up event listeners
    this.setupEventListeners();

    // Start render loop
    this.startRenderLoop();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Set the tasks to display
   */
  setTasks(tasks: GanttTask[]): void {
    this.state.tasks = tasks;
    this.markDirty();

    // Auto-calculate date range from tasks
    if (tasks.length > 0) {
      const minDate = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
      const maxDate = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));

      // Add padding (1 week before, 2 weeks after)
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 14);

      this.state.viewportState.startDate = minDate;
      this.viewport.setStartDate(minDate);
    }

    // Recalculate critical path if enabled
    this.recalculateCriticalPath();
  }

  /**
   * Set the dependencies between tasks
   */
  setDependencies(dependencies: GanttDependency[]): void {
    this.state.dependencies = dependencies;
    this.markDirty();

    // Recalculate critical path if enabled
    this.recalculateCriticalPath();
  }

  /**
   * Set dark mode
   */
  setDarkMode(darkMode: boolean): void {
    this.config.darkMode = darkMode;
    this.config.colors = darkMode ? defaultDarkColors : defaultLightColors;
    this.renderer.updateConfig(this.config);
    this.markDirty();
  }

  /**
   * Scroll to today
   */
  scrollToToday(): void {
    const today = new Date();
    const x = this.viewport.dateToX(today);
    this.viewport.scrollTo(x - this.containerWidth / 2, this.state.viewportState.scrollY);
    this.markDirty();
  }

  /**
   * Scroll to a specific date
   * @param date - The date to scroll to
   * @param center - If true, center the date in the viewport
   */
  scrollToDate(date: Date, center: boolean = true): void {
    const x = this.viewport.dateToX(date);
    const scrollX = center ? x - this.containerWidth / 2 : x;
    this.viewport.scrollTo(scrollX, this.state.viewportState.scrollY);
    this.markDirty();
  }

  /**
   * Scroll to a specific task
   * @param taskId - The task ID to scroll to
   * @param select - If true, also select the task
   */
  scrollToTask(taskId: string, select: boolean = false): void {
    const taskIndex = this.state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.state.tasks[taskIndex];

    // Calculate scroll position to center the task
    const x = this.viewport.dateToX(task.startDate);
    const y = this.viewport.rowToY(taskIndex);

    // Scroll to center the task both horizontally and vertically
    this.viewport.scrollTo(
      x - this.containerWidth / 3,
      y - this.containerHeight / 2 + this.config.headerHeight
    );

    // Optionally select the task
    if (select) {
      this.state.selectedTaskIds.clear();
      this.state.selectedTaskIds.add(taskId);
      this.state.lastSelectedTaskId = taskId;
      this.startDependencyFlash(taskId);
    }

    this.markDirty();
  }

  /**
   * Get the currently visible date range
   */
  getVisibleDateRange(): { start: Date; end: Date } {
    const startX = this.state.viewportState.scrollX;
    const endX = startX + this.containerWidth;
    return {
      start: this.viewport.xToDate(startX),
      end: this.viewport.xToDate(endX),
    };
  }

  /**
   * Get the currently visible task indices
   */
  getVisibleTaskRange(): { first: number; last: number } {
    const scrollY = this.state.viewportState.scrollY;
    const viewHeight = this.containerHeight - this.config.headerHeight;
    const first = Math.floor(scrollY / this.config.rowHeight);
    const last = Math.ceil((scrollY + viewHeight) / this.config.rowHeight);
    return {
      first: Math.max(0, first),
      last: Math.min(this.state.tasks.length - 1, last),
    };
  }

  /**
   * Zoom to fit all tasks
   */
  zoomToFit(): void {
    if (this.state.tasks.length === 0) return;

    const minDate = new Date(Math.min(...this.state.tasks.map(t => t.startDate.getTime())));
    const maxDate = new Date(Math.max(...this.state.tasks.map(t => t.endDate.getTime())));

    const daysDiff = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const availableWidth = this.containerWidth - 200; // Leave room for sidebar
    const idealDayWidth = availableWidth / daysDiff;

    const zoom = Math.max(0.1, Math.min(2, idealDayWidth / this.config.dayWidth));
    this.viewport.setZoom(zoom);
    this.state.viewportState.startDate = minDate;
    this.viewport.setStartDate(minDate);
    this.markDirty();
  }

  // ============================================================================
  // Zoom Presets (Day/Week/Month views)
  // ============================================================================

  /**
   * Zoom preset: Day view (one day fills ~40px)
   * Shows detailed day-by-day view
   */
  zoomToDay(): void {
    this.viewport.setZoom(1.0);
    this.markDirty();
  }

  /**
   * Zoom preset: Week view (one week fills ~40px)
   * Shows weekly overview with day labels
   */
  zoomToWeek(): void {
    this.viewport.setZoom(0.15);
    this.markDirty();
  }

  /**
   * Zoom preset: Month view (one month fills ~100px)
   * Shows monthly overview
   */
  zoomToMonth(): void {
    this.viewport.setZoom(0.05);
    this.markDirty();
  }

  /**
   * Get current zoom level name
   */
  getZoomLevel(): 'day' | 'week' | 'month' | 'custom' {
    const zoom = this.state.viewportState.zoom;
    if (zoom >= 0.8) return 'day';
    if (zoom >= 0.1 && zoom < 0.25) return 'week';
    if (zoom < 0.1) return 'month';
    return 'custom';
  }

  /**
   * Cycle through zoom presets: Day → Week → Month → Day
   */
  cycleZoomLevel(): void {
    const current = this.getZoomLevel();
    switch (current) {
      case 'day':
        this.zoomToWeek();
        break;
      case 'week':
        this.zoomToMonth();
        break;
      case 'month':
      case 'custom':
        this.zoomToDay();
        break;
    }
  }

  // ============================================================================
  // Batch Updates (Anti-Flicker)
  // ============================================================================

  /**
   * Apply batch updates to multiple tasks with anti-flicker protection
   * Use this for cascade operations where many tasks change at once
   *
   * @param updates - Map of task ID to updated task data
   * @param triggerCallbacks - Whether to call onTaskUpdate for each task (default: true)
   */
  batchUpdateTasks(
    updates: Map<string, Partial<GanttTask>>,
    triggerCallbacks: boolean = true
  ): void {
    if (updates.size === 0) return;

    // Prevent cascade loops
    if (this.cascadeInProgress) {
      console.warn('GanttCanvas: Ignoring nested batch update to prevent cascade loop');
      return;
    }

    this.cascadeInProgress = true;
    this.beginRenderSuppression();

    try {
      updates.forEach((update, taskId) => {
        const index = this.state.tasks.findIndex(t => t.id === taskId);
        if (index === -1) return;

        const task = this.state.tasks[index];
        const updatedTask = { ...task, ...update };
        this.state.tasks[index] = updatedTask;

        if (triggerCallbacks) {
          this.onTaskUpdate?.(updatedTask);
        }
      });

      this.debouncedPersistState();
    } finally {
      this.cascadeInProgress = false;
      this.endRenderSuppression();
    }
  }

  /**
   * Begin a batch update session (for external code)
   * Call endBatchUpdate() when done to trigger a single re-render
   */
  beginBatchUpdate(): void {
    this.beginRenderSuppression();
  }

  /**
   * End a batch update session and trigger re-render
   */
  endBatchUpdate(): void {
    this.applyPendingUpdates();
    this.endRenderSuppression();
  }

  /**
   * Update a single task during a batch session
   * Updates are queued and applied when endBatchUpdate() is called
   */
  queueUpdate(taskId: string, update: Partial<GanttTask>): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const existingUpdate = this.pendingUpdates.get(taskId) || task;
    this.pendingUpdates.set(taskId, { ...existingUpdate, ...update });
  }

  /**
   * Check if a cascade operation is currently in progress
   */
  isCascadeInProgress(): boolean {
    return this.cascadeInProgress;
  }

  /**
   * Set event handlers
   */
  onTaskClickHandler(handler: (task: GanttTask) => void): void {
    this.onTaskClick = handler;
  }

  onTaskDoubleClickHandler(handler: (task: GanttTask) => void): void {
    this.onTaskDoubleClick = handler;
  }

  onTaskDragHandler(handler: (task: GanttTask, newStartDate: Date) => void): void {
    this.onTaskDrag = handler;
  }

  onTaskDeleteHandler(handler: (task: GanttTask) => void): void {
    this.onTaskDelete = handler;
  }

  onTaskResizeHandler(handler: (task: GanttTask, newStartDate: Date, newEndDate: Date) => void): void {
    this.onTaskResize = handler;
  }

  onDependencyCreateHandler(handler: (fromTaskId: string, toTaskId: string, type: 'FS' | 'SS' | 'FF' | 'SF') => void): void {
    this.onDependencyCreate = handler;
  }

  onUndoStateChangeHandler(handler: (canUndo: boolean, canRedo: boolean) => void): void {
    this.onUndoStateChange = handler;
    // Immediately call with current state
    handler(this.undoManager.canUndo(), this.undoManager.canRedo());
  }

  onTaskUpdateHandler(handler: (task: GanttTask) => void): void {
    this.onTaskUpdate = handler;
  }

  onProgressChangeHandler(handler: (task: GanttTask, newProgress: number) => void): void {
    this.onProgressChange = handler;
  }

  onSelectionChangeHandler(handler: (selectedTaskIds: string[]) => void): void {
    this.onSelectionChange = handler;
  }

  /**
   * Record an action for undo/redo (use when action already executed externally)
   */
  recordAction(command: Command): void {
    this.undoManager.record(command);
  }

  /**
   * Undo the last action
   */
  undo(): void {
    const command = this.undoManager.undo();
    if (command) {
      this.markDirty();
    }
  }

  /**
   * Redo the last undone action
   */
  redo(): void {
    const command = this.undoManager.redo();
    if (command) {
      this.markDirty();
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undoManager.canRedo();
  }

  /**
   * Set handler for context menu actions
   */
  onContextMenuActionHandler(handler: (actionId: string, task: GanttTask | null) => void): void {
    this.onContextMenuAction = handler;
  }

  /**
   * Configure working days (array of day indices: 0=Sun, 1=Mon, ..., 6=Sat)
   */
  setWorkingDays(days: number[]): void {
    this.calendar.setWorkingDays(days);
    this.markDirty();
  }

  /**
   * Add holidays to the calendar
   */
  addHolidays(holidays: Holiday[]): void {
    this.calendar.addHolidays(holidays);
    this.markDirty();
  }

  /**
   * Clear all holidays
   */
  clearHolidays(): void {
    this.calendar.clearHolidays();
    this.markDirty();
  }

  /**
   * Get the working days calendar instance for advanced configuration
   */
  getCalendar(): WorkingDaysCalendar {
    return this.calendar;
  }

  /**
   * Show or hide the minimap
   */
  setMinimapVisible(visible: boolean): void {
    this.minimapVisible = visible;
    this.markDirty();
  }

  /**
   * Toggle minimap visibility
   */
  toggleMinimap(): void {
    this.minimapVisible = !this.minimapVisible;
    this.markDirty();
  }

  /**
   * Check if minimap is visible
   */
  isMinimapVisible(): boolean {
    return this.minimapVisible;
  }

  /**
   * Enable or disable critical path highlighting
   */
  setCriticalPathEnabled(enabled: boolean): void {
    this.criticalPathEnabled = enabled;
    if (enabled) {
      this.recalculateCriticalPath();
    } else {
      this.criticalPathResult = null;
    }
    this.markDirty();
  }

  /**
   * Toggle critical path highlighting
   */
  toggleCriticalPath(): void {
    this.setCriticalPathEnabled(!this.criticalPathEnabled);
  }

  /**
   * Check if critical path highlighting is enabled
   */
  isCriticalPathEnabled(): boolean {
    return this.criticalPathEnabled;
  }

  /**
   * Get the current critical path result (for external analysis)
   */
  getCriticalPathResult(): CriticalPathResult | null {
    return this.criticalPathResult;
  }

  /**
   * Recalculate the critical path
   */
  recalculateCriticalPath(): void {
    if (this.criticalPathEnabled) {
      this.criticalPathResult = calculateCriticalPath(this.state.tasks, this.state.dependencies);
      this.markDirty();
    }
  }

  /**
   * Enable or disable baseline comparison display
   */
  setBaselineEnabled(enabled: boolean): void {
    this.baselineEnabled = enabled;
    this.markDirty();
  }

  /**
   * Toggle baseline comparison display
   */
  toggleBaseline(): void {
    this.baselineEnabled = !this.baselineEnabled;
    this.markDirty();
  }

  /**
   * Check if baseline comparison is enabled
   */
  isBaselineEnabled(): boolean {
    return this.baselineEnabled;
  }

  /**
   * Set baseline data for comparison
   * @param baselines Array of baseline records
   */
  setBaselines(baselines: GanttBaseline[]): void {
    this.baselineData.clear();
    baselines.forEach(b => {
      this.baselineData.set(b.taskId, b);
    });
    this.markDirty();
  }

  /**
   * Capture current schedule as baseline
   * Creates baseline records from current task dates
   */
  captureBaseline(): GanttBaseline[] {
    const now = new Date();
    const baselines: GanttBaseline[] = this.state.tasks.map(task => ({
      taskId: task.id,
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
      name: task.name,
      capturedAt: now,
    }));

    this.setBaselines(baselines);
    return baselines;
  }

  /**
   * Clear all baseline data
   */
  clearBaselines(): void {
    this.baselineData.clear();
    this.markDirty();
  }

  /**
   * Get baseline for a specific task
   */
  getBaseline(taskId: string): GanttBaseline | undefined {
    return this.baselineData.get(taskId);
  }

  /**
   * Get all baseline data
   */
  getAllBaselines(): GanttBaseline[] {
    return Array.from(this.baselineData.values());
  }

  /**
   * Calculate variance between current and baseline for a task
   * Returns days difference (positive = delayed, negative = ahead)
   */
  getTaskVariance(taskId: string): { startVariance: number; endVariance: number; durationVariance: number } | null {
    const task = this.state.tasks.find(t => t.id === taskId);
    const baseline = this.baselineData.get(taskId);

    if (!task || !baseline) return null;

    const msPerDay = 24 * 60 * 60 * 1000;
    const startVariance = Math.round((task.startDate.getTime() - baseline.startDate.getTime()) / msPerDay);
    const endVariance = Math.round((task.endDate.getTime() - baseline.endDate.getTime()) / msPerDay);

    const currentDuration = Math.round((task.endDate.getTime() - task.startDate.getTime()) / msPerDay);
    const baselineDuration = Math.round((baseline.endDate.getTime() - baseline.startDate.getTime()) / msPerDay);
    const durationVariance = currentDuration - baselineDuration;

    return { startVariance, endVariance, durationVariance };
  }

  // ============================================================================
  // Task Locking API
  // ============================================================================

  /**
   * Lock a task with specified lock type
   * @param taskId - The task ID to lock
   * @param lockType - Type of lock (default: 'manuallyPositioned')
   */
  lockTask(taskId: string, lockType: 'supplierConfirmed' | 'started' | 'manuallyPositioned' = 'manuallyPositioned'): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.locked = lockType;
      this.markDirty();
      this.onTaskUpdate?.(task);
    }
  }

  /**
   * Unlock a task
   * @param taskId - The task ID to unlock
   */
  unlockTask(taskId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task && task.locked) {
      task.locked = undefined;
      this.markDirty();
      this.onTaskUpdate?.(task);
    }
  }

  /**
   * Toggle lock status of a task
   * @param taskId - The task ID to toggle
   * @returns The new lock state (locked type or undefined if unlocked)
   */
  toggleTaskLock(taskId: string): 'supplierConfirmed' | 'started' | 'manuallyPositioned' | undefined {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      if (task.locked) {
        task.locked = undefined;
      } else {
        task.locked = 'manuallyPositioned';
      }
      this.markDirty();
      this.onTaskUpdate?.(task);
      return task.locked;
    }
    return undefined;
  }

  /**
   * Check if a task is locked
   * @param taskId - The task ID to check
   */
  isTaskLocked(taskId: string): boolean {
    const task = this.state.tasks.find(t => t.id === taskId);
    return !!task?.locked;
  }

  /**
   * Get the lock type of a task
   * @param taskId - The task ID to check
   */
  getTaskLockType(taskId: string): 'supplierConfirmed' | 'started' | 'manuallyPositioned' | undefined {
    const task = this.state.tasks.find(t => t.id === taskId);
    return task?.locked;
  }

  /**
   * Lock multiple tasks at once
   * @param taskIds - Array of task IDs to lock
   * @param lockType - Type of lock to apply
   */
  lockTasks(taskIds: string[], lockType: 'supplierConfirmed' | 'started' | 'manuallyPositioned' = 'manuallyPositioned'): void {
    taskIds.forEach(taskId => {
      const task = this.state.tasks.find(t => t.id === taskId);
      if (task) {
        task.locked = lockType;
        this.onTaskUpdate?.(task);
      }
    });
    this.markDirty();
  }

  /**
   * Unlock multiple tasks at once
   * @param taskIds - Array of task IDs to unlock
   */
  unlockTasks(taskIds: string[]): void {
    taskIds.forEach(taskId => {
      const task = this.state.tasks.find(t => t.id === taskId);
      if (task && task.locked) {
        task.locked = undefined;
        this.onTaskUpdate?.(task);
      }
    });
    this.markDirty();
  }

  // ============================================================================
  // Hold State Management
  // ============================================================================

  /**
   * Put a task on hold with a reason
   * @param taskId - The task to put on hold
   * @param reason - The reason for holding
   * @param notes - Optional notes about the hold
   * @param heldBy - Optional name of who placed the hold
   */
  holdTask(taskId: string, reason: HoldReason, notes?: string, heldBy?: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'on-hold';
    task.holdState = {
      reason,
      notes,
      heldAt: new Date(),
      heldBy,
    };
    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Resume a task from hold
   * @param taskId - The task to resume
   * @param newStatus - The status to set after resuming (default: 'in-progress')
   */
  resumeTask(taskId: string, newStatus: 'not-started' | 'in-progress' = 'in-progress'): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'on-hold') return;

    task.status = newStatus;
    task.holdState = undefined;
    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Check if a task is on hold
   */
  isTaskOnHold(taskId: string): boolean {
    const task = this.state.tasks.find(t => t.id === taskId);
    return task?.status === 'on-hold';
  }

  /**
   * Get the hold state for a task
   */
  getHoldState(taskId: string): HoldState | undefined {
    const task = this.state.tasks.find(t => t.id === taskId);
    return task?.holdState;
  }

  /**
   * Get all tasks currently on hold
   */
  getTasksOnHold(): GanttTask[] {
    return this.state.tasks.filter(t => t.status === 'on-hold');
  }

  /**
   * Get tasks on hold by reason
   */
  getTasksOnHoldByReason(reason: HoldReason): GanttTask[] {
    return this.state.tasks.filter(t => t.status === 'on-hold' && t.holdState?.reason === reason);
  }

  /**
   * Get hold reason display name
   */
  static getHoldReasonDisplayName(reason: HoldReason): string {
    const displayNames: Record<HoldReason, string> = {
      'whs_incident': 'WHS Incident',
      'weather_delay': 'Weather Delay',
      'permit_delay': 'Permit Delay',
      'client_request': 'Client Request',
      'material_delay': 'Material Delay',
      'subcontractor_issue': 'Subcontractor Issue',
      'other': 'Other',
    };
    return displayNames[reason] || reason;
  }

  // ============================================================================
  // Today Constraint Detection
  // ============================================================================

  /**
   * Check if moving a task to a date would violate the "today constraint"
   * (i.e., trying to schedule a task to start before today)
   * @param taskId - The task to check
   * @param proposedStartDate - The proposed new start date
   * @returns true if the date is before today
   */
  wouldViolateTodayConstraint(taskId: string, proposedStartDate: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const proposed = new Date(proposedStartDate);
    proposed.setHours(0, 0, 0, 0);

    return proposed < today;
  }

  /**
   * Check if a task currently violates the today constraint
   * (is scheduled to start before today but hasn't started)
   */
  violatesTodayConstraint(taskId: string): boolean {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return false;

    // Already started or completed tasks don't violate
    if (task.status === 'in-progress' || task.status === 'completed') {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const taskStart = new Date(task.startDate);
    taskStart.setHours(0, 0, 0, 0);

    return taskStart < today;
  }

  /**
   * Get all tasks that violate the today constraint
   * (scheduled before today but not started)
   */
  getTasksViolatingTodayConstraint(): GanttTask[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.state.tasks.filter(task => {
      if (task.status === 'in-progress' || task.status === 'completed') {
        return false;
      }

      const taskStart = new Date(task.startDate);
      taskStart.setHours(0, 0, 0, 0);

      return taskStart < today;
    });
  }

  /**
   * Check if moving a task would cause any predecessor constraint violations
   * @param taskId - The task to check
   * @param proposedStartDate - The proposed new start date
   * @returns Object with violation details
   */
  checkMoveConstraints(taskId: string, proposedStartDate: Date): {
    violatesToday: boolean;
    violatesPredecessors: { predecessorId: string; predecessorEndDate: Date }[];
    canMove: boolean;
  } {
    const result = {
      violatesToday: this.wouldViolateTodayConstraint(taskId, proposedStartDate),
      violatesPredecessors: [] as { predecessorId: string; predecessorEndDate: Date }[],
      canMove: true,
    };

    // Check predecessor constraints
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task && task.predecessorIds) {
      const proposed = new Date(proposedStartDate);
      proposed.setHours(0, 0, 0, 0);

      for (const predId of task.predecessorIds) {
        const predecessor = this.state.tasks.find(t => t.id === predId);
        if (!predecessor) continue;

        // Get the dependency to check lag
        const dep = this.state.dependencies.find(
          d => d.fromId === predId && d.toId === taskId
        );
        const lag = dep?.lag || 0;

        // For FS dependencies, successor can't start before predecessor ends + lag
        if (!dep || dep.type === 'FS') {
          const predEnd = new Date(predecessor.endDate);
          predEnd.setHours(0, 0, 0, 0);

          const minStart = new Date(predEnd);
          minStart.setDate(minStart.getDate() + 1 + lag);

          if (proposed < minStart) {
            result.violatesPredecessors.push({
              predecessorId: predId,
              predecessorEndDate: predEnd,
            });
          }
        }
      }
    }

    result.canMove = !result.violatesToday && result.violatesPredecessors.length === 0;
    return result;
  }

  // ============================================================================
  // Dependency Management & Circular Detection
  // ============================================================================

  /**
   * Check if adding a dependency would create a circular reference
   * Uses depth-first search to detect cycles
   * @param fromId - Source task ID
   * @param toId - Target task ID
   * @returns true if adding this dependency would create a cycle
   */
  wouldCreateCircularDependency(fromId: string, toId: string): boolean {
    // Direct cycle: A → A
    if (fromId === toId) return true;

    // Build successor map for efficient traversal
    const successorMap = new Map<string, string[]>();
    this.state.dependencies.forEach(dep => {
      const existing = successorMap.get(dep.fromId) || [];
      existing.push(dep.toId);
      successorMap.set(dep.fromId, existing);
    });

    // Add the proposed dependency temporarily
    const existingSuccessors = successorMap.get(fromId) || [];
    successorMap.set(fromId, [...existingSuccessors, toId]);

    // DFS to detect if we can reach fromId starting from toId
    const visited = new Set<string>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) return true; // Cycle detected!

      if (visited.has(current)) continue;
      visited.add(current);

      const successors = successorMap.get(current) || [];
      for (const successor of successors) {
        if (!visited.has(successor)) {
          stack.push(successor);
        }
      }
    }

    return false;
  }

  /**
   * Find all circular dependencies in the current dependency graph
   * @returns Array of cycle paths, each as an array of task IDs
   */
  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];

    // Build successor map
    const successorMap = new Map<string, string[]>();
    this.state.dependencies.forEach(dep => {
      const existing = successorMap.get(dep.fromId) || [];
      existing.push(dep.toId);
      successorMap.set(dep.fromId, existing);
    });

    // Track visited nodes and current path
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): void => {
      visited.add(taskId);
      recStack.add(taskId);
      path.push(taskId);

      const successors = successorMap.get(taskId) || [];
      for (const successor of successors) {
        if (!visited.has(successor)) {
          dfs(successor);
        } else if (recStack.has(successor)) {
          // Found a cycle - extract the cycle from path
          const cycleStart = path.indexOf(successor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), successor]);
          }
        }
      }

      path.pop();
      recStack.delete(taskId);
    };

    // Run DFS from all task IDs that have dependencies
    const allTaskIds = new Set<string>();
    this.state.dependencies.forEach(dep => {
      allTaskIds.add(dep.fromId);
      allTaskIds.add(dep.toId);
    });

    allTaskIds.forEach(taskId => {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    });

    return cycles;
  }

  /**
   * Add a dependency with circular dependency prevention
   * @param fromId - Source task ID
   * @param toId - Target task ID
   * @param type - Dependency type (FS, SS, FF, SF)
   * @param lag - Optional lag in days
   * @returns The new dependency if created, or null if it would cause a cycle
   */
  addDependency(
    fromId: string,
    toId: string,
    type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS',
    lag: number = 0
  ): GanttDependency | null {
    // Check for circular dependency
    if (this.wouldCreateCircularDependency(fromId, toId)) {
      console.warn(`Circular dependency prevented: ${fromId} → ${toId}`);
      return null;
    }

    // Check if dependency already exists
    const existingDep = this.state.dependencies.find(
      d => d.fromId === fromId && d.toId === toId
    );
    if (existingDep) {
      console.warn(`Dependency already exists: ${fromId} → ${toId}`);
      return existingDep;
    }

    // Create and add the dependency
    const newDep: GanttDependency = {
      id: `dep-${fromId}-${toId}-${Date.now()}`,
      fromId,
      toId,
      type,
      lag,
    };

    this.state.dependencies.push(newDep);
    this.markDirty();

    // Recalculate critical path if enabled
    if (this.criticalPathEnabled) {
      this.recalculateCriticalPath();
    }

    // Notify external handler
    this.onDependencyCreate?.(fromId, toId, type);

    return newDep;
  }

  /**
   * Remove a dependency by ID
   * @param dependencyId - The dependency ID to remove
   * @returns true if removed, false if not found
   */
  removeDependency(dependencyId: string): boolean {
    const index = this.state.dependencies.findIndex(d => d.id === dependencyId);
    if (index === -1) return false;

    this.state.dependencies.splice(index, 1);
    this.markDirty();

    // Recalculate critical path if enabled
    if (this.criticalPathEnabled) {
      this.recalculateCriticalPath();
    }

    return true;
  }

  /**
   * Remove a dependency between two tasks
   * @param fromId - Source task ID
   * @param toId - Target task ID
   * @returns true if removed, false if not found
   */
  removeDependencyBetween(fromId: string, toId: string): boolean {
    const dep = this.state.dependencies.find(d => d.fromId === fromId && d.toId === toId);
    if (!dep) return false;
    return this.removeDependency(dep.id);
  }

  /**
   * Get all predecessors (dependencies pointing TO a task)
   * @param taskId - The task ID
   */
  getPredecessors(taskId: string): GanttDependency[] {
    return this.state.dependencies.filter(d => d.toId === taskId);
  }

  /**
   * Get all successors (dependencies pointing FROM a task)
   * @param taskId - The task ID
   */
  getSuccessors(taskId: string): GanttDependency[] {
    return this.state.dependencies.filter(d => d.fromId === taskId);
  }

  /**
   * Validate all dependencies and remove any circular ones
   * @returns Array of removed circular dependency IDs
   */
  removeCircularDependencies(): string[] {
    const removedIds: string[] = [];
    const cycles = this.findCircularDependencies();

    if (cycles.length === 0) return removedIds;

    console.warn(`Found ${cycles.length} circular dependencies, removing...`);

    // For each cycle, remove the last dependency (the one that closes the loop)
    cycles.forEach(cycle => {
      if (cycle.length < 2) return;

      // Find the dependency that closes this cycle
      const lastTaskId = cycle[cycle.length - 2];
      const cycleCloser = cycle[cycle.length - 1];

      const dep = this.state.dependencies.find(
        d => d.fromId === lastTaskId && d.toId === cycleCloser
      );

      if (dep && !removedIds.includes(dep.id)) {
        console.log(`Removing circular dependency: ${dep.fromId} → ${dep.toId}`);
        this.removeDependency(dep.id);
        removedIds.push(dep.id);
      }
    });

    return removedIds;
  }

  // ============================================================================
  // Broken Dependencies Management
  // ============================================================================

  /**
   * Check if a task has broken predecessor dependencies
   * A dependency is broken when the predecessor doesn't exist or dates conflict
   */
  hasBrokenDependencies(taskId: string): boolean {
    const task = this.state.tasks.find(t => t.id === taskId);
    return !!(task?.brokenPredecessorIds && task.brokenPredecessorIds.length > 0);
  }

  /**
   * Get all broken dependencies for a task
   */
  getBrokenDependencies(taskId: string): string[] {
    const task = this.state.tasks.find(t => t.id === taskId);
    return task?.brokenPredecessorIds || [];
  }

  /**
   * Mark a dependency as broken (preserve the link but flag it)
   * @param taskId - The task with the broken predecessor
   * @param predecessorId - The ID of the broken predecessor
   */
  markDependencyAsBroken(taskId: string, predecessorId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.brokenPredecessorIds) {
      task.brokenPredecessorIds = [];
    }

    if (!task.brokenPredecessorIds.includes(predecessorId)) {
      task.brokenPredecessorIds.push(predecessorId);
      this.markDirty();
      this.onTaskUpdate?.(task);
    }
  }

  /**
   * Restore a broken dependency (remove from broken list)
   * @param taskId - The task with the broken predecessor
   * @param predecessorId - The ID of the predecessor to restore
   */
  restoreBrokenDependency(taskId: string, predecessorId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task || !task.brokenPredecessorIds) return;

    const index = task.brokenPredecessorIds.indexOf(predecessorId);
    if (index !== -1) {
      task.brokenPredecessorIds.splice(index, 1);
      if (task.brokenPredecessorIds.length === 0) {
        task.brokenPredecessorIds = undefined;
      }
      this.markDirty();
      this.onTaskUpdate?.(task);
    }
  }

  /**
   * Restore all broken dependencies for a task
   * @param taskId - The task to restore dependencies for
   */
  restoreAllBrokenDependencies(taskId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task || !task.brokenPredecessorIds) return;

    task.brokenPredecessorIds = undefined;
    this.markDirty();
    this.onTaskUpdate?.(task);
  }

  /**
   * Check all dependencies for validity and mark broken ones
   * A dependency is considered broken if:
   * - The predecessor task doesn't exist
   * - The successor starts before the predecessor ends (for FS type)
   */
  validateDependencies(): { taskId: string; brokenPredecessorId: string; reason: string }[] {
    const broken: { taskId: string; brokenPredecessorId: string; reason: string }[] = [];
    const taskMap = new Map(this.state.tasks.map(t => [t.id, t]));

    this.state.dependencies.forEach(dep => {
      const fromTask = taskMap.get(dep.fromId);
      const toTask = taskMap.get(dep.toId);

      if (!fromTask) {
        // Predecessor doesn't exist
        broken.push({
          taskId: dep.toId,
          brokenPredecessorId: dep.fromId,
          reason: 'Predecessor task does not exist',
        });
        return;
      }

      if (!toTask) {
        // Successor doesn't exist (orphan dependency)
        return;
      }

      // Check date constraint violations based on dependency type
      const lag = dep.lag || 0;
      let isViolated = false;
      let reason = '';

      switch (dep.type) {
        case 'FS': // Finish-to-Start: successor must start after predecessor ends
          const minStartDate = new Date(fromTask.endDate);
          minStartDate.setDate(minStartDate.getDate() + lag + 1);
          if (toTask.startDate < minStartDate) {
            isViolated = true;
            reason = `Starts before predecessor finishes (needs +${Math.ceil((minStartDate.getTime() - toTask.startDate.getTime()) / (24*60*60*1000))} days)`;
          }
          break;

        case 'SS': // Start-to-Start: successor must start after predecessor starts
          const minSSStart = new Date(fromTask.startDate);
          minSSStart.setDate(minSSStart.getDate() + lag);
          if (toTask.startDate < minSSStart) {
            isViolated = true;
            reason = `Starts before predecessor starts`;
          }
          break;

        case 'FF': // Finish-to-Finish: successor must finish after predecessor finishes
          const minFFEnd = new Date(fromTask.endDate);
          minFFEnd.setDate(minFFEnd.getDate() + lag);
          if (toTask.endDate < minFFEnd) {
            isViolated = true;
            reason = `Finishes before predecessor finishes`;
          }
          break;

        case 'SF': // Start-to-Finish: successor must finish after predecessor starts
          const minSFEnd = new Date(fromTask.startDate);
          minSFEnd.setDate(minSFEnd.getDate() + lag);
          if (toTask.endDate < minSFEnd) {
            isViolated = true;
            reason = `Finishes before predecessor starts`;
          }
          break;
      }

      if (isViolated) {
        broken.push({
          taskId: toTask.id,
          brokenPredecessorId: fromTask.id,
          reason,
        });
      }
    });

    return broken;
  }

  /**
   * Get all tasks with broken dependencies
   */
  getTasksWithBrokenDependencies(): GanttTask[] {
    return this.state.tasks.filter(t => t.brokenPredecessorIds && t.brokenPredecessorIds.length > 0);
  }

  /**
   * Get IDs of broken dependencies (for rendering)
   */
  getBrokenDependencyIds(): Set<string> {
    const brokenIds = new Set<string>();

    this.state.tasks.forEach(task => {
      if (task.brokenPredecessorIds) {
        task.brokenPredecessorIds.forEach(predId => {
          // Find the dependency between predId and this task
          const dep = this.state.dependencies.find(
            d => d.fromId === predId && d.toId === task.id
          );
          if (dep) {
            brokenIds.add(dep.id);
          }
        });
      }
    });

    return brokenIds;
  }

  /**
   * Start flashing animation for dependencies connected to a task
   */
  private startDependencyFlash(taskId: string): void {
    // Stop any existing animation
    this.stopDependencyFlash();

    // Find all dependencies connected to this task
    this.highlightedDeps.clear();
    this.state.dependencies.forEach(dep => {
      if (dep.fromId === taskId || dep.toId === taskId) {
        this.highlightedDeps.add(dep.id);
      }
    });

    if (this.highlightedDeps.size === 0) return;

    // Start animation
    this.highlightPhase = 0;
    let frameCount = 0;
    const totalFrames = 30; // ~0.5 second animation

    const animate = () => {
      frameCount++;
      // Use sine wave for smooth pulsing
      this.highlightPhase = Math.sin((frameCount / totalFrames) * Math.PI * 3) * 0.5 + 0.5;
      this.markDirty();

      if (frameCount < totalFrames) {
        this.highlightAnimationId = requestAnimationFrame(animate);
      } else {
        // Animation complete - keep highlighted but stop pulsing
        this.highlightPhase = 1;
        this.highlightAnimationId = null;
        this.markDirty();
      }
    };

    this.highlightAnimationId = requestAnimationFrame(animate);
  }

  /**
   * Stop dependency flashing animation
   */
  private stopDependencyFlash(): void {
    if (this.highlightAnimationId !== null) {
      cancelAnimationFrame(this.highlightAnimationId);
      this.highlightAnimationId = null;
    }
    this.highlightedDeps.clear();
    this.highlightPhase = 0;
  }

  /**
   * Get current highlight phase for animation
   */
  getHighlightPhase(): number {
    return this.highlightPhase;
  }

  /**
   * Get currently highlighted dependency IDs
   */
  getHighlightedDeps(): Set<string> {
    return this.highlightedDeps;
  }

  /**
   * Resize the canvas
   */
  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    this.containerWidth = rect.width;
    this.containerHeight = rect.height;

    // Set canvas size accounting for device pixel ratio
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    // Scale context for HiDPI displays
    this.ctx.scale(this.dpr, this.dpr);

    this.markDirty();
  }

  /**
   * Destroy the canvas and clean up
   */
  destroy(): void {
    this.stopRenderLoop();
    this.removeEventListeners();
    this.canvas.remove();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Mark the canvas as dirty (needs re-render)
   * Respects suppressRender flag to prevent flickering during drag operations
   */
  private markDirty(): void {
    // Anti-flicker: Skip marking dirty if render is suppressed
    if (this.suppressRender) {
      return;
    }
    this.isDirty = true;
  }

  /**
   * Force a re-render even when suppressRender is active
   * Use sparingly - only for critical visual updates during drag
   */
  private forceRender(): void {
    this.isDirty = true;
  }

  /**
   * Begin render suppression for drag/cascade operations
   * Prevents flickering by batching visual updates
   */
  private beginRenderSuppression(): void {
    this.suppressRender = true;
  }

  /**
   * End render suppression and trigger a single re-render
   * Uses requestAnimationFrame for smooth deferred update
   */
  private endRenderSuppression(): void {
    this.suppressRender = false;
    // Use RAF to ensure we render after all pending updates are applied
    requestAnimationFrame(() => {
      this.isDirty = true;
    });
  }

  /**
   * Queue a task update for batching
   * Deduplicates updates to the same task
   */
  private queueTaskUpdate(task: GanttTask): void {
    this.pendingUpdates.set(task.id, { ...task });
  }

  /**
   * Apply all pending updates and clear the queue
   */
  private applyPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) return;

    this.pendingUpdates.forEach((updatedTask, taskId) => {
      const index = this.state.tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.state.tasks[index] = updatedTask;
        this.onTaskUpdate?.(updatedTask);
      }
    });

    this.pendingUpdates.clear();
    this.debouncedPersistState();
  }

  // ============================================================================
  // State Persistence (Debounced)
  // ============================================================================

  /**
   * Enable state persistence to localStorage
   */
  enableStatePersistence(key?: string, debounceMs?: number): void {
    this.statePersistenceEnabled = true;
    if (key) this.statePersistenceKey = key;
    if (debounceMs) this.statePersistenceDebounceMs = debounceMs;
  }

  /**
   * Disable state persistence
   */
  disableStatePersistence(): void {
    this.statePersistenceEnabled = false;
    if (this.statePersistenceTimeout) {
      clearTimeout(this.statePersistenceTimeout);
      this.statePersistenceTimeout = null;
    }
  }

  /**
   * Debounced state persistence to localStorage
   * Prevents excessive writes during rapid updates
   */
  private debouncedPersistState(): void {
    if (!this.statePersistenceEnabled) return;

    // Clear any pending save
    if (this.statePersistenceTimeout) {
      clearTimeout(this.statePersistenceTimeout);
    }

    // Schedule new save
    this.statePersistenceTimeout = setTimeout(() => {
      this.persistState();
      this.statePersistenceTimeout = null;
    }, this.statePersistenceDebounceMs);
  }

  /**
   * Immediately persist state to localStorage
   */
  private persistState(): void {
    if (!this.statePersistenceEnabled) return;

    try {
      const stateToSave = {
        viewportState: this.state.viewportState,
        selectedTaskIds: Array.from(this.state.selectedTaskIds),
        minimapVisible: this.minimapVisible,
        criticalPathEnabled: this.criticalPathEnabled,
        baselineEnabled: this.baselineEnabled,
      };
      localStorage.setItem(this.statePersistenceKey, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('GanttCanvas: Failed to persist state', e);
    }
  }

  /**
   * Restore state from localStorage
   */
  restoreState(): boolean {
    if (!this.statePersistenceEnabled) return false;

    try {
      const saved = localStorage.getItem(this.statePersistenceKey);
      if (!saved) return false;

      const parsed = JSON.parse(saved);

      if (parsed.viewportState) {
        this.viewport.scrollTo(parsed.viewportState.scrollX, parsed.viewportState.scrollY);
        if (parsed.viewportState.zoom) {
          this.viewport.setZoom(parsed.viewportState.zoom);
        }
      }

      if (parsed.selectedTaskIds) {
        this.state.selectedTaskIds = new Set(parsed.selectedTaskIds);
      }

      if (typeof parsed.minimapVisible === 'boolean') {
        this.minimapVisible = parsed.minimapVisible;
      }

      if (typeof parsed.criticalPathEnabled === 'boolean') {
        this.criticalPathEnabled = parsed.criticalPathEnabled;
        if (this.criticalPathEnabled) {
          this.recalculateCriticalPath();
        }
      }

      if (typeof parsed.baselineEnabled === 'boolean') {
        this.baselineEnabled = parsed.baselineEnabled;
      }

      this.markDirty();
      return true;
    } catch (e) {
      console.warn('GanttCanvas: Failed to restore state', e);
      return false;
    }
  }

  /**
   * Clear persisted state
   */
  clearPersistedState(): void {
    try {
      localStorage.removeItem(this.statePersistenceKey);
    } catch (e) {
      console.warn('GanttCanvas: Failed to clear persisted state', e);
    }
  }

  private startRenderLoop(): void {
    const render = () => {
      if (this.isDirty) {
        this.render();
        this.isDirty = false;
      }
      this.animationFrameId = requestAnimationFrame(render);
    };
    this.animationFrameId = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.containerWidth, this.containerHeight);

    // Reset transform
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Get critical path data if enabled
    const criticalTasks = this.criticalPathEnabled && this.criticalPathResult
      ? this.criticalPathResult.criticalTasks
      : undefined;
    const criticalDeps = this.criticalPathEnabled && this.criticalPathResult
      ? this.criticalPathResult.criticalDependencies
      : undefined;

    // Draw layers in order
    this.renderer.drawBackground(this.containerWidth, this.containerHeight);
    this.renderer.drawGrid(this.containerWidth, this.containerHeight, this.state.tasks.length, this.calendar);
    this.renderer.drawTimeScale(this.containerWidth);
    this.renderer.drawTodayMarker(this.containerHeight);

    // Draw baselines first (below task bars)
    if (this.baselineEnabled && this.baselineData.size > 0) {
      this.renderer.drawBaselines(this.state.tasks, this.baselineData, this.containerHeight);
    }

    this.renderer.drawTaskBars(this.state.tasks, this.state.selectedTaskIds, this.state.hoveredTaskId, this.state.hoveredEdge, this.containerHeight, criticalTasks);
    const brokenDeps = this.getBrokenDependencyIds();
    this.renderer.drawDependencies(
      this.state.tasks,
      this.state.dependencies,
      this.state.lastSelectedTaskId,
      this.containerHeight,
      criticalDeps,
      this.highlightedDeps.size > 0 ? this.highlightedDeps : undefined,
      this.highlightedDeps.size > 0 ? this.highlightPhase : undefined,
      brokenDeps.size > 0 ? brokenDeps : undefined
    );

    // Draw drag preview overlay
    if (this.isDragging && this.dragTask && this.dragCurrentDate) {
      this.renderer.drawDragPreview(
        this.dragTask,
        this.dragCurrentDate,
        this.state.tasks.indexOf(this.dragTask)
      );
    }

    // Draw resize preview overlay
    if (this.isResizing && this.resizeTask && this.resizeCurrentStart && this.resizeCurrentEnd && this.resizeEdge) {
      this.renderer.drawResizePreview(
        this.resizeTask,
        this.resizeCurrentStart,
        this.resizeCurrentEnd,
        this.state.tasks.indexOf(this.resizeTask),
        this.resizeEdge
      );
    }

    // Draw dependency creation line
    if (this.isCreatingDependency && this.dependencyFromTask && this.dependencyFromEdge) {
      this.renderer.setTaskIndices(this.state.tasks);
      this.renderer.drawDependencyCreationLine(
        this.dependencyFromTask,
        this.dependencyFromEdge,
        this.dependencyLineEndX,
        this.dependencyLineEndY,
        this.state.tasks.indexOf(this.dependencyFromTask),
        this.dependencyTargetTask
      );
    }

    // Draw selection count badge
    this.renderer.drawSelectionBadge(this.state.selectedTaskIds.size, this.containerWidth);

    // Draw tooltip for hovered task (only when not dragging/resizing/context menu)
    if (this.state.hoveredTaskId && !this.isDragging && !this.isResizing && !this.contextMenuVisible) {
      const hoveredTask = this.state.tasks.find(t => t.id === this.state.hoveredTaskId);
      if (hoveredTask) {
        this.renderer.drawTooltip(hoveredTask, this.mouseX, this.mouseY, this.containerWidth);
      }
    }

    // Draw context menu (always on top)
    if (this.contextMenuVisible && this.contextMenuItems.length > 0) {
      this.renderer.drawContextMenu(
        this.contextMenuX,
        this.contextMenuY,
        this.contextMenuItems,
        this.containerWidth,
        this.containerHeight,
        this.contextMenuHoveredItem
      );
    }

    // Draw minimap (bottom-right corner)
    if (this.minimapVisible && this.state.tasks.length > 0) {
      this.minimapBounds = this.renderer.drawMinimap(
        this.state.tasks,
        this.containerWidth,
        this.containerHeight
      );
    } else {
      this.minimapBounds = null;
    }
  }

  private setupEventListeners(): void {
    // Make canvas focusable for keyboard events
    this.canvas.tabIndex = 0;
    this.canvas.style.outline = 'none'; // Remove focus outline

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('keydown', this.handleKeyDown);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('resize', this.handleResize);
  }

  private removeEventListeners(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleMouseDown = (e: MouseEvent): void => {
    // Focus canvas for keyboard events
    this.canvas.focus();

    // Check for minimap click first
    if (this.minimapVisible && this.minimapBounds) {
      const scrollResult = this.renderer.minimapClickToScroll(
        e.offsetX,
        e.offsetY,
        this.minimapBounds,
        this.state.tasks,
        this.containerWidth,
        this.containerHeight
      );

      if (scrollResult) {
        // Start minimap drag
        this.isDraggingMinimap = true;
        this.minimapDragStartX = e.offsetX;
        this.minimapDragStartY = e.offsetY;
        this.minimapDragStartScrollX = this.state.viewportState.scrollX;
        this.minimapDragStartScrollY = this.state.viewportState.scrollY;

        // Also immediately scroll to the clicked position
        this.viewport.scrollTo(scrollResult.scrollX, scrollResult.scrollY);
        this.canvas.style.cursor = 'grabbing';
        this.markDirty();
        return;
      }
    }

    // Check for context menu click first
    if (this.contextMenuVisible) {
      const itemId = this.renderer.hitTestContextMenu(
        e.offsetX,
        e.offsetY,
        this.contextMenuX,
        this.contextMenuY,
        this.contextMenuItems,
        this.containerWidth
      );

      if (itemId) {
        this.handleContextMenuClick(itemId);
        return;
      } else {
        // Clicked outside menu - close it
        this.closeContextMenu();
        return;
      }
    }

    // Check for connector hit first (for dependency creation)
    const connectorHit = this.hitTestConnector(e.offsetX, e.offsetY);
    if (connectorHit) {
      // Start dependency creation
      this.dependencyFromTask = connectorHit.task;
      this.dependencyFromEdge = connectorHit.edge;
      this.dependencyLineEndX = e.offsetX;
      this.dependencyLineEndY = e.offsetY;
      this.canvas.style.cursor = 'crosshair';
      this.markDirty();
      return;
    }

    // Check for resize edge
    const edgeHit = this.hitTestEdge(e.offsetX, e.offsetY);
    if (edgeHit && !edgeHit.task.locked) {
      // Start potential resize
      this.resizeTask = edgeHit.task;
      this.resizeEdge = edgeHit.edge;
      this.resizeStartX = e.offsetX;
      this.resizeOriginalStart = new Date(edgeHit.task.startDate);
      this.resizeOriginalEnd = new Date(edgeHit.task.endDate);
      this.resizeCurrentStart = new Date(edgeHit.task.startDate);
      this.resizeCurrentEnd = new Date(edgeHit.task.endDate);
      this.selectTask(edgeHit.task.id, e.ctrlKey || e.metaKey, e.shiftKey);
      this.markDirty();
      return;
    }

    // Check for regular task hit
    const task = this.hitTest(e.offsetX, e.offsetY);
    if (task && !task.locked) {
      // Start potential drag
      this.dragTask = task;
      this.dragStartX = e.offsetX;
      this.dragStartDate = new Date(task.startDate);
      this.dragCurrentDate = new Date(task.startDate);
      this.selectTask(task.id, e.ctrlKey || e.metaKey, e.shiftKey);
      this.markDirty();
    } else if (!task) {
      // Clicked on empty space - clear selection
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        this.state.selectedTaskIds.clear();
        this.state.lastSelectedTaskId = null;
        this.markDirty();
      }
    }
  };

  /**
   * Handle task selection with modifier keys
   */
  private selectTask(taskId: string, ctrlKey: boolean, shiftKey: boolean): void {
    if (shiftKey && this.state.lastSelectedTaskId) {
      // Shift+click: range selection
      const lastIndex = this.state.tasks.findIndex(t => t.id === this.state.lastSelectedTaskId);
      const currentIndex = this.state.tasks.findIndex(t => t.id === taskId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const startIdx = Math.min(lastIndex, currentIndex);
        const endIdx = Math.max(lastIndex, currentIndex);

        // Add all tasks in range to selection
        for (let i = startIdx; i <= endIdx; i++) {
          this.state.selectedTaskIds.add(this.state.tasks[i].id);
        }
      }
    } else if (ctrlKey) {
      // Ctrl+click: toggle selection
      if (this.state.selectedTaskIds.has(taskId)) {
        this.state.selectedTaskIds.delete(taskId);
        // Update lastSelectedTaskId if we just removed it
        if (this.state.lastSelectedTaskId === taskId) {
          this.state.lastSelectedTaskId = this.state.selectedTaskIds.size > 0
            ? Array.from(this.state.selectedTaskIds)[this.state.selectedTaskIds.size - 1]
            : null;
        }
      } else {
        this.state.selectedTaskIds.add(taskId);
        this.state.lastSelectedTaskId = taskId;
      }
    } else {
      // Regular click: single selection
      this.state.selectedTaskIds.clear();
      this.state.selectedTaskIds.add(taskId);
      this.state.lastSelectedTaskId = taskId;
    }

    // Start dependency flashing animation for the primary selected task
    if (this.state.selectedTaskIds.has(taskId)) {
      this.startDependencyFlash(taskId);
    }
  }

  private handleMouseUp = (e: MouseEvent): void => {
    // Handle minimap drag completion
    if (this.isDraggingMinimap) {
      this.isDraggingMinimap = false;
      this.canvas.style.cursor = 'default';
      this.markDirty();
      return;
    }

    // Handle dependency creation completion
    if (this.isCreatingDependency && this.dependencyFromTask && this.dependencyFromEdge) {
      // Check if we dropped on a target task
      const targetTask = this.hitTest(e.offsetX, e.offsetY);

      if (targetTask && targetTask.id !== this.dependencyFromTask.id) {
        // Determine the dependency type based on which connectors were used
        // fromEdge: 'start' or 'end' - which connector on the source task
        // We need to determine which connector on the target we're closest to
        const targetStartX = this.viewport.dateToX(targetTask.startDate);
        const targetEndX = this.viewport.dateToX(targetTask.endDate);
        const distToStart = Math.abs(e.offsetX - targetStartX);
        const distToEnd = Math.abs(e.offsetX - targetEndX);
        const targetEdge = distToStart < distToEnd ? 'start' : 'end';

        // Determine dependency type:
        // FS = from.end -> to.start (Finish-to-Start)
        // SS = from.start -> to.start (Start-to-Start)
        // FF = from.end -> to.end (Finish-to-Finish)
        // SF = from.start -> to.end (Start-to-Finish)
        let depType: 'FS' | 'SS' | 'FF' | 'SF';
        if (this.dependencyFromEdge === 'end') {
          depType = targetEdge === 'start' ? 'FS' : 'FF';
        } else {
          depType = targetEdge === 'start' ? 'SS' : 'SF';
        }

        // Call the handler
        this.onDependencyCreate?.(this.dependencyFromTask.id, targetTask.id, depType);
      }

      // Reset dependency creation state
      this.isCreatingDependency = false;
      this.dependencyFromTask = null;
      this.dependencyFromEdge = null;
      this.dependencyTargetTask = null;
      this.canvas.style.cursor = 'default';
      this.markDirty();
      return;
    }

    // Handle resize completion
    if (this.isResizing && this.resizeTask && this.resizeCurrentStart && this.resizeCurrentEnd) {
      const originalStart = this.resizeOriginalStart!;
      const originalEnd = this.resizeOriginalEnd!;
      const newStart = this.resizeCurrentStart;
      const newEnd = this.resizeCurrentEnd;

      // Only trigger if dates actually changed
      if (originalStart.getTime() !== newStart.getTime() || originalEnd.getTime() !== newEnd.getTime()) {
        this.onTaskResize?.(this.resizeTask, newStart, newEnd);
      }

      this.isResizing = false;
      this.canvas.style.cursor = 'pointer';
      this.resetResizeState();
      this.markDirty();
      return;
    } else if (this.resizeTask && !this.isResizing) {
      // It was a click on edge, not a resize
      this.onTaskClick?.(this.resizeTask);
      this.resetResizeState();
      this.markDirty();
      return;
    }

    // Handle drag completion
    if (this.isDragging && this.dragTask && this.dragCurrentDate) {
      // Complete the drag
      const originalDate = this.dragStartDate!;
      const newDate = this.dragCurrentDate;

      // Only trigger if date actually changed
      if (originalDate.getTime() !== newDate.getTime()) {
        this.onTaskDrag?.(this.dragTask, newDate);
      }

      this.isDragging = false;
      this.canvas.style.cursor = 'pointer';
    } else if (this.dragTask && !this.isDragging) {
      // It was a click, not a drag
      this.onTaskClick?.(this.dragTask);
    }

    // Reset drag state
    this.dragTask = null;
    this.dragStartX = 0;
    this.dragStartDate = null;
    this.dragCurrentDate = null;
    this.markDirty();
  };

  private resetResizeState(): void {
    this.resizeTask = null;
    this.resizeEdge = null;
    this.resizeStartX = 0;
    this.resizeOriginalStart = null;
    this.resizeOriginalEnd = null;
    this.resizeCurrentStart = null;
    this.resizeCurrentEnd = null;
  }

  private handleDoubleClick = (e: MouseEvent): void => {
    const task = this.hitTest(e.offsetX, e.offsetY);
    if (task) {
      this.onTaskDoubleClick?.(task);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    // Track mouse position for tooltip
    this.mouseX = e.offsetX;
    this.mouseY = e.offsetY;

    // Handle minimap dragging
    if (this.isDraggingMinimap && this.minimapBounds) {
      const scrollResult = this.renderer.minimapClickToScroll(
        e.offsetX,
        e.offsetY,
        this.minimapBounds,
        this.state.tasks,
        this.containerWidth,
        this.containerHeight
      );

      if (scrollResult) {
        this.viewport.scrollTo(scrollResult.scrollX, scrollResult.scrollY);
        this.markDirty();
      }
      return;
    }

    // Handle context menu hover
    if (this.contextMenuVisible) {
      const itemId = this.renderer.hitTestContextMenu(
        e.offsetX,
        e.offsetY,
        this.contextMenuX,
        this.contextMenuY,
        this.contextMenuItems,
        this.containerWidth
      );

      if (itemId !== this.contextMenuHoveredItem) {
        this.contextMenuHoveredItem = itemId;
        this.markDirty();
      }
      return;
    }

    // Handle dependency creation in progress
    if (this.dependencyFromTask && this.dependencyFromEdge) {
      this.isCreatingDependency = true;
      this.dependencyLineEndX = e.offsetX;
      this.dependencyLineEndY = e.offsetY;

      // Check if hovering over a potential target task
      const targetTask = this.hitTest(e.offsetX, e.offsetY);
      // Store the target for highlighting (only if different from source)
      this.dependencyTargetTask = targetTask && targetTask.id !== this.dependencyFromTask.id ? targetTask : null;

      this.markDirty();
      return;
    }

    // Handle resize in progress
    if (this.resizeTask && this.resizeOriginalStart && this.resizeOriginalEnd) {
      const deltaX = e.offsetX - this.resizeStartX;

      // Check if we've crossed the threshold to start resizing
      if (!this.isResizing && Math.abs(deltaX) > this.dragThreshold) {
        this.isResizing = true;
        this.canvas.style.cursor = 'ew-resize';
      }

      if (this.isResizing) {
        // Calculate day offset from mouse movement
        const daysDelta = Math.round(deltaX / (this.config.dayWidth * this.state.viewportState.zoom));

        if (this.resizeEdge === 'left') {
          // Resizing from left - change start date
          let newStart = new Date(this.resizeOriginalStart);
          newStart.setDate(newStart.getDate() + daysDelta);
          newStart.setHours(0, 0, 0, 0);
          newStart = this.snapToWorkingDay(newStart, daysDelta >= 0);

          // Don't allow start to go past end (minimum 1 day)
          if (newStart < this.resizeOriginalEnd!) {
            this.resizeCurrentStart = newStart;
            this.resizeCurrentEnd = new Date(this.resizeOriginalEnd);
            this.markDirty();
          }
        } else if (this.resizeEdge === 'right') {
          // Resizing from right - change end date
          let newEnd = new Date(this.resizeOriginalEnd);
          newEnd.setDate(newEnd.getDate() + daysDelta);
          newEnd.setHours(0, 0, 0, 0);
          newEnd = this.snapToWorkingDay(newEnd, daysDelta >= 0);

          // Don't allow end to go before start (minimum 1 day)
          if (newEnd > this.resizeOriginalStart!) {
            this.resizeCurrentStart = new Date(this.resizeOriginalStart);
            this.resizeCurrentEnd = newEnd;
            this.markDirty();
          }
        }
        return;
      }
    }

    // Handle drag in progress
    if (this.dragTask && this.dragStartDate) {
      const deltaX = e.offsetX - this.dragStartX;

      // Check if we've crossed the drag threshold
      if (!this.isDragging && Math.abs(deltaX) > this.dragThreshold) {
        this.isDragging = true;
        this.canvas.style.cursor = 'grabbing';
        // Anti-flicker: We DON'T suppress during drag preview - we want smooth visual feedback
        // Suppression is used during cascade calculations when many tasks update at once
      }

      if (this.isDragging) {
        // Calculate new date based on drag distance
        const daysDelta = Math.round(deltaX / (this.config.dayWidth * this.state.viewportState.zoom));
        let newDate = new Date(this.dragStartDate);
        newDate.setDate(newDate.getDate() + daysDelta);

        // Snap to day
        newDate.setHours(0, 0, 0, 0);

        // Snap to working day (skip weekends)
        // Use forward direction when moving right, backward when moving left
        newDate = this.snapToWorkingDay(newDate, daysDelta >= 0);

        if (this.dragCurrentDate?.getTime() !== newDate.getTime()) {
          this.dragCurrentDate = newDate;
          this.markDirty();
        }
        return;
      }
    }

    // Normal hover handling - check for resize edges first
    const edgeHit = this.hitTestEdge(e.offsetX, e.offsetY);
    if (edgeHit) {
      const stateChanged = this.state.hoveredTaskId !== edgeHit.task.id || this.state.hoveredEdge !== edgeHit.edge;
      this.state.hoveredTaskId = edgeHit.task.id;
      this.state.hoveredEdge = edgeHit.edge;
      this.canvas.style.cursor = edgeHit.task.locked ? 'not-allowed' : 'ew-resize';
      if (stateChanged) this.markDirty();
      return;
    }

    // Check for task hover
    const task = this.hitTest(e.offsetX, e.offsetY);
    const newHoveredId = task?.id || null;
    const stateChanged = newHoveredId !== this.state.hoveredTaskId || this.state.hoveredEdge !== null;

    if (stateChanged) {
      this.state.hoveredTaskId = newHoveredId;
      this.state.hoveredEdge = null;
      this.canvas.style.cursor = task ? (task.locked ? 'not-allowed' : 'grab') : 'default';
      this.markDirty();
    }
  };

  private handleMouseLeave = (): void => {
    // Cancel any minimap dragging in progress
    if (this.isDraggingMinimap) {
      this.isDraggingMinimap = false;
    }

    // Cancel any dependency creation in progress
    if (this.isCreatingDependency) {
      this.isCreatingDependency = false;
      this.dependencyFromTask = null;
      this.dependencyFromEdge = null;
      this.dependencyTargetTask = null;
      this.canvas.style.cursor = 'default';
    }

    // Cancel any resize in progress
    if (this.isResizing) {
      this.isResizing = false;
      this.resetResizeState();
    }

    // Cancel any drag in progress
    if (this.isDragging) {
      this.isDragging = false;
      this.dragTask = null;
      this.dragStartX = 0;
      this.dragStartDate = null;
      this.dragCurrentDate = null;
    }

    if (this.state.hoveredTaskId || this.state.hoveredEdge) {
      this.state.hoveredTaskId = null;
      this.state.hoveredEdge = null;
      this.markDirty();
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      this.viewport.zoom(zoomDelta, e.offsetX, e.offsetY);
    } else {
      // Pan
      this.viewport.pan(-e.deltaX, -e.deltaY);
    }

    this.markDirty();
  };

  private handleResize = (): void => {
    this.resize();
  };

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();

    // Check what was right-clicked
    const task = this.hitTest(e.offsetX, e.offsetY);

    // Build context menu items based on context
    const items: ContextMenuItem[] = [];

    if (task) {
      // Task-specific context menu
      items.push(
        { id: 'edit', label: 'Edit Task', icon: '✏️' },
        { id: 'separator1', label: '', separator: true },
        { id: 'lock', label: task.locked ? 'Unlock Task' : 'Lock Task', icon: '🔒', disabled: false },
        { id: 'separator2', label: '', separator: true },
        { id: 'add-predecessor', label: 'Add Predecessor', icon: '⬅️' },
        { id: 'add-successor', label: 'Add Successor', icon: '➡️' },
        { id: 'separator3', label: '', separator: true },
        { id: 'delete', label: 'Delete Task', icon: '🗑️', disabled: !!task.locked }
      );
    } else {
      // Empty space context menu
      items.push(
        { id: 'add-task', label: 'Add Task', icon: '➕' },
        { id: 'separator1', label: '', separator: true },
        { id: 'zoom-fit', label: 'Zoom to Fit', icon: '🔍' },
        { id: 'scroll-today', label: 'Go to Today', icon: '📅' }
      );
    }

    // Show context menu
    this.contextMenuVisible = true;
    this.contextMenuX = e.offsetX;
    this.contextMenuY = e.offsetY;
    this.contextMenuTask = task;
    this.contextMenuItems = items;
    this.contextMenuHoveredItem = null;

    this.markDirty();
  };

  private closeContextMenu(): void {
    if (this.contextMenuVisible) {
      this.contextMenuVisible = false;
      this.contextMenuTask = null;
      this.contextMenuItems = [];
      this.contextMenuHoveredItem = null;
      this.markDirty();
    }
  }

  private handleContextMenuClick(itemId: string): void {
    const task = this.contextMenuTask;
    this.closeContextMenu();

    // Handle built-in actions
    switch (itemId) {
      case 'edit':
        if (task) this.onTaskDoubleClick?.(task);
        break;
      case 'delete':
        if (task) this.onTaskDelete?.(task);
        break;
      case 'lock':
        if (task) {
          // Toggle lock status
          const wasLocked = !!task.locked;
          task.locked = wasLocked ? undefined : 'manuallyPositioned';
          this.markDirty();
          // Notify external handler of lock change
          this.onTaskUpdate?.(task);
        }
        break;
      case 'zoom-fit':
        this.zoomToFit();
        break;
      case 'scroll-today':
        this.scrollToToday();
        break;
      default:
        // Delegate to external handler
        this.onContextMenuAction?.(itemId, task);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Get the last selected task for keyboard operations
    const selectedTask = this.state.lastSelectedTaskId
      ? this.state.tasks.find(t => t.id === this.state.lastSelectedTaskId)
      : null;
    const selectedIndex = selectedTask
      ? this.state.tasks.indexOf(selectedTask)
      : -1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (selectedIndex > 0) {
          const newTaskId = this.state.tasks[selectedIndex - 1].id;
          if (e.shiftKey) {
            // Shift+Up: Extend selection upward
            this.state.selectedTaskIds.add(newTaskId);
          } else {
            // Regular Up: Move to previous task
            this.state.selectedTaskIds.clear();
            this.state.selectedTaskIds.add(newTaskId);
          }
          this.state.lastSelectedTaskId = newTaskId;
          this.scrollToTask(newTaskId);
          this.markDirty();
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (selectedIndex < this.state.tasks.length - 1) {
          const newTaskId = this.state.tasks[selectedIndex + 1].id;
          if (e.shiftKey) {
            // Shift+Down: Extend selection downward
            this.state.selectedTaskIds.add(newTaskId);
          } else {
            // Regular Down: Move to next task
            this.state.selectedTaskIds.clear();
            this.state.selectedTaskIds.add(newTaskId);
          }
          this.state.lastSelectedTaskId = newTaskId;
          this.scrollToTask(newTaskId);
          this.markDirty();
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey && selectedTask && !selectedTask.locked) {
          // Shift+Left: Move selected task(s) earlier by 1 day
          const newDate = new Date(selectedTask.startDate);
          newDate.setDate(newDate.getDate() - 1);
          const snappedDate = this.snapToWorkingDay(newDate, false);
          this.onTaskDrag?.(selectedTask, snappedDate);
        } else {
          // Pan left
          this.viewport.pan(50, 0);
          this.markDirty();
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey && selectedTask && !selectedTask.locked) {
          // Shift+Right: Move selected task(s) later by 1 day
          const newDate = new Date(selectedTask.startDate);
          newDate.setDate(newDate.getDate() + 1);
          const snappedDate = this.snapToWorkingDay(newDate, true);
          this.onTaskDrag?.(selectedTask, snappedDate);
        } else {
          // Pan right
          this.viewport.pan(-50, 0);
          this.markDirty();
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedTask) {
          this.onTaskDoubleClick?.(selectedTask);
        }
        break;

      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selectedTask && !selectedTask.locked) {
          this.onTaskDelete?.(selectedTask);
        }
        break;

      case 'Escape':
        e.preventDefault();
        // Close context menu if open
        if (this.contextMenuVisible) {
          this.closeContextMenu();
        } else {
          // Clear selection
          this.state.selectedTaskIds.clear();
          this.state.lastSelectedTaskId = null;
          this.markDirty();
        }
        break;

      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+A: Select all tasks
          this.state.tasks.forEach(t => this.state.selectedTaskIds.add(t.id));
          if (this.state.tasks.length > 0) {
            this.state.lastSelectedTaskId = this.state.tasks[this.state.tasks.length - 1].id;
          }
          this.markDirty();
        }
        break;

      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+Z: Redo
            this.redo();
          } else {
            // Ctrl+Z: Undo
            this.undo();
          }
        }
        break;

      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+Y: Redo
          this.redo();
        }
        break;

      case 'Home':
        e.preventDefault();
        this.scrollToToday();
        break;

      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+0: Reset zoom
          this.viewport.setZoom(1);
          this.markDirty();
        }
        break;

      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+Plus: Zoom in
          this.viewport.zoom(1.2, this.containerWidth / 2, this.containerHeight / 2);
          this.markDirty();
        }
        break;

      case '-':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+Minus: Zoom out
          this.viewport.zoom(0.8, this.containerWidth / 2, this.containerHeight / 2);
          this.markDirty();
        }
        break;

      case 'm':
      case 'M':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // M: Toggle minimap
          this.toggleMinimap();
        }
        break;

      case 'c':
      case 'C':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // C: Toggle critical path
          this.toggleCriticalPath();
        }
        break;

      case 'b':
      case 'B':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // B: Toggle baseline
          this.toggleBaseline();
        }
        break;

      case 'l':
      case 'L':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // L: Toggle lock on selected task
          if (selectedTask) {
            const wasLocked = !!selectedTask.locked;
            selectedTask.locked = wasLocked ? undefined : 'manuallyPositioned';
            this.markDirty();
            this.onTaskUpdate?.(selectedTask);
          }
        }
        break;

      case 'v':
      case 'V':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // V: Cycle zoom level (Day → Week → Month)
          this.cycleZoomLevel();
        }
        break;

      case '1':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // 1: Day view
          this.zoomToDay();
        }
        break;

      case '2':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // 2: Week view
          this.zoomToWeek();
        }
        break;

      case '3':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // 3: Month view
          this.zoomToMonth();
        }
        break;

      case 'd':
      case 'D':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+D: Duplicate selected task
          if (selectedTask) {
            const duplicate = this.duplicateTask(selectedTask.id);
            if (duplicate) {
              this.state.selectedTaskIds.clear();
              this.state.selectedTaskIds.add(duplicate.id);
              this.state.lastSelectedTaskId = duplicate.id;
            }
          }
        }
        break;

      case 'n':
      case 'N':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+N: Create new task
          const newTask = this.createTask();
          this.state.selectedTaskIds.clear();
          this.state.selectedTaskIds.add(newTask.id);
          this.state.lastSelectedTaskId = newTask.id;
          this.scrollToTask(newTask.id);
        }
        break;

      case 'Insert':
        e.preventDefault();
        // Insert: Create new task after selected
        const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : this.state.tasks.length;
        const insertedTask = this.createTask();
        this.moveTaskToIndex(insertedTask.id, insertIndex);
        this.state.selectedTaskIds.clear();
        this.state.selectedTaskIds.add(insertedTask.id);
        this.state.lastSelectedTaskId = insertedTask.id;
        break;

      case 's':
      case 'S':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // S: Start selected task
          if (selectedTask && selectedTask.status !== 'completed') {
            this.startTask(selectedTask.id);
          }
        }
        break;

      case ' ':
        e.preventDefault();
        // Space: Toggle task completion / increment progress
        if (selectedTask) {
          if (selectedTask.status === 'completed') {
            // If completed, reset to in-progress
            this.setStatus(selectedTask.id, 'in-progress');
            this.setProgress(selectedTask.id, 50);
          } else {
            // Increment progress by 25% or complete if >= 75%
            const currentProgress = selectedTask.progress || 0;
            if (currentProgress >= 75) {
              this.completeTask(selectedTask.id);
            } else {
              this.setProgress(selectedTask.id, currentProgress + 25);
            }
          }
        }
        break;

      case 'p':
      case 'P':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // P: Increment progress by 10%
          if (selectedTask) {
            this.incrementProgress(selectedTask.id, 10);
          }
        }
        break;

      case 'h':
      case 'H':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // H: Toggle hold on selected task
          if (selectedTask) {
            if (selectedTask.status === 'on-hold') {
              this.resumeTask(selectedTask.id);
            } else {
              this.holdTask(selectedTask.id, 'other');
            }
          }
        }
        break;

      case 't':
      case 'T':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // T: Scroll to today
          this.scrollToToday();
        }
        break;

      case 'f':
      case 'F':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // F: Fit all tasks in view (zoom to fit)
          this.zoomToFit();
        }
        break;

      case 'i':
      case 'I':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // I: Invert selection
          this.invertSelection();
        }
        break;

      case 'c':
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+C with selection - don't prevent default, allow copy
          // But store the task for potential paste
          if (selectedTask) {
            this.clipboardTask = selectedTask;
          }
        }
        break;

      case 'x':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+X: Cut (copy and mark for deletion)
          if (selectedTask) {
            this.clipboardTask = selectedTask;
            this.clipboardIsCut = true;
          }
        }
        break;

      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Ctrl+V: Paste task
          if (this.clipboardTask) {
            const pasted = this.duplicateTask(this.clipboardTask.id, 0);
            if (pasted) {
              this.state.selectedTaskIds.clear();
              this.state.selectedTaskIds.add(pasted.id);
              this.state.lastSelectedTaskId = pasted.id;

              // If it was a cut operation, delete the original
              if (this.clipboardIsCut) {
                this.deleteTask(this.clipboardTask.id);
                this.clipboardTask = null;
                this.clipboardIsCut = false;
              }
            }
          }
        }
        break;
    }
  };

  /**
   * Snap date to a working day (skip weekends and holidays)
   * Uses the WorkingDaysCalendar for accurate working day detection
   * @param date - The date to snap
   * @param forward - If true, snap forward to next working day; if false, snap backward
   */
  private snapToWorkingDay(date: Date, forward: boolean = true): Date {
    return this.calendar.snapToWorkingDay(date, forward);
  }

  private hitTest(x: number, y: number): GanttTask | null {
    // Account for header height
    const adjustedY = y - this.config.headerHeight + this.state.viewportState.scrollY;
    if (adjustedY < 0) return null;

    // Find which row was clicked
    const rowIndex = Math.floor(adjustedY / this.config.rowHeight);
    if (rowIndex < 0 || rowIndex >= this.state.tasks.length) return null;

    const task = this.state.tasks[rowIndex];

    // Check if click is within the task bar
    const taskStartX = this.viewport.dateToX(task.startDate);
    const taskEndX = this.viewport.dateToX(task.endDate);

    if (x >= taskStartX && x <= taskEndX) {
      return task;
    }

    return null;
  }

  /**
   * Hit test for resize edges
   * Returns which edge was clicked (left, right) or null if not on an edge
   */
  private hitTestEdge(x: number, y: number): { task: GanttTask; edge: 'left' | 'right' } | null {
    // Account for header height
    const adjustedY = y - this.config.headerHeight + this.state.viewportState.scrollY;
    if (adjustedY < 0) return null;

    // Find which row was clicked
    const rowIndex = Math.floor(adjustedY / this.config.rowHeight);
    if (rowIndex < 0 || rowIndex >= this.state.tasks.length) return null;

    const task = this.state.tasks[rowIndex];

    // Calculate task bar bounds
    const taskStartX = this.viewport.dateToX(task.startDate);
    const taskEndX = this.viewport.dateToX(task.endDate);

    // Check left edge
    if (x >= taskStartX - this.resizeHandleWidth / 2 && x <= taskStartX + this.resizeHandleWidth / 2) {
      return { task, edge: 'left' };
    }

    // Check right edge
    if (x >= taskEndX - this.resizeHandleWidth / 2 && x <= taskEndX + this.resizeHandleWidth / 2) {
      return { task, edge: 'right' };
    }

    return null;
  }

  /**
   * Hit test for connector dots (for dependency creation)
   * Returns which connector was clicked (start, end) or null
   */
  private hitTestConnector(x: number, y: number): { task: GanttTask; edge: 'start' | 'end' } | null {
    // Account for header height
    const adjustedY = y - this.config.headerHeight + this.state.viewportState.scrollY;
    if (adjustedY < 0) return null;

    // Find which row was clicked
    const rowIndex = Math.floor(adjustedY / this.config.rowHeight);
    if (rowIndex < 0 || rowIndex >= this.state.tasks.length) return null;

    const task = this.state.tasks[rowIndex];

    // Calculate task bar center Y
    const rowY = this.viewport.rowToY(rowIndex);
    const centerY = rowY + this.config.rowHeight / 2;

    // Check if click is vertically near the center
    if (Math.abs(adjustedY + this.config.headerHeight - centerY) > this.connectorRadius + 5) return null;

    // Calculate connector positions
    const taskStartX = this.viewport.dateToX(task.startDate);
    const taskEndX = this.viewport.dateToX(task.endDate);

    // Check start connector
    const distToStart = Math.sqrt(Math.pow(x - taskStartX, 2) + Math.pow(y - centerY, 2));
    if (distToStart <= this.connectorRadius + 3) {
      return { task, edge: 'start' };
    }

    // Check end connector
    const distToEnd = Math.sqrt(Math.pow(x - taskEndX, 2) + Math.pow(y - centerY, 2));
    if (distToEnd <= this.connectorRadius + 3) {
      return { task, edge: 'end' };
    }

    return null;
  }

  /**
   * Hit test for progress bar (for dragging progress)
   * Returns the task and x position within the progress bar
   */
  private hitTestProgressBar(x: number, y: number): { task: GanttTask; progressX: number } | null {
    // Account for header height
    const adjustedY = y - this.config.headerHeight + this.state.viewportState.scrollY;
    if (adjustedY < 0) return null;

    // Find which row was clicked
    const rowIndex = Math.floor(adjustedY / this.config.rowHeight);
    if (rowIndex < 0 || rowIndex >= this.state.tasks.length) return null;

    const task = this.state.tasks[rowIndex];

    // Calculate task bar bounds
    const taskStartX = this.viewport.dateToX(task.startDate);
    const taskEndX = this.viewport.dateToX(task.endDate);
    const taskWidth = taskEndX - taskStartX;

    // Check if click is within the task bar horizontally
    if (x < taskStartX || x > taskEndX) return null;

    // Check if click is in the bottom third of the row (where progress bar would be)
    const rowY = this.viewport.rowToY(rowIndex);
    const barTop = rowY + (this.config.rowHeight - this.config.taskBarHeight) / 2;
    const barBottom = barTop + this.config.taskBarHeight;

    if (y < barTop || y > barBottom) return null;

    // Calculate relative position within task bar (0 to 1)
    const progressX = (x - taskStartX) / taskWidth;

    return { task, progressX };
  }

  /**
   * Get tasks within a marquee rectangle
   */
  private getTasksInMarquee(x1: number, y1: number, x2: number, y2: number): GanttTask[] {
    // Normalize rectangle
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    const tasks: GanttTask[] = [];

    this.state.tasks.forEach((task, index) => {
      const taskStartX = this.viewport.dateToX(task.startDate);
      const taskEndX = this.viewport.dateToX(task.endDate);
      const rowY = this.viewport.rowToY(index);
      const taskTop = rowY + (this.config.rowHeight - this.config.taskBarHeight) / 2;
      const taskBottom = taskTop + this.config.taskBarHeight;

      // Check if task bar intersects with marquee
      const intersectsX = taskStartX <= right && taskEndX >= left;
      const intersectsY = taskTop <= bottom && taskBottom >= top;

      if (intersectsX && intersectsY) {
        tasks.push(task);
      }
    });

    return tasks;
  }

  // ============================================================================
  // Progress API
  // ============================================================================

  /**
   * Set progress for a task
   * @param taskId - The task ID
   * @param progress - Progress value between 0 and 100
   */
  setProgress(taskId: string, progress: number): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const clampedProgress = Math.max(0, Math.min(100, progress));
    task.progress = clampedProgress;
    this.onProgressChange?.(task, clampedProgress);
    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Get progress for a task
   */
  getProgress(taskId: string): number {
    const task = this.state.tasks.find(t => t.id === taskId);
    return task?.progress ?? 0;
  }

  /**
   * Increment progress for a task
   */
  incrementProgress(taskId: string, amount: number = 10): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const newProgress = Math.min(100, (task.progress || 0) + amount);
    this.setProgress(taskId, newProgress);
  }

  /**
   * Complete a task (set progress to 100%)
   */
  completeTask(taskId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.progress = 100;
    task.status = 'completed';
    this.onProgressChange?.(task, 100);
    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  // ============================================================================
  // Task CRUD API
  // ============================================================================

  /**
   * Add a new task to the chart
   * @param task - The task to add (id is required)
   * @param index - Optional position to insert at (default: end)
   * @returns The added task
   */
  addTask(task: GanttTask, index?: number): GanttTask {
    // Validate required fields
    if (!task.id || !task.name || !task.startDate || !task.endDate) {
      throw new Error('Task must have id, name, startDate, and endDate');
    }

    // Ensure dates are Date objects
    const newTask: GanttTask = {
      ...task,
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
      status: task.status || 'not-started',
      progress: task.progress ?? 0,
    };

    if (typeof index === 'number' && index >= 0 && index <= this.state.tasks.length) {
      this.state.tasks.splice(index, 0, newTask);
    } else {
      this.state.tasks.push(newTask);
    }

    this.onTaskUpdate?.(newTask);
    this.markDirty();
    return newTask;
  }

  /**
   * Create a new task with default values
   * @param overrides - Optional values to override defaults
   * @returns The created task
   */
  createTask(overrides?: Partial<GanttTask>): GanttTask {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);

    const task: GanttTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'New Task',
      startDate: today,
      endDate: endDate,
      status: 'not-started',
      progress: 0,
      ...overrides,
    };

    return this.addTask(task);
  }

  /**
   * Delete a task by ID
   * @param taskId - The task ID to delete
   * @returns true if task was deleted
   */
  deleteTask(taskId: string): boolean {
    const index = this.state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    const task = this.state.tasks[index];

    // Remove from tasks array
    this.state.tasks.splice(index, 1);

    // Remove from selection
    this.state.selectedTaskIds.delete(taskId);
    if (this.state.lastSelectedTaskId === taskId) {
      this.state.lastSelectedTaskId = null;
    }

    // Remove dependencies involving this task
    this.state.dependencies = this.state.dependencies.filter(
      d => d.fromId !== taskId && d.toId !== taskId
    );

    // Update predecessor lists on other tasks
    this.state.tasks.forEach(t => {
      if (t.predecessorIds) {
        t.predecessorIds = t.predecessorIds.filter(id => id !== taskId);
      }
      if (t.brokenPredecessorIds) {
        t.brokenPredecessorIds = t.brokenPredecessorIds.filter(id => id !== taskId);
      }
    });

    this.onTaskDelete?.(task);
    this.markDirty();
    return true;
  }

  /**
   * Delete multiple tasks
   * @param taskIds - Array of task IDs to delete
   * @returns Number of tasks deleted
   */
  deleteTasks(taskIds: string[]): number {
    let count = 0;
    this.beginBatchUpdate();

    taskIds.forEach(id => {
      if (this.deleteTask(id)) count++;
    });

    this.endBatchUpdate();
    return count;
  }

  /**
   * Delete selected tasks
   * @returns Number of tasks deleted
   */
  deleteSelectedTasks(): number {
    const ids = this.getSelectedTaskIds();
    return this.deleteTasks(ids);
  }

  /**
   * Duplicate a task
   * @param taskId - The task to duplicate
   * @param offsetDays - Days to offset the duplicate (default: 1)
   * @returns The duplicated task or null
   */
  duplicateTask(taskId: string, offsetDays: number = 1): GanttTask | null {
    const original = this.state.tasks.find(t => t.id === taskId);
    if (!original) return null;

    const newStartDate = new Date(original.startDate);
    newStartDate.setDate(newStartDate.getDate() + offsetDays);

    const newEndDate = new Date(original.endDate);
    newEndDate.setDate(newEndDate.getDate() + offsetDays);

    const duplicate: GanttTask = {
      ...original,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${original.name} (Copy)`,
      startDate: newStartDate,
      endDate: newEndDate,
      progress: 0,
      status: 'not-started',
      locked: undefined,
      holdState: undefined,
      predecessorIds: undefined,
      brokenPredecessorIds: undefined,
    };

    const originalIndex = this.state.tasks.indexOf(original);
    return this.addTask(duplicate, originalIndex + 1);
  }

  /**
   * Move a task to a new position in the list
   * @param taskId - The task to move
   * @param newIndex - The new index position
   */
  moveTaskToIndex(taskId: string, newIndex: number): void {
    const currentIndex = this.state.tasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;

    const [task] = this.state.tasks.splice(currentIndex, 1);
    const insertIndex = newIndex > currentIndex ? newIndex - 1 : newIndex;
    this.state.tasks.splice(Math.max(0, Math.min(insertIndex, this.state.tasks.length)), 0, task);

    this.markDirty();
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): GanttTask | undefined {
    return this.state.tasks.find(t => t.id === taskId);
  }

  /**
   * Get task index
   */
  getTaskIndex(taskId: string): number {
    return this.state.tasks.findIndex(t => t.id === taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): GanttTask[] {
    return [...this.state.tasks];
  }

  /**
   * Get task count
   */
  getTaskCount(): number {
    return this.state.tasks.length;
  }

  // ============================================================================
  // Status Management API
  // ============================================================================

  /**
   * Set task status
   */
  setStatus(taskId: string, status: GanttTask['status']): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;
    task.status = status;

    // Auto-update progress for completed tasks
    if (status === 'completed' && (task.progress || 0) < 100) {
      task.progress = 100;
      this.onProgressChange?.(task, 100);
    }

    // Clear hold state if resuming
    if (oldStatus === 'on-hold' && status !== 'on-hold') {
      task.holdState = undefined;
    }

    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Get task status
   */
  getStatus(taskId: string): GanttTask['status'] | undefined {
    return this.state.tasks.find(t => t.id === taskId)?.status;
  }

  /**
   * Start a task (set to in-progress)
   */
  startTask(taskId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'in-progress';
    task.locked = 'started';
    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Mark task as at-risk
   */
  markAtRisk(taskId: string): void {
    this.setStatus(taskId, 'at-risk');
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: GanttTask['status']): GanttTask[] {
    return this.state.tasks.filter(t => t.status === status);
  }

  /**
   * Get status counts
   */
  getStatusCounts(): Record<string, number> {
    const counts: Record<string, number> = {
      'not-started': 0,
      'in-progress': 0,
      'completed': 0,
      'on-hold': 0,
      'at-risk': 0,
    };

    this.state.tasks.forEach(t => {
      const status = t.status || 'not-started';
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get completion percentage
   */
  getCompletionPercentage(): number {
    if (this.state.tasks.length === 0) return 0;
    const completed = this.state.tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / this.state.tasks.length) * 100);
  }

  /**
   * Get average progress
   */
  getAverageProgress(): number {
    if (this.state.tasks.length === 0) return 0;
    const total = this.state.tasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    return Math.round(total / this.state.tasks.length);
  }

  // ============================================================================
  // Export API
  // ============================================================================

  /**
   * Export canvas to image data URL
   * @param format - Image format ('png' | 'jpeg')
   * @param quality - JPEG quality (0-1)
   */
  exportToImage(format: 'png' | 'jpeg' = 'png', quality: number = 0.92): string {
    return this.canvas.toDataURL(`image/${format}`, quality);
  }

  /**
   * Export canvas to Blob
   * @param format - Image format
   * @param quality - JPEG quality
   */
  async exportToBlob(format: 'png' | 'jpeg' = 'png', quality: number = 0.92): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        `image/${format}`,
        quality
      );
    });
  }

  /**
   * Download canvas as image
   * @param filename - The filename (without extension)
   * @param format - Image format
   */
  downloadImage(filename: string = 'gantt-chart', format: 'png' | 'jpeg' = 'png'): void {
    const dataUrl = this.exportToImage(format);
    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = dataUrl;
    link.click();
  }

  /**
   * Export tasks data to JSON
   */
  exportToJSON(): string {
    const data = {
      tasks: this.state.tasks.map(t => ({
        ...t,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate.toISOString(),
        holdState: t.holdState ? {
          ...t.holdState,
          heldAt: t.holdState.heldAt.toISOString(),
        } : undefined,
      })),
      dependencies: this.state.dependencies,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import tasks data from JSON
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);

      if (data.tasks) {
        this.state.tasks = data.tasks.map((t: Record<string, unknown>) => ({
          ...t,
          startDate: new Date(t.startDate as string),
          endDate: new Date(t.endDate as string),
          holdState: t.holdState ? {
            ...(t.holdState as Record<string, unknown>),
            heldAt: new Date((t.holdState as Record<string, unknown>).heldAt as string),
          } : undefined,
        }));
      }

      if (data.dependencies) {
        this.state.dependencies = data.dependencies;
      }

      this.markDirty();
    } catch (e) {
      console.error('GanttCanvas: Failed to import JSON', e);
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Export tasks to CSV format
   */
  exportToCSV(): string {
    const headers = ['ID', 'Name', 'Start Date', 'End Date', 'Duration (days)', 'Progress', 'Status', 'Locked', 'Predecessors'];
    const rows = this.state.tasks.map(t => {
      const duration = Math.ceil((t.endDate.getTime() - t.startDate.getTime()) / (24 * 60 * 60 * 1000));
      return [
        t.id,
        `"${t.name.replace(/"/g, '""')}"`,
        t.startDate.toISOString().split('T')[0],
        t.endDate.toISOString().split('T')[0],
        duration,
        t.progress || 0,
        t.status || 'not-started',
        t.locked || '',
        (t.predecessorIds || []).join(';'),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Download as CSV
   */
  downloadCSV(filename: string = 'gantt-tasks'): void {
    const csv = this.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ============================================================================
  // Selection API
  // ============================================================================

  /**
   * Get all selected task IDs
   */
  getSelectedTaskIds(): string[] {
    return Array.from(this.state.selectedTaskIds);
  }

  /**
   * Get all selected tasks
   */
  getSelectedTasks(): GanttTask[] {
    return this.state.tasks.filter(t => this.state.selectedTaskIds.has(t.id));
  }

  /**
   * Select tasks by IDs
   */
  selectTasks(taskIds: string[], addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.state.selectedTaskIds.clear();
    }

    taskIds.forEach(id => {
      if (this.state.tasks.some(t => t.id === id)) {
        this.state.selectedTaskIds.add(id);
      }
    });

    if (taskIds.length > 0) {
      this.state.lastSelectedTaskId = taskIds[taskIds.length - 1];
    }

    this.onSelectionChange?.(this.getSelectedTaskIds());
    this.markDirty();
  }

  /**
   * Select all tasks
   */
  selectAllTasks(): void {
    this.state.tasks.forEach(t => this.state.selectedTaskIds.add(t.id));
    this.onSelectionChange?.(this.getSelectedTaskIds());
    this.markDirty();
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.state.selectedTaskIds.clear();
    this.state.lastSelectedTaskId = null;
    this.onSelectionChange?.([]);
    this.markDirty();
  }

  /**
   * Invert selection
   */
  invertSelection(): void {
    const newSelection = new Set<string>();
    this.state.tasks.forEach(t => {
      if (!this.state.selectedTaskIds.has(t.id)) {
        newSelection.add(t.id);
      }
    });
    this.state.selectedTaskIds = newSelection;
    this.onSelectionChange?.(this.getSelectedTaskIds());
    this.markDirty();
  }

  // ============================================================================
  // Filtering & Search API
  // ============================================================================

  /**
   * Filter tasks by a predicate function
   * Returns matching tasks without modifying the display
   */
  filterTasks(predicate: (task: GanttTask) => boolean): GanttTask[] {
    return this.state.tasks.filter(predicate);
  }

  /**
   * Search tasks by name (case-insensitive)
   */
  searchByName(query: string): GanttTask[] {
    const lowerQuery = query.toLowerCase();
    return this.state.tasks.filter(t => t.name.toLowerCase().includes(lowerQuery));
  }

  /**
   * Find tasks within a date range
   */
  findTasksInDateRange(startDate: Date, endDate: Date): GanttTask[] {
    return this.state.tasks.filter(t => {
      return t.startDate <= endDate && t.endDate >= startDate;
    });
  }

  /**
   * Find tasks by supplier
   */
  findTasksBySupplier(supplierId: number): GanttTask[] {
    return this.state.tasks.filter(t => t.supplierId === supplierId);
  }

  /**
   * Find tasks with no predecessors (starting tasks)
   */
  findStartingTasks(): GanttTask[] {
    return this.state.tasks.filter(t => !t.predecessorIds || t.predecessorIds.length === 0);
  }

  /**
   * Find tasks with no successors (ending tasks)
   */
  findEndingTasks(): GanttTask[] {
    const taskIdsWithSuccessors = new Set<string>();
    this.state.dependencies.forEach(d => taskIdsWithSuccessors.add(d.fromId));
    return this.state.tasks.filter(t => !taskIdsWithSuccessors.has(t.id));
  }

  /**
   * Find overdue tasks (end date before today, not completed)
   */
  findOverdueTasks(): GanttTask[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.state.tasks.filter(t => {
      return t.status !== 'completed' && t.endDate < today;
    });
  }

  /**
   * Find tasks due soon (within N days)
   */
  findTasksDueSoon(days: number = 7): GanttTask[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    return this.state.tasks.filter(t => {
      return t.status !== 'completed' && t.endDate >= today && t.endDate <= futureDate;
    });
  }

  /**
   * Find tasks starting soon (within N days)
   */
  findTasksStartingSoon(days: number = 7): GanttTask[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    return this.state.tasks.filter(t => {
      return t.status === 'not-started' && t.startDate >= today && t.startDate <= futureDate;
    });
  }

  // ============================================================================
  // Task Hierarchy/Grouping API
  // ============================================================================

  private taskParentMap: Map<string, string> = new Map(); // child -> parent
  private taskChildrenMap: Map<string, string[]> = new Map(); // parent -> children

  /**
   * Set parent-child relationship between tasks
   */
  setTaskParent(childId: string, parentId: string | null): void {
    // Remove from old parent
    const oldParentId = this.taskParentMap.get(childId);
    if (oldParentId) {
      const oldSiblings = this.taskChildrenMap.get(oldParentId) || [];
      this.taskChildrenMap.set(oldParentId, oldSiblings.filter(id => id !== childId));
    }

    if (parentId) {
      // Set new parent
      this.taskParentMap.set(childId, parentId);
      const children = this.taskChildrenMap.get(parentId) || [];
      if (!children.includes(childId)) {
        children.push(childId);
        this.taskChildrenMap.set(parentId, children);
      }
    } else {
      // Remove parent relationship
      this.taskParentMap.delete(childId);
    }

    this.markDirty();
  }

  /**
   * Get parent task ID
   */
  getTaskParent(taskId: string): string | null {
    return this.taskParentMap.get(taskId) || null;
  }

  /**
   * Get children task IDs
   */
  getTaskChildren(taskId: string): string[] {
    return this.taskChildrenMap.get(taskId) || [];
  }

  /**
   * Check if task has children
   */
  hasChildren(taskId: string): boolean {
    return (this.taskChildrenMap.get(taskId)?.length || 0) > 0;
  }

  /**
   * Check if task is a root task (no parent)
   */
  isRootTask(taskId: string): boolean {
    return !this.taskParentMap.has(taskId);
  }

  /**
   * Get all root tasks
   */
  getRootTasks(): GanttTask[] {
    return this.state.tasks.filter(t => this.isRootTask(t.id));
  }

  /**
   * Get task depth in hierarchy
   */
  getTaskDepth(taskId: string): number {
    let depth = 0;
    let currentId: string | null = taskId;
    while (currentId && this.taskParentMap.has(currentId)) {
      depth++;
      currentId = this.taskParentMap.get(currentId) || null;
    }
    return depth;
  }

  /**
   * Get all ancestors of a task
   */
  getTaskAncestors(taskId: string): string[] {
    const ancestors: string[] = [];
    let currentId: string | null = this.taskParentMap.get(taskId) || null;
    while (currentId) {
      ancestors.push(currentId);
      currentId = this.taskParentMap.get(currentId) || null;
    }
    return ancestors;
  }

  /**
   * Get all descendants of a task (recursive)
   */
  getTaskDescendants(taskId: string): string[] {
    const descendants: string[] = [];
    const children = this.taskChildrenMap.get(taskId) || [];

    for (const childId of children) {
      descendants.push(childId);
      descendants.push(...this.getTaskDescendants(childId));
    }

    return descendants;
  }

  // ============================================================================
  // Date Calculation Helpers
  // ============================================================================

  /**
   * Calculate task duration in days
   */
  getTaskDuration(taskId: string): number {
    const task = this.getTask(taskId);
    if (!task) return 0;
    return Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  /**
   * Calculate working days duration (excluding weekends/holidays)
   */
  getTaskWorkingDays(taskId: string): number {
    const task = this.getTask(taskId);
    if (!task) return 0;
    return this.calendar.getWorkingDaysBetween(task.startDate, task.endDate);
  }

  /**
   * Set task duration (adjusts end date)
   */
  setTaskDuration(taskId: string, days: number): void {
    const task = this.getTask(taskId);
    if (!task) return;

    const newEndDate = new Date(task.startDate);
    newEndDate.setDate(newEndDate.getDate() + days - 1);
    task.endDate = newEndDate;

    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Set task duration in working days (adjusts end date)
   */
  setTaskWorkingDaysDuration(taskId: string, workingDays: number): void {
    const task = this.getTask(taskId);
    if (!task) return;

    task.endDate = this.calendar.addWorkingDays(task.startDate, workingDays - 1);
    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Move task to new start date (preserving duration)
   */
  moveTask(taskId: string, newStartDate: Date): void {
    const task = this.getTask(taskId);
    if (!task) return;

    const duration = this.getTaskDuration(taskId);
    task.startDate = new Date(newStartDate);
    task.endDate = new Date(newStartDate);
    task.endDate.setDate(task.endDate.getDate() + duration - 1);

    this.onTaskUpdate?.(task);
    this.markDirty();
  }

  /**
   * Get project date range
   */
  getProjectDateRange(): { start: Date; end: Date } | null {
    if (this.state.tasks.length === 0) return null;

    let minDate = this.state.tasks[0].startDate;
    let maxDate = this.state.tasks[0].endDate;

    this.state.tasks.forEach(t => {
      if (t.startDate < minDate) minDate = t.startDate;
      if (t.endDate > maxDate) maxDate = t.endDate;
    });

    return { start: new Date(minDate), end: new Date(maxDate) };
  }

  /**
   * Get project duration in days
   */
  getProjectDuration(): number {
    const range = this.getProjectDateRange();
    if (!range) return 0;
    return Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }

  /**
   * Calculate earliest start for a task based on predecessors
   */
  calculateEarliestStart(taskId: string): Date {
    const task = this.getTask(taskId);
    if (!task) return new Date();

    const predecessors = this.getPredecessors(taskId);
    if (predecessors.length === 0) return task.startDate;

    let latestPredEnd = new Date(0);

    predecessors.forEach(dep => {
      const predTask = this.getTask(dep.fromId);
      if (!predTask) return;

      let constraintDate: Date;
      const lag = dep.lag || 0;

      switch (dep.type) {
        case 'FS':
          constraintDate = new Date(predTask.endDate);
          constraintDate.setDate(constraintDate.getDate() + 1 + lag);
          break;
        case 'SS':
          constraintDate = new Date(predTask.startDate);
          constraintDate.setDate(constraintDate.getDate() + lag);
          break;
        case 'FF':
          const duration = this.getTaskDuration(taskId);
          constraintDate = new Date(predTask.endDate);
          constraintDate.setDate(constraintDate.getDate() + lag - duration + 1);
          break;
        case 'SF':
          constraintDate = new Date(predTask.startDate);
          constraintDate.setDate(constraintDate.getDate() + lag);
          break;
        default:
          constraintDate = new Date(predTask.endDate);
          constraintDate.setDate(constraintDate.getDate() + 1);
      }

      if (constraintDate > latestPredEnd) {
        latestPredEnd = constraintDate;
      }
    });

    return latestPredEnd.getTime() > 0 ? latestPredEnd : task.startDate;
  }

  // ============================================================================
  // Validation & Constraints API
  // ============================================================================

  /**
   * Validate all tasks and return issues
   */
  validateAllTasks(): Array<{ taskId: string; issue: string; severity: 'error' | 'warning' }> {
    const issues: Array<{ taskId: string; issue: string; severity: 'error' | 'warning' }> = [];

    this.state.tasks.forEach(task => {
      // Check for invalid dates
      if (task.endDate < task.startDate) {
        issues.push({
          taskId: task.id,
          issue: 'End date is before start date',
          severity: 'error',
        });
      }

      // Check for zero duration
      if (task.startDate.getTime() === task.endDate.getTime()) {
        issues.push({
          taskId: task.id,
          issue: 'Task has zero duration',
          severity: 'warning',
        });
      }

      // Check for overdue
      if (this.violatesTodayConstraint(task.id)) {
        issues.push({
          taskId: task.id,
          issue: 'Task is overdue (past start date but not started)',
          severity: 'warning',
        });
      }

      // Check for broken dependencies
      if (this.hasBrokenDependencies(task.id)) {
        issues.push({
          taskId: task.id,
          issue: 'Task has broken dependencies',
          severity: 'warning',
        });
      }

      // Check progress vs status mismatch
      if (task.status === 'completed' && (task.progress || 0) < 100) {
        issues.push({
          taskId: task.id,
          issue: 'Task marked complete but progress < 100%',
          severity: 'warning',
        });
      }

      // Check for predecessor constraint violations
      const earliestStart = this.calculateEarliestStart(task.id);
      if (task.startDate < earliestStart && task.status !== 'completed') {
        issues.push({
          taskId: task.id,
          issue: `Task starts before predecessors allow (earliest: ${earliestStart.toLocaleDateString()})`,
          severity: 'error',
        });
      }
    });

    return issues;
  }

  /**
   * Check if a task can be moved to a date
   */
  canMoveTask(taskId: string, newStartDate: Date): { canMove: boolean; reason?: string } {
    const task = this.getTask(taskId);
    if (!task) return { canMove: false, reason: 'Task not found' };

    if (task.locked) {
      return { canMove: false, reason: `Task is locked (${task.locked})` };
    }

    const constraints = this.checkMoveConstraints(taskId, newStartDate);

    if (constraints.violatesToday) {
      return { canMove: false, reason: 'Cannot schedule before today' };
    }

    if (constraints.violatesPredecessors.length > 0) {
      return {
        canMove: false,
        reason: `Violates predecessor constraints (${constraints.violatesPredecessors.length} conflicts)`,
      };
    }

    return { canMove: true };
  }

  /**
   * Auto-schedule a task based on predecessors
   */
  autoScheduleTask(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task || task.locked) return;

    const earliestStart = this.calculateEarliestStart(taskId);
    const snappedStart = this.calendar.snapToWorkingDay(earliestStart, true);

    if (snappedStart.getTime() !== task.startDate.getTime()) {
      this.moveTask(taskId, snappedStart);
    }
  }

  /**
   * Auto-schedule all unlocked tasks based on predecessors
   */
  autoScheduleAll(): number {
    let count = 0;

    // Sort by dependencies (process tasks with no/fewer predecessors first)
    const sorted = [...this.state.tasks].sort((a, b) => {
      const aPreds = a.predecessorIds?.length || 0;
      const bPreds = b.predecessorIds?.length || 0;
      return aPreds - bPreds;
    });

    this.beginBatchUpdate();

    sorted.forEach(task => {
      if (!task.locked) {
        const oldStart = task.startDate.getTime();
        this.autoScheduleTask(task.id);
        if (task.startDate.getTime() !== oldStart) {
          count++;
        }
      }
    });

    this.endBatchUpdate();
    return count;
  }

  /**
   * Get summary statistics
   */
  getStatistics(): {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    notStartedTasks: number;
    onHoldTasks: number;
    atRiskTasks: number;
    overdueTasks: number;
    completionRate: number;
    averageProgress: number;
    projectDuration: number;
    workingDays: number;
  } {
    const statusCounts = this.getStatusCounts();
    const range = this.getProjectDateRange();

    return {
      totalTasks: this.state.tasks.length,
      completedTasks: statusCounts['completed'] || 0,
      inProgressTasks: statusCounts['in-progress'] || 0,
      notStartedTasks: statusCounts['not-started'] || 0,
      onHoldTasks: statusCounts['on-hold'] || 0,
      atRiskTasks: statusCounts['at-risk'] || 0,
      overdueTasks: this.findOverdueTasks().length,
      completionRate: this.getCompletionPercentage(),
      averageProgress: this.getAverageProgress(),
      projectDuration: this.getProjectDuration(),
      workingDays: range ? this.calendar.getWorkingDaysBetween(range.start, range.end) : 0,
    };
  }

  // =========================================================================
  // PRINT & EXPORT API
  // =========================================================================

  /**
   * Generate print-ready HTML
   */
  generatePrintHTML(options: PrintOptions = {}): string {
    const {
      title = 'Gantt Chart',
      includeHeader = true,
      includeFooter = true,
      pageSize = 'A4',
      orientation = 'landscape',
      showDependencies = true,
      showProgress = true,
      showDates = true,
    } = options;

    const tasks = this.state.tasks;
    const range = this.getProjectDateRange();

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${pageSize} ${orientation};
            margin: 1cm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 10pt;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 18pt;
          }
          .header .dates {
            color: #666;
            font-size: 9pt;
          }
          .task-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .task-table th,
          .task-table td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            text-align: left;
          }
          .task-table th {
            background: #f5f5f5;
            font-weight: 600;
          }
          .task-table tr:nth-child(even) {
            background: #fafafa;
          }
          .progress-bar {
            width: 100px;
            height: 12px;
            background: #eee;
            border-radius: 6px;
            overflow: hidden;
          }
          .progress-fill {
            height: 100%;
            background: #4CAF50;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8pt;
          }
          .status-not-started { background: #e0e0e0; }
          .status-in-progress { background: #bbdefb; color: #1565c0; }
          .status-completed { background: #c8e6c9; color: #2e7d32; }
          .status-on-hold { background: #fff9c4; color: #f57f17; }
          .status-at-risk { background: #ffcdd2; color: #c62828; }
          .footer {
            text-align: center;
            font-size: 8pt;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 20px;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
    `;

    if (includeHeader) {
      html += `
        <div class="header">
          <h1>${title}</h1>
          ${range ? `<div class="dates">${this.formatDate(range.start)} - ${this.formatDate(range.end)}</div>` : ''}
        </div>
      `;
    }

    html += `
      <table class="task-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Task Name</th>
            ${showDates ? '<th>Start Date</th><th>End Date</th><th>Duration</th>' : ''}
            ${showProgress ? '<th>Progress</th>' : ''}
            <th>Status</th>
            ${showDependencies ? '<th>Predecessors</th>' : ''}
          </tr>
        </thead>
        <tbody>
    `;

    tasks.forEach((task, index) => {
      const duration = this.getTaskDuration(task.id);
      const progress = task.progress || 0;
      const status = task.status || 'not-started';
      const preds = task.predecessorIds?.join(', ') || '-';

      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${this.escapeHTML(task.name)}</td>
          ${showDates ? `
            <td>${this.formatDate(task.startDate)}</td>
            <td>${this.formatDate(task.endDate)}</td>
            <td>${duration} days</td>
          ` : ''}
          ${showProgress ? `
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
              ${progress}%
            </td>
          ` : ''}
          <td><span class="status-badge status-${status}">${status.replace('-', ' ')}</span></td>
          ${showDependencies ? `<td>${preds}</td>` : ''}
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    if (includeFooter) {
      const stats = this.getStatistics();
      html += `
        <div class="footer">
          <p>Total Tasks: ${stats.totalTasks} | Completed: ${stats.completedTasks} (${stats.completionRate.toFixed(1)}%) |
             In Progress: ${stats.inProgressTasks} | On Hold: ${stats.onHoldTasks} | At Risk: ${stats.atRiskTasks}</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      `;
    }

    html += `
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Open print dialog
   */
  print(options: PrintOptions = {}): void {
    const html = this.generatePrintHTML(options);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }

  /**
   * Export to PDF (requires html2canvas + jspdf)
   */
  async exportToPDF(options: PDFExportOptions = {}): Promise<Blob | null> {
    const {
      filename = 'gantt-chart.pdf',
      orientation = 'landscape',
      pageSize = 'A4',
      quality = 2,
      includeTaskList = true,
    } = options;

    // Check if required libraries are available
    if (typeof window === 'undefined') {
      console.error('PDF export requires browser environment');
      return null;
    }

    try {
      // Dynamic imports for PDF libraries
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Create a temporary container for the canvas
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.appendChild(this.canvas.cloneNode(true) as HTMLCanvasElement);
      document.body.appendChild(container);

      // Capture canvas as image
      const canvasImage = await html2canvas(container, { scale: quality });

      // Create PDF
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: pageSize,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add title
      pdf.setFontSize(16);
      pdf.text(options.title || 'Gantt Chart', pageWidth / 2, 15, { align: 'center' });

      // Add chart image
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvasImage.height * imgWidth) / canvasImage.width;
      pdf.addImage(canvasImage.toDataURL('image/png'), 'PNG', 10, 25, imgWidth, Math.min(imgHeight, pageHeight - 50));

      // Add task list on additional pages if requested
      if (includeTaskList) {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.text('Task List', 10, 15);

        let y = 25;
        pdf.setFontSize(10);

        this.state.tasks.forEach((task, index) => {
          if (y > pageHeight - 20) {
            pdf.addPage();
            y = 15;
          }

          const status = task.status || 'not-started';
          const progress = task.progress || 0;
          pdf.text(`${index + 1}. ${task.name} - ${status} (${progress}%)`, 10, y);
          y += 7;
        });
      }

      // Cleanup
      document.body.removeChild(container);

      // Return blob
      return pdf.output('blob');

    } catch (error) {
      console.error('PDF export failed:', error);
      console.info('PDF export requires html2canvas and jspdf packages. Install with: npm install html2canvas jspdf');
      return null;
    }
  }

  /**
   * Download PDF
   */
  async downloadPDF(options: PDFExportOptions = {}): Promise<void> {
    const blob = await this.exportToPDF(options);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = options.filename || 'gantt-chart.pdf';
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Helper: Format date for print
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Helper: Escape HTML entities
   */
  private escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =========================================================================
  // RESOURCE ASSIGNMENT API
  // =========================================================================

  /**
   * Resource assignments map (taskId -> resourceIds)
   */
  private taskResources: Map<string, string[]> = new Map();
  private resources: Map<string, Resource> = new Map();

  /**
   * Add a resource to the system
   */
  addResource(resource: Resource): void {
    this.resources.set(resource.id, resource);
  }

  /**
   * Remove a resource
   */
  removeResource(resourceId: string): void {
    this.resources.delete(resourceId);
    // Remove from all task assignments
    this.taskResources.forEach((resourceIds, taskId) => {
      const filtered = resourceIds.filter(id => id !== resourceId);
      this.taskResources.set(taskId, filtered);
    });
  }

  /**
   * Get a resource by ID
   */
  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }

  /**
   * Get all resources
   */
  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Assign resource to task
   */
  assignResource(taskId: string, resourceId: string): void {
    if (!this.resources.has(resourceId)) {
      console.warn(`Resource ${resourceId} not found`);
      return;
    }

    const existing = this.taskResources.get(taskId) || [];
    if (!existing.includes(resourceId)) {
      this.taskResources.set(taskId, [...existing, resourceId]);
      this.markDirty();
    }
  }

  /**
   * Unassign resource from task
   */
  unassignResource(taskId: string, resourceId: string): void {
    const existing = this.taskResources.get(taskId) || [];
    const filtered = existing.filter(id => id !== resourceId);
    this.taskResources.set(taskId, filtered);
    this.markDirty();
  }

  /**
   * Get resources assigned to a task
   */
  getTaskResources(taskId: string): Resource[] {
    const resourceIds = this.taskResources.get(taskId) || [];
    return resourceIds
      .map(id => this.resources.get(id))
      .filter((r): r is Resource => r !== undefined);
  }

  /**
   * Get tasks assigned to a resource
   */
  getResourceTasks(resourceId: string): GanttTask[] {
    const taskIds: string[] = [];
    this.taskResources.forEach((resourceIds, taskId) => {
      if (resourceIds.includes(resourceId)) {
        taskIds.push(taskId);
      }
    });
    return taskIds
      .map(id => this.getTask(id))
      .filter((t): t is GanttTask => t !== undefined);
  }

  /**
   * Check resource availability for date range
   */
  isResourceAvailable(resourceId: string, startDate: Date, endDate: Date, excludeTaskId?: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;

    const assignedTasks = this.getResourceTasks(resourceId)
      .filter(t => t.id !== excludeTaskId);

    // Check for overlapping assignments
    for (const task of assignedTasks) {
      const taskStart = task.startDate.getTime();
      const taskEnd = task.endDate.getTime();
      const checkStart = startDate.getTime();
      const checkEnd = endDate.getTime();

      // Check for overlap
      if (checkStart <= taskEnd && checkEnd >= taskStart) {
        return false; // Overlap found
      }
    }

    return true;
  }

  /**
   * Get resource utilization percentage for date range
   */
  getResourceUtilization(resourceId: string, startDate: Date, endDate: Date): number {
    const resource = this.resources.get(resourceId);
    if (!resource) return 0;

    const totalDays = this.calendar.getWorkingDaysBetween(startDate, endDate);
    if (totalDays === 0) return 0;

    const assignedTasks = this.getResourceTasks(resourceId);
    let assignedDays = 0;

    for (const task of assignedTasks) {
      // Calculate overlap with date range
      const overlapStart = new Date(Math.max(task.startDate.getTime(), startDate.getTime()));
      const overlapEnd = new Date(Math.min(task.endDate.getTime(), endDate.getTime()));

      if (overlapStart <= overlapEnd) {
        assignedDays += this.calendar.getWorkingDaysBetween(overlapStart, overlapEnd);
      }
    }

    return Math.min(100, (assignedDays / totalDays) * 100);
  }

  /**
   * Find overallocated resources in date range
   */
  findOverallocatedResources(startDate: Date, endDate: Date): { resource: Resource; dates: Date[] }[] {
    const overallocated: { resource: Resource; dates: Date[] }[] = [];

    this.resources.forEach(resource => {
      const dates: Date[] = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        if (this.calendar.isWorkingDay(current)) {
          // Count tasks assigned on this day
          const tasksOnDay = this.getResourceTasks(resource.id).filter(task => {
            return current >= task.startDate && current <= task.endDate;
          });

          if (tasksOnDay.length > 1) {
            dates.push(new Date(current));
          }
        }
        current.setDate(current.getDate() + 1);
      }

      if (dates.length > 0) {
        overallocated.push({ resource, dates });
      }
    });

    return overallocated;
  }

  // =========================================================================
  // ACCESSIBILITY (A11Y) API
  // =========================================================================

  /**
   * ARIA live region announcements
   */
  private ariaLiveRegion: HTMLDivElement | null = null;

  /**
   * Initialize accessibility features
   */
  initializeAccessibility(): void {
    // Create ARIA live region for announcements
    this.ariaLiveRegion = document.createElement('div');
    this.ariaLiveRegion.setAttribute('role', 'status');
    this.ariaLiveRegion.setAttribute('aria-live', 'polite');
    this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
    this.ariaLiveRegion.className = 'sr-only'; // Screen reader only
    this.ariaLiveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(this.ariaLiveRegion);

    // Set canvas ARIA attributes
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', 'Gantt Chart - Use arrow keys to navigate tasks');
    this.canvas.setAttribute('tabindex', '0');
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.ariaLiveRegion) return;

    this.ariaLiveRegion.setAttribute('aria-live', priority);
    this.ariaLiveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.ariaLiveRegion) {
        this.ariaLiveRegion.textContent = '';
      }
    }, 1000);
  }

  /**
   * Get task description for screen readers
   */
  getTaskDescription(taskId: string): string {
    const task = this.getTask(taskId);
    if (!task) return 'Unknown task';

    const index = this.getTaskIndex(taskId);
    const duration = this.getTaskDuration(taskId);
    const status = task.status || 'not-started';
    const progress = task.progress || 0;
    const locked = task.locked ? ', locked' : '';
    const onHold = this.isTaskOnHold(taskId) ? ', on hold' : '';

    return `Task ${index + 1}: ${task.name}. ` +
           `Starts ${this.formatDate(task.startDate)}, ` +
           `ends ${this.formatDate(task.endDate)}, ` +
           `${duration} days. ` +
           `Status: ${status.replace('-', ' ')}, ${progress}% complete${locked}${onHold}`;
  }

  /**
   * Announce task selection
   */
  announceTaskSelection(taskId: string): void {
    const description = this.getTaskDescription(taskId);
    this.announce(description);
  }

  /**
   * Announce action result
   */
  announceAction(action: string): void {
    this.announce(action, 'assertive');
  }

  /**
   * Get keyboard navigation instructions
   */
  getKeyboardInstructions(): string {
    return `
      Keyboard Navigation:
      - Arrow Up/Down: Navigate between tasks
      - Arrow Left/Right: Move selected task dates
      - Enter: Edit selected task
      - Delete: Delete selected task
      - Space: Toggle progress
      - S: Start task
      - L: Toggle lock
      - H: Toggle hold
      - Ctrl+A: Select all
      - Ctrl+Z: Undo
      - Ctrl+Y: Redo
      - Escape: Deselect all
      - T: Scroll to today
      - F: Fit all tasks in view
    `;
  }

  /**
   * Cleanup accessibility resources
   */
  cleanupAccessibility(): void {
    if (this.ariaLiveRegion && this.ariaLiveRegion.parentNode) {
      this.ariaLiveRegion.parentNode.removeChild(this.ariaLiveRegion);
      this.ariaLiveRegion = null;
    }
  }

  // =========================================================================
  // COMMAND CREATION HELPERS (for use with UndoManager)
  // =========================================================================

  // Note: The undo/redo system uses the UndoManager class (see undo(), redo(), canUndo(), canRedo() methods above)

  /**
   * Create a move task command
   */
  createMoveCommand(taskId: string, newStartDate: Date): Command {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const oldStartDate = new Date(task.startDate);
    const oldEndDate = new Date(task.endDate);
    const duration = task.endDate.getTime() - task.startDate.getTime();
    const newEndDate = new Date(newStartDate.getTime() + duration);

    return {
      id: `move-${taskId}-${Date.now()}`,
      timestamp: Date.now(),
      description: `Move ${task.name}`,
      execute: () => {
        const t = this.getTask(taskId);
        if (t) {
          t.startDate = new Date(newStartDate);
          t.endDate = new Date(newEndDate);
        }
      },
      undo: () => {
        const t = this.getTask(taskId);
        if (t) {
          t.startDate = oldStartDate;
          t.endDate = oldEndDate;
        }
      },
    };
  }

  /**
   * Create a progress change command
   */
  createProgressCommand(taskId: string, newProgress: number): Command {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const oldProgress = task.progress || 0;

    return {
      id: `progress-${taskId}-${Date.now()}`,
      timestamp: Date.now(),
      description: `Change progress of ${task.name}`,
      execute: () => {
        const t = this.getTask(taskId);
        if (t) t.progress = newProgress;
      },
      undo: () => {
        const t = this.getTask(taskId);
        if (t) t.progress = oldProgress;
      },
    };
  }

  /**
   * Create a delete task command
   */
  createDeleteCommand(taskId: string): Command {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const taskCopy = { ...task };
    const index = this.getTaskIndex(taskId);

    return {
      id: `delete-${taskId}-${Date.now()}`,
      timestamp: Date.now(),
      description: `Delete ${task.name}`,
      execute: () => {
        const idx = this.state.tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
          this.state.tasks.splice(idx, 1);
        }
      },
      undo: () => {
        this.state.tasks.splice(index, 0, taskCopy);
      },
    };
  }

  /**
   * Create an add task command
   */
  createAddCommand(task: GanttTask): Command {
    const taskCopy = { ...task };

    return {
      id: `add-${task.id}-${Date.now()}`,
      timestamp: Date.now(),
      description: `Add ${task.name}`,
      execute: () => {
        this.state.tasks.push(taskCopy);
      },
      undo: () => {
        const idx = this.state.tasks.findIndex(t => t.id === taskCopy.id);
        if (idx !== -1) {
          this.state.tasks.splice(idx, 1);
        }
      },
    };
  }

  // =========================================================================
  // TOUCH/MOBILE GESTURE SUPPORT
  // =========================================================================

  /**
   * Touch state tracking
   */
  private touchState: TouchState = {
    isActive: false,
    startTime: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    touches: [],
    gesture: null,
    pinchStartDistance: 0,
    pinchStartZoom: 1,
    velocityX: 0,
    velocityY: 0,
    lastMoveTime: 0,
  };

  private touchLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchMomentumAnimationId: number | null = null;

  /**
   * Initialize touch event listeners
   */
  initializeTouchEvents(): void {
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
  }

  /**
   * Handle touch start
   */
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    const touches = Array.from(e.touches);
    const now = Date.now();

    this.touchState.isActive = true;
    this.touchState.startTime = now;
    this.touchState.touches = touches.map(t => ({ x: t.clientX, y: t.clientY }));

    if (touches.length === 1) {
      // Single finger touch
      const touch = touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.touchState.startX = x;
      this.touchState.startY = y;
      this.touchState.lastX = x;
      this.touchState.lastY = y;
      this.touchState.gesture = 'tap';

      // Start long press timer for context menu
      this.touchLongPressTimer = setTimeout(() => {
        if (this.touchState.gesture === 'tap') {
          this.touchState.gesture = 'longpress';
          // Trigger context menu at touch location
          const task = this.hitTestTask(x, y);
          if (task) {
            this.showContextMenuForTask(task, touch.clientX, touch.clientY);
          }
        }
      }, 500);

    } else if (touches.length === 2) {
      // Two finger pinch/pan
      this.cancelLongPress();
      this.touchState.gesture = 'pinch';
      this.touchState.pinchStartDistance = this.getTouchDistance(touches[0], touches[1]);
      this.touchState.pinchStartZoom = this.viewport.getState().zoom;
    }

    // Stop any ongoing momentum
    this.stopMomentumScroll();
  }

  /**
   * Handle touch move
   */
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    const touches = Array.from(e.touches);
    const now = Date.now();

    if (touches.length === 1 && this.touchState.gesture !== 'longpress') {
      const touch = touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const deltaX = x - this.touchState.lastX;
      const deltaY = y - this.touchState.lastY;
      const totalDeltaX = x - this.touchState.startX;
      const totalDeltaY = y - this.touchState.startY;

      // Check if moved enough to be a drag
      if (Math.abs(totalDeltaX) > 10 || Math.abs(totalDeltaY) > 10) {
        this.cancelLongPress();

        if (this.touchState.gesture === 'tap') {
          // Check if touching a task
          const task = this.hitTestTask(this.touchState.startX, this.touchState.startY);
          if (task && !task.locked) {
            this.touchState.gesture = 'drag-task';
            this.startTaskDrag(task, this.touchState.startX, this.touchState.startY);
          } else {
            this.touchState.gesture = 'pan';
          }
        }

        if (this.touchState.gesture === 'pan') {
          this.viewport.pan(-deltaX, -deltaY);
          this.markDirty();
        } else if (this.touchState.gesture === 'drag-task') {
          this.updateTaskDrag(x, y);
        }

        // Track velocity for momentum
        const timeDelta = now - this.touchState.lastMoveTime;
        if (timeDelta > 0) {
          this.touchState.velocityX = deltaX / timeDelta * 16; // normalize to ~60fps
          this.touchState.velocityY = deltaY / timeDelta * 16;
        }
      }

      this.touchState.lastX = x;
      this.touchState.lastY = y;
      this.touchState.lastMoveTime = now;

    } else if (touches.length === 2) {
      // Pinch zoom with center preservation
      const distance = this.getTouchDistance(touches[0], touches[1]);
      const scale = distance / this.touchState.pinchStartDistance;
      const newZoom = this.touchState.pinchStartZoom * scale;

      // Calculate center point for zoom
      const centerX = (touches[0].clientX + touches[1].clientX) / 2;
      const centerY = (touches[0].clientY + touches[1].clientY) / 2;
      const rect = this.canvas.getBoundingClientRect();
      const localX = centerX - rect.left;

      // Preserve the date at the center point during zoom
      const oldZoom = this.viewport.getState().zoom;
      const dateAtCenter = this.viewport.xToDate(localX);

      this.viewport.setZoom(newZoom);

      // Adjust scroll to keep the same date at the center
      const newX = this.viewport.dateToX(dateAtCenter);
      const scrollAdjust = newX - localX;
      this.viewport.pan(scrollAdjust, 0);

      this.markDirty();
    }
  }

  /**
   * Handle touch end
   */
  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();

    this.cancelLongPress();

    const gesture = this.touchState.gesture;
    const duration = Date.now() - this.touchState.startTime;

    if (gesture === 'tap' && duration < 300) {
      // Quick tap - select task
      const task = this.hitTestTask(this.touchState.startX, this.touchState.startY);
      if (task) {
        this.selectTask(task.id, false, false);
        this.announceTaskSelection(task.id);
      } else {
        this.clearSelection();
      }

      // Check for double tap
      if (this.lastTapTime && Date.now() - this.lastTapTime < 300) {
        // Double tap - edit task or zoom
        const task = this.hitTestTask(this.touchState.startX, this.touchState.startY);
        if (task) {
          this.onTaskDoubleClick?.(task);
        } else {
          // Double tap on empty space - zoom in at tap point
          const tapX = this.touchState.startX;
          const dateAtTap = this.viewport.xToDate(tapX);
          const newZoom = this.viewport.getState().zoom * 1.5;

          this.viewport.setZoom(newZoom);

          // Adjust scroll to keep the same date at the tap point
          const newX = this.viewport.dateToX(dateAtTap);
          this.viewport.pan(newX - tapX, 0);

          this.markDirty();
        }
      }
      this.lastTapTime = Date.now();

    } else if (gesture === 'drag-task') {
      this.endTaskDrag();

    } else if (gesture === 'pan') {
      // Start momentum scroll if velocity is high enough
      const velocity = Math.sqrt(
        this.touchState.velocityX ** 2 +
        this.touchState.velocityY ** 2
      );
      if (velocity > 2) {
        this.startMomentumScroll();
      }
    }

    this.resetTouchState();
  }

  /**
   * Handle touch cancel
   */
  private handleTouchCancel(e: TouchEvent): void {
    e.preventDefault();
    this.cancelLongPress();

    if (this.touchState.gesture === 'drag-task') {
      this.cancelTaskDrag();
    }

    this.resetTouchState();
  }

  private lastTapTime: number = 0;

  /**
   * Get distance between two touches
   */
  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Cancel long press timer
   */
  private cancelLongPress(): void {
    if (this.touchLongPressTimer) {
      clearTimeout(this.touchLongPressTimer);
      this.touchLongPressTimer = null;
    }
  }

  /**
   * Reset touch state
   */
  private resetTouchState(): void {
    this.touchState = {
      isActive: false,
      startTime: 0,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      touches: [],
      gesture: null,
      pinchStartDistance: 0,
      pinchStartZoom: 1,
      velocityX: 0,
      velocityY: 0,
      lastMoveTime: 0,
    };
  }

  /**
   * Start momentum scroll animation
   */
  private startMomentumScroll(): void {
    const friction = 0.95;
    let velocityX = this.touchState.velocityX;
    let velocityY = this.touchState.velocityY;

    const animate = () => {
      if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) {
        this.touchMomentumAnimationId = null;
        return;
      }

      this.viewport.pan(-velocityX, -velocityY);
      this.markDirty();

      velocityX *= friction;
      velocityY *= friction;

      this.touchMomentumAnimationId = requestAnimationFrame(animate);
    };

    this.touchMomentumAnimationId = requestAnimationFrame(animate);
  }

  /**
   * Stop momentum scroll
   */
  private stopMomentumScroll(): void {
    if (this.touchMomentumAnimationId) {
      cancelAnimationFrame(this.touchMomentumAnimationId);
      this.touchMomentumAnimationId = null;
    }
  }

  /**
   * Show context menu for a task (touch)
   */
  private showContextMenuForTask(task: GanttTask, screenX: number, screenY: number): void {
    // Vibrate for haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Set context menu state
    this.contextMenuVisible = true;
    this.contextMenuX = screenX;
    this.contextMenuY = screenY;
    this.contextMenuTask = task;

    // Build menu items for task
    this.contextMenuItems = [
      { id: 'edit', label: 'Edit Task' },
      { id: 'start', label: task.status === 'in-progress' ? 'Mark Not Started' : 'Start Task' },
      { id: 'complete', label: 'Mark Complete' },
      { id: 'separator1', label: '', separator: true },
      { id: 'lock', label: task.locked ? 'Unlock' : 'Lock Position' },
      { id: 'hold', label: this.isTaskOnHold(task.id) ? 'Resume' : 'Put On Hold' },
      { id: 'separator2', label: '', separator: true },
      { id: 'delete', label: 'Delete Task' },
    ];

    this.markDirty();
  }

  // =========================================================================
  // DRAG TOOLTIP API
  // =========================================================================

  /**
   * Drag tooltip state
   */
  private dragTooltip: DragTooltipState = {
    visible: false,
    x: 0,
    y: 0,
    task: null,
    originalDate: null,
    newDate: null,
    duration: 0,
    predecessorCount: 0,
    successorCount: 0,
  };

  /**
   * Show drag tooltip
   */
  showDragTooltip(task: GanttTask, x: number, y: number, newStartDate: Date): void {
    const predecessors = task.predecessorIds?.length || 0;
    const successors = this.getSuccessors(task.id).length;
    const duration = this.getTaskDuration(task.id);

    this.dragTooltip = {
      visible: true,
      x: x + 20,
      y: y - 60,
      task,
      originalDate: task.startDate,
      newDate: newStartDate,
      duration,
      predecessorCount: predecessors,
      successorCount: successors,
    };

    this.markDirty();
  }

  /**
   * Update drag tooltip position
   */
  updateDragTooltip(x: number, y: number, newStartDate: Date): void {
    if (!this.dragTooltip.visible) return;

    this.dragTooltip.x = x + 20;
    this.dragTooltip.y = y - 60;
    this.dragTooltip.newDate = newStartDate;

    this.markDirty();
  }

  /**
   * Hide drag tooltip
   */
  hideDragTooltip(): void {
    this.dragTooltip.visible = false;
    this.markDirty();
  }

  /**
   * Get drag tooltip state for rendering
   */
  getDragTooltipState(): DragTooltipState {
    return { ...this.dragTooltip };
  }

  // =========================================================================
  // TASK GROUPING & COLLAPSE API
  // =========================================================================

  /**
   * Collapsed groups state (set of parent task IDs that are collapsed)
   */
  private collapsedGroups: Set<string> = new Set();

  /**
   * Toggle group collapsed state
   */
  toggleGroupCollapsed(parentTaskId: string): void {
    if (this.collapsedGroups.has(parentTaskId)) {
      this.collapsedGroups.delete(parentTaskId);
      this.announceAction(`Expanded group`);
    } else {
      this.collapsedGroups.add(parentTaskId);
      this.announceAction(`Collapsed group`);
    }
    this.markDirty();
  }

  /**
   * Collapse a group
   */
  collapseGroup(parentTaskId: string): void {
    if (!this.collapsedGroups.has(parentTaskId)) {
      this.collapsedGroups.add(parentTaskId);
      this.markDirty();
    }
  }

  /**
   * Expand a group
   */
  expandGroup(parentTaskId: string): void {
    if (this.collapsedGroups.has(parentTaskId)) {
      this.collapsedGroups.delete(parentTaskId);
      this.markDirty();
    }
  }

  /**
   * Collapse all groups
   */
  collapseAllGroups(): void {
    this.getRootTasks().forEach(task => {
      if (this.hasChildren(task.id)) {
        this.collapsedGroups.add(task.id);
      }
    });
    this.announceAction('Collapsed all groups');
    this.markDirty();
  }

  /**
   * Expand all groups
   */
  expandAllGroups(): void {
    this.collapsedGroups.clear();
    this.announceAction('Expanded all groups');
    this.markDirty();
  }

  /**
   * Check if group is collapsed
   */
  isGroupCollapsed(parentTaskId: string): boolean {
    return this.collapsedGroups.has(parentTaskId);
  }

  /**
   * Get visible tasks (respecting collapsed groups)
   */
  getVisibleTasks(): GanttTask[] {
    const visible: GanttTask[] = [];
    const hiddenByParent = new Set<string>();

    // First pass: identify all hidden tasks
    this.state.tasks.forEach(task => {
      const ancestorIds = this.getTaskAncestors(task.id);
      for (const ancestorId of ancestorIds) {
        if (this.collapsedGroups.has(ancestorId)) {
          hiddenByParent.add(task.id);
          break;
        }
      }
    });

    // Second pass: collect visible tasks
    this.state.tasks.forEach(task => {
      if (!hiddenByParent.has(task.id)) {
        visible.push(task);
      }
    });

    return visible;
  }

  /**
   * Get collapsed group count
   */
  getCollapsedGroupCount(): number {
    return this.collapsedGroups.size;
  }

  /**
   * Get hidden task count (tasks inside collapsed groups)
   */
  getHiddenTaskCount(): number {
    let hidden = 0;
    this.collapsedGroups.forEach(parentId => {
      hidden += this.getTaskDescendants(parentId).length;
    });
    return hidden;
  }

  // =========================================================================
  // ZOOM PRESETS & TOOLBAR API
  // =========================================================================

  /**
   * Predefined zoom levels
   */
  private zoomPresets: ZoomPreset[] = [
    { id: 'day', label: 'Day', daysVisible: 7, zoom: 3 },
    { id: 'week', label: 'Week', daysVisible: 14, zoom: 1.5 },
    { id: 'month', label: 'Month', daysVisible: 30, zoom: 0.7 },
    { id: 'quarter', label: 'Quarter', daysVisible: 90, zoom: 0.25 },
    { id: 'year', label: 'Year', daysVisible: 365, zoom: 0.07 },
  ];

  private currentZoomPreset: string = 'month';

  /**
   * Get all zoom presets
   */
  getZoomPresets(): ZoomPreset[] {
    return [...this.zoomPresets];
  }

  /**
   * Get current zoom preset ID
   */
  getCurrentZoomPreset(): string {
    return this.currentZoomPreset;
  }

  /**
   * Apply a zoom preset
   */
  applyZoomPreset(presetId: string): void {
    const preset = this.zoomPresets.find(p => p.id === presetId);
    if (!preset) return;

    this.currentZoomPreset = presetId;
    this.viewport.setZoom(preset.zoom);
    this.markDirty();

    this.announceAction(`Zoom: ${preset.label} view`);
  }

  /**
   * Zoom in one level
   */
  zoomInOneLevel(): void {
    const currentIndex = this.zoomPresets.findIndex(p => p.id === this.currentZoomPreset);
    if (currentIndex > 0) {
      this.applyZoomPreset(this.zoomPresets[currentIndex - 1].id);
    }
  }

  /**
   * Zoom out one level
   */
  zoomOutOneLevel(): void {
    const currentIndex = this.zoomPresets.findIndex(p => p.id === this.currentZoomPreset);
    if (currentIndex < this.zoomPresets.length - 1) {
      this.applyZoomPreset(this.zoomPresets[currentIndex + 1].id);
    }
  }

  /**
   * Add a custom zoom preset
   */
  addZoomPreset(preset: ZoomPreset): void {
    // Insert in order by daysVisible
    const index = this.zoomPresets.findIndex(p => p.daysVisible > preset.daysVisible);
    if (index === -1) {
      this.zoomPresets.push(preset);
    } else {
      this.zoomPresets.splice(index, 0, preset);
    }
  }

  /**
   * Remove a custom zoom preset
   */
  removeZoomPreset(presetId: string): void {
    const index = this.zoomPresets.findIndex(p => p.id === presetId);
    if (index !== -1) {
      this.zoomPresets.splice(index, 1);
      if (this.currentZoomPreset === presetId) {
        this.currentZoomPreset = 'month';
      }
    }
  }

  /**
   * Get toolbar state for React rendering
   */
  getToolbarState(): ToolbarState {
    return {
      zoomPresets: this.getZoomPresets(),
      currentZoomPreset: this.currentZoomPreset,
      canZoomIn: this.zoomPresets.findIndex(p => p.id === this.currentZoomPreset) > 0,
      canZoomOut: this.zoomPresets.findIndex(p => p.id === this.currentZoomPreset) < this.zoomPresets.length - 1,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      selectedTaskCount: this.state.selectedTaskIds.size,
      totalTaskCount: this.state.tasks.length,
      visibleTaskCount: this.getVisibleTasks().length,
      collapsedGroupCount: this.getCollapsedGroupCount(),
      criticalPathEnabled: this.criticalPathEnabled,
      baselineEnabled: this.baselineEnabled,
      minimapVisible: this.minimapVisible,
    };
  }

  // =========================================================================
  // SNAP-TO-GRID CONFIGURATION
  // =========================================================================

  /**
   * Snap configuration
   */
  private snapConfig: SnapConfig = {
    enabled: true,
    snapToDay: true,
    snapToWorkingDay: true,
    snapToWeekStart: false,
    snapToMonthStart: false,
    snapThresholdPixels: 10,
    showSnapGuides: true,
  };

  /**
   * Get snap configuration
   */
  getSnapConfig(): SnapConfig {
    return { ...this.snapConfig };
  }

  /**
   * Set snap configuration
   */
  setSnapConfig(config: Partial<SnapConfig>): void {
    this.snapConfig = { ...this.snapConfig, ...config };
  }

  /**
   * Toggle snap to grid
   */
  toggleSnap(): void {
    this.snapConfig.enabled = !this.snapConfig.enabled;
    this.announceAction(this.snapConfig.enabled ? 'Snap enabled' : 'Snap disabled');
  }

  /**
   * Snap a date based on current configuration
   */
  snapDate(date: Date): Date {
    if (!this.snapConfig.enabled) {
      return date;
    }

    let snapped = new Date(date);

    // Snap to month start first (largest unit)
    if (this.snapConfig.snapToMonthStart) {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const daysToStart = Math.abs(date.getDate() - 1);
      const daysToEnd = Math.abs(monthEnd.getDate() - date.getDate());
      if (daysToStart <= 3) {
        snapped = monthStart;
      } else if (daysToEnd <= 3) {
        snapped = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      }
    }

    // Snap to week start
    if (this.snapConfig.snapToWeekStart && !this.snapConfig.snapToMonthStart) {
      const dayOfWeek = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      if (Math.abs(date.getTime() - monday.getTime()) <= 2 * 24 * 60 * 60 * 1000) {
        snapped = monday;
      }
    }

    // Snap to working day
    if (this.snapConfig.snapToWorkingDay) {
      snapped = this.calendar.snapToWorkingDay(snapped, true);
    }

    // Snap to day boundary
    if (this.snapConfig.snapToDay) {
      snapped.setHours(0, 0, 0, 0);
    }

    return snapped;
  }

  /**
   * Check if a position should snap
   */
  shouldSnap(pixelDistance: number): boolean {
    return this.snapConfig.enabled &&
           Math.abs(pixelDistance) <= this.snapConfig.snapThresholdPixels;
  }

  /**
   * Get snap guides for current drag operation
   */
  getSnapGuides(draggedTask: GanttTask, proposedDate: Date): SnapGuide[] {
    if (!this.snapConfig.showSnapGuides) return [];

    const guides: SnapGuide[] = [];
    const proposedX = this.dateToX(proposedDate);

    // Add snap guide for today
    const todayX = this.dateToX(new Date());
    if (this.shouldSnap(Math.abs(proposedX - todayX))) {
      guides.push({ type: 'today', x: todayX, label: 'Today' });
    }

    // Add snap guides for other task starts/ends
    this.state.tasks.forEach(task => {
      if (task.id === draggedTask.id) return;

      const startX = this.dateToX(task.startDate);
      const endX = this.dateToX(task.endDate);

      if (this.shouldSnap(Math.abs(proposedX - startX))) {
        guides.push({ type: 'task-start', x: startX, label: task.name, taskId: task.id });
      }

      if (this.shouldSnap(Math.abs(proposedX - endX))) {
        guides.push({ type: 'task-end', x: endX, label: task.name, taskId: task.id });
      }
    });

    return guides;
  }

  /**
   * Convert date to X coordinate
   */
  private dateToX(date: Date): number {
    return this.viewport.dateToX(date);
  }

  // =========================================================================
  // HELPER: Task drag operations (used by touch)
  // =========================================================================

  private startTaskDrag(task: GanttTask, x: number, y: number): void {
    this.dragTask = task;
    this.isDragging = true;
    this.dragStartX = x;
    this.dragStartDate = new Date(task.startDate);
    this.showDragTooltip(task, x, y, task.startDate);
  }

  private updateTaskDrag(x: number, y: number): void {
    if (!this.dragTask || !this.dragStartDate) return;

    const task = this.dragTask;

    const deltaX = x - this.dragStartX;
    const deltaDays = Math.round(deltaX / this.viewport.getDayWidth());
    const newDate = new Date(this.dragStartDate);
    newDate.setDate(newDate.getDate() + deltaDays);

    const snappedDate = this.snapDate(newDate);
    this.updateDragTooltip(x, y, snappedDate);

    // Preview position (don't actually move yet)
    this.markDirty();
  }

  private endTaskDrag(): void {
    if (!this.dragTask || !this.dragStartDate) return;

    const task = this.dragTask;
    if (task && this.dragTooltip.newDate) {
      const duration = task.endDate.getTime() - task.startDate.getTime();
      task.startDate = new Date(this.dragTooltip.newDate);
      task.endDate = new Date(task.startDate.getTime() + duration);

      this.onTaskDrag?.(task, task.startDate);
    }

    this.hideDragTooltip();
    this.isDragging = false;
    this.dragTask = null;
    this.dragStartDate = null;
  }

  private cancelTaskDrag(): void {
    this.hideDragTooltip();
    this.isDragging = false;
    this.dragTask = null;
    this.dragStartDate = null;
    this.markDirty();
  }

  private hitTestTask(x: number, y: number): GanttTask | null {
    // Use the existing hit test logic from mouse handler
    const result = this.performHitTest(x, y);
    if (result.type === 'task' && result.taskId) {
      return this.getTask(result.taskId) || null;
    }
    return null;
  }

  private performHitTest(x: number, y: number): { type: 'task' | 'dependency' | 'empty'; taskId?: string } {
    // Check each visible task
    const rowHeight = 36;
    const headerHeight = 50;
    const taskBarHeight = 24;

    const scrollY = this.viewport.getState().scrollY;
    const visibleTasks = this.getVisibleTasks();

    for (let i = 0; i < visibleTasks.length; i++) {
      const task = visibleTasks[i];
      const taskY = headerHeight + i * rowHeight - scrollY + (rowHeight - taskBarHeight) / 2;

      const taskStartX = this.dateToX(task.startDate);
      const taskEndX = this.dateToX(task.endDate);

      if (x >= taskStartX && x <= taskEndX && y >= taskY && y <= taskY + taskBarHeight) {
        return { type: 'task', taskId: task.id };
      }
    }

    return { type: 'empty' };
  }

  // =========================================================================
  // UNDO COMMAND HELPERS - Extensions to existing UndoManager
  // =========================================================================

  /**
   * Create a task move command (helper for undo/redo)
   */
  createMoveTaskCommand(taskId: string, newStartDate: Date): Command {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const originalStart = new Date(task.startDate);
    const originalEnd = new Date(task.endDate);
    const duration = originalEnd.getTime() - originalStart.getTime();
    const newEndDate = new Date(newStartDate.getTime() + duration);

    return {
      id: `move-${taskId}-${Date.now()}`,
      description: `Move "${task.name}" to ${newStartDate.toLocaleDateString()}`,
      timestamp: Date.now(),
      execute: () => {
        const t = this.getTask(taskId);
        if (t) {
          t.startDate = new Date(newStartDate);
          t.endDate = new Date(newEndDate);
        }
      },
      undo: () => {
        const t = this.getTask(taskId);
        if (t) {
          t.startDate = new Date(originalStart);
          t.endDate = new Date(originalEnd);
        }
      }
    };
  }

  /**
   * Create a task resize command (helper for undo/redo)
   */
  createResizeTaskCommand(taskId: string, newStart: Date, newEnd: Date): Command {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const originalStart = new Date(task.startDate);
    const originalEnd = new Date(task.endDate);

    return {
      id: `resize-${taskId}-${Date.now()}`,
      description: `Resize "${task.name}"`,
      timestamp: Date.now(),
      execute: () => {
        const t = this.getTask(taskId);
        if (t) {
          t.startDate = new Date(newStart);
          t.endDate = new Date(newEnd);
        }
      },
      undo: () => {
        const t = this.getTask(taskId);
        if (t) {
          t.startDate = new Date(originalStart);
          t.endDate = new Date(originalEnd);
        }
      }
    };
  }

  // =========================================================================
  // PROGRESS BAR OVERLAY - Visual task progress
  // =========================================================================

  private showProgressBars: boolean = true;

  /**
   * Set task progress (0-100)
   */
  setTaskProgress(taskId: string, progress: number): void {
    const task = this.getTask(taskId);
    if (task) {
      task.progress = Math.max(0, Math.min(100, progress));
      this.markDirty();
    }
  }

  /**
   * Get task progress
   */
  getTaskProgress(taskId: string): number {
    const task = this.getTask(taskId);
    return task?.progress ?? 0;
  }

  /**
   * Toggle progress bar visibility
   */
  toggleProgressBars(): void {
    this.showProgressBars = !this.showProgressBars;
    this.markDirty();
  }

  /**
   * Set progress bar visibility
   */
  setShowProgressBars(show: boolean): void {
    this.showProgressBars = show;
    this.markDirty();
  }

  /**
   * Get progress bar visibility
   */
  isShowingProgressBars(): boolean {
    return this.showProgressBars;
  }

  /**
   * Calculate overall project progress
   */
  calculateProjectProgress(): { completed: number; total: number; percentage: number } {
    const tasks = this.state.tasks;
    const total = tasks.length;

    if (total === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    let weightedProgress = 0;
    tasks.forEach(task => {
      // Weight by task duration
      const duration = Math.max(1, this.getDurationDays(task));
      weightedProgress += (task.progress || 0) * duration;
    });

    const totalDuration = tasks.reduce((sum, task) => sum + Math.max(1, this.getDurationDays(task)), 0);
    const percentage = Math.round(weightedProgress / totalDuration);

    const completed = tasks.filter(t => (t.progress || 0) >= 100).length;

    return { completed, total, percentage };
  }

  private getDurationDays(task: GanttTask): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / msPerDay);
  }

  // =========================================================================
  // ENHANCED KEYBOARD SHORTCUTS
  // =========================================================================

  private keyboardShortcuts: Map<string, KeyboardShortcut> = new Map();
  private keyboardEnabled: boolean = true;

  /**
   * Initialize default keyboard shortcuts
   */
  initializeDefaultKeyboardShortcuts(): void {
    this.registerKeyboardShortcut({
      key: 'z',
      ctrl: true,
      description: 'Undo',
      action: () => this.undo()
    });

    this.registerKeyboardShortcut({
      key: 'y',
      ctrl: true,
      description: 'Redo',
      action: () => this.redo()
    });

    this.registerKeyboardShortcut({
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Redo (alternative)',
      action: () => this.redo()
    });

    this.registerKeyboardShortcut({
      key: 'a',
      ctrl: true,
      description: 'Select all tasks',
      action: () => this.selectAllTasks()
    });

    this.registerKeyboardShortcut({
      key: 'Escape',
      description: 'Clear selection',
      action: () => this.clearSelection()
    });

    this.registerKeyboardShortcut({
      key: 'Delete',
      description: 'Delete selected tasks',
      action: () => this.deleteSelectedTasks()
    });

    this.registerKeyboardShortcut({
      key: 'ArrowLeft',
      description: 'Move selected task earlier',
      action: () => this.nudgeSelectedTasks(-1)
    });

    this.registerKeyboardShortcut({
      key: 'ArrowRight',
      description: 'Move selected task later',
      action: () => this.nudgeSelectedTasks(1)
    });

    this.registerKeyboardShortcut({
      key: '0',
      ctrl: true,
      description: 'Reset zoom',
      action: () => this.applyZoomPreset('month')
    });

    this.registerKeyboardShortcut({
      key: '+',
      ctrl: true,
      description: 'Zoom in',
      action: () => this.zoomInOneLevel()
    });

    this.registerKeyboardShortcut({
      key: '-',
      ctrl: true,
      description: 'Zoom out',
      action: () => this.zoomOutOneLevel()
    });

    this.registerKeyboardShortcut({
      key: 'f',
      description: 'Zoom to fit all tasks',
      action: () => this.zoomToFit()
    });

    this.registerKeyboardShortcut({
      key: 't',
      description: 'Scroll to today',
      action: () => this.scrollToToday()
    });

    this.registerKeyboardShortcut({
      key: 'c',
      description: 'Toggle critical path',
      action: () => this.toggleCriticalPath()
    });

    this.registerKeyboardShortcut({
      key: 'p',
      description: 'Toggle progress bars',
      action: () => this.toggleProgressBars()
    });
  }

  /**
   * Register a keyboard shortcut
   */
  registerKeyboardShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.keyboardShortcuts.set(key, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterKeyboardShortcut(shortcut: Omit<KeyboardShortcut, 'action' | 'description'>): void {
    const key = this.getShortcutKey(shortcut as KeyboardShortcut);
    this.keyboardShortcuts.delete(key);
  }

  /**
   * Get all registered shortcuts
   */
  getKeyboardShortcuts(): KeyboardShortcut[] {
    return Array.from(this.keyboardShortcuts.values());
  }

  /**
   * Enable/disable keyboard shortcuts
   */
  setKeyboardEnabled(enabled: boolean): void {
    this.keyboardEnabled = enabled;
  }

  /**
   * Process keyboard shortcut (called from handleKeyDown or externally)
   */
  processKeyboardShortcut(e: KeyboardEvent): boolean {
    if (!this.keyboardEnabled) return false;

    // Don't handle if focus is in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return false;
    }

    const key = this.getEventShortcutKey(e);
    const shortcut = this.keyboardShortcuts.get(key);

    if (shortcut) {
      e.preventDefault();
      shortcut.action();
      return true;
    }

    return false;
  }

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.meta) parts.push('meta');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  private getEventShortcutKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  /**
   * Nudge selected tasks by days
   */
  private nudgeSelectedTasks(days: number): void {
    const selectedIds = this.getSelectedTaskIds();
    if (selectedIds.length === 0) return;

    selectedIds.forEach(taskId => {
      const task = this.getTask(taskId);
      if (task && !task.locked) {
        const duration = task.endDate.getTime() - task.startDate.getTime();
        task.startDate = new Date(task.startDate.getTime() + days * 24 * 60 * 60 * 1000);
        task.endDate = new Date(task.startDate.getTime() + duration);
      }
    });

    this.markDirty();
  }

  // =========================================================================
  // EXPORT API - Export to PNG/JSON
  // =========================================================================

  /**
   * Export the Gantt chart to PNG
   */
  async exportToPNG(options: ExportPNGOptions = {}): Promise<Blob> {
    const {
      width = this.canvas.width,
      height = this.canvas.height,
      backgroundColor = '#ffffff',
      scale = 1
    } = options;

    // Create export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width * scale;
    exportCanvas.height = height * scale;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create export context');

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Scale for DPI
    ctx.scale(scale, scale);

    // Draw current canvas content
    ctx.drawImage(this.canvas, 0, 0);

    // Convert to blob
    return new Promise((resolve, reject) => {
      exportCanvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/png');
    });
  }

  /**
   * Export full Gantt data to JSON with options
   */
  exportGanttData(options: ExportJSONOptions = {}): ExportedGanttData {
    const {
      includeDependencies = true,
      includeProgress = true
    } = options;

    return {
      exportedAt: new Date().toISOString(),
      tasks: this.state.tasks.map(task => ({
        id: task.id,
        name: task.name,
        startDate: task.startDate.toISOString(),
        endDate: task.endDate.toISOString(),
        progress: includeProgress ? task.progress : undefined,
        locked: task.locked,
        supplierId: task.supplierId,
        supplierName: task.supplierName
      })),
      dependencies: includeDependencies ? this.state.dependencies.map(dep => ({
        id: dep.id,
        fromId: dep.fromId,
        toId: dep.toId,
        type: dep.type,
        lag: dep.lag
      })) : undefined,
      projectStart: this.state.tasks.length > 0
        ? new Date(Math.min(...this.state.tasks.map(t => t.startDate.getTime()))).toISOString()
        : new Date().toISOString(),
      projectEnd: this.state.tasks.length > 0
        ? new Date(Math.max(...this.state.tasks.map(t => t.endDate.getTime()))).toISOString()
        : new Date().toISOString()
    };
  }

  /**
   * Download exported PNG
   */
  async downloadPNG(filename: string = 'gantt-chart.png', options?: ExportPNGOptions): Promise<void> {
    const blob = await this.exportToPNG(options);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Download exported JSON
   */
  downloadGanttJSON(filename: string = 'gantt-data.json', options?: ExportJSONOptions): void {
    const data = this.exportGanttData(options);
    const pretty = options?.pretty !== false;
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // TIMELINE MARKERS - Milestones, Deadlines, Custom Markers
  // =========================================================================

  private timelineMarkers: TimelineMarker[] = [];

  /**
   * Add a timeline marker
   */
  addTimelineMarker(marker: Omit<TimelineMarker, 'id'>): string {
    const id = `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timelineMarkers.push({ ...marker, id });
    this.markDirty();
    return id;
  }

  /**
   * Remove a timeline marker
   */
  removeTimelineMarker(markerId: string): boolean {
    const index = this.timelineMarkers.findIndex(m => m.id === markerId);
    if (index !== -1) {
      this.timelineMarkers.splice(index, 1);
      this.markDirty();
      return true;
    }
    return false;
  }

  /**
   * Update a timeline marker
   */
  updateTimelineMarker(markerId: string, updates: Partial<TimelineMarker>): boolean {
    const marker = this.timelineMarkers.find(m => m.id === markerId);
    if (marker) {
      Object.assign(marker, updates);
      this.markDirty();
      return true;
    }
    return false;
  }

  /**
   * Get all timeline markers
   */
  getTimelineMarkers(): TimelineMarker[] {
    return [...this.timelineMarkers];
  }

  /**
   * Get markers in date range
   */
  getMarkersInRange(startDate: Date, endDate: Date): TimelineMarker[] {
    return this.timelineMarkers.filter(m =>
      m.date >= startDate && m.date <= endDate
    );
  }

  /**
   * Clear all timeline markers
   */
  clearTimelineMarkers(): void {
    this.timelineMarkers = [];
    this.markDirty();
  }

  /**
   * Add milestone marker (convenience method)
   */
  addMilestone(name: string, date: Date, color?: string): string {
    return this.addTimelineMarker({
      type: 'milestone',
      name,
      date,
      color: color || '#4F46E5',
      showLabel: true
    });
  }

  /**
   * Add deadline marker (convenience method)
   */
  addDeadline(name: string, date: Date, color?: string): string {
    return this.addTimelineMarker({
      type: 'deadline',
      name,
      date,
      color: color || '#EF4444',
      showLabel: true
    });
  }

  /**
   * Add event marker (convenience method)
   */
  addEvent(name: string, date: Date, color?: string): string {
    return this.addTimelineMarker({
      type: 'event',
      name,
      date,
      color: color || '#10B981',
      showLabel: true
    });
  }

  // =========================================================================
  // EVENT CALLBACKS
  // =========================================================================

  private onTasksDelete?: (taskIds: string[]) => void;

  /**
   * Set callback for task deletion
   */
  setOnTasksDelete(callback: (taskIds: string[]) => void): void {
    this.onTasksDelete = callback;
  }

  // =========================================================================
  // FEATURE 1: COMPREHENSIVE TASK FILTERING API
  // =========================================================================

  private activeFilter: TaskFilterConfig | null = null;
  private filteredTaskIds: Set<string> = new Set();
  private isFilterActive: boolean = false;

  /**
   * Apply a comprehensive filter to the Gantt chart
   * Only matching tasks will be visible
   */
  applyFilter(filter: TaskFilterConfig): void {
    this.activeFilter = filter;
    this.isFilterActive = true;
    this.recalculateFilteredTasks();
    this.markDirty();
  }

  /**
   * Clear all filters and show all tasks
   */
  clearFilter(): void {
    this.activeFilter = null;
    this.isFilterActive = false;
    this.filteredTaskIds.clear();
    this.markDirty();
  }

  /**
   * Check if a filter is currently active
   */
  hasActiveFilter(): boolean {
    return this.isFilterActive;
  }

  /**
   * Get the current active filter
   */
  getActiveFilter(): TaskFilterConfig | null {
    return this.activeFilter;
  }

  /**
   * Recalculate which tasks match the filter
   */
  private recalculateFilteredTasks(): void {
    this.filteredTaskIds.clear();

    if (!this.activeFilter) {
      return;
    }

    const filter = this.activeFilter;

    this.state.tasks.forEach(task => {
      let matches = true;

      // Filter by status
      if (filter.status && filter.status.length > 0) {
        const taskStatus = task.status || 'not-started';
        if (!filter.status.includes(taskStatus)) {
          matches = false;
        }
      }

      // Filter by supplier IDs
      if (matches && filter.supplierIds && filter.supplierIds.length > 0) {
        if (!task.supplierId || !filter.supplierIds.includes(task.supplierId)) {
          matches = false;
        }
      }

      // Filter by date range (task must overlap with filter range)
      if (matches && filter.dateRange) {
        const filterStart = filter.dateRange.start;
        const filterEnd = filter.dateRange.end;
        const overlaps = task.startDate <= filterEnd && task.endDate >= filterStart;
        if (!overlaps) {
          matches = false;
        }
      }

      // Filter by locked state
      if (matches && filter.locked !== undefined) {
        const isLocked = !!task.locked;
        if (filter.locked !== isLocked) {
          matches = false;
        }
      }

      // Filter by progress range
      if (matches && filter.progressRange) {
        const progress = task.progress || 0;
        if (progress < filter.progressRange.min || progress > filter.progressRange.max) {
          matches = false;
        }
      }

      // Filter by search text (name match)
      if (matches && filter.searchText && filter.searchText.trim() !== '') {
        const searchLower = filter.searchText.toLowerCase();
        const nameMatches = task.name.toLowerCase().includes(searchLower);
        const supplierMatches = task.supplierName?.toLowerCase().includes(searchLower) || false;
        if (!nameMatches && !supplierMatches) {
          matches = false;
        }
      }

      // Filter by custom predicate
      if (matches && filter.customPredicate) {
        if (!filter.customPredicate(task)) {
          matches = false;
        }
      }

      // Filter by critical path
      if (matches && filter.criticalPathOnly) {
        if (!this.criticalPathResult?.criticalTasks.has(task.id)) {
          matches = false;
        }
      }

      // Filter by hold state
      if (matches && filter.onHoldOnly) {
        if (task.status !== 'on-hold') {
          matches = false;
        }
      }

      // Filter by broken dependencies
      if (matches && filter.brokenDependenciesOnly) {
        if (!task.brokenPredecessorIds || task.brokenPredecessorIds.length === 0) {
          matches = false;
        }
      }

      if (matches) {
        this.filteredTaskIds.add(task.id);
      }
    });
  }

  /**
   * Get tasks that pass the current filter
   */
  getFilteredTasks(): GanttTask[] {
    if (!this.isFilterActive) {
      return [...this.state.tasks];
    }
    return this.state.tasks.filter(t => this.filteredTaskIds.has(t.id));
  }

  /**
   * Check if a specific task passes the current filter
   */
  taskPassesFilter(taskId: string): boolean {
    if (!this.isFilterActive) {
      return true;
    }
    return this.filteredTaskIds.has(taskId);
  }

  /**
   * Get filter statistics
   */
  getFilterStats(): FilterStats {
    const total = this.state.tasks.length;
    const visible = this.isFilterActive ? this.filteredTaskIds.size : total;
    const hidden = total - visible;
    return {
      total,
      visible,
      hidden,
      percentage: total > 0 ? Math.round((visible / total) * 100) : 100
    };
  }

  // =========================================================================
  // FEATURE 2: MARQUEE/LASSO MULTI-TASK SELECTION
  // =========================================================================

  /**
   * Start marquee selection
   * Called internally by mouse handlers when dragging on empty space
   */
  startMarqueeSelection(x: number, y: number): void {
    this.isMarqueeSelecting = true;
    this.marqueeStartX = x;
    this.marqueeStartY = y;
    this.marqueeEndX = x;
    this.marqueeEndY = y;
    this.marqueeSelectedIds.clear();
    this.canvas.style.cursor = 'crosshair';
    this.markDirty();
  }

  /**
   * Update marquee selection during drag
   */
  updateMarqueeSelection(x: number, y: number, additive: boolean = false): void {
    if (!this.isMarqueeSelecting) return;

    this.marqueeEndX = x;
    this.marqueeEndY = y;

    // Find tasks within the marquee
    const tasksInMarquee = this.getTasksInMarquee(
      this.marqueeStartX,
      this.marqueeStartY,
      this.marqueeEndX,
      this.marqueeEndY
    );

    // Update selection
    if (additive) {
      // Additive mode: add marquee tasks to existing selection
      tasksInMarquee.forEach(t => {
        this.marqueeSelectedIds.add(t.id);
      });
    } else {
      // Replace mode: only select marquee tasks
      this.marqueeSelectedIds.clear();
      tasksInMarquee.forEach(t => {
        this.marqueeSelectedIds.add(t.id);
      });
    }

    this.markDirty();
  }

  /**
   * Complete marquee selection
   */
  completeMarqueeSelection(additive: boolean = false): void {
    if (!this.isMarqueeSelecting) return;

    // Apply marquee selection to actual selection
    if (additive) {
      // Add marquee selection to existing
      this.marqueeSelectedIds.forEach(id => {
        this.state.selectedTaskIds.add(id);
      });
    } else {
      // Replace selection with marquee selection
      this.state.selectedTaskIds = new Set(this.marqueeSelectedIds);
    }

    // Update last selected task
    if (this.marqueeSelectedIds.size > 0) {
      this.state.lastSelectedTaskId = Array.from(this.marqueeSelectedIds)[0];
    }

    // Notify selection change
    this.onSelectionChange?.(this.getSelectedTaskIds());

    // Reset marquee state
    this.isMarqueeSelecting = false;
    this.marqueeSelectedIds.clear();
    this.canvas.style.cursor = 'default';
    this.markDirty();
  }

  /**
   * Cancel marquee selection
   */
  cancelMarqueeSelection(): void {
    this.isMarqueeSelecting = false;
    this.marqueeSelectedIds.clear();
    this.canvas.style.cursor = 'default';
    this.markDirty();
  }

  /**
   * Check if marquee selection is in progress
   */
  isMarqueeActive(): boolean {
    return this.isMarqueeSelecting;
  }

  /**
   * Get current marquee bounds for rendering
   */
  getMarqueeBounds(): MarqueeBounds | null {
    if (!this.isMarqueeSelecting) return null;
    return {
      x1: this.marqueeStartX,
      y1: this.marqueeStartY,
      x2: this.marqueeEndX,
      y2: this.marqueeEndY,
      selectedCount: this.marqueeSelectedIds.size
    };
  }

  // =========================================================================
  // FEATURE 3: ENHANCED CONTEXT MENU SYSTEM
  // =========================================================================

  private customContextMenuBuilder?: (task: GanttTask | null) => ContextMenuItem[];
  private contextMenuTheme: ContextMenuTheme = {
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    hoverBackgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    dividerColor: '#e5e7eb',
    dangerColor: '#ef4444',
    disabledColor: '#9ca3af',
    shortcutColor: '#6b7280',
    borderRadius: 8,
    itemPadding: 8,
    minWidth: 180,
    maxWidth: 280,
    shadowBlur: 16,
    shadowColor: 'rgba(0, 0, 0, 0.15)'
  };

  /**
   * Set a custom context menu builder function
   * This allows complete control over menu items based on task and state
   */
  setContextMenuBuilder(builder: (task: GanttTask | null) => ContextMenuItem[]): void {
    this.customContextMenuBuilder = builder;
  }

  /**
   * Clear custom context menu builder (use default menu)
   */
  clearContextMenuBuilder(): void {
    this.customContextMenuBuilder = undefined;
  }

  /**
   * Update context menu theme
   */
  setContextMenuTheme(theme: Partial<ContextMenuTheme>): void {
    this.contextMenuTheme = { ...this.contextMenuTheme, ...theme };
  }

  /**
   * Get default context menu items for a task
   */
  getDefaultContextMenuItems(task: GanttTask | null): ContextMenuItem[] {
    if (!task) {
      // Background context menu (no task selected)
      return [
        {
          id: 'add-task',
          label: 'Add Task',
          icon: 'plus',
          shortcut: 'Ctrl+N',
          action: () => this.onContextMenuAction?.('add-task', null)
        },
        { id: 'divider-1', type: 'divider' },
        {
          id: 'zoom-fit',
          label: 'Zoom to Fit',
          icon: 'maximize',
          action: () => this.zoomToFit()
        },
        {
          id: 'scroll-today',
          label: 'Go to Today',
          icon: 'calendar',
          shortcut: 'T',
          action: () => this.scrollToToday()
        },
        { id: 'divider-2', type: 'divider' },
        {
          id: 'select-all',
          label: 'Select All',
          shortcut: 'Ctrl+A',
          action: () => this.selectAllTasks()
        },
        {
          id: 'clear-selection',
          label: 'Clear Selection',
          shortcut: 'Esc',
          action: () => this.clearSelection()
        }
      ];
    }

    // Task context menu
    const items: ContextMenuItem[] = [
      {
        id: 'edit-task',
        label: 'Edit Task',
        icon: 'edit',
        shortcut: 'Enter',
        action: () => this.onTaskDoubleClick?.(task)
      },
      {
        id: 'scroll-to-task',
        label: 'Scroll to Task',
        icon: 'target',
        action: () => this.scrollToTask(task.id, false)
      },
      { id: 'divider-1', type: 'divider' }
    ];

    // Progress submenu
    items.push({
      id: 'set-progress-0',
      label: 'Set Progress: 0%',
      action: () => this.setProgress(task.id, 0)
    });
    items.push({
      id: 'set-progress-50',
      label: 'Set Progress: 50%',
      action: () => this.setProgress(task.id, 50)
    });
    items.push({
      id: 'set-progress-100',
      label: 'Set Progress: 100%',
      action: () => this.setProgress(task.id, 100)
    });

    items.push({ id: 'divider-2', type: 'divider' });

    // Lock/unlock
    if (task.locked) {
      items.push({
        id: 'unlock-task',
        label: 'Unlock Task',
        icon: 'unlock',
        action: () => this.unlockTask(task.id)
      });
    } else {
      items.push({
        id: 'lock-task',
        label: 'Lock Task',
        icon: 'lock',
        action: () => this.lockTask(task.id, 'manuallyPositioned')
      });
    }

    // Copy/Cut/Duplicate
    items.push({ id: 'divider-3', type: 'divider' });
    items.push({
      id: 'copy-task',
      label: 'Copy',
      icon: 'copy',
      shortcut: 'Ctrl+C',
      action: () => {
        this.clipboardTask = task;
        this.clipboardIsCut = false;
      }
    });
    items.push({
      id: 'cut-task',
      label: 'Cut',
      icon: 'scissors',
      shortcut: 'Ctrl+X',
      action: () => {
        this.clipboardTask = task;
        this.clipboardIsCut = true;
      }
    });
    items.push({
      id: 'duplicate-task',
      label: 'Duplicate',
      icon: 'copy-plus',
      shortcut: 'Ctrl+D',
      action: () => this.duplicateTask(task.id)
    });

    // Delete
    items.push({ id: 'divider-4', type: 'divider' });
    items.push({
      id: 'delete-task',
      label: 'Delete',
      icon: 'trash',
      shortcut: 'Delete',
      danger: true,
      action: () => this.deleteSelectedTasks()
    });

    return items;
  }

  /**
   * Show context menu at position
   */
  showContextMenuAt(x: number, y: number, task: GanttTask | null): void {
    // Build menu items
    const items = this.customContextMenuBuilder
      ? this.customContextMenuBuilder(task)
      : this.getDefaultContextMenuItems(task);

    this.contextMenuX = x;
    this.contextMenuY = y;
    this.contextMenuTask = task;
    this.contextMenuItems = items;
    this.contextMenuVisible = true;
    this.contextMenuHoveredItem = null;
    this.markDirty();
  }

  /**
   * Get context menu theme (for custom rendering)
   */
  getContextMenuTheme(): ContextMenuTheme {
    return { ...this.contextMenuTheme };
  }

  /**
   * Add a custom action to the context menu
   */
  addContextMenuAction(item: ContextMenuItem, position: 'start' | 'end' | number = 'end'): void {
    if (position === 'start') {
      this.contextMenuItems.unshift(item);
    } else if (position === 'end') {
      this.contextMenuItems.push(item);
    } else {
      this.contextMenuItems.splice(position, 0, item);
    }
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 4: BASELINE COMPARISON ENHANCEMENTS
  // =========================================================================

  /**
   * Add or update a single baseline entry
   */
  setTaskBaseline(taskId: string, startDate: Date, endDate: Date, name?: string): void {
    this.baselineData.set(taskId, {
      taskId,
      startDate,
      endDate,
      name,
      capturedAt: new Date()
    });
    this.markDirty();
  }

  /**
   * Remove baseline for a task
   */
  removeTaskBaseline(taskId: string): boolean {
    const had = this.baselineData.has(taskId);
    this.baselineData.delete(taskId);
    this.markDirty();
    return had;
  }

  /**
   * Get variance between current schedule and baseline (enhanced)
   */
  getScheduleVariance(taskId: string): ScheduleVariance | null {
    const task = this.state.tasks.find(t => t.id === taskId);
    const baseline = this.baselineData.get(taskId);

    if (!task || !baseline) return null;

    const msPerDay = 24 * 60 * 60 * 1000;
    const startVarianceDays = Math.round(
      (task.startDate.getTime() - baseline.startDate.getTime()) / msPerDay
    );
    const endVarianceDays = Math.round(
      (task.endDate.getTime() - baseline.endDate.getTime()) / msPerDay
    );

    const plannedDuration = Math.round(
      (baseline.endDate.getTime() - baseline.startDate.getTime()) / msPerDay
    );
    const currentDuration = Math.round(
      (task.endDate.getTime() - task.startDate.getTime()) / msPerDay
    );
    const durationVariance = currentDuration - plannedDuration;

    return {
      taskId,
      startVarianceDays,
      endVarianceDays,
      durationVariance,
      isDelayed: endVarianceDays > 0,
      isAhead: endVarianceDays < 0,
      hasSlipped: startVarianceDays > 0 || endVarianceDays > 0
    };
  }

  /**
   * Get variance for all tasks
   */
  getAllVariances(): ScheduleVariance[] {
    return this.state.tasks
      .map(t => this.getScheduleVariance(t.id))
      .filter((v): v is ScheduleVariance => v !== null);
  }

  /**
   * Get tasks that have slipped from baseline
   */
  getSlippedTasks(): GanttTask[] {
    return this.state.tasks.filter(task => {
      const variance = this.getScheduleVariance(task.id);
      return variance?.hasSlipped;
    });
  }

  /**
   * Get tasks that are ahead of baseline
   */
  getAheadTasks(): GanttTask[] {
    return this.state.tasks.filter(task => {
      const variance = this.getScheduleVariance(task.id);
      return variance?.isAhead;
    });
  }

  // =========================================================================
  // FEATURE 5: AUTO-FIT ZOOM ENHANCEMENTS
  // =========================================================================

  /**
   * Zoom to fit only selected tasks
   */
  zoomToSelection(padding: number = 3): void {
    const selectedTasks = this.getSelectedTasks();
    if (selectedTasks.length === 0) return;

    // Find the date range of selected tasks
    let minDate = new Date(Math.min(...selectedTasks.map(t => t.startDate.getTime())));
    let maxDate = new Date(Math.max(...selectedTasks.map(t => t.endDate.getTime())));

    // Add padding
    minDate.setDate(minDate.getDate() - padding);
    maxDate.setDate(maxDate.getDate() + padding);

    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / msPerDay);

    // Calculate required zoom level
    const availableWidth = this.containerWidth - 150;
    const requiredDayWidth = availableWidth / totalDays;

    // Clamp zoom but allow wider zoom for small selections
    const zoom = Math.max(
      this.config.minDayWidth / this.config.dayWidth,
      Math.min(2, requiredDayWidth / this.config.dayWidth) // Allow up to 2x for small selections
    );

    // Update viewport
    this.viewport.setZoom(zoom);
    this.state.viewportState.startDate = minDate;
    this.viewport.setStartDate(minDate);

    // Calculate vertical scroll to center selected tasks
    const selectedIndices = selectedTasks.map(t => this.state.tasks.findIndex(st => st.id === t.id));
    const minIndex = Math.min(...selectedIndices);
    const maxIndex = Math.max(...selectedIndices);
    const centerIndex = (minIndex + maxIndex) / 2;
    const centerY = centerIndex * this.config.rowHeight;
    const scrollY = Math.max(0, centerY - this.containerHeight / 2 + this.config.headerHeight);

    this.viewport.scrollTo(0, scrollY);
    this.markDirty();
  }

  /**
   * Zoom to fit a specific date range
   */
  zoomToDateRange(startDate: Date, endDate: Date, padding: number = 3): void {
    // Add padding
    const adjustedStart = new Date(startDate);
    adjustedStart.setDate(adjustedStart.getDate() - padding);
    const adjustedEnd = new Date(endDate);
    adjustedEnd.setDate(adjustedEnd.getDate() + padding);

    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((adjustedEnd.getTime() - adjustedStart.getTime()) / msPerDay);

    // Calculate required zoom level
    const availableWidth = this.containerWidth - 150;
    const requiredDayWidth = availableWidth / totalDays;

    // Clamp zoom
    const zoom = Math.max(
      this.config.minDayWidth / this.config.dayWidth,
      Math.min(this.config.maxDayWidth / this.config.dayWidth, requiredDayWidth / this.config.dayWidth)
    );

    // Update viewport
    this.viewport.setZoom(zoom);
    this.state.viewportState.startDate = adjustedStart;
    this.viewport.setStartDate(adjustedStart);

    // Scroll to start
    this.viewport.scrollTo(0, this.state.viewportState.scrollY);
    this.markDirty();
  }

  /**
   * Get tasks visible in the current viewport
   */
  getVisibleTasksInViewport(): GanttTask[] {
    const { start, end } = this.getVisibleDateRange();
    const viewportState = this.viewport.getState();

    // Calculate visible row range
    const firstVisibleRow = Math.floor(viewportState.scrollY / this.config.rowHeight);
    const visibleRowCount = Math.ceil(this.containerHeight / this.config.rowHeight);
    const lastVisibleRow = firstVisibleRow + visibleRowCount;

    return this.state.tasks.filter((task, index) => {
      // Check if row is visible
      if (index < firstVisibleRow || index > lastVisibleRow) {
        return false;
      }
      // Check if task date range overlaps with visible range
      return task.startDate <= end && task.endDate >= start;
    });
  }

  /**
   * Pan viewport to center on a specific date
   */
  centerOnDate(date: Date): void {
    const x = this.viewport.dateToX(date);
    const scrollX = x - this.containerWidth / 2;
    this.viewport.scrollTo(scrollX, this.state.viewportState.scrollY);
    this.markDirty();
  }

  /**
   * Pan viewport to center on a specific task
   */
  centerOnTask(taskId: string): void {
    const taskIndex = this.state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.state.tasks[taskIndex];

    // Center horizontally on task midpoint
    const taskMidDate = new Date(
      (task.startDate.getTime() + task.endDate.getTime()) / 2
    );
    const x = this.viewport.dateToX(taskMidDate);
    const scrollX = x - this.containerWidth / 2;

    // Center vertically on task row
    const y = taskIndex * this.config.rowHeight + this.config.headerHeight;
    const scrollY = y - this.containerHeight / 2;

    this.viewport.scrollTo(scrollX, Math.max(0, scrollY));
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 6: TASK TOOLTIP CUSTOMIZATION API
  // =========================================================================

  private tooltipConfig: TooltipConfig = {
    enabled: true,
    delay: 500,
    maxWidth: 300,
    showProgress: true,
    showDates: true,
    showDuration: true,
    showDependencies: true,
    showSupplier: true,
    showStatus: true,
    position: 'auto'
  };

  private customTooltipBuilder?: (task: GanttTask) => TooltipContent;
  private tooltipVisible: boolean = false;
  private tooltipTask: GanttTask | null = null;
  private tooltipX: number = 0;
  private tooltipY: number = 0;
  private tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Configure tooltip behavior
   */
  setTooltipConfig(config: Partial<TooltipConfig>): void {
    this.tooltipConfig = { ...this.tooltipConfig, ...config };
  }

  /**
   * Get current tooltip configuration
   */
  getTooltipConfig(): TooltipConfig {
    return { ...this.tooltipConfig };
  }

  /**
   * Set a custom tooltip content builder
   */
  setTooltipBuilder(builder: (task: GanttTask) => TooltipContent): void {
    this.customTooltipBuilder = builder;
  }

  /**
   * Clear custom tooltip builder (use default)
   */
  clearTooltipBuilder(): void {
    this.customTooltipBuilder = undefined;
  }

  /**
   * Get tooltip content for a task
   */
  getTooltipContent(task: GanttTask): TooltipContent {
    if (this.customTooltipBuilder) {
      return this.customTooltipBuilder(task);
    }

    const config = this.tooltipConfig;
    const lines: TooltipLine[] = [];

    // Title line
    lines.push({
      type: 'title',
      label: task.name,
      bold: true
    });

    // Status
    if (config.showStatus && task.status) {
      lines.push({
        type: 'status',
        label: 'Status',
        value: this.formatStatus(task.status),
        color: this.getStatusColor(task.status)
      });
    }

    // Progress
    if (config.showProgress) {
      lines.push({
        type: 'progress',
        label: 'Progress',
        value: `${task.progress || 0}%`,
        progress: task.progress || 0
      });
    }

    // Dates
    if (config.showDates) {
      lines.push({
        type: 'date',
        label: 'Start',
        value: this.formatDate(task.startDate)
      });
      lines.push({
        type: 'date',
        label: 'End',
        value: this.formatDate(task.endDate)
      });
    }

    // Duration
    if (config.showDuration) {
      const duration = this.getTaskDurationDays(task);
      lines.push({
        type: 'duration',
        label: 'Duration',
        value: `${duration} day${duration !== 1 ? 's' : ''}`
      });
    }

    // Supplier
    if (config.showSupplier && task.supplierName) {
      lines.push({
        type: 'supplier',
        label: 'Supplier',
        value: task.supplierName
      });
    }

    // Dependencies
    if (config.showDependencies) {
      const predecessors = this.getPredecessors(task.id);
      const successors = this.getSuccessors(task.id);
      if (predecessors.length > 0 || successors.length > 0) {
        lines.push({
          type: 'dependencies',
          label: 'Dependencies',
          value: `${predecessors.length} pred, ${successors.length} succ`
        });
      }
    }

    // Lock state
    if (task.locked) {
      lines.push({
        type: 'lock',
        label: 'Locked',
        value: this.formatLockType(task.locked),
        icon: 'lock'
      });
    }

    // Hold state
    if (task.holdState) {
      lines.push({
        type: 'hold',
        label: 'On Hold',
        value: this.formatHoldReason(task.holdState.reason),
        color: '#f59e0b'
      });
    }

    return {
      lines,
      maxWidth: config.maxWidth
    };
  }

  /**
   * Show tooltip for a task
   */
  showTooltip(task: GanttTask, x: number, y: number): void {
    if (!this.tooltipConfig.enabled) return;

    // Clear any pending tooltip
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    // Delay showing tooltip
    this.tooltipTimeout = setTimeout(() => {
      this.tooltipVisible = true;
      this.tooltipTask = task;
      this.tooltipX = x;
      this.tooltipY = y;
      this.markDirty();
    }, this.tooltipConfig.delay);
  }

  /**
   * Hide tooltip
   */
  hideTooltip(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    if (this.tooltipVisible) {
      this.tooltipVisible = false;
      this.tooltipTask = null;
      this.markDirty();
    }
  }

  /**
   * Get current tooltip state
   */
  getTooltipState(): { visible: boolean; task: GanttTask | null; x: number; y: number } {
    return {
      visible: this.tooltipVisible,
      task: this.tooltipTask,
      x: this.tooltipX,
      y: this.tooltipY
    };
  }

  // Helper formatters for tooltip
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'not-started': 'Not Started',
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'on-hold': 'On Hold',
      'at-risk': 'At Risk'
    };
    return statusMap[status] || status;
  }

  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'not-started': '#9ca3af',
      'in-progress': '#3b82f6',
      'completed': '#22c55e',
      'on-hold': '#f59e0b',
      'at-risk': '#ef4444'
    };
    return colorMap[status] || '#6b7280';
  }

  // NOTE: formatDate is already defined above in the Print Styles section

  private getTaskDurationDays(task: GanttTask): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / msPerDay) + 1;
  }

  private formatLockType(lockType: string): string {
    const lockMap: Record<string, string> = {
      'supplierConfirmed': 'Supplier Confirmed',
      'started': 'Started',
      'manuallyPositioned': 'Manually Positioned'
    };
    return lockMap[lockType] || lockType;
  }

  private formatHoldReason(reason: string): string {
    const reasonMap: Record<string, string> = {
      'whs_incident': 'WHS Incident',
      'weather_delay': 'Weather Delay',
      'permit_delay': 'Permit Delay',
      'client_request': 'Client Request',
      'material_delay': 'Material Delay',
      'subcontractor_issue': 'Subcontractor Issue',
      'other': 'Other'
    };
    return reasonMap[reason] || reason;
  }

  // =========================================================================
  // FEATURE 7: ANIMATION/TRANSITION SYSTEM
  // =========================================================================

  private animations: Map<string, Animation> = new Map();
  private animationEnabled: boolean = true;
  private animationDuration: number = 300; // Default 300ms

  /**
   * Enable or disable animations
   */
  setAnimationEnabled(enabled: boolean): void {
    this.animationEnabled = enabled;
    if (!enabled) {
      // Cancel all running animations
      this.animations.clear();
    }
  }

  /**
   * Set default animation duration
   */
  setAnimationDuration(duration: number): void {
    this.animationDuration = Math.max(0, Math.min(2000, duration));
  }

  /**
   * Animate a task move
   */
  animateTaskMove(taskId: string, toStartDate: Date, onComplete?: () => void): void {
    if (!this.animationEnabled) {
      // Instant move
      this.moveTask(taskId, toStartDate);
      onComplete?.();
      return;
    }

    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const fromX = this.viewport.dateToX(task.startDate);
    const toX = this.viewport.dateToX(toStartDate);
    const duration = task.endDate.getTime() - task.startDate.getTime();

    this.startAnimation({
      id: `move-${taskId}`,
      type: 'move',
      targetId: taskId,
      startTime: performance.now(),
      duration: this.animationDuration,
      easing: 'easeOutCubic',
      from: { x: fromX },
      to: { x: toX },
      onUpdate: (progress, values) => {
        const currentX = values.x;
        const currentDate = this.viewport.xToDate(currentX);
        task.startDate = currentDate;
        task.endDate = new Date(currentDate.getTime() + duration);
        this.markDirty();
      },
      onComplete: () => {
        task.startDate = toStartDate;
        task.endDate = new Date(toStartDate.getTime() + duration);
        this.markDirty();
        onComplete?.();
      }
    });
  }

  /**
   * Animate zoom level change
   */
  animateZoom(toZoom: number, centerX?: number, onComplete?: () => void): void {
    if (!this.animationEnabled) {
      this.viewport.setZoom(toZoom);
      this.markDirty();
      onComplete?.();
      return;
    }

    const fromZoom = this.viewport.getState().zoom;

    this.startAnimation({
      id: 'zoom',
      type: 'zoom',
      startTime: performance.now(),
      duration: this.animationDuration,
      easing: 'easeOutCubic',
      from: { zoom: fromZoom },
      to: { zoom: toZoom },
      onUpdate: (progress, values) => {
        this.viewport.setZoom(values.zoom);
        this.markDirty();
      },
      onComplete: () => {
        this.viewport.setZoom(toZoom);
        this.markDirty();
        onComplete?.();
      }
    });
  }

  /**
   * Animate scroll to position
   */
  animateScrollTo(scrollX: number, scrollY: number, onComplete?: () => void): void {
    if (!this.animationEnabled) {
      this.viewport.scrollTo(scrollX, scrollY);
      this.markDirty();
      onComplete?.();
      return;
    }

    const state = this.viewport.getState();
    const fromScrollX = state.scrollX;
    const fromScrollY = state.scrollY;

    this.startAnimation({
      id: 'scroll',
      type: 'scroll',
      startTime: performance.now(),
      duration: this.animationDuration,
      easing: 'easeOutCubic',
      from: { scrollX: fromScrollX, scrollY: fromScrollY },
      to: { scrollX, scrollY },
      onUpdate: (progress, values) => {
        this.viewport.scrollTo(values.scrollX, values.scrollY);
        this.markDirty();
      },
      onComplete: () => {
        this.viewport.scrollTo(scrollX, scrollY);
        this.markDirty();
        onComplete?.();
      }
    });
  }

  /**
   * Animate task highlight (pulse effect)
   */
  animateHighlight(taskId: string, color?: string): void {
    if (!this.animationEnabled) return;

    this.startAnimation({
      id: `highlight-${taskId}`,
      type: 'highlight',
      targetId: taskId,
      startTime: performance.now(),
      duration: 600,
      easing: 'easeInOutSine',
      from: { opacity: 0 },
      to: { opacity: 1 },
      repeat: 2,
      yoyo: true,
      data: { color: color || '#3b82f6' },
      onUpdate: (progress, values) => {
        this.markDirty();
      }
    });
  }

  /**
   * Start an animation
   */
  private startAnimation(animation: Animation): void {
    // Cancel any existing animation with same ID
    this.animations.delete(animation.id);
    this.animations.set(animation.id, animation);
    this.runAnimationFrame();
  }

  /**
   * Cancel an animation
   */
  cancelAnimation(animationId: string): void {
    this.animations.delete(animationId);
  }

  /**
   * Run animation frame
   */
  private runAnimationFrame(): void {
    if (this.animations.size === 0) return;

    const now = performance.now();
    const completed: string[] = [];

    this.animations.forEach((anim, id) => {
      const elapsed = now - anim.startTime;
      let progress = Math.min(1, elapsed / anim.duration);

      // Apply easing
      progress = this.applyEasing(progress, anim.easing);

      // Calculate current values
      const values: Record<string, number> = {};
      for (const key of Object.keys(anim.from)) {
        const from = anim.from[key];
        const to = anim.to[key];
        values[key] = from + (to - from) * progress;
      }

      // Call update
      anim.onUpdate?.(progress, values);

      // Check if complete
      if (elapsed >= anim.duration) {
        if (anim.repeat && anim.repeat > 1) {
          anim.repeat--;
          anim.startTime = now;
          if (anim.yoyo) {
            // Swap from and to
            const temp = anim.from;
            anim.from = anim.to;
            anim.to = temp;
          }
        } else {
          anim.onComplete?.();
          completed.push(id);
        }
      }
    });

    // Remove completed animations
    completed.forEach(id => this.animations.delete(id));

    // Continue animation loop if there are still animations
    if (this.animations.size > 0) {
      requestAnimationFrame(() => this.runAnimationFrame());
    }
  }

  /**
   * Apply easing function
   */
  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'easeInQuad':
        return t * t;
      case 'easeOutQuad':
        return t * (2 - t);
      case 'easeInOutQuad':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'easeInCubic':
        return t * t * t;
      case 'easeOutCubic':
        return (--t) * t * t + 1;
      case 'easeInOutCubic':
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      case 'easeInOutSine':
        return -(Math.cos(Math.PI * t) - 1) / 2;
      case 'easeOutElastic':
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      case 'easeOutBounce':
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
          return n1 * t * t;
        } else if (t < 2 / d1) {
          return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
          return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
          return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
      default:
        return t;
    }
  }

  /**
   * Check if any animations are running
   */
  isAnimating(): boolean {
    return this.animations.size > 0;
  }

  // =========================================================================
  // FEATURE 8: TASK NOTES/COMMENTS SYSTEM
  // =========================================================================

  private taskNotes: Map<string, TaskNote[]> = new Map();
  private noteIdCounter: number = 0;

  /**
   * Add a note to a task
   */
  addTaskNote(taskId: string, content: string, author?: string, type?: 'note' | 'comment' | 'warning' | 'info'): TaskNote {
    const now = new Date();
    const note: TaskNote = {
      id: `note-${++this.noteIdCounter}`,
      taskId,
      content,
      author: author || 'System',
      createdAt: now,
      updatedAt: now,
      type: type || 'note'
    };

    const notes = this.taskNotes.get(taskId) || [];
    notes.push(note);
    this.taskNotes.set(taskId, notes);

    return note;
  }

  /**
   * Update a note
   */
  updateTaskNote(noteId: string, content: string): boolean {
    for (const [taskId, notes] of this.taskNotes) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        note.content = content;
        note.updatedAt = new Date();
        return true;
      }
    }
    return false;
  }

  /**
   * Delete a note
   */
  deleteTaskNote(noteId: string): boolean {
    for (const [taskId, notes] of this.taskNotes) {
      const index = notes.findIndex(n => n.id === noteId);
      if (index !== -1) {
        notes.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Get notes for a task
   */
  getTaskNotes(taskId: string): TaskNote[] {
    return this.taskNotes.get(taskId) || [];
  }

  /**
   * Get all tasks with notes
   */
  getTasksWithNotes(): string[] {
    return Array.from(this.taskNotes.keys()).filter(
      taskId => (this.taskNotes.get(taskId)?.length || 0) > 0
    );
  }

  /**
   * Get note count for a task
   */
  getTaskNoteCount(taskId: string): number {
    return this.taskNotes.get(taskId)?.length || 0;
  }

  /**
   * Check if task has notes
   */
  taskHasNotes(taskId: string): boolean {
    return (this.taskNotes.get(taskId)?.length || 0) > 0;
  }

  /**
   * Clear all notes for a task
   */
  clearTaskNotes(taskId: string): void {
    this.taskNotes.delete(taskId);
  }

  /**
   * Import notes data
   */
  importNotes(notesData: Array<{ taskId: string; notes: TaskNote[] }>): void {
    notesData.forEach(({ taskId, notes }) => {
      this.taskNotes.set(taskId, notes);
    });
  }

  /**
   * Export all notes
   */
  exportNotes(): Array<{ taskId: string; notes: TaskNote[] }> {
    const result: Array<{ taskId: string; notes: TaskNote[] }> = [];
    this.taskNotes.forEach((notes, taskId) => {
      result.push({ taskId, notes });
    });
    return result;
  }

  // =========================================================================
  // FEATURE 9: MILESTONE SPECIAL RENDERING
  // =========================================================================

  private milestones: Set<string> = new Set();
  private milestoneConfig: MilestoneConfig = {
    shape: 'diamond',
    size: 20,
    color: '#6366f1',
    showLabel: true,
    labelPosition: 'right'
  };

  /**
   * Mark a task as a milestone
   */
  setMilestone(taskId: string, isMilestone: boolean = true): void {
    if (isMilestone) {
      this.milestones.add(taskId);
    } else {
      this.milestones.delete(taskId);
    }
    this.markDirty();
  }

  /**
   * Check if a task is a milestone
   */
  isMilestone(taskId: string): boolean {
    return this.milestones.has(taskId);
  }

  /**
   * Get all milestone tasks
   */
  getMilestones(): GanttTask[] {
    return this.state.tasks.filter(t => this.milestones.has(t.id));
  }

  /**
   * Configure milestone rendering
   */
  setMilestoneConfig(config: Partial<MilestoneConfig>): void {
    this.milestoneConfig = { ...this.milestoneConfig, ...config };
    this.markDirty();
  }

  /**
   * Get milestone configuration
   */
  getMilestoneConfig(): MilestoneConfig {
    return { ...this.milestoneConfig };
  }

  /**
   * Auto-detect milestones (zero-duration tasks)
   */
  autoDetectMilestones(): void {
    this.state.tasks.forEach(task => {
      const duration = task.endDate.getTime() - task.startDate.getTime();
      if (duration <= 24 * 60 * 60 * 1000) { // 1 day or less
        this.milestones.add(task.id);
      }
    });
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 10: SUMMARY TASK (GROUP BAR) RENDERING
  // =========================================================================

  private summaryTasks: Set<string> = new Set();
  private summaryConfig: SummaryTaskConfig = {
    barHeight: 8,
    barColor: '#6b7280',
    endCaps: true,
    showProgress: true,
    progressColor: '#3b82f6',
    showDateRange: true,
    autoCalculateDates: true
  };

  /**
   * Mark a task as a summary task (group header)
   */
  setSummaryTask(taskId: string, isSummary: boolean = true): void {
    if (isSummary) {
      this.summaryTasks.add(taskId);
    } else {
      this.summaryTasks.delete(taskId);
    }
    this.markDirty();
  }

  /**
   * Check if a task is a summary task
   */
  isSummaryTask(taskId: string): boolean {
    return this.summaryTasks.has(taskId);
  }

  /**
   * Get all summary tasks
   */
  getSummaryTasks(): GanttTask[] {
    return this.state.tasks.filter(t => this.summaryTasks.has(t.id));
  }

  /**
   * Configure summary task rendering
   */
  setSummaryConfig(config: Partial<SummaryTaskConfig>): void {
    this.summaryConfig = { ...this.summaryConfig, ...config };
    this.markDirty();
  }

  /**
   * Get summary task configuration
   */
  getSummaryConfig(): SummaryTaskConfig {
    return { ...this.summaryConfig };
  }

  /**
   * Update summary task dates based on children
   * Automatically calculates start/end from child tasks
   */
  updateSummaryDates(summaryTaskId: string): void {
    const children = this.getTaskChildren(summaryTaskId);
    if (children.length === 0) return;

    const childTasks = children
      .map(id => this.state.tasks.find(t => t.id === id))
      .filter((t): t is GanttTask => t !== undefined);

    if (childTasks.length === 0) return;

    const minStart = new Date(Math.min(...childTasks.map(t => t.startDate.getTime())));
    const maxEnd = new Date(Math.max(...childTasks.map(t => t.endDate.getTime())));

    const summaryTask = this.state.tasks.find(t => t.id === summaryTaskId);
    if (summaryTask) {
      summaryTask.startDate = minStart;
      summaryTask.endDate = maxEnd;

      // Calculate aggregate progress
      if (childTasks.length > 0) {
        const totalProgress = childTasks.reduce((sum, t) => sum + (t.progress || 0), 0);
        summaryTask.progress = Math.round(totalProgress / childTasks.length);
      }

      this.markDirty();
    }
  }

  /**
   * Update all summary task dates
   */
  updateAllSummaryDates(): void {
    this.summaryTasks.forEach(taskId => {
      this.updateSummaryDates(taskId);
    });
  }

  /**
   * Get summary task info
   */
  getSummaryInfo(taskId: string): SummaryTaskInfo | null {
    if (!this.summaryTasks.has(taskId)) return null;

    const children = this.getTaskChildren(taskId);
    const childTasks = children
      .map(id => this.state.tasks.find(t => t.id === id))
      .filter((t): t is GanttTask => t !== undefined);

    const completedCount = childTasks.filter(t => t.status === 'completed').length;
    const inProgressCount = childTasks.filter(t => t.status === 'in-progress').length;
    const totalProgress = childTasks.reduce((sum, t) => sum + (t.progress || 0), 0);

    return {
      taskId,
      childCount: children.length,
      completedCount,
      inProgressCount,
      notStartedCount: children.length - completedCount - inProgressCount,
      averageProgress: children.length > 0 ? Math.round(totalProgress / children.length) : 0,
      minStart: childTasks.length > 0 ? new Date(Math.min(...childTasks.map(t => t.startDate.getTime()))) : undefined,
      maxEnd: childTasks.length > 0 ? new Date(Math.max(...childTasks.map(t => t.endDate.getTime()))) : undefined
    };
  }

  // =========================================================================
  // FEATURE 11: TASK INDENTATION EXTENSIONS
  // =========================================================================
  // Adds indent/outdent operations for task hierarchy
  // Uses existing: setTaskParent, getTaskParent, getTaskDepth (defined above)

  private indentWidth: number = 20;

  /**
   * Get indent offset for a task based on its depth level
   */
  getTaskIndent(taskId: string): number {
    return this.getTaskDepth(taskId) * this.indentWidth;
  }

  /**
   * Indent a task (make it child of previous sibling)
   */
  indentTask(taskId: string): boolean {
    const taskIndex = this.state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex <= 0) return false;

    const previousTask = this.state.tasks[taskIndex - 1];
    const currentLevel = this.getTaskDepth(taskId);
    const previousLevel = this.getTaskDepth(previousTask.id);

    // Can only indent if previous task is at same level or one level up
    if (previousLevel <= currentLevel) {
      this.setTaskParent(taskId, previousTask.id);
      return true;
    }
    return false;
  }

  /**
   * Outdent a task (move to parent's level)
   */
  outdentTask(taskId: string): boolean {
    const parentId = this.getTaskParent(taskId);
    if (!parentId) return false;

    const grandparentId = this.getTaskParent(parentId);
    this.setTaskParent(taskId, grandparentId);
    return true;
  }

  // =========================================================================
  // FEATURE 13: KEYBOARD NAVIGATION EXTENSIONS
  // =========================================================================
  // Extends the existing keyboard system with task focus and navigation
  // Uses existing: keyboardEnabled, keyboardShortcuts, registerKeyboardShortcut,
  //                setKeyboardEnabled, processKeyboardShortcut (defined above)

  private focusedTaskId: string | null = null;

  /**
   * Enhanced keyboard handler with navigation support
   * Call this in addition to processKeyboardShortcut for navigation
   */
  handleKeyboardNavigation(event: KeyboardEvent): boolean {
    if (!this.keyboardEnabled) return false;

    // First try existing shortcuts
    if (this.processKeyboardShortcut(event)) {
      return true;
    }

    // Built-in navigation
    switch (event.key) {
      case 'ArrowUp':
        this.navigateToTask('up', event.shiftKey);
        event.preventDefault();
        return true;

      case 'ArrowDown':
        this.navigateToTask('down', event.shiftKey);
        event.preventDefault();
        return true;

      case 'ArrowLeft':
        if (event.ctrlKey || event.metaKey) {
          // Outdent
          if (this.focusedTaskId) {
            this.outdentTask(this.focusedTaskId);
          }
        } else {
          // Collapse
          if (this.focusedTaskId && this.hasChildren(this.focusedTaskId)) {
            this.collapseGroup(this.focusedTaskId);
          }
        }
        event.preventDefault();
        return true;

      case 'ArrowRight':
        if (event.ctrlKey || event.metaKey) {
          // Indent
          if (this.focusedTaskId) {
            this.indentTask(this.focusedTaskId);
          }
        } else {
          // Expand
          if (this.focusedTaskId && this.hasChildren(this.focusedTaskId)) {
            this.expandGroup(this.focusedTaskId);
          }
        }
        event.preventDefault();
        return true;

      case 'Enter':
        if (this.focusedTaskId) {
          const task = this.getTask(this.focusedTaskId);
          if (task) this.onTaskDoubleClick?.(task);
        }
        event.preventDefault();
        return true;

      case 'Delete':
      case 'Backspace':
        if (this.focusedTaskId && !event.ctrlKey && !event.metaKey) {
          const task = this.getTask(this.focusedTaskId);
          if (task) this.onTaskDelete?.(task);
        }
        event.preventDefault();
        return true;

      case 'Escape':
        this.clearSelection();
        this.focusedTaskId = null;
        this.markDirty();
        event.preventDefault();
        return true;

      case 'a':
        if (event.ctrlKey || event.metaKey) {
          this.selectAllTasks();
          event.preventDefault();
          return true;
        }
        break;

      case 'Home':
        if (this.state.tasks.length > 0) {
          this.focusTask(this.state.tasks[0].id);
        }
        event.preventDefault();
        return true;

      case 'End':
        if (this.state.tasks.length > 0) {
          this.focusTask(this.state.tasks[this.state.tasks.length - 1].id);
        }
        event.preventDefault();
        return true;

      case ' ':
        if (this.focusedTaskId) {
          // Toggle selection using ctrl+click logic
          this.selectTask(this.focusedTaskId, true, false);
        }
        event.preventDefault();
        return true;
    }

    return false;
  }

  /**
   * Navigate to adjacent task
   */
  private navigateToTask(direction: 'up' | 'down', extendSelection: boolean): void {
    const visibleTasks = this.getVisibleTasks();
    if (visibleTasks.length === 0) return;

    const currentIndex = this.focusedTaskId
      ? visibleTasks.findIndex(t => t.id === this.focusedTaskId)
      : -1;

    let newIndex: number;
    if (direction === 'up') {
      newIndex = currentIndex <= 0 ? visibleTasks.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex >= visibleTasks.length - 1 ? 0 : currentIndex + 1;
    }

    const newTask = visibleTasks[newIndex];
    this.focusTask(newTask.id);

    if (extendSelection) {
      // Shift-select: add to selection
      this.selectTask(newTask.id, false, true);
    } else {
      // Simple select: clear others
      this.selectTask(newTask.id, false, false);
    }
  }

  /**
   * Focus a task (for keyboard navigation)
   */
  focusTask(taskId: string): void {
    this.focusedTaskId = taskId;
    this.scrollToTask(taskId);
    this.markDirty();
  }

  /**
   * Get focused task ID
   */
  getFocusedTaskId(): string | null {
    return this.focusedTaskId;
  }

  /**
   * Register navigation-related shortcuts
   */
  registerNavigationShortcuts(): void {
    this.registerKeyboardShortcut({
      key: 'z',
      ctrl: true,
      action: () => this.undo(),
      description: 'Undo'
    });
    this.registerKeyboardShortcut({
      key: 'y',
      ctrl: true,
      action: () => this.redo(),
      description: 'Redo'
    });
    this.registerKeyboardShortcut({
      key: '+',
      ctrl: true,
      action: () => this.zoomInOneLevel(),
      description: 'Zoom in'
    });
    this.registerKeyboardShortcut({
      key: '-',
      ctrl: true,
      action: () => this.zoomOutOneLevel(),
      description: 'Zoom out'
    });
    this.registerKeyboardShortcut({
      key: '0',
      ctrl: true,
      action: () => this.zoomToFit(),
      description: 'Zoom to fit'
    });
    this.registerKeyboardShortcut({
      key: 't',
      action: () => this.scrollToToday(),
      description: 'Go to today'
    });
  }

  // =========================================================================
  // FEATURE 14: ROW REORDERING (DRAG TO REORDER)
  // =========================================================================
  // Drag tasks to reorder them in the list

  private isReorderDragging: boolean = false;
  private reorderSourceIndex: number = -1;
  private reorderTargetIndex: number = -1;
  private reorderDragY: number = 0;
  private reorderPreviewOffset: number = 0;

  /**
   * Start reorder drag
   */
  startReorderDrag(taskId: string, y: number): void {
    const index = this.state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;

    this.isReorderDragging = true;
    this.reorderSourceIndex = index;
    this.reorderTargetIndex = index;
    this.reorderDragY = y;
    this.reorderPreviewOffset = 0;
    this.markDirty();
  }

  /**
   * Update reorder drag position
   */
  updateReorderDrag(y: number): void {
    if (!this.isReorderDragging) return;

    this.reorderDragY = y;

    // Calculate target index based on Y position
    const rowHeight = this.config.rowHeight;
    const headerHeight = this.config.headerHeight;
    const scrollY = this.viewport.getState().scrollY;

    const relativeY = y - headerHeight + scrollY;
    let targetIndex = Math.floor(relativeY / rowHeight);
    targetIndex = Math.max(0, Math.min(targetIndex, this.state.tasks.length - 1));

    if (targetIndex !== this.reorderTargetIndex) {
      this.reorderTargetIndex = targetIndex;
      this.markDirty();
    }
  }

  /**
   * Complete reorder drag
   */
  completeReorderDrag(): boolean {
    if (!this.isReorderDragging) return false;

    const sourceIndex = this.reorderSourceIndex;
    const targetIndex = this.reorderTargetIndex;

    this.isReorderDragging = false;
    this.reorderSourceIndex = -1;
    this.reorderTargetIndex = -1;

    if (sourceIndex !== targetIndex && sourceIndex !== -1 && targetIndex !== -1) {
      // Move task in array
      const [task] = this.state.tasks.splice(sourceIndex, 1);
      this.state.tasks.splice(targetIndex, 0, task);

      // Emit reorder event
      this.onTaskReorder?.(task.id, sourceIndex, targetIndex);
      this.markDirty();
      return true;
    }

    this.markDirty();
    return false;
  }

  /**
   * Cancel reorder drag
   */
  cancelReorderDrag(): void {
    this.isReorderDragging = false;
    this.reorderSourceIndex = -1;
    this.reorderTargetIndex = -1;
    this.markDirty();
  }

  /**
   * Get reorder state for rendering
   */
  getReorderState(): ReorderState {
    return {
      isDragging: this.isReorderDragging,
      sourceIndex: this.reorderSourceIndex,
      targetIndex: this.reorderTargetIndex,
      dragY: this.reorderDragY
    };
  }

  /**
   * Check if reorder is in progress
   */
  isReordering(): boolean {
    return this.isReorderDragging;
  }

  // Callback for reorder events
  private onTaskReorder?: (taskId: string, fromIndex: number, toIndex: number) => void;

  /**
   * Set reorder callback
   */
  setOnTaskReorder(callback: (taskId: string, fromIndex: number, toIndex: number) => void): void {
    this.onTaskReorder = callback;
  }

  // =========================================================================
  // FEATURE 15: TASK CONSTRAINTS SYSTEM
  // =========================================================================
  // Must-start-on, must-finish-on, start-no-earlier-than, etc.

  private taskConstraints: Map<string, TaskConstraint> = new Map();

  /**
   * Set a constraint on a task
   */
  setTaskConstraint(taskId: string, constraint: TaskConstraint): void {
    this.taskConstraints.set(taskId, constraint);
    this.markDirty();
  }

  /**
   * Remove constraint from a task
   */
  removeTaskConstraint(taskId: string): void {
    this.taskConstraints.delete(taskId);
    this.markDirty();
  }

  /**
   * Get constraint for a task
   */
  getTaskConstraint(taskId: string): TaskConstraint | null {
    return this.taskConstraints.get(taskId) || null;
  }

  /**
   * Check if a proposed date violates the task's constraint
   */
  validateConstraint(taskId: string, proposedStart: Date, proposedEnd: Date): ConstraintViolation | null {
    const constraint = this.taskConstraints.get(taskId);
    if (!constraint) return null;

    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return null;

    switch (constraint.type) {
      case 'must-start-on':
        if (proposedStart.getTime() !== constraint.date.getTime()) {
          return {
            taskId,
            constraintType: constraint.type,
            constraintDate: constraint.date,
            violationType: 'date-mismatch',
            message: `Task must start on ${this.formatConstraintDate(constraint.date)}`
          };
        }
        break;

      case 'must-finish-on':
        if (proposedEnd.getTime() !== constraint.date.getTime()) {
          return {
            taskId,
            constraintType: constraint.type,
            constraintDate: constraint.date,
            violationType: 'date-mismatch',
            message: `Task must finish on ${this.formatConstraintDate(constraint.date)}`
          };
        }
        break;

      case 'start-no-earlier-than':
        if (proposedStart < constraint.date) {
          return {
            taskId,
            constraintType: constraint.type,
            constraintDate: constraint.date,
            violationType: 'too-early',
            message: `Task cannot start before ${this.formatConstraintDate(constraint.date)}`
          };
        }
        break;

      case 'start-no-later-than':
        if (proposedStart > constraint.date) {
          return {
            taskId,
            constraintType: constraint.type,
            constraintDate: constraint.date,
            violationType: 'too-late',
            message: `Task cannot start after ${this.formatConstraintDate(constraint.date)}`
          };
        }
        break;

      case 'finish-no-earlier-than':
        if (proposedEnd < constraint.date) {
          return {
            taskId,
            constraintType: constraint.type,
            constraintDate: constraint.date,
            violationType: 'too-early',
            message: `Task cannot finish before ${this.formatConstraintDate(constraint.date)}`
          };
        }
        break;

      case 'finish-no-later-than':
        if (proposedEnd > constraint.date) {
          return {
            taskId,
            constraintType: constraint.type,
            constraintDate: constraint.date,
            violationType: 'too-late',
            message: `Task cannot finish after ${this.formatConstraintDate(constraint.date)}`
          };
        }
        break;
    }

    return null;
  }

  /**
   * Format constraint date for display
   */
  private formatConstraintDate(date: Date): string {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Get all constraint violations in the project
   */
  getAllConstraintViolations(): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    this.state.tasks.forEach(task => {
      const violation = this.validateConstraint(task.id, task.startDate, task.endDate);
      if (violation) {
        violations.push(violation);
      }
    });

    return violations;
  }

  /**
   * Auto-adjust task to satisfy constraint (if possible)
   */
  adjustToConstraint(taskId: string): boolean {
    const constraint = this.taskConstraints.get(taskId);
    if (!constraint) return false;

    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return false;

    const duration = task.endDate.getTime() - task.startDate.getTime();

    switch (constraint.type) {
      case 'must-start-on':
      case 'start-no-earlier-than':
      case 'start-no-later-than':
        task.startDate = new Date(constraint.date);
        task.endDate = new Date(constraint.date.getTime() + duration);
        break;

      case 'must-finish-on':
      case 'finish-no-earlier-than':
      case 'finish-no-later-than':
        task.endDate = new Date(constraint.date);
        task.startDate = new Date(constraint.date.getTime() - duration);
        break;
    }

    this.markDirty();
    return true;
  }

  /**
   * Get tasks with constraints
   */
  getTasksWithConstraints(): GanttTask[] {
    return this.state.tasks.filter(t => this.taskConstraints.has(t.id));
  }

  /**
   * Import constraints from data
   */
  importConstraints(data: Array<{ taskId: string; type: ConstraintType; date: string }>): void {
    data.forEach(({ taskId, type, date }) => {
      this.taskConstraints.set(taskId, {
        type,
        date: new Date(date)
      });
    });
    this.markDirty();
  }

  /**
   * Export constraints to data
   */
  exportConstraints(): Array<{ taskId: string; type: ConstraintType; date: string }> {
    const result: Array<{ taskId: string; type: ConstraintType; date: string }> = [];

    this.taskConstraints.forEach((constraint, taskId) => {
      result.push({
        taskId,
        type: constraint.type,
        date: constraint.date.toISOString()
      });
    });

    return result;
  }

  // =========================================================================
  // FEATURE 21: OBJECT POOLING SYSTEM
  // =========================================================================
  // Memory-efficient object pooling for render objects to reduce GC pressure

  private objectPools: Map<string, ObjectPool<any>> = new Map();

  /**
   * Get or create an object pool for a specific type
   */
  private getPool<T>(type: string, factory: () => T, reset: (obj: T) => void, initialSize: number = 100): ObjectPool<T> {
    if (!this.objectPools.has(type)) {
      this.objectPools.set(type, new ObjectPool(factory, reset, initialSize));
    }
    return this.objectPools.get(type) as ObjectPool<T>;
  }

  /**
   * Get a pooled render rectangle
   */
  private acquireRenderRect(): RenderRect {
    const pool = this.getPool<RenderRect>(
      'renderRect',
      () => ({ x: 0, y: 0, width: 0, height: 0, color: '', borderColor: '', borderWidth: 0, radius: 0 }),
      (rect) => { rect.x = 0; rect.y = 0; rect.width = 0; rect.height = 0; rect.color = ''; rect.borderColor = ''; rect.borderWidth = 0; rect.radius = 0; }
    );
    return pool.acquire();
  }

  /**
   * Release a render rectangle back to the pool
   */
  private releaseRenderRect(rect: RenderRect): void {
    const pool = this.objectPools.get('renderRect') as ObjectPool<RenderRect>;
    if (pool) pool.release(rect);
  }

  /**
   * Get a pooled render line
   */
  private acquireRenderLine(): RenderLine {
    const pool = this.getPool<RenderLine>(
      'renderLine',
      () => ({ x1: 0, y1: 0, x2: 0, y2: 0, color: '', width: 1, dash: [] }),
      (line) => { line.x1 = 0; line.y1 = 0; line.x2 = 0; line.y2 = 0; line.color = ''; line.width = 1; line.dash = []; }
    );
    return pool.acquire();
  }

  /**
   * Release a render line back to the pool
   */
  private releaseRenderLine(line: RenderLine): void {
    const pool = this.objectPools.get('renderLine') as ObjectPool<RenderLine>;
    if (pool) pool.release(line);
  }

  /**
   * Get a pooled render text
   */
  private acquireRenderText(): RenderText {
    const pool = this.getPool<RenderText>(
      'renderText',
      () => ({ x: 0, y: 0, text: '', color: '', font: '', align: 'left' as CanvasTextAlign, baseline: 'top' as CanvasTextBaseline, maxWidth: undefined }),
      (t) => { t.x = 0; t.y = 0; t.text = ''; t.color = ''; t.font = ''; t.align = 'left'; t.baseline = 'top'; t.maxWidth = undefined; }
    );
    return pool.acquire();
  }

  /**
   * Release a render text back to the pool
   */
  private releaseRenderText(text: RenderText): void {
    const pool = this.objectPools.get('renderText') as ObjectPool<RenderText>;
    if (pool) pool.release(text);
  }

  /**
   * Clear all object pools (call on destroy)
   */
  private clearObjectPools(): void {
    this.objectPools.forEach(pool => pool.clear());
    this.objectPools.clear();
  }

  /**
   * Get pool statistics for debugging
   */
  getPoolStats(): { type: string; size: number; available: number; acquired: number }[] {
    const stats: { type: string; size: number; available: number; acquired: number }[] = [];
    this.objectPools.forEach((pool, type) => {
      const poolStats = pool.getStats();
      stats.push({ type, ...poolStats });
    });
    return stats;
  }

  // =========================================================================
  // FEATURE 22: RENDER BATCHING SYSTEM
  // =========================================================================
  // Batch multiple draw calls for improved performance

  private renderBatch: RenderBatch = {
    rects: [],
    lines: [],
    texts: [],
    paths: [],
    isCollecting: false
  };

  /**
   * Begin collecting render operations for batching
   */
  beginBatch(): void {
    this.renderBatch.isCollecting = true;
    this.renderBatch.rects = [];
    this.renderBatch.lines = [];
    this.renderBatch.texts = [];
    this.renderBatch.paths = [];
  }

  /**
   * End batch collection and execute all render operations
   */
  endBatch(): void {
    if (!this.renderBatch.isCollecting) return;

    this.renderBatch.isCollecting = false;

    // Sort operations by z-index if needed
    // Execute all batched operations in optimal order
    this.executeBatchedRects();
    this.executeBatchedLines();
    this.executeBatchedPaths();
    this.executeBatchedTexts();
  }

  /**
   * Add a rectangle to the batch
   */
  private batchRect(x: number, y: number, width: number, height: number, color: string, options?: { borderColor?: string; borderWidth?: number; radius?: number; zIndex?: number }): void {
    if (this.renderBatch.isCollecting) {
      this.renderBatch.rects.push({
        x, y, width, height, color,
        borderColor: options?.borderColor || '',
        borderWidth: options?.borderWidth || 0,
        radius: options?.radius || 0,
        zIndex: options?.zIndex || 0
      });
    } else {
      // Immediate draw if not batching
      this.ctx.fillStyle = color;
      if (options?.radius) {
        this.roundRect(x, y, width, height, options.radius);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(x, y, width, height);
      }
      if (options?.borderColor && options?.borderWidth) {
        this.ctx.strokeStyle = options.borderColor;
        this.ctx.lineWidth = options.borderWidth;
        this.ctx.strokeRect(x, y, width, height);
      }
    }
  }

  /**
   * Add a line to the batch
   */
  private batchLine(x1: number, y1: number, x2: number, y2: number, color: string, width: number = 1, dash: number[] = []): void {
    if (this.renderBatch.isCollecting) {
      this.renderBatch.lines.push({ x1, y1, x2, y2, color, width, dash, zIndex: 0 });
    } else {
      this.ctx.beginPath();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = width;
      this.ctx.setLineDash(dash);
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  /**
   * Add text to the batch
   */
  private batchText(x: number, y: number, text: string, color: string, font: string, options?: { align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxWidth?: number }): void {
    if (this.renderBatch.isCollecting) {
      this.renderBatch.texts.push({
        x, y, text, color, font,
        align: options?.align || 'left',
        baseline: options?.baseline || 'top',
        maxWidth: options?.maxWidth,
        zIndex: 10 // Text always on top
      });
    } else {
      this.ctx.fillStyle = color;
      this.ctx.font = font;
      this.ctx.textAlign = options?.align || 'left';
      this.ctx.textBaseline = options?.baseline || 'top';
      if (options?.maxWidth) {
        this.ctx.fillText(text, x, y, options.maxWidth);
      } else {
        this.ctx.fillText(text, x, y);
      }
    }
  }

  /**
   * Execute batched rectangle operations
   */
  private executeBatchedRects(): void {
    // Group by color for fewer state changes
    const byColor = new Map<string, typeof this.renderBatch.rects>();
    this.renderBatch.rects.forEach(rect => {
      const key = `${rect.color}|${rect.borderColor}|${rect.borderWidth}|${rect.radius}`;
      if (!byColor.has(key)) byColor.set(key, []);
      byColor.get(key)!.push(rect);
    });

    byColor.forEach((rects, key) => {
      const [color, borderColor, borderWidth, radius] = key.split('|');
      this.ctx.fillStyle = color;

      rects.forEach(rect => {
        if (parseFloat(radius) > 0) {
          this.roundRect(rect.x, rect.y, rect.width, rect.height, parseFloat(radius));
          this.ctx.fill();
        } else {
          this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }

        if (borderColor && parseFloat(borderWidth) > 0) {
          this.ctx.strokeStyle = borderColor;
          this.ctx.lineWidth = parseFloat(borderWidth);
          this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
      });
    });
  }

  /**
   * Execute batched line operations
   */
  private executeBatchedLines(): void {
    const byStyle = new Map<string, typeof this.renderBatch.lines>();
    this.renderBatch.lines.forEach(line => {
      const key = `${line.color}|${line.width}|${line.dash.join(',')}`;
      if (!byStyle.has(key)) byStyle.set(key, []);
      byStyle.get(key)!.push(line);
    });

    byStyle.forEach((lines, key) => {
      const [color, width, dashStr] = key.split('|');
      const dash = dashStr ? dashStr.split(',').map(Number) : [];

      this.ctx.beginPath();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = parseFloat(width);
      this.ctx.setLineDash(dash);

      lines.forEach(line => {
        this.ctx.moveTo(line.x1, line.y1);
        this.ctx.lineTo(line.x2, line.y2);
      });

      this.ctx.stroke();
      this.ctx.setLineDash([]);
    });
  }

  /**
   * Execute batched path operations
   */
  private executeBatchedPaths(): void {
    // Paths are complex - execute individually for now
    this.renderBatch.paths.forEach(path => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = path.color;
      this.ctx.lineWidth = path.width;
      this.ctx.setLineDash(path.dash);

      const points = path.points;
      if (points.length > 0) {
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          this.ctx.lineTo(points[i].x, points[i].y);
        }
      }

      this.ctx.stroke();
      this.ctx.setLineDash([]);
    });
  }

  /**
   * Execute batched text operations
   */
  private executeBatchedTexts(): void {
    const byStyle = new Map<string, typeof this.renderBatch.texts>();
    this.renderBatch.texts.forEach(text => {
      const key = `${text.color}|${text.font}|${text.align}|${text.baseline}`;
      if (!byStyle.has(key)) byStyle.set(key, []);
      byStyle.get(key)!.push(text);
    });

    byStyle.forEach((texts, key) => {
      const [color, font, align, baseline] = key.split('|');

      this.ctx.fillStyle = color;
      this.ctx.font = font;
      this.ctx.textAlign = align as CanvasTextAlign;
      this.ctx.textBaseline = baseline as CanvasTextBaseline;

      texts.forEach(text => {
        if (text.maxWidth) {
          this.ctx.fillText(text.text, text.x, text.y, text.maxWidth);
        } else {
          this.ctx.fillText(text.text, text.x, text.y);
        }
      });
    });
  }

  /**
   * Helper to draw rounded rectangles
   */
  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  // =========================================================================
  // FEATURE 23: VISIBILITY API INTEGRATION
  // =========================================================================
  // Pause rendering when tab is not visible to save resources

  private isPageVisible: boolean = true;
  private visibilityChangeHandler: (() => void) | null = null;
  private wasAnimatingBeforeHidden: boolean = false;

  /**
   * Initialize visibility API listeners
   */
  private initVisibilityAPI(): void {
    if (typeof document === 'undefined') return;

    this.visibilityChangeHandler = () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;

      if (!this.isPageVisible && wasVisible) {
        // Page became hidden - pause animations
        this.wasAnimatingBeforeHidden = this.animationFrameId !== null;
        this.pauseRendering();
        this.onVisibilityChange?.(false);
      } else if (this.isPageVisible && !wasVisible) {
        // Page became visible - resume if was animating
        if (this.wasAnimatingBeforeHidden) {
          this.resumeRendering();
        }
        this.markDirty(); // Force redraw
        this.onVisibilityChange?.(true);
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Cleanup visibility API listeners
   */
  private cleanupVisibilityAPI(): void {
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  }

  /**
   * Pause rendering (for when tab is hidden)
   */
  private pauseRendering(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume rendering
   */
  private resumeRendering(): void {
    if (this.animationFrameId === null) {
      this.startRenderLoop();
    }
  }

  /**
   * Check if page is currently visible
   */
  isVisible(): boolean {
    return this.isPageVisible;
  }

  /**
   * Callback for visibility changes
   */
  private onVisibilityChange?: (visible: boolean) => void;

  /**
   * Set visibility change callback
   */
  setVisibilityChangeCallback(callback: (visible: boolean) => void): void {
    this.onVisibilityChange = callback;
  }

  // =========================================================================
  // FEATURE 24: DOUBLE-CLICK ZOOM
  // =========================================================================
  // Double-click to zoom in, shift+double-click to zoom out

  private lastClickTime: number = 0;
  private lastClickX: number = 0;
  private lastClickY: number = 0;
  private doubleClickThreshold: number = 300; // ms
  private doubleClickDistance: number = 5; // pixels

  /**
   * Handle potential double-click for zoom
   */
  private handleDoubleClickZoom(x: number, y: number, shiftKey: boolean): boolean {
    const now = Date.now();
    const timeDiff = now - this.lastClickTime;
    const dx = Math.abs(x - this.lastClickX);
    const dy = Math.abs(y - this.lastClickY);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (timeDiff < this.doubleClickThreshold && distance < this.doubleClickDistance) {
      // This is a double-click!
      const zoomFactor = shiftKey ? 0.5 : 2; // Zoom out if shift, zoom in otherwise
      this.zoomAtPoint(x, y, zoomFactor);

      // Reset click tracking
      this.lastClickTime = 0;
      return true;
    }

    // Record this click for potential double-click detection
    this.lastClickTime = now;
    this.lastClickX = x;
    this.lastClickY = y;
    return false;
  }

  /**
   * Zoom at a specific point (keeps that point stationary)
   */
  zoomAtPoint(screenX: number, screenY: number, factor: number): void {
    const state = this.viewport.getState();

    // Convert screen position to world position before zoom
    const worldX = screenX / state.zoom + state.scrollX;
    const worldY = screenY / state.zoom + state.scrollY;

    // Apply zoom
    const newZoom = Math.max(this.config.minDayWidth / this.config.dayWidth,
                             Math.min(this.config.maxDayWidth / this.config.dayWidth,
                                      state.zoom * factor));

    // Calculate new scroll to keep world point under cursor
    const newScrollX = worldX - screenX / newZoom;
    const newScrollY = worldY - screenY / newZoom;

    this.viewport.setZoom(newZoom);
    this.viewport.scrollTo(newScrollX, newScrollY);
    this.markDirty();
  }

  /**
   * Animated zoom at point
   */
  animatedZoomAtPoint(screenX: number, screenY: number, factor: number, duration: number = 300): void {
    const state = this.viewport.getState();
    const targetZoom = Math.max(this.config.minDayWidth / this.config.dayWidth,
                                Math.min(this.config.maxDayWidth / this.config.dayWidth,
                                         state.zoom * factor));

    // Convert screen position to world position
    const worldX = screenX / state.zoom + state.scrollX;
    const worldY = screenY / state.zoom + state.scrollY;

    const startZoom = state.zoom;
    const startScrollX = state.scrollX;
    const startScrollY = state.scrollY;

    // Target scroll to keep point stationary
    const targetScrollX = worldX - screenX / targetZoom;
    const targetScrollY = worldY - screenY / targetZoom;

    // Use internal animation implementation
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutCubic(progress);

      const currentZoom = startZoom + (targetZoom - startZoom) * easedProgress;
      const currentScrollX = startScrollX + (targetScrollX - startScrollX) * easedProgress;
      const currentScrollY = startScrollY + (targetScrollY - startScrollY) * easedProgress;

      this.viewport.setZoom(currentZoom);
      this.viewport.scrollTo(currentScrollX, currentScrollY);
      this.markDirty();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  /**
   * Ease out cubic function
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // =========================================================================
  // FEATURE 25: TIME SCALE CLICK INTERACTION
  // =========================================================================
  // Click on time scale to scroll to date, drag to select date range

  private isTimeScaleDragging: boolean = false;
  private timeScaleDragStart: Date | null = null;
  private timeScaleDragEnd: Date | null = null;
  private timeScaleSelectionCallback?: (startDate: Date, endDate: Date) => void;

  /**
   * Check if click is in the time scale header area
   */
  private isInTimeScaleArea(y: number): boolean {
    return y < this.config.headerHeight;
  }

  /**
   * Handle click on time scale
   */
  private handleTimeScaleClick(x: number): void {
    const date = this.xToDate(x);
    if (date) {
      this.scrollToDate(date, true); // Animated scroll
    }
  }

  /**
   * Start time scale drag selection
   */
  private startTimeScaleDrag(x: number): void {
    this.isTimeScaleDragging = true;
    this.timeScaleDragStart = this.xToDate(x);
    this.timeScaleDragEnd = this.timeScaleDragStart;
    this.markDirty();
  }

  /**
   * Update time scale drag selection
   */
  private updateTimeScaleDrag(x: number): void {
    if (!this.isTimeScaleDragging) return;
    this.timeScaleDragEnd = this.xToDate(x);
    this.markDirty();
  }

  /**
   * End time scale drag selection
   */
  private endTimeScaleDrag(): void {
    if (!this.isTimeScaleDragging) return;

    this.isTimeScaleDragging = false;

    if (this.timeScaleDragStart && this.timeScaleDragEnd && this.timeScaleSelectionCallback) {
      // Ensure start is before end
      const start = this.timeScaleDragStart < this.timeScaleDragEnd
        ? this.timeScaleDragStart
        : this.timeScaleDragEnd;
      const end = this.timeScaleDragStart < this.timeScaleDragEnd
        ? this.timeScaleDragEnd
        : this.timeScaleDragStart;

      this.timeScaleSelectionCallback(start, end);
    }

    this.timeScaleDragStart = null;
    this.timeScaleDragEnd = null;
    this.markDirty();
  }

  /**
   * Get the current time scale selection range
   */
  getTimeScaleSelection(): { start: Date; end: Date } | null {
    if (!this.timeScaleDragStart || !this.timeScaleDragEnd) return null;

    const start = this.timeScaleDragStart < this.timeScaleDragEnd
      ? this.timeScaleDragStart
      : this.timeScaleDragEnd;
    const end = this.timeScaleDragStart < this.timeScaleDragEnd
      ? this.timeScaleDragEnd
      : this.timeScaleDragStart;

    return { start, end };
  }

  /**
   * Set callback for time scale selection
   */
  setTimeScaleSelectionCallback(callback: (startDate: Date, endDate: Date) => void): void {
    this.timeScaleSelectionCallback = callback;
  }

  /**
   * Convert x coordinate to date
   */
  private xToDate(x: number): Date | null {
    const state = this.viewport.getState();
    const dayWidth = this.config.dayWidth * state.zoom;

    // Calculate days from start
    const daysFromStart = (x + state.scrollX * state.zoom) / dayWidth;

    // Get project start date
    const startDate = this.getProjectStartDate();
    if (!startDate) return null;

    const result = new Date(startDate);
    result.setDate(result.getDate() + Math.floor(daysFromStart));
    return result;
  }

  /**
   * Get the earliest task start date
   */
  private getProjectStartDate(): Date | null {
    if (this.state.tasks.length === 0) return new Date();

    let earliest = this.state.tasks[0].startDate;
    this.state.tasks.forEach(task => {
      if (task.startDate < earliest) earliest = task.startDate;
    });
    return earliest;
  }

  /**
   * Render time scale selection overlay
   */
  private renderTimeScaleSelection(): void {
    if (!this.isTimeScaleDragging || !this.timeScaleDragStart || !this.timeScaleDragEnd) return;

    const startX = this.dateToX(this.timeScaleDragStart);
    const endX = this.dateToX(this.timeScaleDragEnd);

    const x = Math.min(startX, endX);
    const width = Math.abs(endX - startX);

    // Draw selection overlay
    this.ctx.fillStyle = this.config.darkMode
      ? 'rgba(99, 102, 241, 0.3)'
      : 'rgba(99, 102, 241, 0.2)';
    this.ctx.fillRect(x, 0, width, this.containerHeight);

    // Draw selection borders
    this.ctx.strokeStyle = this.config.darkMode
      ? 'rgba(99, 102, 241, 0.8)'
      : 'rgba(99, 102, 241, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, this.containerHeight);
    this.ctx.moveTo(x + width, 0);
    this.ctx.lineTo(x + width, this.containerHeight);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // =========================================================================
  // FEATURE 12: TASK RESIZE (DURATION CHANGE)
  // =========================================================================
  private resizeState: {
    isResizing: boolean;
    taskId: string | null;
    edge: 'left' | 'right' | null;
    originalStartDate: Date | null;
    originalEndDate: Date | null;
    startX: number;
  } = { isResizing: false, taskId: null, edge: null, originalStartDate: null, originalEndDate: null, startX: 0 };

  startTaskResize(taskId: string, edge: 'left' | 'right', startX: number): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task || this.isTaskLocked(taskId)) return;

    this.resizeState = {
      isResizing: true,
      taskId,
      edge,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      startX
    };
    this.markDirty();
  }

  updateTaskResize(currentX: number): void {
    if (!this.resizeState.isResizing || !this.resizeState.taskId) return;

    const task = this.state.tasks.find(t => t.id ===this.resizeState.taskId);
    if (!task) return;

    const deltaX = currentX - this.resizeState.startX;
    const daysDelta = Math.round(deltaX / (this.config.dayWidth * this.viewport.getState().zoom));

    if (this.resizeState.edge === 'left' && this.resizeState.originalStartDate) {
      const newStart = new Date(this.resizeState.originalStartDate);
      newStart.setDate(newStart.getDate() + daysDelta);
      if (newStart < task.endDate) {
        task.startDate = newStart;
      }
    } else if (this.resizeState.edge === 'right' && this.resizeState.originalEndDate) {
      const newEnd = new Date(this.resizeState.originalEndDate);
      newEnd.setDate(newEnd.getDate() + daysDelta);
      if (newEnd > task.startDate) {
        task.endDate = newEnd;
      }
    }

    this.markDirty();
  }

  endTaskResize(): { taskId: string; oldStart: Date; oldEnd: Date; newStart: Date; newEnd: Date } | null {
    if (!this.resizeState.isResizing || !this.resizeState.taskId) return null;

    const task = this.state.tasks.find(t => t.id ===this.resizeState.taskId);
    const result = task && this.resizeState.originalStartDate && this.resizeState.originalEndDate ? {
      taskId: this.resizeState.taskId,
      oldStart: this.resizeState.originalStartDate,
      oldEnd: this.resizeState.originalEndDate,
      newStart: task.startDate,
      newEnd: task.endDate
    } : null;

    this.resizeState = { isResizing: false, taskId: null, edge: null, originalStartDate: null, originalEndDate: null, startX: 0 };
    this.markDirty();
    return result;
  }

  isResizingTask(): boolean { return this.resizeState.isResizing; }
  getResizingTaskId(): string | null { return this.resizeState.taskId; }

  // =========================================================================
  // FEATURE 16: LINK/DEPENDENCY CREATION BY DRAG
  // =========================================================================
  private linkCreationState: {
    isCreating: boolean;
    fromTaskId: string | null;
    fromEdge: 'start' | 'end';
    currentX: number;
    currentY: number;
  } = { isCreating: false, fromTaskId: null, fromEdge: 'end', currentX: 0, currentY: 0 };

  startLinkCreation(taskId: string, edge: 'start' | 'end'): void {
    this.linkCreationState = {
      isCreating: true,
      fromTaskId: taskId,
      fromEdge: edge,
      currentX: 0,
      currentY: 0
    };
    this.markDirty();
  }

  updateLinkCreation(x: number, y: number): void {
    if (!this.linkCreationState.isCreating) return;
    this.linkCreationState.currentX = x;
    this.linkCreationState.currentY = y;
    this.markDirty();
  }

  completeLinkCreation(toTaskId: string, toEdge: 'start' | 'end'): GanttDependency | null {
    if (!this.linkCreationState.isCreating || !this.linkCreationState.fromTaskId) return null;

    const fromEdge = this.linkCreationState.fromEdge;
    let depType: 'FS' | 'SS' | 'FF' | 'SF';

    if (fromEdge === 'end' && toEdge === 'start') depType = 'FS';
    else if (fromEdge === 'start' && toEdge === 'start') depType = 'SS';
    else if (fromEdge === 'end' && toEdge === 'end') depType = 'FF';
    else depType = 'SF';

    // Check for circular dependency
    if (this.wouldCreateCircularDependency(this.linkCreationState.fromTaskId, toTaskId)) {
      this.cancelLinkCreation();
      return null;
    }

    const newDep: GanttDependency = {
      id: `dep-${Date.now()}`,
      fromId: this.linkCreationState.fromTaskId,
      toId: toTaskId,
      type: depType,
      lag: 0
    };

    this.state.dependencies.push(newDep);
    this.cancelLinkCreation();
    return newDep;
  }

  cancelLinkCreation(): void {
    this.linkCreationState = { isCreating: false, fromTaskId: null, fromEdge: 'end', currentX: 0, currentY: 0 };
    this.markDirty();
  }

  isCreatingLink(): boolean { return this.linkCreationState.isCreating; }

  renderLinkCreationLine(): void {
    if (!this.linkCreationState.isCreating || !this.linkCreationState.fromTaskId) return;

    const fromTask = this.state.tasks.find(t => t.id ===this.linkCreationState.fromTaskId);
    if (!fromTask) return;

    const taskIndex = this.state.tasks.findIndex(t => t.id === fromTask.id);
    const fromX = this.linkCreationState.fromEdge === 'end'
      ? this.dateToX(fromTask.endDate)
      : this.dateToX(fromTask.startDate);
    const fromY = this.viewport.rowToY(taskIndex) + this.config.rowHeight / 2;

    this.ctx.beginPath();
    this.ctx.strokeStyle = '#6366f1';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(this.linkCreationState.currentX, this.linkCreationState.currentY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // =========================================================================
  // FEATURE 17: VIRTUAL SCROLLING EXTENSIONS
  // =========================================================================
  // Note: Core getVisibleTaskRange/getVisibleTasks defined earlier. These are extensions.
  private virtualScrollEnabled: boolean = true;
  private overscanRows: number = 5;
  private overscanDays: number = 7;

  setVirtualScrollEnabled(enabled: boolean): void {
    this.virtualScrollEnabled = enabled;
    this.markDirty();
  }

  setOverscan(rows: number, days: number): void {
    this.overscanRows = Math.max(0, rows);
    this.overscanDays = Math.max(0, days);
    this.markDirty();
  }

  getExtendedVisibleDateRange(): { startDate: Date; endDate: Date } {
    const state = this.viewport.getState();
    const dayWidth = this.config.dayWidth * state.zoom;

    const startDays = Math.floor(state.scrollX / dayWidth) - this.overscanDays;
    const endDays = Math.ceil((state.scrollX + this.containerWidth) / dayWidth) + this.overscanDays;

    const projectStart = this.getProjectStartDate() || new Date();
    const startDate = new Date(projectStart);
    startDate.setDate(startDate.getDate() + startDays);

    const endDate = new Date(projectStart);
    endDate.setDate(endDate.getDate() + endDays);

    return { startDate, endDate };
  }

  // =========================================================================
  // FEATURE 18: MINIMAP NAVIGATION
  // =========================================================================
  private minimapEnabled: boolean = false;
  private minimapWidth: number = 200;
  private minimapHeight: number = 100;
  private minimapPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';
  private isMinimapDragging: boolean = false;

  setMinimapEnabled(enabled: boolean): void {
    this.minimapEnabled = enabled;
    this.markDirty();
  }

  setMinimapSize(width: number, height: number): void {
    this.minimapWidth = Math.max(100, width);
    this.minimapHeight = Math.max(50, height);
    this.markDirty();
  }

  setMinimapPosition(position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'): void {
    this.minimapPosition = position;
    this.markDirty();
  }

  getMinimapBounds(): { x: number; y: number; width: number; height: number } {
    const padding = 10;
    let x: number, y: number;

    switch (this.minimapPosition) {
      case 'top-left':
        x = padding;
        y = this.config.headerHeight + padding;
        break;
      case 'top-right':
        x = this.containerWidth - this.minimapWidth - padding;
        y = this.config.headerHeight + padding;
        break;
      case 'bottom-left':
        x = padding;
        y = this.containerHeight - this.minimapHeight - padding;
        break;
      case 'bottom-right':
      default:
        x = this.containerWidth - this.minimapWidth - padding;
        y = this.containerHeight - this.minimapHeight - padding;
        break;
    }

    return { x, y, width: this.minimapWidth, height: this.minimapHeight };
  }

  renderMinimap(): void {
    if (!this.minimapEnabled || this.state.tasks.length === 0) return;

    const bounds = this.getMinimapBounds();
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = this.config.darkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.strokeStyle = this.config.darkMode ? '#444' : '#ccc';
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // Calculate scale
    const projectStart = this.getProjectStartDate() || new Date();
    const projectEnd = this.getProjectEndDate() || new Date();
    const totalDays = Math.max(1, (projectEnd.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000));
    const totalRows = this.state.tasks.length;

    const scaleX = bounds.width / totalDays;
    const scaleY = bounds.height / totalRows;

    // Draw tasks
    ctx.fillStyle = this.config.darkMode ? '#6366f1' : '#4f46e5';
    this.state.tasks.forEach((task, index) => {
      const taskStartDays = (task.startDate.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000);
      const taskDuration = (task.endDate.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000);

      const x = bounds.x + taskStartDays * scaleX;
      const y = bounds.y + index * scaleY;
      const w = Math.max(2, taskDuration * scaleX);
      const h = Math.max(1, scaleY * 0.8);

      ctx.fillRect(x, y, w, h);
    });

    // Draw viewport rectangle
    const state = this.viewport.getState();
    const dayWidth = this.config.dayWidth * state.zoom;
    const viewStartDays = state.scrollX / dayWidth;
    const viewDays = this.containerWidth / dayWidth;
    const viewStartRow = state.scrollY / this.config.rowHeight;
    const viewRows = (this.containerHeight - this.config.headerHeight) / this.config.rowHeight;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      bounds.x + viewStartDays * scaleX,
      bounds.y + viewStartRow * scaleY,
      viewDays * scaleX,
      viewRows * scaleY
    );
  }

  handleMinimapClick(x: number, y: number): boolean {
    if (!this.minimapEnabled) return false;

    const bounds = this.getMinimapBounds();
    if (x < bounds.x || x > bounds.x + bounds.width ||
        y < bounds.y || y > bounds.y + bounds.height) return false;

    this.navigateFromMinimap(x, y);
    return true;
  }

  private navigateFromMinimap(clickX: number, clickY: number): void {
    const bounds = this.getMinimapBounds();
    const projectStart = this.getProjectStartDate() || new Date();
    const projectEnd = this.getProjectEndDate() || new Date();
    const totalDays = (projectEnd.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000);
    const totalRows = this.state.tasks.length;

    const relX = (clickX - bounds.x) / bounds.width;
    const relY = (clickY - bounds.y) / bounds.height;

    const state = this.viewport.getState();
    const dayWidth = this.config.dayWidth * state.zoom;

    const newScrollX = relX * totalDays * dayWidth - this.containerWidth / 2;
    const newScrollY = relY * totalRows * this.config.rowHeight - (this.containerHeight - this.config.headerHeight) / 2;

    this.viewport.scrollTo(Math.max(0, newScrollX), Math.max(0, newScrollY));
    this.markDirty();
  }

  private getProjectEndDate(): Date | null {
    if (this.state.tasks.length === 0) return null;
    let latest = this.state.tasks[0].endDate;
    this.state.tasks.forEach(task => {
      if (task.endDate > latest) latest = task.endDate;
    });
    return latest;
  }

  // =========================================================================
  // FEATURE 19: BASELINE COMPARISON VISUALIZATION EXTENSIONS
  // =========================================================================
  // Note: Core baseline methods defined earlier. These are rendering extensions.
  private baselineRenderOpacity: number = 0.4;
  private baselineRenderColor: string = '#9ca3af';

  setBaselineRenderStyle(opacity: number, color: string): void {
    this.baselineRenderOpacity = Math.max(0, Math.min(1, opacity));
    this.baselineRenderColor = color;
    this.markDirty();
  }

  renderBaselineBar(task: GanttTask, taskIndex: number): void {
    const baseline = this.getBaseline(task.id);
    if (!baseline) return;

    const x = this.dateToX(baseline.startDate);
    const y = this.viewport.rowToY(taskIndex) + this.config.rowHeight - 8;
    const width = this.dateToX(baseline.endDate) - x;
    const height = 4;

    this.ctx.globalAlpha = this.baselineRenderOpacity;
    this.ctx.fillStyle = this.baselineRenderColor;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.globalAlpha = 1;
  }

  calculateBaselineVariance(taskId: string): { startVariance: number; endVariance: number; durationVariance: number } | null {
    const task = this.state.tasks.find(t => t.id === taskId);
    const baseline = this.getBaseline(taskId);
    if (!task || !baseline) return null;

    const oneDay = 24 * 60 * 60 * 1000;
    const startVariance = Math.round((task.startDate.getTime() - baseline.startDate.getTime()) / oneDay);
    const endVariance = Math.round((task.endDate.getTime() - baseline.endDate.getTime()) / oneDay);
    const actualDuration = Math.round((task.endDate.getTime() - task.startDate.getTime()) / oneDay);
    const baselineDuration = Math.round((baseline.endDate.getTime() - baseline.startDate.getTime()) / oneDay);

    return { startVariance, endVariance, durationVariance: actualDuration - baselineDuration };
  }

  // =========================================================================
  // FEATURE 20: CRITICAL PATH VISUALIZATION
  // =========================================================================
  private criticalPathVisible: boolean = false;
  private criticalPathTaskIds: Set<string> = new Set();
  private criticalPathColor: string = '#ef4444';

  setCriticalPathVisible(visible: boolean): void {
    this.criticalPathVisible = visible;
    if (visible) this.calculateCriticalPath();
    this.markDirty();
  }

  calculateCriticalPath(): void {
    this.criticalPathTaskIds.clear();

    if (this.state.tasks.length === 0) return;

    // Find project end date
    const projectEnd = this.getProjectEndDate();
    if (!projectEnd) return;

    // Find tasks that end at project end (critical end tasks)
    const endTasks = this.state.tasks.filter(t =>
      Math.abs(t.endDate.getTime() - projectEnd.getTime()) < 24 * 60 * 60 * 1000
    );

    // Trace back from end tasks through predecessors
    const visited = new Set<string>();
    const queue = endTasks.map(t => t.id);

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      if (visited.has(taskId)) continue;
      visited.add(taskId);

      this.criticalPathTaskIds.add(taskId);

      // Find predecessors
      const task = this.state.tasks.find(t => t.id === taskId);
      if (task?.predecessorIds) {
        task.predecessorIds.forEach(predId => {
          if (!visited.has(predId)) queue.push(predId);
        });
      }
    }
  }

  isOnCriticalPath(taskId: string): boolean {
    return this.criticalPathTaskIds.has(taskId);
  }

  getCriticalPathTaskIds(): string[] {
    return Array.from(this.criticalPathTaskIds);
  }

  setCriticalPathColor(color: string): void {
    this.criticalPathColor = color;
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 26: EXTENDED TIME SCALE VIEWS (QUARTER/YEAR)
  // =========================================================================
  private currentTimeScale: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day';

  setTimeScale(scale: 'day' | 'week' | 'month' | 'quarter' | 'year'): void {
    this.currentTimeScale = scale;
    this.markDirty();
  }

  getTimeScale(): string { return this.currentTimeScale; }

  getTimeScaleLabel(date: Date): string {
    switch (this.currentTimeScale) {
      case 'year': return date.getFullYear().toString();
      case 'quarter': return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
      case 'month': return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
      case 'week': return `W${this.getWeekNumber(date)}`;
      default: return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // =========================================================================
  // FEATURE 27: TASK BAR VISUAL ENHANCEMENTS (GRADIENTS/SHADOWS)
  // =========================================================================
  private taskBarGradientEnabled: boolean = false;
  private taskBarShadowEnabled: boolean = false;

  setTaskBarGradientEnabled(enabled: boolean): void {
    this.taskBarGradientEnabled = enabled;
    this.markDirty();
  }

  setTaskBarShadowEnabled(enabled: boolean): void {
    this.taskBarShadowEnabled = enabled;
    this.markDirty();
  }

  createTaskBarGradient(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, baseColor: string): CanvasGradient {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(baseColor, 20));
    gradient.addColorStop(0.5, baseColor);
    gradient.addColorStop(1, this.darkenColor(baseColor, 20));
    return gradient;
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  applyTaskBarShadowEffect(ctx: CanvasRenderingContext2D): void {
    if (this.taskBarShadowEnabled) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }
  }

  clearTaskBarShadowEffect(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // =========================================================================
  // FEATURE 28: WORKING HOURS HIGHLIGHTING
  // =========================================================================
  private workingHoursEnabled: boolean = false;
  private workingHoursStart: number = 7;
  private workingHoursEnd: number = 17;

  setWorkingHoursHighlighting(enabled: boolean, startHour?: number, endHour?: number): void {
    this.workingHoursEnabled = enabled;
    if (startHour !== undefined) this.workingHoursStart = startHour;
    if (endHour !== undefined) this.workingHoursEnd = endHour;
    this.markDirty();
  }

  isWorkingHour(hour: number): boolean {
    return hour >= this.workingHoursStart && hour < this.workingHoursEnd;
  }

  // =========================================================================
  // FEATURE 29: SHIFT+DRAG TO COPY TASK
  // =========================================================================
  private copyDragState: { isCopying: boolean; sourceTaskId: string | null; ghostTask: GanttTask | null } =
    { isCopying: false, sourceTaskId: null, ghostTask: null };

  startCopyDrag(taskId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.copyDragState = {
      isCopying: true,
      sourceTaskId: taskId,
      ghostTask: { ...task, id: `copy-${Date.now()}`, name: `${task.name} (Copy)` }
    };
    this.markDirty();
  }

  updateCopyDrag(newStartDate: Date): void {
    if (!this.copyDragState.isCopying || !this.copyDragState.ghostTask) return;

    const duration = this.copyDragState.ghostTask.endDate.getTime() - this.copyDragState.ghostTask.startDate.getTime();
    this.copyDragState.ghostTask.startDate = newStartDate;
    this.copyDragState.ghostTask.endDate = new Date(newStartDate.getTime() + duration);
    this.markDirty();
  }

  completeCopyDrag(): GanttTask | null {
    if (!this.copyDragState.isCopying || !this.copyDragState.ghostTask) return null;

    const newTask = { ...this.copyDragState.ghostTask };
    this.state.tasks.push(newTask);
    this.copyDragState = { isCopying: false, sourceTaskId: null, ghostTask: null };
    this.markDirty();
    return newTask;
  }

  cancelCopyDrag(): void {
    this.copyDragState = { isCopying: false, sourceTaskId: null, ghostTask: null };
    this.markDirty();
  }

  isCopyDragging(): boolean { return this.copyDragState.isCopying; }

  // =========================================================================
  // FEATURE 30: GESTURE RECOGNITION
  // =========================================================================
  private gestureState: { touches: Touch[]; lastGesture: string | null; gestureStartTime: number } =
    { touches: [], lastGesture: null, gestureStartTime: 0 };
  private gestureCallbacks: Map<string, (data: any) => void> = new Map();

  registerGestureCallback(gesture: string, callback: (data: any) => void): void {
    this.gestureCallbacks.set(gesture, callback);
  }

  recognizeGesture(touches: Touch[]): string | null {
    if (touches.length === 2) {
      const dx = Math.abs(touches[0].clientX - touches[1].clientX);
      const dy = Math.abs(touches[0].clientY - touches[1].clientY);
      if (dx > 50 || dy > 50) return 'pinch';
    }
    if (touches.length === 3) return 'three-finger-swipe';
    return null;
  }

  handleGesture(gesture: string, data: any): void {
    const callback = this.gestureCallbacks.get(gesture);
    if (callback) callback(data);
  }

  // =========================================================================
  // FEATURE 31: RAF THROTTLING FOR POWER SAVING
  // =========================================================================
  private rafThrottleEnabled: boolean = true;
  private lastRenderTime: number = 0;
  private minFrameInterval: number = 16;
  private idleThrottleMultiplier: number = 4;
  private isUserInteracting: boolean = false;

  setRAFThrottling(enabled: boolean, minFrameInterval?: number): void {
    this.rafThrottleEnabled = enabled;
    if (minFrameInterval) this.minFrameInterval = minFrameInterval;
  }

  setUserInteracting(interacting: boolean): void {
    this.isUserInteracting = interacting;
    if (interacting) this.markDirty();
  }

  shouldSkipFrame(): boolean {
    if (!this.rafThrottleEnabled) return false;

    const now = performance.now();
    const interval = this.isUserInteracting ? this.minFrameInterval : this.minFrameInterval * this.idleThrottleMultiplier;

    if (now - this.lastRenderTime < interval) return true;
    this.lastRenderTime = now;
    return false;
  }

  // =========================================================================
  // FEATURE 32: CLIPPING REGION OPTIMIZATION
  // =========================================================================
  private clippingEnabled: boolean = true;
  private dirtyRegions: Array<{ x: number; y: number; width: number; height: number }> = [];

  setClippingEnabled(enabled: boolean): void {
    this.clippingEnabled = enabled;
  }

  addDirtyRegion(x: number, y: number, width: number, height: number): void {
    this.dirtyRegions.push({ x, y, width, height });
  }

  clearDirtyRegions(): void {
    this.dirtyRegions = [];
  }

  applyClipping(ctx: CanvasRenderingContext2D): void {
    if (!this.clippingEnabled || this.dirtyRegions.length === 0) return;

    ctx.save();
    ctx.beginPath();
    this.dirtyRegions.forEach(r => ctx.rect(r.x, r.y, r.width, r.height));
    ctx.clip();
  }

  // =========================================================================
  // FEATURE 33: Z-INDEX LAYER MANAGEMENT
  // =========================================================================
  private layers: Map<string, { zIndex: number; visible: boolean }> = new Map([
    ['background', { zIndex: 0, visible: true }],
    ['grid', { zIndex: 10, visible: true }],
    ['tasks', { zIndex: 20, visible: true }],
    ['dependencies', { zIndex: 30, visible: true }],
    ['overlays', { zIndex: 40, visible: true }],
    ['ui', { zIndex: 50, visible: true }]
  ]);

  setLayerZIndex(layerName: string, zIndex: number): void {
    const layer = this.layers.get(layerName);
    if (layer) layer.zIndex = zIndex;
    this.markDirty();
  }

  setLayerVisible(layerName: string, visible: boolean): void {
    const layer = this.layers.get(layerName);
    if (layer) layer.visible = visible;
    this.markDirty();
  }

  getLayerOrder(): string[] {
    return Array.from(this.layers.entries())
      .filter(([_, layer]) => layer.visible)
      .sort((a, b) => a[1].zIndex - b[1].zIndex)
      .map(([name]) => name);
  }

  // =========================================================================
  // FEATURE 34: PRESERVE POSITION ON RESIZE
  // =========================================================================
  private preservePositionOnResize: boolean = true;
  private anchorTaskId: string | null = null;
  private anchorPosition: { x: number; y: number } | null = null;

  setPreservePositionOnResize(enabled: boolean): void {
    this.preservePositionOnResize = enabled;
  }

  captureAnchorPosition(): void {
    const visibleTasks = this.getVisibleTasks();
    if (visibleTasks.length > 0) {
      const centerTask = visibleTasks[Math.floor(visibleTasks.length / 2)];
      this.anchorTaskId = centerTask.id;
      this.anchorPosition = {
        x: this.dateToX(centerTask.startDate),
        y: this.viewport.rowToY(this.state.tasks.findIndex(t => t.id === centerTask.id))
      };
    }
  }

  restoreAnchorPosition(): void {
    if (!this.preservePositionOnResize || !this.anchorTaskId || !this.anchorPosition) return;

    const task = this.state.tasks.find(t => t.id ===this.anchorTaskId);
    if (!task) return;

    const taskIndex = this.state.tasks.findIndex(t => t.id === this.anchorTaskId);
    const newX = this.dateToX(task.startDate);
    const newY = this.viewport.rowToY(taskIndex);

    const deltaX = newX - this.anchorPosition.x;
    const deltaY = newY - this.anchorPosition.y;

    this.viewport.pan(-deltaX, -deltaY);
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 35: DEPENDENCY LINE ROUTING
  // =========================================================================
  private lineRoutingEnabled: boolean = true;
  private routingAlgorithm: 'direct' | 'orthogonal' | 'bezier' = 'bezier';

  setLineRoutingEnabled(enabled: boolean): void {
    this.lineRoutingEnabled = enabled;
    this.markDirty();
  }

  setRoutingAlgorithm(algorithm: 'direct' | 'orthogonal' | 'bezier'): void {
    this.routingAlgorithm = algorithm;
    this.markDirty();
  }

  calculateDependencyPath(fromTask: GanttTask, toTask: GanttTask, depType: string): { x: number; y: number }[] {
    const fromIndex = this.state.tasks.findIndex(t => t.id === fromTask.id);
    const toIndex = this.state.tasks.findIndex(t => t.id === toTask.id);

    const fromX = depType.startsWith('S') ? this.dateToX(fromTask.startDate) : this.dateToX(fromTask.endDate);
    const toX = depType.endsWith('S') ? this.dateToX(toTask.startDate) : this.dateToX(toTask.endDate);
    const fromY = this.viewport.rowToY(fromIndex) + this.config.rowHeight / 2;
    const toY = this.viewport.rowToY(toIndex) + this.config.rowHeight / 2;

    if (this.routingAlgorithm === 'direct') {
      return [{ x: fromX, y: fromY }, { x: toX, y: toY }];
    }

    // Orthogonal routing
    const midX = (fromX + toX) / 2;
    return [
      { x: fromX, y: fromY },
      { x: midX, y: fromY },
      { x: midX, y: toY },
      { x: toX, y: toY }
    ];
  }

  // =========================================================================
  // FEATURE 36: DEPENDENCY CHAIN ANALYSIS
  // =========================================================================
  getDependencyChain(taskId: string, direction: 'predecessors' | 'successors'): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();
    const queue = [taskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentId !== taskId) chain.push(currentId);

      if (direction === 'predecessors') {
        const task = this.state.tasks.find(t => t.id ===currentId);
        if (task?.predecessorIds) queue.push(...task.predecessorIds);
      } else {
        const successors = this.state.dependencies
          .filter(d => d.fromId === currentId)
          .map(d => d.toId);
        queue.push(...successors);
      }
    }

    return chain;
  }

  getFullDependencyTree(taskId: string): { predecessors: string[]; successors: string[] } {
    return {
      predecessors: this.getDependencyChain(taskId, 'predecessors'),
      successors: this.getDependencyChain(taskId, 'successors')
    };
  }

  // =========================================================================
  // FEATURE 37: F2 TO RENAME TASK
  // =========================================================================
  private renameState: { isRenaming: boolean; taskId: string | null; inputElement: HTMLInputElement | null } =
    { isRenaming: false, taskId: null, inputElement: null };

  startTaskRename(taskId?: string): void {
    const targetId = taskId || this.getSelectedTaskIds()[0];
    if (!targetId) return;

    const task = this.state.tasks.find(t => t.id ===targetId);
    if (!task) return;

    const taskIndex = this.state.tasks.findIndex(t => t.id === targetId);
    const x = this.dateToX(task.startDate);
    const y = this.viewport.rowToY(taskIndex);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = task.name;
    input.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:200px;height:${this.config.rowHeight}px;z-index:1000;`;

    input.addEventListener('blur', () => this.completeTaskRename());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.completeTaskRename();
      if (e.key === 'Escape') this.cancelTaskRename();
    });

    this.canvas.parentElement?.appendChild(input);
    input.focus();
    input.select();

    this.renameState = { isRenaming: true, taskId: targetId, inputElement: input };
  }

  completeTaskRename(): void {
    if (!this.renameState.isRenaming || !this.renameState.taskId || !this.renameState.inputElement) return;

    const task = this.state.tasks.find(t => t.id ===this.renameState.taskId);
    if (task) task.name = this.renameState.inputElement.value;

    this.cleanupRename();
    this.markDirty();
  }

  cancelTaskRename(): void {
    this.cleanupRename();
  }

  private cleanupRename(): void {
    if (this.renameState.inputElement?.parentElement) {
      this.renameState.inputElement.parentElement.removeChild(this.renameState.inputElement);
    }
    this.renameState = { isRenaming: false, taskId: null, inputElement: null };
  }

  isRenamingTask(): boolean { return this.renameState.isRenaming; }

  // =========================================================================
  // FEATURE 38: SPACE TO TOGGLE TASK LOCK
  // =========================================================================
  toggleSelectedTaskLock(): void {
    const selectedIds = this.getSelectedTaskIds();
    selectedIds.forEach(id => {
      const task = this.state.tasks.find(t => t.id ===id);
      if (task) {
        task.locked = task.locked ? undefined : 'manuallyPositioned';
      }
    });
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 39: KEYBOARD SHORTCUT HELP MODAL
  // =========================================================================
  private shortcutHelpVisible: boolean = false;

  toggleShortcutHelp(): void {
    this.shortcutHelpVisible = !this.shortcutHelpVisible;
    this.markDirty();
  }

  getKeyboardShortcutsForHelpModal(): Array<{ key: string; description: string; category: string }> {
    return [
      { key: 'Arrow Keys', description: 'Move selection', category: 'Navigation' },
      { key: 'Ctrl+A', description: 'Select all tasks', category: 'Selection' },
      { key: 'Delete', description: 'Delete selected tasks', category: 'Editing' },
      { key: 'Ctrl+Z', description: 'Undo', category: 'History' },
      { key: 'Ctrl+Y', description: 'Redo', category: 'History' },
      { key: 'Ctrl+C', description: 'Copy task', category: 'Clipboard' },
      { key: 'Ctrl+V', description: 'Paste task', category: 'Clipboard' },
      { key: 'F2', description: 'Rename task', category: 'Editing' },
      { key: 'Space', description: 'Toggle task lock', category: 'Editing' },
      { key: '?', description: 'Show this help', category: 'Help' },
      { key: 'Escape', description: 'Cancel current action', category: 'General' }
    ];
  }

  renderShortcutHelp(): void {
    if (!this.shortcutHelpVisible) return;

    const ctx = this.ctx;
    const shortcuts = this.getKeyboardShortcutsForHelpModal();
    const modalWidth = 400;
    const modalHeight = shortcuts.length * 25 + 60;
    const x = (this.containerWidth - modalWidth) / 2;
    const y = (this.containerHeight - modalHeight) / 2;

    // Background
    ctx.fillStyle = this.config.darkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x, y, modalWidth, modalHeight);
    ctx.strokeStyle = this.config.darkMode ? '#444' : '#ccc';
    ctx.strokeRect(x, y, modalWidth, modalHeight);

    // Title
    ctx.fillStyle = this.config.darkMode ? '#fff' : '#000';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText('Keyboard Shortcuts', x + 20, y + 30);

    // Shortcuts
    ctx.font = '13px system-ui';
    shortcuts.forEach((shortcut, i) => {
      const rowY = y + 55 + i * 25;
      ctx.fillStyle = this.config.darkMode ? '#a0a0a0' : '#666';
      ctx.fillText(shortcut.key, x + 20, rowY);
      ctx.fillStyle = this.config.darkMode ? '#fff' : '#000';
      ctx.fillText(shortcut.description, x + 150, rowY);
    });
  }

  isShortcutHelpVisible(): boolean { return this.shortcutHelpVisible; }

  // =========================================================================
  // FEATURE 40: FOCUS RING FOR ACCESSIBILITY
  // =========================================================================
  private focusRingVisible: boolean = true;
  private focusRingColor: string = '#6366f1';
  private focusRingWidth: number = 3;

  // Note: focusTask and getFocusedTaskId exist at Feature 14

  setFocusRingStyle(color: string, width: number): void {
    this.focusRingColor = color;
    this.focusRingWidth = width;
    this.markDirty();
  }

  setFocusRingVisible(visible: boolean): void {
    this.focusRingVisible = visible;
    this.markDirty();
  }

  renderFocusRing(task: GanttTask, taskIndex: number): void {
    if (!this.focusRingVisible || task.id !== this.focusedTaskId) return;

    const x = this.dateToX(task.startDate) - this.focusRingWidth;
    const y = this.viewport.rowToY(taskIndex) - this.focusRingWidth;
    const width = this.dateToX(task.endDate) - this.dateToX(task.startDate) + this.focusRingWidth * 2;
    const height = this.config.taskBarHeight + this.focusRingWidth * 2;

    this.ctx.strokeStyle = this.focusRingColor;
    this.ctx.lineWidth = this.focusRingWidth;
    this.ctx.setLineDash([4, 2]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }

  moveFocus(direction: 'up' | 'down' | 'next' | 'prev'): void {
    const currentIndex = this.focusedTaskId
      ? this.state.tasks.findIndex(t => t.id === this.focusedTaskId)
      : -1;

    let newIndex: number;
    switch (direction) {
      case 'up':
      case 'prev':
        newIndex = currentIndex > 0 ? currentIndex - 1 : this.state.tasks.length - 1;
        break;
      case 'down':
      case 'next':
        newIndex = currentIndex < this.state.tasks.length - 1 ? currentIndex + 1 : 0;
        break;
    }

    if (this.state.tasks[newIndex]) {
      this.focusTask(this.state.tasks[newIndex].id);
    }
  }

  // =========================================================================
  // FEATURE 41: DOUBLE BUFFERING FOR SMOOTH ANIMATION
  // =========================================================================
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private doubleBufferingEnabled: boolean = false;

  initializeDoubleBuffering(): void {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.doubleBufferingEnabled = true;
  }

  setDoubleBufferingEnabled(enabled: boolean): void {
    this.doubleBufferingEnabled = enabled;
    if (enabled && !this.offscreenCanvas) this.initializeDoubleBuffering();
  }

  getRenderContext(): CanvasRenderingContext2D {
    return this.doubleBufferingEnabled && this.offscreenCtx ? this.offscreenCtx : this.ctx;
  }

  flipBuffer(): void {
    if (!this.doubleBufferingEnabled || !this.offscreenCanvas) return;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  resizeOffscreenCanvas(): void {
    if (!this.offscreenCanvas) return;
    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;
  }

  // =========================================================================
  // FEATURE 42: WEBGL FALLBACK FOR COMPLEX SCENES
  // =========================================================================
  private webglEnabled: boolean = false;
  private webglCanvas: HTMLCanvasElement | null = null;
  private webglContext: WebGLRenderingContext | null = null;
  private webglTaskThreshold: number = 500;

  initializeWebGL(): boolean {
    try {
      this.webglCanvas = document.createElement('canvas');
      this.webglContext = this.webglCanvas.getContext('webgl');
      this.webglEnabled = this.webglContext !== null;
      return this.webglEnabled;
    } catch {
      this.webglEnabled = false;
      return false;
    }
  }

  setWebGLEnabled(enabled: boolean): void {
    if (enabled && !this.webglContext) this.initializeWebGL();
    this.webglEnabled = enabled && this.webglContext !== null;
  }

  shouldUseWebGL(): boolean {
    return this.webglEnabled && this.state.tasks.length > this.webglTaskThreshold;
  }

  setWebGLTaskThreshold(threshold: number): void {
    this.webglTaskThreshold = threshold;
  }

  // =========================================================================
  // FEATURE 43: AUTO-REMOVE CIRCULAR DEPENDENCIES ON SAVE
  // =========================================================================
  removeCircularDependenciesOnSave(): Array<{ from: string; to: string; type: string }> {
    const removed: Array<{ from: string; to: string; type: string }> = [];

    this.state.dependencies = this.state.dependencies.filter(dep => {
      if (this.wouldCreateCircularDependency(dep.fromId, dep.toId)) {
        removed.push({ from: dep.fromId, to: dep.toId, type: dep.type });
        return false;
      }
      return true;
    });

    if (removed.length > 0) {
      console.warn('[GanttCanvas] Removed circular dependencies:', removed);
      this.markDirty();
    }

    return removed;
  }

  // =========================================================================
  // FEATURE 44: CIRCULAR DEPENDENCY LOGGING
  // =========================================================================
  private circularDepLoggingEnabled: boolean = true;

  setCircularDependencyLogging(enabled: boolean): void {
    this.circularDepLoggingEnabled = enabled;
  }

  logCircularDependencyAttempt(fromId: string, toId: string): void {
    if (!this.circularDepLoggingEnabled) return;
    console.warn(`[GanttCanvas] Circular dependency blocked: ${fromId} → ${toId}`);
  }

  // =========================================================================
  // FEATURE 45: ENHANCED TOUCH GESTURE RECOGNITION
  // =========================================================================
  private touchGestureState: { startTouches: Touch[]; currentGesture: string | null } =
    { startTouches: [], currentGesture: null };

  detectTouchGesture(touches: TouchList): 'tap' | 'double-tap' | 'long-press' | 'swipe-left' | 'swipe-right' | 'pinch' | 'rotate' | null {
    if (touches.length === 1) {
      // Single touch gestures handled elsewhere
      return 'tap';
    }
    if (touches.length === 2) {
      return 'pinch';
    }
    return null;
  }

  // =========================================================================
  // FEATURE 46: SWIPE TO DELETE TASK
  // =========================================================================
  private swipeDeleteEnabled: boolean = true;
  private swipeDeleteThreshold: number = 150;
  private swipeState: { taskId: string | null; startX: number; currentX: number } =
    { taskId: null, startX: 0, currentX: 0 };

  setSwipeDeleteEnabled(enabled: boolean): void {
    this.swipeDeleteEnabled = enabled;
  }

  startSwipe(taskId: string, startX: number): void {
    if (!this.swipeDeleteEnabled) return;
    this.swipeState = { taskId, startX, currentX: startX };
  }

  updateSwipe(currentX: number): void {
    this.swipeState.currentX = currentX;
    this.markDirty();
  }

  completeSwipe(): string | null {
    const swipeDistance = this.swipeState.currentX - this.swipeState.startX;
    const taskId = this.swipeState.taskId;

    this.swipeState = { taskId: null, startX: 0, currentX: 0 };

    if (Math.abs(swipeDistance) > this.swipeDeleteThreshold && taskId) {
      this.deleteTask(taskId);
      return taskId;
    }

    this.markDirty();
    return null;
  }

  // =========================================================================
  // FEATURE 47: TOUCH FEEDBACK VISUAL (RIPPLE)
  // =========================================================================
  private ripples: Array<{ x: number; y: number; radius: number; opacity: number; startTime: number }> = [];
  private rippleMaxRadius: number = 50;
  private rippleDuration: number = 400;

  createRipple(x: number, y: number): void {
    this.ripples.push({ x, y, radius: 0, opacity: 0.5, startTime: performance.now() });
    this.markDirty();
  }

  updateRipples(): void {
    const now = performance.now();
    this.ripples = this.ripples.filter(ripple => {
      const elapsed = now - ripple.startTime;
      if (elapsed > this.rippleDuration) return false;

      const progress = elapsed / this.rippleDuration;
      ripple.radius = this.rippleMaxRadius * progress;
      ripple.opacity = 0.5 * (1 - progress);
      return true;
    });
  }

  renderRipples(): void {
    this.ripples.forEach(ripple => {
      this.ctx.beginPath();
      this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(99, 102, 241, ${ripple.opacity})`;
      this.ctx.fill();
    });
  }

  // =========================================================================
  // FEATURE 48: HAPTIC FEEDBACK TRIGGERS
  // =========================================================================
  private hapticEnabled: boolean = true;

  setHapticEnabled(enabled: boolean): void {
    this.hapticEnabled = enabled;
  }

  triggerHapticFeedback(intensity: 'light' | 'medium' | 'heavy'): void {
    if (!this.hapticEnabled || !navigator.vibrate) return;

    const durations = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(durations[intensity]);
  }

  hapticOnAction(action: 'select' | 'drag-start' | 'drag-end' | 'delete' | 'error' | 'success'): void {
    const intensities: Record<string, 'light' | 'medium' | 'heavy'> = {
      'select': 'light',
      'drag-start': 'light',
      'drag-end': 'medium',
      'delete': 'heavy',
      'error': 'heavy',
      'success': 'medium'
    };
    this.triggerHapticFeedback(intensities[action] || 'light');
  }

  // =========================================================================
  // FEATURE 49: RESPONSIVE LAYOUT FOR MOBILE
  // =========================================================================
  private currentBreakpoint: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  private breakpoints = { mobile: 640, tablet: 1024 };

  updateResponsiveLayout(): void {
    const width = this.containerWidth;
    if (width < this.breakpoints.mobile) this.currentBreakpoint = 'mobile';
    else if (width < this.breakpoints.tablet) this.currentBreakpoint = 'tablet';
    else this.currentBreakpoint = 'desktop';
    this.markDirty();
  }

  getBreakpoint(): string { return this.currentBreakpoint; }
  isMobileView(): boolean { return this.currentBreakpoint === 'mobile'; }
  isTabletView(): boolean { return this.currentBreakpoint === 'tablet'; }

  getResponsiveRowHeight(): number {
    const heights = { mobile: 50, tablet: 40, desktop: this.config.rowHeight };
    return heights[this.currentBreakpoint];
  }

  // =========================================================================
  // FEATURE 50: PORTRAIT/LANDSCAPE ORIENTATION SUPPORT
  // =========================================================================
  private currentOrientation: 'portrait' | 'landscape' = 'landscape';
  private orientationCallbacks: ((o: 'portrait' | 'landscape') => void)[] = [];

  initializeOrientationDetection(): void {
    this.detectOrientation();
    window.addEventListener('orientationchange', () => setTimeout(() => this.detectOrientation(), 100));
    window.addEventListener('resize', () => this.detectOrientation());
  }

  private detectOrientation(): void {
    const newO: 'portrait' | 'landscape' = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    if (newO !== this.currentOrientation) {
      this.currentOrientation = newO;
      this.orientationCallbacks.forEach(cb => cb(newO));
      this.markDirty();
    }
  }

  onOrientationChange(cb: (o: 'portrait' | 'landscape') => void): () => void {
    this.orientationCallbacks.push(cb);
    return () => { const i = this.orientationCallbacks.indexOf(cb); if (i !== -1) this.orientationCallbacks.splice(i, 1); };
  }

  getOrientation(): 'portrait' | 'landscape' { return this.currentOrientation; }
  isPortrait(): boolean { return this.currentOrientation === 'portrait'; }
  isLandscape(): boolean { return this.currentOrientation === 'landscape'; }

  // =========================================================================
  // FEATURE 51: SCREEN READER ANNOUNCEMENTS
  // =========================================================================
  private screenReaderElement: HTMLElement | null = null;

  initializeScreenReaderSupport(): void {
    this.screenReaderElement = document.createElement('div');
    this.screenReaderElement.setAttribute('role', 'status');
    this.screenReaderElement.setAttribute('aria-live', 'polite');
    this.screenReaderElement.setAttribute('aria-atomic', 'true');
    this.screenReaderElement.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    document.body.appendChild(this.screenReaderElement);
  }

  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.screenReaderElement) return;
    this.screenReaderElement.setAttribute('aria-live', priority);
    this.screenReaderElement.textContent = '';
    setTimeout(() => { if (this.screenReaderElement) this.screenReaderElement.textContent = message; }, 100);
  }

  // =========================================================================
  // FEATURE 52: VIRTUAL KEYBOARD AWARENESS
  // =========================================================================
  private virtualKeyboardHeight: number = 0;
  private virtualKeyboardVisible: boolean = false;

  initializeVirtualKeyboardDetection(): void {
    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.handleVirtualKeyboardChange());
    }
  }

  private handleVirtualKeyboardChange(): void {
    if (!window.visualViewport) return;
    const heightDiff = window.innerHeight - window.visualViewport.height;
    this.virtualKeyboardVisible = heightDiff > 150;
    this.virtualKeyboardHeight = this.virtualKeyboardVisible ? heightDiff : 0;
    this.markDirty();
  }

  isVirtualKeyboardVisible(): boolean { return this.virtualKeyboardVisible; }
  getVirtualKeyboardHeight(): number { return this.virtualKeyboardHeight; }

  // =========================================================================
  // FEATURE 53: SAFE AREA INSETS
  // =========================================================================
  private safeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

  updateSafeAreaInsets(): void {
    const style = getComputedStyle(document.documentElement);
    this.safeAreaInsets = {
      top: parseInt(style.getPropertyValue('--sat') || '0'),
      right: parseInt(style.getPropertyValue('--sar') || '0'),
      bottom: parseInt(style.getPropertyValue('--sab') || '0'),
      left: parseInt(style.getPropertyValue('--sal') || '0')
    };
  }

  getSafeAreaInsets(): { top: number; right: number; bottom: number; left: number } {
    return { ...this.safeAreaInsets };
  }

  // =========================================================================
  // FEATURE 54: TOUCH-FRIENDLY BUTTONS
  // =========================================================================
  private touchButtonSize: number = 44;

  setTouchButtonSize(size: number): void {
    this.touchButtonSize = Math.max(44, size);
  }

  getTouchButtonSize(): number { return this.touchButtonSize; }

  // =========================================================================
  // FEATURE 55: ACCESSIBLE TOUCH TARGETS
  // =========================================================================
  expandTouchTarget(bounds: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
    const minSize = 44;
    let { x, y, width, height } = bounds;
    if (width < minSize) { x -= (minSize - width) / 2; width = minSize; }
    if (height < minSize) { y -= (minSize - height) / 2; height = minSize; }
    return { x, y, width, height };
  }

  // =========================================================================
  // FEATURE 56: PALM REJECTION
  // =========================================================================
  private palmRejectionEnabled: boolean = true;

  setPalmRejectionEnabled(enabled: boolean): void {
    this.palmRejectionEnabled = enabled;
  }

  isPalmTouch(touch: Touch): boolean {
    if (!this.palmRejectionEnabled) return false;
    if ('radiusX' in touch && 'radiusY' in touch) {
      const area = Math.PI * (touch as any).radiusX * (touch as any).radiusY;
      if (area > 50) return true;
    }
    return false;
  }

  // =========================================================================
  // FEATURE 57: STYLUS/PEN SUPPORT
  // =========================================================================
  private currentPointerType: 'mouse' | 'touch' | 'pen' = 'mouse';
  private penPressure: number = 0;

  handlePointerEvent(e: PointerEvent): void {
    this.currentPointerType = e.pointerType as 'mouse' | 'touch' | 'pen';
    this.penPressure = e.pressure;
  }

  getPointerType(): string { return this.currentPointerType; }
  getPenPressure(): number { return this.penPressure; }
  isStylusActive(): boolean { return this.currentPointerType === 'pen'; }

  // =========================================================================
  // FEATURE 58: TASK BAR GRADIENT FILL (ADVANCED)
  // =========================================================================
  private gradientCache: Map<string, CanvasGradient> = new Map();

  getCachedGradient(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, height: number, color: string): CanvasGradient {
    if (!this.gradientCache.has(key)) {
      this.gradientCache.set(key, this.createTaskBarGradient(ctx, x, y, height, color));
    }
    return this.gradientCache.get(key)!;
  }

  clearGradientCache(): void {
    this.gradientCache.clear();
  }

  // =========================================================================
  // FEATURE 59: TASK BAR SHADOW (ADVANCED)
  // =========================================================================
  private shadowCache: Map<string, ImageData> = new Map();

  applyShadowWithCache(ctx: CanvasRenderingContext2D, taskId: string): void {
    if (this.taskBarShadowEnabled) {
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }
  }

  // =========================================================================
  // FEATURE 60: DEPENDENCY LINE ROUTING (ADVANCED)
  // =========================================================================
  private routeCache: Map<string, { x: number; y: number }[]> = new Map();

  getCachedRoute(depId: string, fromTask: GanttTask, toTask: GanttTask, depType: string): { x: number; y: number }[] {
    const cacheKey = `${depId}-${fromTask.startDate.getTime()}-${toTask.startDate.getTime()}`;
    if (!this.routeCache.has(cacheKey)) {
      this.routeCache.set(cacheKey, this.calculateDependencyPath(fromTask, toTask, depType));
    }
    return this.routeCache.get(cacheKey)!;
  }

  invalidateRouteCache(): void {
    this.routeCache.clear();
  }

  // =========================================================================
  // FEATURE 61: TODAY MARKER LINE
  // =========================================================================
  private todayMarkerEnabled: boolean = true;
  private todayMarkerColor: string = '#ef4444';
  private todayMarkerWidth: number = 2;

  setTodayMarkerEnabled(enabled: boolean): void {
    this.todayMarkerEnabled = enabled;
    this.markDirty();
  }

  setTodayMarkerStyle(color: string, width: number): void {
    this.todayMarkerColor = color;
    this.todayMarkerWidth = width;
    this.markDirty();
  }

  isTodayMarkerEnabled(): boolean { return this.todayMarkerEnabled; }

  // =========================================================================
  // FEATURE 62: TODAY MARKER LABEL
  // =========================================================================
  private todayLabelEnabled: boolean = true;
  private todayLabelFormat: string = 'Today';

  setTodayLabelEnabled(enabled: boolean): void {
    this.todayLabelEnabled = enabled;
    this.markDirty();
  }

  setTodayLabelFormat(format: string): void {
    this.todayLabelFormat = format;
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 63: TODAY MARKER PULSING ANIMATION
  // =========================================================================
  private todayMarkerPulseEnabled: boolean = false;
  private todayMarkerPulsePhase: number = 0;

  setTodayMarkerPulse(enabled: boolean): void {
    this.todayMarkerPulseEnabled = enabled;
    if (enabled) this.startPulseAnimation();
    this.markDirty();
  }

  private startPulseAnimation(): void {
    const animate = () => {
      if (!this.todayMarkerPulseEnabled) return;
      this.todayMarkerPulsePhase = (this.todayMarkerPulsePhase + 0.05) % (Math.PI * 2);
      this.markDirty();
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  getTodayMarkerOpacity(): number {
    return this.todayMarkerPulseEnabled ? 0.5 + 0.5 * Math.sin(this.todayMarkerPulsePhase) : 1;
  }

  // =========================================================================
  // FEATURE 64: CUSTOM DATE FORMAT PER ZOOM LEVEL
  // =========================================================================
  private dateFormats: Map<string, Intl.DateTimeFormatOptions> = new Map([
    ['day', { month: 'short', day: 'numeric' }],
    ['week', { month: 'short', day: 'numeric' }],
    ['month', { month: 'short', year: 'numeric' }],
    ['quarter', { month: 'short', year: 'numeric' }],
    ['year', { year: 'numeric' }]
  ]);

  setDateFormat(zoomLevel: string, format: Intl.DateTimeFormatOptions): void {
    this.dateFormats.set(zoomLevel, format);
    this.markDirty();
  }

  getDateFormat(zoomLevel: string): Intl.DateTimeFormatOptions {
    return this.dateFormats.get(zoomLevel) || { month: 'short', day: 'numeric' };
  }

  // =========================================================================
  // FEATURE 65: LOCALE-AWARE DATE FORMATTING
  // =========================================================================
  private locale: string = 'en-AU';

  setLocale(locale: string): void {
    this.locale = locale;
    this.markDirty();
  }

  getLocale(): string { return this.locale; }

  // Note: formatDate already exists in the class - use that method

  // =========================================================================
  // FEATURE 66: ALTERNATING ROW BACKGROUND COLORS
  // =========================================================================
  private alternatingRowsEnabled: boolean = true;
  private evenRowColor: string = 'transparent';
  private oddRowColor: string = 'rgba(0,0,0,0.02)';

  setAlternatingRows(enabled: boolean, evenColor?: string, oddColor?: string): void {
    this.alternatingRowsEnabled = enabled;
    if (evenColor) this.evenRowColor = evenColor;
    if (oddColor) this.oddRowColor = oddColor;
    this.markDirty();
  }

  getRowBackgroundColor(rowIndex: number): string {
    if (!this.alternatingRowsEnabled) return 'transparent';
    return rowIndex % 2 === 0 ? this.evenRowColor : this.oddRowColor;
  }

  // =========================================================================
  // FEATURE 67: ROW HEIGHT CONFIGURATION
  // =========================================================================
  setRowHeight(height: number): void {
    this.config.rowHeight = Math.max(20, Math.min(100, height));
    this.markDirty();
  }

  getRowHeight(): number { return this.config.rowHeight; }

  // =========================================================================
  // FEATURE 68: HEADER HEIGHT CONFIGURATION
  // =========================================================================
  setHeaderHeight(height: number): void {
    this.config.headerHeight = Math.max(30, Math.min(150, height));
    this.markDirty();
  }

  getHeaderHeight(): number { return this.config.headerHeight; }

  // =========================================================================
  // FEATURE 69: STICKY HEADER (STAYS VISIBLE ON SCROLL)
  // =========================================================================
  private stickyHeaderEnabled: boolean = true;

  setStickyHeader(enabled: boolean): void {
    this.stickyHeaderEnabled = enabled;
    this.markDirty();
  }

  isStickyHeaderEnabled(): boolean { return this.stickyHeaderEnabled; }

  // Note: Sticky header is handled in renderHeader() by always drawing at y=0

  // =========================================================================
  // FEATURE 70: TIME SCALE CLICK TO SCROLL TO DATE
  // =========================================================================
  private timeScaleClickEnabled: boolean = true;

  setTimeScaleClickEnabled(enabled: boolean): void {
    this.timeScaleClickEnabled = enabled;
  }

  // Note: handleTimeScaleClick already exists in Feature 25
  // Note: scrollToDate already exists in the class

  // =========================================================================
  // FEATURE 71: TIME SCALE DRAG TO SELECT DATE RANGE
  // =========================================================================
  private dateRangeSelection: { start: Date | null; end: Date | null } = { start: null, end: null };
  private isSelectingDateRange: boolean = false;

  startDateRangeSelection(x: number): void {
    if (!this.timeScaleClickEnabled) return;
    this.isSelectingDateRange = true;
    this.dateRangeSelection.start = this.viewport.xToDate(x);
    this.dateRangeSelection.end = null;
    this.markDirty();
  }

  updateDateRangeSelection(x: number): void {
    if (!this.isSelectingDateRange) return;
    this.dateRangeSelection.end = this.viewport.xToDate(x);
    this.markDirty();
  }

  endDateRangeSelection(): { start: Date; end: Date } | null {
    if (!this.isSelectingDateRange || !this.dateRangeSelection.start || !this.dateRangeSelection.end) {
      this.isSelectingDateRange = false;
      return null;
    }

    const result = {
      start: this.dateRangeSelection.start < this.dateRangeSelection.end ? this.dateRangeSelection.start : this.dateRangeSelection.end,
      end: this.dateRangeSelection.start < this.dateRangeSelection.end ? this.dateRangeSelection.end : this.dateRangeSelection.start
    };

    this.isSelectingDateRange = false;
    this.dateRangeSelection = { start: null, end: null };
    this.markDirty();
    return result;
  }

  getDateRangeSelection(): { start: Date | null; end: Date | null } { return { ...this.dateRangeSelection }; }

  // =========================================================================
  // FEATURE 72: MAJOR/MINOR GRID LINES
  // =========================================================================
  private majorGridLineColor: string = '#e5e7eb';
  private minorGridLineColor: string = '#f3f4f6';
  private majorGridLineWidth: number = 1;
  private minorGridLineWidth: number = 0.5;

  setGridLineStyles(major: { color?: string; width?: number }, minor: { color?: string; width?: number }): void {
    if (major.color) this.majorGridLineColor = major.color;
    if (major.width) this.majorGridLineWidth = major.width;
    if (minor.color) this.minorGridLineColor = minor.color;
    if (minor.width) this.minorGridLineWidth = minor.width;
    this.markDirty();
  }

  isMajorGridLine(date: Date): boolean {
    // Major grid lines at week/month boundaries depending on zoom
    const zoom = this.viewport.getState().zoom;
    if (zoom < 0.5) return date.getDate() === 1; // Month boundaries at low zoom
    return date.getDay() === 1; // Monday at normal zoom
  }

  // =========================================================================
  // FEATURE 73: WORKING HOURS HIGHLIGHTING
  // =========================================================================
  // Note: Working hours properties already exist in Feature 28. This extends that feature.
  private workingHoursHighlightColor: string = 'rgba(34, 197, 94, 0.05)';

  setWorkingHoursHighlightColor(color: string): void {
    this.workingHoursHighlightColor = color;
    this.markDirty();
  }

  getWorkingHoursHighlightColor(): string { return this.workingHoursHighlightColor; }

  // =========================================================================
  // FEATURE 74: NON-WORKING TIME DIMMING
  // =========================================================================
  private nonWorkingDimEnabled: boolean = true;
  private nonWorkingDimColor: string = 'rgba(0, 0, 0, 0.03)';

  setNonWorkingDim(enabled: boolean, color?: string): void {
    this.nonWorkingDimEnabled = enabled;
    if (color) this.nonWorkingDimColor = color;
    this.markDirty();
  }

  isNonWorkingDay(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Weekend
  }

  // =========================================================================
  // FEATURE 75: CUSTOM CALENDAR INTEGRATION
  // =========================================================================
  // Note: setWorkingDays exists in the class via calendar system
  private customHolidays: Set<string> = new Set();

  setCustomHolidays(holidays: Date[]): void {
    this.customHolidays.clear();
    holidays.forEach(d => this.customHolidays.add(d.toISOString().split('T')[0]));
    this.markDirty();
  }

  addHoliday(date: Date): void {
    this.customHolidays.add(date.toISOString().split('T')[0]);
    this.markDirty();
  }

  removeHoliday(date: Date): void {
    this.customHolidays.delete(date.toISOString().split('T')[0]);
    this.markDirty();
  }

  isHoliday(date: Date): boolean {
    return this.customHolidays.has(date.toISOString().split('T')[0]);
  }

  // Note: setWorkingDays exists via this.calendar.setWorkingDays()
  // Use isWorkingDay via the calendar system: this.calendar.isWorkingDay()

  // =========================================================================
  // FEATURE 76: TASK BAR RECTANGLE RENDERING
  // =========================================================================
  // Note: Core task bar rendering is in GanttRenderer. This adds customization.
  private taskBarCornerRadius: number = 4;

  setTaskBarCornerRadius(radius: number): void {
    this.taskBarCornerRadius = Math.max(0, Math.min(20, radius));
    this.markDirty();
  }

  getTaskBarCornerRadius(): number { return this.taskBarCornerRadius; }

  // =========================================================================
  // FEATURE 77: TASK BAR BORDER
  // =========================================================================
  private taskBarBorderWidth: number = 1;
  private taskBarBorderColor: string = 'rgba(0,0,0,0.1)';

  setTaskBarBorder(width: number, color?: string): void {
    this.taskBarBorderWidth = width;
    if (color) this.taskBarBorderColor = color;
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 78: TASK BAR FILL COLOR (STATUS-BASED)
  // =========================================================================
  // Note: getStatusColor already exists in the class. This provides the API config.
  private customStatusColors: Map<string, string> = new Map();

  setCustomStatusColor(status: string, color: string): void {
    this.customStatusColors.set(status, color);
    this.markDirty();
  }

  getCustomStatusColor(status: string): string | undefined {
    return this.customStatusColors.get(status);
  }

  clearCustomStatusColors(): void {
    this.customStatusColors.clear();
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 79: TASK TEXT STYLING
  // =========================================================================
  private taskTextColor: string = '#ffffff';
  private taskTextFont: string = '12px Inter, sans-serif';
  private taskTextPadding: number = 8;

  setTaskTextStyle(color?: string, font?: string, padding?: number): void {
    if (color) this.taskTextColor = color;
    if (font) this.taskTextFont = font;
    if (padding !== undefined) this.taskTextPadding = padding;
    this.markDirty();
  }

  // =========================================================================
  // FEATURE 80: TASK BAR GRADIENT FILL
  // =========================================================================
  // Note: taskBarGradientEnabled, lightenColor, darkenColor exist in Feature 27.
  // This provides direction configuration.
  private gradientDirection: 'vertical' | 'horizontal' = 'vertical';

  setGradientDirection(direction: 'vertical' | 'horizontal'): void {
    this.gradientDirection = direction;
    this.markDirty();
  }

  getGradientDirection(): 'vertical' | 'horizontal' { return this.gradientDirection; }

  // =========================================================================
  // FEATURE 81: TASK BAR SHADOW
  // =========================================================================
  // Note: taskBarShadowEnabled exists in Feature 59. This provides additional shadow config.
  private shadowColor: string = 'rgba(0, 0, 0, 0.15)';
  private shadowBlur: number = 4;
  private shadowOffsetX: number = 2;
  private shadowOffsetY: number = 2;

  setShadowStyle(options: { color?: string; blur?: number; offsetX?: number; offsetY?: number }): void {
    if (options.color) this.shadowColor = options.color;
    if (options.blur !== undefined) this.shadowBlur = options.blur;
    if (options.offsetX !== undefined) this.shadowOffsetX = options.offsetX;
    if (options.offsetY !== undefined) this.shadowOffsetY = options.offsetY;
    this.markDirty();
  }

  getShadowStyle(): { color: string; blur: number; offsetX: number; offsetY: number } {
    return {
      color: this.shadowColor,
      blur: this.shadowBlur,
      offsetX: this.shadowOffsetX,
      offsetY: this.shadowOffsetY
    };
  }

  // =========================================================================
  // FEATURE 82-100: TASK BAR RENDERING HELPERS
  // =========================================================================
  // Note: Core rendering (text, progress, resize handles, hover, selection,
  // icons, opacity, indentation, summary bars) is in GanttRenderer.
  // These provide configuration APIs.

  private taskBarMinWidth: number = 20;
  private progressBarHeight: number = 4;
  // Note: resizeHandleWidth already exists as class property

  setTaskBarMinWidth(width: number): void {
    this.taskBarMinWidth = Math.max(10, width);
    this.markDirty();
  }

  getTaskBarMinWidth(): number { return this.taskBarMinWidth; }

  setProgressBarHeight(height: number): void {
    this.progressBarHeight = Math.max(2, Math.min(20, height));
    this.markDirty();
  }

  getProgressBarHeight(): number { return this.progressBarHeight; }

  // Note: resizeHandleWidth getter/setter - property exists at class level

  // =========================================================================
  // FEATURE 101-106: DEPENDENCY LINE TYPES
  // =========================================================================
  // Note: FS, SS, FF, SF dependency types, bezier curves, and arrow heads
  // are implemented in GanttRenderer. These provide configuration.

  private dependencyLineWidth: number = 2;
  private dependencyArrowSize: number = 8;

  setDependencyLineWidth(width: number): void {
    this.dependencyLineWidth = Math.max(1, Math.min(5, width));
    this.markDirty();
  }

  getDependencyLineWidth(): number { return this.dependencyLineWidth; }

  setDependencyArrowSize(size: number): void {
    this.dependencyArrowSize = Math.max(4, Math.min(16, size));
    this.markDirty();
  }

  getDependencyArrowSize(): number { return this.dependencyArrowSize; }

  // =========================================================================
  // FEATURE 107: DEPENDENCY LINE ROUTING (AVOID TASK BARS)
  // =========================================================================
  private dependencyRoutingEnabled: boolean = false;
  private routingPadding: number = 10;

  setDependencyRouting(enabled: boolean, padding?: number): void {
    this.dependencyRoutingEnabled = enabled;
    if (padding !== undefined) this.routingPadding = padding;
    this.markDirty();
  }

  isDependencyRoutingEnabled(): boolean { return this.dependencyRoutingEnabled; }

  calculateRoutedPath(fromTask: GanttTask, toTask: GanttTask, depType: string): { x: number; y: number }[] {
    if (!this.dependencyRoutingEnabled) {
      return this.calculateDependencyPath(fromTask, toTask, depType);
    }

    // Get basic path points
    const basicPath = this.calculateDependencyPath(fromTask, toTask, depType);

    // Find tasks that might obstruct the path
    const obstructingTasks = this.state.tasks.filter(task => {
      if (task.id === fromTask.id || task.id === toTask.id) return false;
      // Check if task bar intersects with the path bounding box
      const pathMinX = Math.min(...basicPath.map(p => p.x));
      const pathMaxX = Math.max(...basicPath.map(p => p.x));
      const pathMinY = Math.min(...basicPath.map(p => p.y));
      const pathMaxY = Math.max(...basicPath.map(p => p.y));

      const taskX = this.viewport.dateToX(task.startDate);
      const taskEndX = this.viewport.dateToX(task.endDate);
      const taskIndex = this.state.tasks.indexOf(task);
      const taskY = this.viewport.rowToY(taskIndex);

      return taskX < pathMaxX && taskEndX > pathMinX &&
             taskY < pathMaxY && taskY + this.config.rowHeight > pathMinY;
    });

    if (obstructingTasks.length === 0) {
      return basicPath;
    }

    // Route around obstructions by going above or below
    const routedPath: { x: number; y: number }[] = [];
    const start = basicPath[0];
    const end = basicPath[basicPath.length - 1];

    // Determine if we should route above or below
    const midY = (start.y + end.y) / 2;
    const obstacleYs = obstructingTasks.map(t => {
      const idx = this.state.tasks.indexOf(t);
      return this.viewport.rowToY(idx) + this.config.rowHeight / 2;
    });
    const avgObstacleY = obstacleYs.reduce((a, b) => a + b, 0) / obstacleYs.length;

    const routeAbove = midY > avgObstacleY;
    const routeY = routeAbove
      ? Math.min(...obstacleYs) - this.routingPadding - this.config.rowHeight
      : Math.max(...obstacleYs) + this.routingPadding + this.config.rowHeight;

    routedPath.push(start);
    routedPath.push({ x: start.x, y: routeY });
    routedPath.push({ x: end.x, y: routeY });
    routedPath.push(end);

    return routedPath;
  }

  // =========================================================================
  // FEATURE 108-110: DEPENDENCY LABELS AND COLORS
  // =========================================================================
  private showDependencyLag: boolean = true;
  private showDependencyType: boolean = false;

  setShowDependencyLag(show: boolean): void {
    this.showDependencyLag = show;
    this.markDirty();
  }

  setShowDependencyType(show: boolean): void {
    this.showDependencyType = show;
    this.markDirty();
  }

  isShowDependencyLag(): boolean { return this.showDependencyLag; }
  isShowDependencyType(): boolean { return this.showDependencyType; }

}

// ============================================================================
// Types for new APIs
// ============================================================================

// Feature 21: Object Pool Types
export class ObjectPool<T> {
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 100) {
    this.factory = factory;
    this.reset = reset;

    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.factory();
    }
    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool = [];
    this.inUse.clear();
  }

  getStats(): { size: number; available: number; acquired: number } {
    return {
      size: this.pool.length + this.inUse.size,
      available: this.pool.length,
      acquired: this.inUse.size
    };
  }
}

export interface RenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  zIndex?: number;
}

export interface RenderLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  dash: number[];
  zIndex?: number;
}

export interface RenderText {
  x: number;
  y: number;
  text: string;
  color: string;
  font: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  maxWidth?: number;
  zIndex?: number;
}

export interface RenderPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  dash: number[];
  zIndex?: number;
}

export interface RenderBatch {
  rects: RenderRect[];
  lines: RenderLine[];
  texts: RenderText[];
  paths: RenderPath[];
  isCollecting: boolean;
}

export interface TouchState {
  isActive: boolean;
  startTime: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  touches: { x: number; y: number }[];
  gesture: 'tap' | 'pan' | 'pinch' | 'drag-task' | 'longpress' | null;
  pinchStartDistance: number;
  pinchStartZoom: number;
  velocityX: number;
  velocityY: number;
  lastMoveTime: number;
}

export interface DragTooltipState {
  visible: boolean;
  x: number;
  y: number;
  task: GanttTask | null;
  originalDate: Date | null;
  newDate: Date | null;
  duration: number;
  predecessorCount: number;
  successorCount: number;
}

export interface ZoomPreset {
  id: string;
  label: string;
  daysVisible: number;
  zoom: number;
}

export interface ToolbarState {
  zoomPresets: ZoomPreset[];
  currentZoomPreset: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedTaskCount: number;
  totalTaskCount: number;
  visibleTaskCount: number;
  collapsedGroupCount: number;
  criticalPathEnabled: boolean;
  baselineEnabled: boolean;
  minimapVisible: boolean;
}

export interface SnapConfig {
  enabled: boolean;
  snapToDay: boolean;
  snapToWorkingDay: boolean;
  snapToWeekStart: boolean;
  snapToMonthStart: boolean;
  snapThresholdPixels: number;
  showSnapGuides: boolean;
}

export interface SnapGuide {
  type: 'today' | 'task-start' | 'task-end' | 'week-start' | 'month-start';
  x: number;
  label: string;
  taskId?: string;
}

// Note: ContextMenuItem is defined at the top of the file

// Note: ContextMenuItem is defined at the top of the file

export interface PrintOptions {
  title?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  showDependencies?: boolean;
  showProgress?: boolean;
  showDates?: boolean;
}

export interface PDFExportOptions extends PrintOptions {
  filename?: string;
  quality?: number;
  includeTaskList?: boolean;
}

export interface Resource {
  id: string;
  name: string;
  type?: 'person' | 'equipment' | 'material';
  email?: string;
  role?: string;
  color?: string;
  avatar?: string;
  hourlyRate?: number;
  availability?: number; // percentage (0-100)
}

// ============================================================================
// Undo/Redo Types
// ============================================================================

export interface UndoCommand {
  type: string;
  description: string;
  execute: () => void;
  undo: () => void;
}

// ============================================================================
// Keyboard Shortcut Types
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportPNGOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  scale?: number;
}

export interface ExportJSONOptions {
  includeDependencies?: boolean;
  includeProgress?: boolean;
  pretty?: boolean;
}

export interface ExportedGanttData {
  exportedAt: string;
  tasks: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    progress?: number;
    locked?: 'supplierConfirmed' | 'started' | 'manuallyPositioned';
    supplierId?: number;
    supplierName?: string;
  }>;
  dependencies?: Array<{
    id: string;
    fromId: string;
    toId: string;
    type: string;
    lag?: number;
  }>;
  projectStart: string;
  projectEnd: string;
}

// ============================================================================
// Timeline Marker Types
// ============================================================================

export interface TimelineMarker {
  id: string;
  type: 'milestone' | 'deadline' | 'event' | 'custom';
  name: string;
  date: Date;
  color?: string;
  icon?: string;
  showLabel?: boolean;
  description?: string;
}

// ============================================================================
// Feature 14: Reorder Types
// ============================================================================

export interface ReorderState {
  isDragging: boolean;
  sourceIndex: number;
  targetIndex: number;
  dragY: number;
}

// ============================================================================
// Feature 15: Constraint Types
// ============================================================================

export type ConstraintType =
  | 'must-start-on'
  | 'must-finish-on'
  | 'start-no-earlier-than'
  | 'start-no-later-than'
  | 'finish-no-earlier-than'
  | 'finish-no-later-than';

export interface TaskConstraint {
  type: ConstraintType;
  date: Date;
}

export interface ConstraintViolation {
  taskId: string;
  constraintType: ConstraintType;
  constraintDate: Date;
  violationType: 'date-mismatch' | 'too-early' | 'too-late';
  message: string;
}

// Default export
export default GanttCanvas;
