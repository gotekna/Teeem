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

// ============================================================================
// Types
// ============================================================================

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress?: number;
  status?: 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'at-risk';
  locked?: 'supplierConfirmed' | 'started' | 'manuallyPositioned';
  predecessorIds?: string[];
  supplierId?: number;
  supplierName?: string;
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

  // Event handlers
  private onTaskClick?: (task: GanttTask) => void;
  private onTaskDoubleClick?: (task: GanttTask) => void;
  private onTaskDrag?: (task: GanttTask, newStartDate: Date) => void;
  private onTaskDelete?: (task: GanttTask) => void;
  private onTaskResize?: (task: GanttTask, newStartDate: Date, newEndDate: Date) => void;
  private onDependencyCreate?: (fromTaskId: string, toTaskId: string, type: 'FS' | 'SS' | 'FF' | 'SF') => void;
  private onUndoStateChange?: (canUndo: boolean, canRedo: boolean) => void;

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
  }

  /**
   * Set the dependencies between tasks
   */
  setDependencies(dependencies: GanttDependency[]): void {
    this.state.dependencies = dependencies;
    this.markDirty();
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
   * Scroll to a specific task
   */
  scrollToTask(taskId: string): void {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskIndex = this.state.tasks.indexOf(task);
    const y = taskIndex * this.config.rowHeight;
    const x = this.viewport.dateToX(task.startDate);

    this.viewport.scrollTo(x - 100, y - 100);
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

  private markDirty(): void {
    this.isDirty = true;
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

    // Draw layers in order
    this.renderer.drawBackground(this.containerWidth, this.containerHeight);
    this.renderer.drawGrid(this.containerWidth, this.containerHeight, this.state.tasks.length);
    this.renderer.drawTimeScale(this.containerWidth);
    this.renderer.drawTodayMarker(this.containerHeight);
    this.renderer.drawTaskBars(this.state.tasks, this.state.selectedTaskIds, this.state.hoveredTaskId, this.state.hoveredEdge);
    this.renderer.drawDependencies(this.state.tasks, this.state.dependencies, this.state.lastSelectedTaskId);

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

    // Draw tooltip for hovered task (only when not dragging/resizing)
    if (this.state.hoveredTaskId && !this.isDragging && !this.isResizing) {
      const hoveredTask = this.state.tasks.find(t => t.id === this.state.hoveredTaskId);
      if (hoveredTask) {
        this.renderer.drawTooltip(hoveredTask, this.mouseX, this.mouseY, this.containerWidth);
      }
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
    window.removeEventListener('resize', this.handleResize);
  }

  private handleMouseDown = (e: MouseEvent): void => {
    // Focus canvas for keyboard events
    this.canvas.focus();

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
  }

  private handleMouseUp = (e: MouseEvent): void => {
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
        this.state.selectedTaskIds.clear();
        this.state.lastSelectedTaskId = null;
        this.markDirty();
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
    }
  };

  /**
   * Snap date to a working day (skip weekends)
   * @param date - The date to snap
   * @param forward - If true, snap forward to next working day; if false, snap backward
   */
  private snapToWorkingDay(date: Date, forward: boolean = true): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek === 0) {
      // Sunday -> Monday (forward) or Friday (backward)
      result.setDate(result.getDate() + (forward ? 1 : -2));
    } else if (dayOfWeek === 6) {
      // Saturday -> Monday (forward) or Friday (backward)
      result.setDate(result.getDate() + (forward ? 2 : -1));
    }

    return result;
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
}

// Default export
export default GanttCanvas;
