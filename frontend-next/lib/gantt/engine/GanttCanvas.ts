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
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
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

  // Event handlers
  private onTaskClick?: (task: GanttTask) => void;
  private onTaskDoubleClick?: (task: GanttTask) => void;
  private onTaskDrag?: (task: GanttTask, newStartDate: Date) => void;

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
      selectedTaskId: null,
      hoveredTaskId: null,
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
    this.renderer.drawTaskBars(this.state.tasks, this.state.selectedTaskId, this.state.hoveredTaskId);
    this.renderer.drawDependencies(this.state.tasks, this.state.dependencies);

    // Draw drag preview overlay
    if (this.isDragging && this.dragTask && this.dragCurrentDate) {
      this.renderer.drawDragPreview(
        this.dragTask,
        this.dragCurrentDate,
        this.state.tasks.indexOf(this.dragTask)
      );
    }
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('resize', this.handleResize);
  }

  private removeEventListeners(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const task = this.hitTest(e.offsetX, e.offsetY);
    if (task && !task.locked) {
      // Start potential drag
      this.dragTask = task;
      this.dragStartX = e.offsetX;
      this.dragStartDate = new Date(task.startDate);
      this.dragCurrentDate = new Date(task.startDate);
      this.state.selectedTaskId = task.id;
      this.markDirty();
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
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

  private handleDoubleClick = (e: MouseEvent): void => {
    const task = this.hitTest(e.offsetX, e.offsetY);
    if (task) {
      this.onTaskDoubleClick?.(task);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
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
        const newDate = new Date(this.dragStartDate);
        newDate.setDate(newDate.getDate() + daysDelta);

        // Snap to day
        newDate.setHours(0, 0, 0, 0);

        if (this.dragCurrentDate?.getTime() !== newDate.getTime()) {
          this.dragCurrentDate = newDate;
          this.markDirty();
        }
        return;
      }
    }

    // Normal hover handling
    const task = this.hitTest(e.offsetX, e.offsetY);
    const newHoveredId = task?.id || null;

    if (newHoveredId !== this.state.hoveredTaskId) {
      this.state.hoveredTaskId = newHoveredId;
      this.canvas.style.cursor = task ? (task.locked ? 'not-allowed' : 'grab') : 'default';
      this.markDirty();
    }
  };

  private handleMouseLeave = (): void => {
    // Cancel any drag in progress
    if (this.isDragging) {
      this.isDragging = false;
      this.dragTask = null;
      this.dragStartX = 0;
      this.dragStartDate = null;
      this.dragCurrentDate = null;
    }

    if (this.state.hoveredTaskId) {
      this.state.hoveredTaskId = null;
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
}

// Default export
export default GanttCanvas;
