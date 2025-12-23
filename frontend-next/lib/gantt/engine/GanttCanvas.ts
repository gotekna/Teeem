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
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
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
}

// Default export
export default GanttCanvas;
