/**
 * InteractionManager - Handles drag, resize, and mouse/touch interactions
 *
 * Responsibilities:
 * - Task dragging (move start/end dates)
 * - Task resizing (change duration)
 * - Progress bar dragging
 * - Dependency creation by drag
 * - Marquee/lasso selection
 * - Hit testing coordination
 *
 * State Machine:
 * ```
 * IDLE -> DRAG_PENDING -> DRAGGING -> IDLE
 *      -> RESIZE_PENDING -> RESIZING -> IDLE
 *      -> PROGRESS_PENDING -> PROGRESS_DRAGGING -> IDLE
 *      -> DEPENDENCY_PENDING -> DEPENDENCY_DRAGGING -> IDLE
 *      -> MARQUEE_PENDING -> MARQUEE_SELECTING -> IDLE
 * ```
 */

import type { GanttTask } from '../GanttCanvas';
import type { SpatialIndex, Rect } from '../spatial/SpatialIndex';
import type { SelectionManager } from './SelectionManager';
import type { RenderCoordinator } from './RenderCoordinator';

// ============================================================================
// Types
// ============================================================================

export type InteractionState =
  | 'idle'
  | 'drag-pending'
  | 'dragging'
  | 'resize-pending'
  | 'resizing'
  | 'progress-pending'
  | 'progress-dragging'
  | 'dependency-pending'
  | 'dependency-dragging'
  | 'marquee-pending'
  | 'marquee-selecting';

export type ResizeEdge = 'left' | 'right' | null;

export interface DragState {
  taskId: string;
  task: GanttTask;
  startX: number;
  startY: number;
  startDate: Date;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
}

export interface ResizeState {
  taskId: string;
  task: GanttTask;
  edge: 'left' | 'right';
  startX: number;
  startDate: Date;
  startEndDate: Date;
  currentX: number;
}

export interface ProgressState {
  taskId: string;
  task: GanttTask;
  startX: number;
  startProgress: number;
  currentProgress: number;
}

export interface DependencyState {
  fromTaskId: string;
  fromTask: GanttTask;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  toTaskId: string | null;
}

export interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  rect: Rect;
}

export interface HitTestResult {
  taskId: string | null;
  task: GanttTask | null;
  edge: ResizeEdge;
  isProgressBar: boolean;
  isConnector: boolean;
  connectorSide: 'left' | 'right' | null;
}

// Event types
export interface DragEvent {
  task: GanttTask;
  originalStartDate: Date;
  newStartDate: Date;
  newEndDate: Date;
  phase: 'start' | 'move' | 'end' | 'cancel';
}

export interface ResizeEvent {
  task: GanttTask;
  edge: 'left' | 'right';
  originalStartDate: Date;
  originalEndDate: Date;
  newStartDate: Date;
  newEndDate: Date;
  phase: 'start' | 'move' | 'end' | 'cancel';
}

export interface ProgressEvent {
  task: GanttTask;
  originalProgress: number;
  newProgress: number;
  phase: 'start' | 'move' | 'end' | 'cancel';
}

export interface DependencyDragEvent {
  fromTask: GanttTask;
  toTask: GanttTask | null;
  phase: 'start' | 'move' | 'end' | 'cancel';
}

export interface MarqueeEvent {
  rect: Rect;
  taskIds: string[];
  phase: 'start' | 'move' | 'end' | 'cancel';
}

type DragCallback = (event: DragEvent) => void;
type ResizeCallback = (event: ResizeEvent) => void;
type ProgressCallback = (event: ProgressEvent) => void;
type DependencyDragCallback = (event: DependencyDragEvent) => void;
type MarqueeCallback = (event: MarqueeEvent) => void;

// ============================================================================
// Configuration
// ============================================================================

export interface InteractionConfig {
  /** Minimum pixels to move before starting drag */
  dragThreshold: number;
  /** Width of resize handle zone in pixels */
  resizeHandleWidth: number;
  /** Height of progress bar in pixels */
  progressBarHeight: number;
  /** Size of dependency connector in pixels */
  connectorSize: number;
  /** Enable touch gestures */
  enableTouch: boolean;
  /** Enable keyboard modifiers */
  enableModifiers: boolean;
}

const DEFAULT_CONFIG: InteractionConfig = {
  dragThreshold: 5,
  resizeHandleWidth: 8,
  progressBarHeight: 4,
  connectorSize: 12,
  enableTouch: true,
  enableModifiers: true,
};

// ============================================================================
// InteractionManager Class
// ============================================================================

export class InteractionManager {
  // Configuration
  private config: InteractionConfig;

  // State
  private state: InteractionState = 'idle';
  private dragState: DragState | null = null;
  private resizeState: ResizeState | null = null;
  private progressState: ProgressState | null = null;
  private dependencyState: DependencyState | null = null;
  private marqueeState: MarqueeState | null = null;

  // Hover state
  private hoveredTaskId: string | null = null;
  private hoveredEdge: ResizeEdge = null;
  private cursorStyle: string = 'default';

  // Dependencies (injected)
  private spatialIndex: SpatialIndex | null = null;
  private selectionManager: SelectionManager | null = null;
  private renderCoordinator: RenderCoordinator | null = null;

  // Task access function
  private getTask: ((id: string) => GanttTask | undefined) | null = null;
  private getTasks: (() => GanttTask[]) | null = null;

  // Coordinate conversion functions
  private xToDate: ((x: number) => Date) | null = null;
  private dateToX: ((date: Date) => number) | null = null;
  private yToRow: ((y: number) => number) | null = null;
  private rowToY: ((row: number) => number) | null = null;

  // Callbacks
  private dragCallbacks: Set<DragCallback> = new Set();
  private resizeCallbacks: Set<ResizeCallback> = new Set();
  private progressCallbacks: Set<ProgressCallback> = new Set();
  private dependencyDragCallbacks: Set<DependencyDragCallback> = new Set();
  private marqueeCallbacks: Set<MarqueeCallback> = new Set();

  // Canvas reference for cursor
  private canvas: HTMLCanvasElement | null = null;

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(config: Partial<InteractionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Set the canvas element for cursor changes
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Set the spatial index for hit testing
   */
  setSpatialIndex(index: SpatialIndex): void {
    this.spatialIndex = index;
  }

  /**
   * Set the selection manager
   */
  setSelectionManager(manager: SelectionManager): void {
    this.selectionManager = manager;
  }

  /**
   * Set the render coordinator
   */
  setRenderCoordinator(coordinator: RenderCoordinator): void {
    this.renderCoordinator = coordinator;
  }

  /**
   * Set task access functions
   */
  setTaskAccessors(
    getTask: (id: string) => GanttTask | undefined,
    getTasks: () => GanttTask[]
  ): void {
    this.getTask = getTask;
    this.getTasks = getTasks;
  }

  /**
   * Set coordinate conversion functions
   */
  setCoordinateConverters(
    xToDate: (x: number) => Date,
    dateToX: (date: Date) => number,
    yToRow: (y: number) => number,
    rowToY: (row: number) => number
  ): void {
    this.xToDate = xToDate;
    this.dateToX = dateToX;
    this.yToRow = yToRow;
    this.rowToY = rowToY;
  }

  // ============================================================================
  // Event Handlers - Mouse
  // ============================================================================

  /**
   * Handle mouse down event
   */
  handleMouseDown(e: MouseEvent, canvasX: number, canvasY: number): void {
    if (this.state !== 'idle') {
      return;
    }

    const hitTest = this.hitTest(canvasX, canvasY);
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // Dependency connector clicked
    if (hitTest.isConnector && hitTest.task) {
      this.startDependencyDrag(hitTest.task, canvasX, canvasY);
      return;
    }

    // Progress bar clicked
    if (hitTest.isProgressBar && hitTest.task) {
      this.startProgressDrag(hitTest.task, canvasX);
      return;
    }

    // Resize edge clicked
    if (hitTest.edge && hitTest.task) {
      this.startResize(hitTest.task, hitTest.edge, canvasX);
      return;
    }

    // Task body clicked
    if (hitTest.task) {
      // Handle selection
      if (this.selectionManager) {
        const modifier = isCtrl ? 'ctrl' : isShift ? 'shift' : 'none';
        this.selectionManager.handleClick(hitTest.task.id, modifier);
      }

      // Start potential drag
      this.startDragPending(hitTest.task, canvasX, canvasY);
      return;
    }

    // Empty space clicked - start marquee or clear selection
    if (!isCtrl && !isShift && this.selectionManager) {
      this.selectionManager.clear();
    }

    this.startMarqueePending(canvasX, canvasY);
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(e: MouseEvent, canvasX: number, canvasY: number): void {
    switch (this.state) {
      case 'idle':
        this.updateHover(canvasX, canvasY);
        break;

      case 'drag-pending':
        if (this.shouldStartDrag(canvasX, canvasY)) {
          this.startDrag();
        }
        break;

      case 'dragging':
        this.updateDrag(canvasX, canvasY);
        break;

      case 'resize-pending':
        if (this.shouldStartResize(canvasX)) {
          this.state = 'resizing';
        }
        break;

      case 'resizing':
        this.updateResize(canvasX);
        break;

      case 'progress-pending':
        this.state = 'progress-dragging';
        break;

      case 'progress-dragging':
        this.updateProgressDrag(canvasX);
        break;

      case 'dependency-pending':
        this.state = 'dependency-dragging';
        break;

      case 'dependency-dragging':
        this.updateDependencyDrag(canvasX, canvasY);
        break;

      case 'marquee-pending':
        if (this.shouldStartMarquee(canvasX, canvasY)) {
          this.state = 'marquee-selecting';
        }
        break;

      case 'marquee-selecting':
        this.updateMarquee(canvasX, canvasY);
        break;
    }
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(e: MouseEvent, canvasX: number, canvasY: number): void {
    switch (this.state) {
      case 'drag-pending':
        // Click without drag
        this.cancelDrag();
        break;

      case 'dragging':
        this.endDrag();
        break;

      case 'resize-pending':
      case 'resizing':
        this.endResize();
        break;

      case 'progress-pending':
      case 'progress-dragging':
        this.endProgressDrag();
        break;

      case 'dependency-pending':
      case 'dependency-dragging':
        this.endDependencyDrag(canvasX, canvasY);
        break;

      case 'marquee-pending':
      case 'marquee-selecting':
        this.endMarquee();
        break;
    }

    this.state = 'idle';
  }

  /**
   * Handle mouse leave event
   */
  handleMouseLeave(): void {
    this.cancel();
    this.hoveredTaskId = null;
    this.hoveredEdge = null;
    this.setCursor('default');
  }

  // ============================================================================
  // Event Handlers - Touch
  // ============================================================================

  /**
   * Handle touch start event
   */
  handleTouchStart(e: TouchEvent, canvasX: number, canvasY: number): void {
    if (!this.config.enableTouch) return;

    // Treat as mouse down
    const fakeEvent = { ctrlKey: false, metaKey: false, shiftKey: false } as MouseEvent;
    this.handleMouseDown(fakeEvent, canvasX, canvasY);
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(e: TouchEvent, canvasX: number, canvasY: number): void {
    if (!this.config.enableTouch) return;

    const fakeEvent = {} as MouseEvent;
    this.handleMouseMove(fakeEvent, canvasX, canvasY);
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(e: TouchEvent, canvasX: number, canvasY: number): void {
    if (!this.config.enableTouch) return;

    const fakeEvent = {} as MouseEvent;
    this.handleMouseUp(fakeEvent, canvasX, canvasY);
  }

  // ============================================================================
  // Public API - State
  // ============================================================================

  /**
   * Get current interaction state
   */
  getState(): InteractionState {
    return this.state;
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.state === 'dragging' || this.state === 'drag-pending';
  }

  /**
   * Check if currently resizing
   */
  isResizing(): boolean {
    return this.state === 'resizing' || this.state === 'resize-pending';
  }

  /**
   * Check if any interaction is active
   */
  isInteracting(): boolean {
    return this.state !== 'idle';
  }

  /**
   * Get the currently dragged task
   */
  getDraggedTask(): GanttTask | null {
    return this.dragState?.task || null;
  }

  /**
   * Get hovered task ID
   */
  getHoveredTaskId(): string | null {
    return this.hoveredTaskId;
  }

  /**
   * Get hovered edge
   */
  getHoveredEdge(): ResizeEdge {
    return this.hoveredEdge;
  }

  /**
   * Get marquee rectangle (for rendering)
   */
  getMarqueeRect(): Rect | null {
    return this.marqueeState?.rect || null;
  }

  /**
   * Get dependency drag line (for rendering)
   */
  getDependencyDragLine(): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
    if (!this.dependencyState) return null;
    return {
      from: { x: this.dependencyState.startX, y: this.dependencyState.startY },
      to: { x: this.dependencyState.currentX, y: this.dependencyState.currentY },
    };
  }

  /**
   * Cancel any active interaction
   */
  cancel(): void {
    switch (this.state) {
      case 'drag-pending':
      case 'dragging':
        this.cancelDrag();
        break;
      case 'resize-pending':
      case 'resizing':
        this.cancelResize();
        break;
      case 'progress-pending':
      case 'progress-dragging':
        this.cancelProgressDrag();
        break;
      case 'dependency-pending':
      case 'dependency-dragging':
        this.cancelDependencyDrag();
        break;
      case 'marquee-pending':
      case 'marquee-selecting':
        this.cancelMarquee();
        break;
    }
    this.state = 'idle';
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  onDrag(callback: DragCallback): () => void {
    this.dragCallbacks.add(callback);
    return () => this.dragCallbacks.delete(callback);
  }

  onResize(callback: ResizeCallback): () => void {
    this.resizeCallbacks.add(callback);
    return () => this.resizeCallbacks.delete(callback);
  }

  onProgressChange(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  onDependencyDrag(callback: DependencyDragCallback): () => void {
    this.dependencyDragCallbacks.add(callback);
    return () => this.dependencyDragCallbacks.delete(callback);
  }

  onMarquee(callback: MarqueeCallback): () => void {
    this.marqueeCallbacks.add(callback);
    return () => this.marqueeCallbacks.delete(callback);
  }

  // ============================================================================
  // Private - Hit Testing
  // ============================================================================

  private hitTest(x: number, y: number): HitTestResult {
    const result: HitTestResult = {
      taskId: null,
      task: null,
      edge: null,
      isProgressBar: false,
      isConnector: false,
      connectorSide: null,
    };

    if (!this.spatialIndex || !this.getTask) {
      return result;
    }

    const hits = this.spatialIndex.queryPoint(x, y);
    if (hits.length === 0) {
      return result;
    }

    // Get the first (topmost) hit
    const taskId = hits[0];
    const task = this.getTask(taskId);
    if (!task) {
      return result;
    }

    result.taskId = taskId;
    result.task = task;

    // Get task bounds
    const bounds = this.spatialIndex.getBounds(taskId);
    if (!bounds) {
      return result;
    }

    // Check for connector (dependency creation)
    const connectorSize = this.config.connectorSize;
    if (x < bounds.x + connectorSize) {
      result.isConnector = true;
      result.connectorSide = 'left';
      return result;
    }
    if (x > bounds.x + bounds.width - connectorSize) {
      result.isConnector = true;
      result.connectorSide = 'right';
      return result;
    }

    // Check for progress bar
    const progressBarHeight = this.config.progressBarHeight;
    if (y > bounds.y + bounds.height - progressBarHeight - 2) {
      result.isProgressBar = true;
      return result;
    }

    // Check for resize edges
    const handleWidth = this.config.resizeHandleWidth;
    if (x < bounds.x + handleWidth) {
      result.edge = 'left';
    } else if (x > bounds.x + bounds.width - handleWidth) {
      result.edge = 'right';
    }

    return result;
  }

  private updateHover(x: number, y: number): void {
    const hitTest = this.hitTest(x, y);

    this.hoveredTaskId = hitTest.taskId;
    this.hoveredEdge = hitTest.edge;

    // Update cursor
    if (hitTest.isConnector) {
      this.setCursor('crosshair');
    } else if (hitTest.isProgressBar) {
      this.setCursor('ew-resize');
    } else if (hitTest.edge) {
      this.setCursor('ew-resize');
    } else if (hitTest.task) {
      this.setCursor('grab');
    } else {
      this.setCursor('default');
    }

    this.renderCoordinator?.markDirty();
  }

  // ============================================================================
  // Private - Drag Operations
  // ============================================================================

  private startDragPending(task: GanttTask, x: number, y: number): void {
    this.state = 'drag-pending';
    this.dragState = {
      taskId: task.id,
      task,
      startX: x,
      startY: y,
      startDate: new Date(task.startDate),
      currentX: x,
      currentY: y,
      deltaX: 0,
      deltaY: 0,
    };
  }

  private shouldStartDrag(x: number, y: number): boolean {
    if (!this.dragState) return false;
    const dx = Math.abs(x - this.dragState.startX);
    const dy = Math.abs(y - this.dragState.startY);
    return dx > this.config.dragThreshold || dy > this.config.dragThreshold;
  }

  private startDrag(): void {
    if (!this.dragState) return;
    this.state = 'dragging';
    this.setCursor('grabbing');

    this.emitDragEvent('start');
  }

  private updateDrag(x: number, y: number): void {
    if (!this.dragState || !this.xToDate) return;

    this.dragState.currentX = x;
    this.dragState.currentY = y;
    this.dragState.deltaX = x - this.dragState.startX;
    this.dragState.deltaY = y - this.dragState.startY;

    this.emitDragEvent('move');
    this.renderCoordinator?.markDirty();
  }

  private endDrag(): void {
    if (!this.dragState) return;
    this.emitDragEvent('end');
    this.dragState = null;
    this.setCursor('default');
  }

  private cancelDrag(): void {
    if (!this.dragState) return;
    this.emitDragEvent('cancel');
    this.dragState = null;
    this.setCursor('default');
  }

  private emitDragEvent(phase: DragEvent['phase']): void {
    if (!this.dragState || !this.xToDate) return;

    const deltaMs = this.dragState.deltaX * (24 * 60 * 60 * 1000 / 50); // Approximate
    const newStartDate = new Date(this.dragState.startDate.getTime() + deltaMs);
    const duration = this.dragState.task.endDate.getTime() - this.dragState.task.startDate.getTime();
    const newEndDate = new Date(newStartDate.getTime() + duration);

    const event: DragEvent = {
      task: this.dragState.task,
      originalStartDate: this.dragState.startDate,
      newStartDate,
      newEndDate,
      phase,
    };

    for (const callback of this.dragCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[InteractionManager] Drag callback error:', e);
      }
    }
  }

  // ============================================================================
  // Private - Resize Operations
  // ============================================================================

  private startResize(task: GanttTask, edge: 'left' | 'right', x: number): void {
    this.state = 'resize-pending';
    this.resizeState = {
      taskId: task.id,
      task,
      edge,
      startX: x,
      startDate: new Date(task.startDate),
      startEndDate: new Date(task.endDate),
      currentX: x,
    };
    this.setCursor('ew-resize');
  }

  private shouldStartResize(x: number): boolean {
    if (!this.resizeState) return false;
    return Math.abs(x - this.resizeState.startX) > this.config.dragThreshold;
  }

  private updateResize(x: number): void {
    if (!this.resizeState) return;
    this.resizeState.currentX = x;
    this.emitResizeEvent('move');
    this.renderCoordinator?.markDirty();
  }

  private endResize(): void {
    if (!this.resizeState) return;
    this.emitResizeEvent('end');
    this.resizeState = null;
    this.setCursor('default');
  }

  private cancelResize(): void {
    if (!this.resizeState) return;
    this.emitResizeEvent('cancel');
    this.resizeState = null;
    this.setCursor('default');
  }

  private emitResizeEvent(phase: ResizeEvent['phase']): void {
    if (!this.resizeState) return;

    const event: ResizeEvent = {
      task: this.resizeState.task,
      edge: this.resizeState.edge,
      originalStartDate: this.resizeState.startDate,
      originalEndDate: this.resizeState.startEndDate,
      newStartDate: this.resizeState.startDate, // Would be calculated
      newEndDate: this.resizeState.startEndDate, // Would be calculated
      phase,
    };

    for (const callback of this.resizeCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[InteractionManager] Resize callback error:', e);
      }
    }
  }

  // ============================================================================
  // Private - Progress Operations
  // ============================================================================

  private startProgressDrag(task: GanttTask, x: number): void {
    this.state = 'progress-pending';
    this.progressState = {
      taskId: task.id,
      task,
      startX: x,
      startProgress: task.progress || 0,
      currentProgress: task.progress || 0,
    };
    this.setCursor('ew-resize');
  }

  private updateProgressDrag(x: number): void {
    if (!this.progressState || !this.spatialIndex) return;

    const bounds = this.spatialIndex.getBounds(this.progressState.taskId);
    if (!bounds) return;

    const relativeX = x - bounds.x;
    const progress = Math.max(0, Math.min(100, (relativeX / bounds.width) * 100));
    this.progressState.currentProgress = Math.round(progress);

    this.emitProgressEvent('move');
    this.renderCoordinator?.markDirty();
  }

  private endProgressDrag(): void {
    if (!this.progressState) return;
    this.emitProgressEvent('end');
    this.progressState = null;
    this.setCursor('default');
  }

  private cancelProgressDrag(): void {
    if (!this.progressState) return;
    this.emitProgressEvent('cancel');
    this.progressState = null;
    this.setCursor('default');
  }

  private emitProgressEvent(phase: ProgressEvent['phase']): void {
    if (!this.progressState) return;

    const event: ProgressEvent = {
      task: this.progressState.task,
      originalProgress: this.progressState.startProgress,
      newProgress: this.progressState.currentProgress,
      phase,
    };

    for (const callback of this.progressCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[InteractionManager] Progress callback error:', e);
      }
    }
  }

  // ============================================================================
  // Private - Dependency Drag Operations
  // ============================================================================

  private startDependencyDrag(task: GanttTask, x: number, y: number): void {
    this.state = 'dependency-pending';
    this.dependencyState = {
      fromTaskId: task.id,
      fromTask: task,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      toTaskId: null,
    };
    this.setCursor('crosshair');
  }

  private updateDependencyDrag(x: number, y: number): void {
    if (!this.dependencyState) return;

    this.dependencyState.currentX = x;
    this.dependencyState.currentY = y;

    // Find target task
    const hitTest = this.hitTest(x, y);
    this.dependencyState.toTaskId = hitTest.taskId !== this.dependencyState.fromTaskId
      ? hitTest.taskId
      : null;

    this.emitDependencyDragEvent('move');
    this.renderCoordinator?.markDirty();
  }

  private endDependencyDrag(x: number, y: number): void {
    if (!this.dependencyState) return;

    const hitTest = this.hitTest(x, y);
    if (hitTest.task && hitTest.taskId !== this.dependencyState.fromTaskId) {
      this.dependencyState.toTaskId = hitTest.taskId;
    }

    this.emitDependencyDragEvent('end');
    this.dependencyState = null;
    this.setCursor('default');
  }

  private cancelDependencyDrag(): void {
    if (!this.dependencyState) return;
    this.emitDependencyDragEvent('cancel');
    this.dependencyState = null;
    this.setCursor('default');
  }

  private emitDependencyDragEvent(phase: DependencyDragEvent['phase']): void {
    if (!this.dependencyState) return;

    const toTask = this.dependencyState.toTaskId && this.getTask
      ? this.getTask(this.dependencyState.toTaskId) || null
      : null;

    const event: DependencyDragEvent = {
      fromTask: this.dependencyState.fromTask,
      toTask,
      phase,
    };

    for (const callback of this.dependencyDragCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[InteractionManager] Dependency drag callback error:', e);
      }
    }
  }

  // ============================================================================
  // Private - Marquee Operations
  // ============================================================================

  private startMarqueePending(x: number, y: number): void {
    this.state = 'marquee-pending';
    this.marqueeState = {
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      rect: { x, y, width: 0, height: 0 },
    };
  }

  private shouldStartMarquee(x: number, y: number): boolean {
    if (!this.marqueeState) return false;
    const dx = Math.abs(x - this.marqueeState.startX);
    const dy = Math.abs(y - this.marqueeState.startY);
    return dx > this.config.dragThreshold || dy > this.config.dragThreshold;
  }

  private updateMarquee(x: number, y: number): void {
    if (!this.marqueeState) return;

    this.marqueeState.currentX = x;
    this.marqueeState.currentY = y;

    // Calculate rect (handle negative dimensions)
    const minX = Math.min(this.marqueeState.startX, x);
    const minY = Math.min(this.marqueeState.startY, y);
    const maxX = Math.max(this.marqueeState.startX, x);
    const maxY = Math.max(this.marqueeState.startY, y);

    this.marqueeState.rect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    // Find tasks in marquee
    const taskIds = this.spatialIndex?.queryRect(this.marqueeState.rect) || [];

    this.emitMarqueeEvent('move', taskIds);
    this.renderCoordinator?.markDirty();
  }

  private endMarquee(): void {
    if (!this.marqueeState) return;

    const taskIds = this.spatialIndex?.queryRect(this.marqueeState.rect) || [];

    // Select tasks in marquee
    if (this.selectionManager && taskIds.length > 0) {
      this.selectionManager.addMultiple(taskIds);
    }

    this.emitMarqueeEvent('end', taskIds);
    this.marqueeState = null;
  }

  private cancelMarquee(): void {
    if (!this.marqueeState) return;
    this.emitMarqueeEvent('cancel', []);
    this.marqueeState = null;
  }

  private emitMarqueeEvent(phase: MarqueeEvent['phase'], taskIds: string[]): void {
    if (!this.marqueeState) return;

    const event: MarqueeEvent = {
      rect: this.marqueeState.rect,
      taskIds,
      phase,
    };

    for (const callback of this.marqueeCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[InteractionManager] Marquee callback error:', e);
      }
    }
  }

  // ============================================================================
  // Private - Utilities
  // ============================================================================

  private setCursor(cursor: string): void {
    if (this.cursorStyle === cursor) return;
    this.cursorStyle = cursor;
    if (this.canvas) {
      this.canvas.style.cursor = cursor;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.cancel();
    this.dragCallbacks.clear();
    this.resizeCallbacks.clear();
    this.progressCallbacks.clear();
    this.dependencyDragCallbacks.clear();
    this.marqueeCallbacks.clear();
    this.spatialIndex = null;
    this.selectionManager = null;
    this.renderCoordinator = null;
    this.canvas = null;
  }
}

export default InteractionManager;
