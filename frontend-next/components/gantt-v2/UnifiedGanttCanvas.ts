/**
 * UnifiedGanttCanvas - Unified Canvas Engine for Gantt Chart
 *
 * This is the core canvas engine that draws EVERYTHING:
 * - Left side: Table columns (backgrounds, text, grid)
 * - Right side: Timeline (bars, dependencies, today marker)
 *
 * Key difference from old GanttCanvas.ts:
 * - Single canvas draws both table AND timeline
 * - No scroll sync needed - this component owns all scrolling
 * - React overlays positioned by coordinates from this engine
 *
 * @see TEEEM_DOCS/GANTT_FEATURE_INVENTORY.md - 148 features to preserve
 * @see TEEEM_DOCS/GANTT_BUSINESS_RULES.md - 31 rules that must not break
 */

import { GanttTask, GanttDependency, GanttConfig, GanttColors, isHeaderRow } from '@/lib/gantt/types';
import { getTodayInCompanyTimezone } from '@/lib/stores/company-settings-store';
import { calculateCriticalPath, type CriticalPathResult } from '@/lib/gantt/engine/CriticalPath';

// =============================================================================
// Types
// =============================================================================

/** Callback types for engine events */
export interface UnifiedGanttCallbacks {
  /** Called when viewport changes (scroll, zoom) */
  onViewportChange?: (viewport: ViewportState) => void;
  /** Called when overlay positions need updating */
  onOverlayPositionsChange?: (positions: OverlayPosition[]) => void;
  /** Called when visible row range changes */
  onVisibleRangeChange?: (range: { start: number; end: number }) => void;
  /** Called when selection changes */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Called when a task is clicked */
  onTaskClick?: (task: GanttTask, event: MouseEvent) => void;
  /** Called when a task is double-clicked */
  onTaskDoubleClick?: (task: GanttTask, event: MouseEvent) => void;
  /** Called when a task is dragged to a new date */
  onTaskDrag?: (task: GanttTask, newStartDate: Date) => void;
  /** Called when a task is resized (start or end date changed) */
  onTaskResize?: (task: GanttTask, newStartDate: Date, newEndDate: Date) => void;
  /** Called when columns change (reorder, resize, visibility) */
  onColumnsChange?: (columns: TableColumn[]) => void;
  /** Called when collapsed headers change */
  onCollapsedChange?: (collapsedIds: Set<string>) => void;
  /** Called when dependency column is clicked */
  onDependencyClick?: (task: GanttTask, event: MouseEvent) => void;
  /** Called when right-click context menu is requested */
  onContextMenu?: (task: GanttTask | null, x: number, y: number, event: MouseEvent) => void;
  /** Called when a dependency is created via drag */
  onDependencyCreate?: (fromTaskId: string, toTaskId: string, type: 'FS' | 'SS' | 'FF' | 'SF') => void;
  /** Called when task progress is changed via drag */
  onProgressChange?: (task: GanttTask, newProgress: number) => void;
  /** Called when dependency popup should be shown (dragging over target task) */
  onDependencyPopupShow?: (fromTaskId: string, toTaskId: string, x: number, y: number) => void;
  /** Called when dependency popup should be hidden */
  onDependencyPopupHide?: () => void;
  /** Called when a cell should be edited (double-click on editable column) */
  onCellEdit?: (task: GanttTask, columnId: string, field: string, currentValue: unknown, cellRect: { x: number; y: number; width: number; height: number }) => void;
}

/** Drag operation type */
type DragOperation =
  | { type: 'none' }
  | { type: 'column-resize'; columnId: string; startX: number; startWidth: number }
  | { type: 'column-reorder'; columnId: string; startX: number; currentX: number }
  | { type: 'task-move'; taskId: string; startX: number; startDate: Date }
  | { type: 'task-resize'; taskId: string; edge: 'left' | 'right'; startX: number; originalStart: Date; originalEnd: Date }
  | { type: 'marquee'; startX: number; startY: number; currentX: number; currentY: number }
  | { type: 'pan'; startX: number; startY: number }
  | { type: 'dependency-create'; fromTaskId: string; fromX: number; fromY: number; currentX: number; currentY: number }
  | { type: 'progress-drag'; taskId: string; barStartX: number; barWidth: number; originalProgress: number };

/** Viewport state */
export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** Position info for React overlays */
export interface OverlayPosition {
  taskId: string;
  rowIndex: number;
  y: number;
  checkboxes: Array<{
    x: number;
    width: number;
    field: string;
    checked: boolean;
  }>;
}

/** Column configuration for table side */
export interface TableColumn {
  id: string;
  label: string;
  width: number;
  minWidth?: number;
  visible: boolean;
  type: 'text' | 'checkbox' | 'number' | 'action' | 'date';
  field?: string;
  /** Alignment for text rendering */
  align?: 'left' | 'center' | 'right';
}

/** Configuration extending base GanttConfig */
export interface UnifiedGanttConfig extends Partial<GanttConfig> {
  /** Width of the table section (left side) */
  tableWidth?: number;
  /** Columns to display in table */
  columns?: TableColumn[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const LIGHT_COLORS: GanttColors = {
  background: '#ffffff',
  gridLines: '#e5e7eb',
  todayMarker: '#ef4444',
  weekendBackground: '#f9fafb',
  taskBar: {
    notStarted: '#9ca3af',
    inProgress: '#3b82f6',
    completed: '#10b981',
    onHold: '#f59e0b',
    atRisk: '#ef4444',
  },
  taskBarBorder: '#6b7280',
  taskBarText: '#1f2937',
  headerBackground: '#f3f4f6',
  headerText: '#374151',
  selectedRow: '#dbeafe',
  hoverRow: '#f3f4f6',
  borderColor: '#e5e7eb',
  textColor: '#1f2937',
  headerRowBackground: 'rgba(251, 191, 36, 0.15)',
  childRowBackground: 'rgba(251, 191, 36, 0.08)',
};

const DARK_COLORS: GanttColors = {
  background: '#1f2937',
  gridLines: '#374151',
  todayMarker: '#ef4444',
  weekendBackground: '#111827',
  taskBar: {
    notStarted: '#6b7280',
    inProgress: '#3b82f6',
    completed: '#10b981',
    onHold: '#f59e0b',
    atRisk: '#ef4444',
  },
  taskBarBorder: '#4b5563',
  taskBarText: '#f9fafb',
  headerBackground: '#111827',
  headerText: '#e5e7eb',
  selectedRow: '#1e3a5f',
  hoverRow: '#374151',
  borderColor: '#4b5563',
  textColor: '#e5e7eb',
  headerRowBackground: 'rgba(251, 191, 36, 0.2)',
  childRowBackground: 'rgba(251, 191, 36, 0.1)',
};

const DEFAULT_COLORS = LIGHT_COLORS;

/** Left padding for table area to prevent left edge clipping */
const TABLE_LEFT_PADDING = 4;

const DEFAULT_COLUMNS: TableColumn[] = [
  // Row number (not in original but useful)
  { id: 'row_number', label: '#', width: 40, visible: true, type: 'text' },
  // Name - always visible (permanent)
  { id: 'name', label: 'Name', width: 242, minWidth: 100, visible: true, type: 'text', field: 'name' },
  // Status checkboxes - hidden by default
  { id: 'started', label: '▶', width: 24, visible: false, type: 'checkbox', field: 'started' },
  { id: 'hold', label: '📌', width: 24, visible: false, type: 'checkbox', field: 'hold' },
  { id: 'confirm', label: '✓', width: 24, visible: false, type: 'checkbox', field: 'confirm' },
  { id: 'supplier_confirm', label: 'S✓', width: 24, visible: false, type: 'checkbox', field: 'supplier_confirm' },
  { id: 'is_completed', label: '✓', width: 24, visible: false, type: 'checkbox', field: 'is_completed' },
  // Dependencies (action column - click opens editor) - Show "34 FS, 35 SS" format
  { id: 'dependencies', label: 'Deps', width: 80, visible: true, type: 'action', field: 'predecessor_display' },
  // Duration (editable number)
  { id: 'duration', label: 'Days', width: 50, visible: true, type: 'number', field: 'duration_days' },
  // Supplier info
  { id: 'supplier', label: 'Supplier', width: 100, visible: true, type: 'text', field: 'supplier_name' },
  { id: 'poNumber', label: 'PO #', width: 70, visible: true, type: 'text', field: 'purchase_order_number' },
  // Role
  { id: 'role', label: 'Role', width: 90, visible: true, type: 'text', field: 'assigned_role' },
  // Hidden by default
  { id: 'startDate', label: 'Start', width: 80, visible: false, type: 'date', field: 'start_date' },
  { id: 'endDate', label: 'End', width: 80, visible: false, type: 'date', field: 'end_date' },
  { id: 'progress', label: '%', width: 50, visible: false, type: 'number', field: 'progress_percentage' },
  { id: 'status', label: 'Status', width: 80, visible: false, type: 'text', field: 'status' },
];

// =============================================================================
// UnifiedGanttCanvas Class
// =============================================================================

export class UnifiedGanttCanvas {
  // Canvas and context
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Configuration
  private config: Required<GanttConfig>;
  private tableWidth: number;
  private columns: TableColumn[];
  private callbacks: UnifiedGanttCallbacks;

  // Data
  private tasks: GanttTask[] = [];
  private dependencies: GanttDependency[] = [];

  // Viewport state
  private scrollX: number = 0;
  private scrollY: number = 0;
  private zoom: number = 1;
  private startDate: Date;

  // Container dimensions
  private width: number = 0;
  private height: number = 0;

  // Interaction state
  private selectedTaskIds: Set<string> = new Set();
  private lastSelectedTaskId: string | null = null; // For shift+click range selection
  private hoveredTaskId: string | null = null;
  private hoveredColumnEdge: { columnId: string; edge: 'left' | 'right' } | null = null;
  private showDependencies: boolean = true;

  // Drag state
  private dragOperation: DragOperation = { type: 'none' };

  // Pending dependency creation (waiting for popup type selection)
  private pendingDependency: { fromTaskId: string; toTaskId: string } | null = null;

  // Header collapse state
  private collapsedHeaderIds: Set<string> = new Set();

  // Filter state
  private searchQuery: string = '';
  private showGroupedOnly: boolean = false;
  private filteredTaskIds: Set<string> | null = null; // null = show all

  // Critical path state
  private criticalPathEnabled: boolean = false;
  private criticalPathResult: CriticalPathResult | null = null;
  private criticalTaskIds: Set<string> = new Set();

  // Baseline state
  private baselineEnabled: boolean = false;
  private baselines: Map<string, { startDate: Date; endDate: Date }> = new Map();

  // Holiday state
  private holidays: Map<string, string> = new Map(); // date string (YYYY-MM-DD) -> holiday name

  // Minimap state
  private minimapEnabled: boolean = false;
  private minimapBounds: { x: number; y: number; width: number; height: number } | null = null;

  // Visible tasks (after filtering and collapsing)
  private visibleTasks: GanttTask[] = [];

  // Selected group header (for highlighting)
  private selectedGroupHeaderId: string | null = null;

  // Animation
  private animationFrameId: number | null = null;
  private isDirty: boolean = true;

  // =============================================================================
  // Constructor
  // =============================================================================

  constructor(
    canvas: HTMLCanvasElement,
    options: UnifiedGanttConfig & UnifiedGanttCallbacks = {}
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;

    // Extract callbacks
    this.callbacks = {
      onViewportChange: options.onViewportChange,
      onOverlayPositionsChange: options.onOverlayPositionsChange,
      onVisibleRangeChange: options.onVisibleRangeChange,
      onSelectionChange: options.onSelectionChange,
      onTaskClick: options.onTaskClick,
      onTaskDoubleClick: options.onTaskDoubleClick,
      onTaskDrag: options.onTaskDrag,
      onTaskResize: options.onTaskResize,
      onColumnsChange: options.onColumnsChange,
      onCollapsedChange: options.onCollapsedChange,
      onDependencyClick: options.onDependencyClick,
      onContextMenu: options.onContextMenu,
      onDependencyCreate: options.onDependencyCreate,
      onProgressChange: options.onProgressChange,
      onDependencyPopupShow: options.onDependencyPopupShow,
      onDependencyPopupHide: options.onDependencyPopupHide,
      onCellEdit: options.onCellEdit,
    };

    // Build config with defaults
    const isDarkMode = options.darkMode ?? false;
    const baseColors = isDarkMode ? DARK_COLORS : LIGHT_COLORS;
    this.config = {
      rowHeight: options.rowHeight ?? 28,
      headerHeight: options.headerHeight ?? 50,
      taskBarHeight: options.taskBarHeight ?? 18,
      taskBarPadding: options.taskBarPadding ?? 5,
      dayWidth: options.dayWidth ?? 25,
      minDayWidth: options.minDayWidth ?? 10,
      maxDayWidth: options.maxDayWidth ?? 100,
      colors: { ...baseColors, ...options.colors },
      darkMode: isDarkMode,
    };

    this.columns = options.columns ?? [...DEFAULT_COLUMNS];
    // Calculate table width from visible columns (or use override)
    // Add TABLE_LEFT_PADDING to account for left edge spacing
    this.tableWidth = (options.tableWidth ?? this.columns
      .filter((c) => c.visible)
      .reduce((sum, c) => sum + c.width, 0)) + TABLE_LEFT_PADDING;

    // Initialize start date to today
    this.startDate = getTodayInCompanyTimezone();
    // Go back 1 week for buffer
    this.startDate.setDate(this.startDate.getDate() - 7);

    // Setup canvas
    this.setupCanvas();

    // Bind event handlers
    this.bindEvents();

    // Start render loop
    this.startRenderLoop();
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /** Set tasks data */
  setTasks(tasks: GanttTask[]): void {
    this.tasks = tasks;
    this.recalculateVisibleTasks();
    this.calculateDateRange();
    // Recalculate critical path if enabled
    if (this.criticalPathEnabled) {
      this.recalculateCriticalPath();
    }
    this.markDirty();
  }

  /** Set dependencies data */
  setDependencies(dependencies: GanttDependency[]): void {
    this.dependencies = dependencies;
    // Recalculate critical path if enabled
    if (this.criticalPathEnabled) {
      this.recalculateCriticalPath();
    }
    this.markDirty();
  }

  /** Toggle dependency visibility */
  setShowDependencies(show: boolean): void {
    this.showDependencies = show;
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Header Collapse/Expand
  // ---------------------------------------------------------------------------

  /** Toggle header collapse state */
  toggleHeaderCollapse(taskId: string): void {
    if (this.collapsedHeaderIds.has(taskId)) {
      this.collapsedHeaderIds.delete(taskId);
    } else {
      this.collapsedHeaderIds.add(taskId);
    }
    this.recalculateVisibleTasks();
    this.callbacks.onCollapsedChange?.(new Set(this.collapsedHeaderIds));
    this.markDirty();
  }

  /** Collapse all headers */
  collapseAll(): void {
    for (const task of this.tasks) {
      if (this.isHeaderTask(task)) {
        this.collapsedHeaderIds.add(task.id);
      }
    }
    this.recalculateVisibleTasks();
    this.callbacks.onCollapsedChange?.(new Set(this.collapsedHeaderIds));
    this.markDirty();
  }

  /** Expand all headers */
  expandAll(): void {
    this.collapsedHeaderIds.clear();
    this.recalculateVisibleTasks();
    this.callbacks.onCollapsedChange?.(new Set(this.collapsedHeaderIds));
    this.markDirty();
  }

  /** Check if a header is collapsed */
  isHeaderCollapsed(taskId: string): boolean {
    return this.collapsedHeaderIds.has(taskId);
  }

  // ---------------------------------------------------------------------------
  // Search & Filter
  // ---------------------------------------------------------------------------

  /** Set search query (filters by task name) */
  setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase().trim();
    this.recalculateVisibleTasks();
    this.markDirty();
  }

  /** Toggle grouped-only filter */
  setShowGroupedOnly(show: boolean): void {
    this.showGroupedOnly = show;
    this.recalculateVisibleTasks();
    this.markDirty();
  }

  /** Get current search query */
  getSearchQuery(): string {
    return this.searchQuery;
  }

  /** Get grouped-only state */
  getShowGroupedOnly(): boolean {
    return this.showGroupedOnly;
  }

  // ---------------------------------------------------------------------------
  // Critical Path
  // ---------------------------------------------------------------------------

  /** Enable or disable critical path highlighting */
  setCriticalPathEnabled(enabled: boolean): void {
    this.criticalPathEnabled = enabled;
    if (enabled) {
      this.recalculateCriticalPath();
    } else {
      this.criticalPathResult = null;
      this.criticalTaskIds.clear();
    }
    this.markDirty();
  }

  /** Toggle critical path highlighting */
  toggleCriticalPath(): void {
    this.setCriticalPathEnabled(!this.criticalPathEnabled);
  }

  /** Check if critical path highlighting is enabled */
  isCriticalPathEnabled(): boolean {
    return this.criticalPathEnabled;
  }

  /** Get the current critical path result */
  getCriticalPathResult(): CriticalPathResult | null {
    return this.criticalPathResult;
  }

  /** Check if a task is on the critical path */
  isOnCriticalPath(taskId: string): boolean {
    return this.criticalTaskIds.has(taskId);
  }

  /** Recalculate the critical path */
  private recalculateCriticalPath(): void {
    if (!this.criticalPathEnabled || this.tasks.length === 0) {
      this.criticalPathResult = null;
      this.criticalTaskIds.clear();
      return;
    }

    try {
      this.criticalPathResult = calculateCriticalPath(this.tasks, this.dependencies);
      this.criticalTaskIds = new Set(this.criticalPathResult.criticalTasks);
    } catch (error) {
      console.error('[UnifiedGanttCanvas] Critical path calculation failed:', error);
      this.criticalPathResult = null;
      this.criticalTaskIds.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // Baseline Comparison
  // ---------------------------------------------------------------------------

  /** Enable or disable baseline comparison display */
  setBaselineEnabled(enabled: boolean): void {
    this.baselineEnabled = enabled;
    this.markDirty();
  }

  /** Toggle baseline comparison display */
  toggleBaseline(): void {
    this.setBaselineEnabled(!this.baselineEnabled);
  }

  /** Check if baseline comparison is enabled */
  isBaselineEnabled(): boolean {
    return this.baselineEnabled;
  }

  /** Set baselines data (task ID -> baseline dates) */
  setBaselines(baselines: Map<string, { startDate: Date; endDate: Date }>): void {
    this.baselines = baselines;
    this.markDirty();
  }

  /** Capture current task dates as baseline */
  captureBaseline(): Map<string, { startDate: Date; endDate: Date }> {
    const baseline = new Map<string, { startDate: Date; endDate: Date }>();
    for (const task of this.tasks) {
      baseline.set(task.id, {
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
      });
    }
    this.baselines = baseline;
    this.baselineEnabled = true;
    this.markDirty();
    return baseline;
  }

  /** Get baseline for a task */
  getBaseline(taskId: string): { startDate: Date; endDate: Date } | undefined {
    return this.baselines.get(taskId);
  }

  /** Clear all baselines */
  clearBaselines(): void {
    this.baselines.clear();
    this.baselineEnabled = false;
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Holiday Management
  // ---------------------------------------------------------------------------

  /** Add holidays to the calendar */
  addHolidays(holidays: Array<{ date: Date; name: string }>): void {
    for (const holiday of holidays) {
      const dateKey = this.formatDateKey(holiday.date);
      this.holidays.set(dateKey, holiday.name);
    }
    this.markDirty();
  }

  /** Clear all holidays */
  clearHolidays(): void {
    this.holidays.clear();
    this.markDirty();
  }

  /** Check if a date is a holiday */
  isHoliday(date: Date): boolean {
    return this.holidays.has(this.formatDateKey(date));
  }

  /** Get holiday name for a date */
  getHolidayName(date: Date): string | undefined {
    return this.holidays.get(this.formatDateKey(date));
  }

  /** Format date as YYYY-MM-DD key */
  private formatDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Check if a date is a weekend */
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  // ---------------------------------------------------------------------------
  // Minimap Navigation
  // ---------------------------------------------------------------------------

  /** Enable or disable minimap display */
  setMinimapEnabled(enabled: boolean): void {
    this.minimapEnabled = enabled;
    this.markDirty();
  }

  /** Toggle minimap display */
  toggleMinimap(): void {
    this.setMinimapEnabled(!this.minimapEnabled);
  }

  /** Check if minimap is enabled */
  isMinimapEnabled(): boolean {
    return this.minimapEnabled;
  }

  /** Get minimap bounds (for hit testing) */
  getMinimapBounds(): { x: number; y: number; width: number; height: number } | null {
    return this.minimapBounds;
  }

  /** Handle click on minimap - returns true if click was handled */
  private handleMinimapClick(x: number, y: number): boolean {
    if (!this.minimapBounds) return false;

    const { x: mx, y: my, width: mw, height: mh } = this.minimapBounds;

    // Check if click is within minimap bounds
    if (x < mx || x > mx + mw || y < my || y > my + mh) {
      return false;
    }

    // Calculate content dimensions (same as in drawScrollIndicator)
    const { rowHeight, headerHeight } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;
    const totalContentHeight = this.visibleTasks.length * rowHeight;

    let minDate = this.startDate;
    let maxDate = this.startDate;
    for (const task of this.visibleTasks) {
      if (task.startDate < minDate) minDate = task.startDate;
      if (task.endDate > maxDate) maxDate = task.endDate;
    }
    const totalDays = Math.max(this.daysBetween(minDate, maxDate) + 7, 30);
    const totalTimelineWidth = totalDays * dayWidth;

    const viewableHeight = this.height - headerHeight;
    const viewableTimelineWidth = this.width - this.tableWidth;

    // Calculate scale factors
    const scaleX = (mw - 8) / totalTimelineWidth;
    const scaleY = (mh - 8) / Math.max(totalContentHeight, viewableHeight);

    // Convert click position to scroll position
    const clickInMinimapX = x - mx - 4;
    const clickInMinimapY = y - my - 4;

    // Calculate new scroll position (center viewport on clicked point)
    const newScrollX = (clickInMinimapX / scaleX) - (viewableTimelineWidth / 2);
    const newScrollY = (clickInMinimapY / scaleY) - (viewableHeight / 2);

    // Clamp scroll positions
    const maxScrollX = Math.max(0, totalTimelineWidth - viewableTimelineWidth);
    const maxScrollY = Math.max(0, totalContentHeight - viewableHeight);

    this.scrollX = Math.max(0, Math.min(newScrollX, maxScrollX));
    this.scrollY = Math.max(0, Math.min(newScrollY, maxScrollY));

    this.emitViewportChange();
    this.markDirty();

    return true;
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  /** Select a task (with modifiers for multi/range) */
  selectTask(taskId: string, modifiers: { ctrl?: boolean; shift?: boolean } = {}): void {
    if (modifiers.shift && this.lastSelectedTaskId) {
      // Range selection
      const startIdx = this.visibleTasks.findIndex((t) => t.id === this.lastSelectedTaskId);
      const endIdx = this.visibleTasks.findIndex((t) => t.id === taskId);
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        for (let i = minIdx; i <= maxIdx; i++) {
          this.selectedTaskIds.add(this.visibleTasks[i].id);
        }
      }
    } else if (modifiers.ctrl) {
      // Toggle selection
      if (this.selectedTaskIds.has(taskId)) {
        this.selectedTaskIds.delete(taskId);
      } else {
        this.selectedTaskIds.add(taskId);
      }
      this.lastSelectedTaskId = taskId;
    } else {
      // Single selection
      this.selectedTaskIds.clear();
      this.selectedTaskIds.add(taskId);
      this.lastSelectedTaskId = taskId;
    }

    this.updateSelectedGroupHeader();
    this.callbacks.onSelectionChange?.(new Set(this.selectedTaskIds));
    this.markDirty();
  }

  /** Clear selection */
  clearSelection(): void {
    this.selectedTaskIds.clear();
    this.lastSelectedTaskId = null;
    this.selectedGroupHeaderId = null;
    this.callbacks.onSelectionChange?.(new Set());
    this.markDirty();
  }

  /** Select all visible tasks */
  selectAll(): void {
    for (const task of this.visibleTasks) {
      this.selectedTaskIds.add(task.id);
    }
    this.callbacks.onSelectionChange?.(new Set(this.selectedTaskIds));
    this.markDirty();
  }

  /** Select a header and all its children (group selection) */
  selectHeaderGroup(headerTaskId: string): void {
    const headerTask = this.tasks.find((t) => t.id === headerTaskId);
    if (!headerTask) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerRowData = headerTask.rowData as any;
    const headerTaskNumber = headerRowData?.task_number;
    if (!headerTaskNumber) return;

    // Clear previous selection
    this.selectedTaskIds.clear();

    // Add header itself
    this.selectedTaskIds.add(headerTaskId);

    // Find all children of this header
    for (const task of this.tasks) {
      const parentNum = this.getParentHeaderTaskNumber(task);
      if (parentNum === headerTaskNumber) {
        this.selectedTaskIds.add(task.id);
      }
    }

    this.lastSelectedTaskId = headerTaskId;
    this.callbacks.onSelectionChange?.(new Set(this.selectedTaskIds));
    this.markDirty();
  }

  /** Get selected task IDs */
  getSelectedTaskIds(): Set<string> {
    return new Set(this.selectedTaskIds);
  }

  /** Update a task field */
  updateTaskField(taskId: string, field: string, value: unknown): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task && task.rowData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (task.rowData as any)[field] = value;
      this.markDirty();
    }
  }

  /** Zoom in */
  zoomIn(): void {
    this.zoom = Math.min(3, this.zoom * 1.2);
    this.emitViewportChange();
    this.markDirty();
  }

  /** Zoom out */
  zoomOut(): void {
    this.zoom = Math.max(0.1, this.zoom / 1.2);
    this.emitViewportChange();
    this.markDirty();
  }

  /** Zoom preset: Day view (detailed) */
  zoomToDay(): void {
    this.zoom = 1.0;
    this.emitViewportChange();
    this.markDirty();
  }

  /** Zoom preset: Week view */
  zoomToWeek(): void {
    this.zoom = 0.15;
    this.emitViewportChange();
    this.markDirty();
  }

  /** Zoom preset: Month view */
  zoomToMonth(): void {
    this.zoom = 0.05;
    this.emitViewportChange();
    this.markDirty();
  }

  /** Get current zoom level name */
  getZoomLevel(): 'day' | 'week' | 'month' | 'custom' {
    if (this.zoom >= 0.8) return 'day';
    if (this.zoom >= 0.1 && this.zoom < 0.25) return 'week';
    if (this.zoom < 0.1) return 'month';
    return 'custom';
  }

  /** Cycle through zoom presets: Day → Week → Month → Day */
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

  /** Get all columns */
  getColumns(): TableColumn[] {
    return [...this.columns];
  }

  /** Toggle column visibility */
  toggleColumnVisibility(columnId: string): void {
    const column = this.columns.find((c) => c.id === columnId);
    if (column && column.id !== 'name') {
      // Name column is always visible
      column.visible = !column.visible;
      this.recalculateTableWidth();
      this.markDirty();
    }
  }

  /** Set column visibility */
  setColumnVisibility(columnId: string, visible: boolean): void {
    const column = this.columns.find((c) => c.id === columnId);
    if (column && (column.id !== 'name' || visible)) {
      column.visible = visible;
      this.recalculateTableWidth();
      this.callbacks.onColumnsChange?.([...this.columns]);
      this.markDirty();
    }
  }

  /** Recalculate table width based on visible columns */
  private recalculateTableWidth(): void {
    this.tableWidth = this.columns
      .filter((c) => c.visible)
      .reduce((sum, c) => sum + c.width, 0) + TABLE_LEFT_PADDING;
  }

  /** Reorder columns */
  reorderColumns(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.columns.length) return;
    if (toIndex < 0 || toIndex >= this.columns.length) return;

    const [removed] = this.columns.splice(fromIndex, 1);
    this.columns.splice(toIndex, 0, removed);
    this.callbacks.onColumnsChange?.([...this.columns]);
    this.markDirty();
  }

  /** Resize a column */
  resizeColumn(columnId: string, newWidth: number): void {
    const column = this.columns.find((c) => c.id === columnId);
    if (column) {
      const minWidth = column.minWidth ?? 24;
      column.width = Math.max(minWidth, newWidth);
      this.recalculateTableWidth();
      this.callbacks.onColumnsChange?.([...this.columns]);
      this.markDirty();
    }
  }

  /** Set all columns (for restoring saved config) */
  setColumns(columns: TableColumn[]): void {
    this.columns = columns;
    this.recalculateTableWidth();
    this.markDirty();
  }

  /** Complete pending dependency creation with selected type */
  completeDependencyCreation(type: 'FS' | 'SS' | 'FF' | 'SF'): void {
    if (this.pendingDependency) {
      console.log('[UnifiedGanttCanvas] Completing dependency:', this.pendingDependency.fromTaskId, '->', this.pendingDependency.toTaskId, 'type:', type);
      this.callbacks.onDependencyCreate?.(
        this.pendingDependency.fromTaskId,
        this.pendingDependency.toTaskId,
        type
      );
      this.pendingDependency = null;
    }
  }

  /** Cancel pending dependency creation */
  cancelDependencyCreation(): void {
    if (this.pendingDependency) {
      console.log('[UnifiedGanttCanvas] Cancelling dependency creation');
      this.pendingDependency = null;
      this.callbacks.onDependencyPopupHide?.();
    }
  }

  /** Get the currently hovered task ID */
  getHoveredTask(): string | null {
    return this.hoveredTaskId;
  }

  /** Set the hovered task programmatically */
  setHoveredTask(taskId: string | null): void {
    if (this.hoveredTaskId !== taskId) {
      this.hoveredTaskId = taskId;
      this.markDirty();
    }
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  /** Check if a task is a header row */
  private isHeaderTask(task: GanttTask): boolean {
    // SSoT: Use isHeaderRow from lib/gantt/types
    return isHeaderRow(task.rowData);
  }

  /** Get parent header task number for a child task */
  private getParentHeaderTaskNumber(task: GanttTask): number | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowData = task.rowData as any;
    const headerGantt = rowData?.header_gantt;

    if (!headerGantt || headerGantt === 'Header') return null;

    if (typeof headerGantt === 'number') return headerGantt;
    if (typeof headerGantt === 'object' && headerGantt?.id) return headerGantt.id;
    if (typeof headerGantt === 'string') {
      const parsed = parseInt(headerGantt, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /** Find header task by task_number */
  private findHeaderByTaskNumber(taskNumber: number): GanttTask | undefined {
    return this.tasks.find((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowData = t.rowData as any;
      return this.isHeaderTask(t) && rowData?.task_number === taskNumber;
    });
  }

  /** Recalculate visible tasks based on filters and collapsed state */
  private recalculateVisibleTasks(): void {
    const visible: GanttTask[] = [];

    // Build set of collapsed header task numbers
    const collapsedTaskNumbers = new Set<number>();
    for (const taskId of this.collapsedHeaderIds) {
      const task = this.tasks.find((t) => t.id === taskId);
      if (task) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = task.rowData as any;
        if (rowData?.task_number) {
          collapsedTaskNumbers.add(rowData.task_number);
        }
      }
    }

    // Build set of header task numbers for grouped-only filter
    const headerTaskNumbers = new Set<number>();
    if (this.showGroupedOnly) {
      for (const task of this.tasks) {
        if (this.isHeaderTask(task)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = task.rowData as any;
          if (rowData?.task_number) {
            headerTaskNumbers.add(rowData.task_number);
          }
        }
      }
    }

    // Build parent-child map for headers (to check grandparent collapse for 2-level nesting)
    const headerParentMap = new Map<number, number | null>();
    for (const task of this.tasks) {
      if (this.isHeaderTask(task)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = task.rowData as any;
        if (rowData?.task_number) {
          headerParentMap.set(rowData.task_number, this.getParentHeaderTaskNumber(task));
        }
      }
    }

    for (const task of this.tasks) {
      // Check search filter
      if (this.searchQuery) {
        if (!task.name.toLowerCase().includes(this.searchQuery)) {
          continue;
        }
      }

      // Check grouped-only filter
      if (this.showGroupedOnly) {
        const parentNum = this.getParentHeaderTaskNumber(task);
        const isHeader = this.isHeaderTask(task);
        if (!isHeader && (parentNum === null || !headerTaskNumbers.has(parentNum))) {
          continue; // Not in a group
        }
      }

      // Check if any ancestor is collapsed (2-level nesting support)
      // - Check direct parent
      // - If parent is a Level 2 header, also check if Level 1 grandparent is collapsed
      const parentNum = this.getParentHeaderTaskNumber(task);
      if (parentNum !== null) {
        // Direct parent is collapsed
        if (collapsedTaskNumbers.has(parentNum)) {
          continue; // Hidden by collapsed parent
        }

        // Check if parent is a Level 2 header and its Level 1 grandparent is collapsed
        const grandparentNum = headerParentMap.get(parentNum);
        if (grandparentNum !== null && grandparentNum !== undefined) {
          if (collapsedTaskNumbers.has(grandparentNum)) {
            continue; // Hidden by collapsed grandparent
          }
        }
      }

      visible.push(task);
    }

    this.visibleTasks = visible;
  }

  /** Update selected group header ID based on current selection */
  private updateSelectedGroupHeader(): void {
    if (this.selectedTaskIds.size === 0) {
      this.selectedGroupHeaderId = null;
      return;
    }

    // Find the first selected task
    const firstSelectedId = Array.from(this.selectedTaskIds)[0];
    const firstTask = this.tasks.find((t) => t.id === firstSelectedId);
    if (!firstTask) {
      this.selectedGroupHeaderId = null;
      return;
    }

    // If it's a header, use it
    if (this.isHeaderTask(firstTask)) {
      this.selectedGroupHeaderId = firstTask.id;
      return;
    }

    // Find its parent header
    const parentNum = this.getParentHeaderTaskNumber(firstTask);
    if (parentNum !== null) {
      const header = this.findHeaderByTaskNumber(parentNum);
      this.selectedGroupHeaderId = header?.id ?? null;
    } else {
      this.selectedGroupHeaderId = null;
    }
  }

  /** Check if task is in the selected group */
  private isTaskInSelectedGroup(task: GanttTask): boolean {
    if (!this.selectedGroupHeaderId) return false;

    // Check if task IS the selected header
    if (task.id === this.selectedGroupHeaderId) return true;

    // Get selected header's task_number
    const selectedHeader = this.tasks.find((t) => t.id === this.selectedGroupHeaderId);
    if (!selectedHeader) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectedHeaderRowData = selectedHeader.rowData as any;
    const selectedHeaderTaskNum = selectedHeaderRowData?.task_number;
    if (selectedHeaderTaskNum === undefined) return false;

    // Check if task is a child of this header
    const parentNum = this.getParentHeaderTaskNumber(task);
    return parentNum === selectedHeaderTaskNum;
  }

  /** Get column at x position */
  private getColumnAt(x: number): TableColumn | null {
    if (x >= this.tableWidth) return null;

    let columnX = TABLE_LEFT_PADDING;
    for (const column of this.columns) {
      if (!column.visible) continue;
      if (x >= columnX && x < columnX + column.width) {
        return column;
      }
      columnX += column.width;
    }
    return null;
  }

  /** Get column resize handle at position (returns column if near right edge) */
  private getColumnResizeHandleAt(x: number, y: number): { columnId: string; edge: 'right' } | null {
    if (y >= this.config.headerHeight) return null;
    if (x >= this.tableWidth) return null;

    const handleWidth = 8; // Pixels from edge to detect resize
    let columnX = TABLE_LEFT_PADDING;

    for (const column of this.columns) {
      if (!column.visible) continue;
      columnX += column.width;

      // Check if near right edge of column
      if (x >= columnX - handleWidth && x <= columnX + handleWidth) {
        return { columnId: column.id, edge: 'right' };
      }
    }
    return null;
  }

  /** Get task at row y position */
  private getTaskAtRow(y: number): GanttTask | null {
    if (y < this.config.headerHeight) return null;

    const rowIndex = Math.floor((y - this.config.headerHeight + this.scrollY) / this.config.rowHeight);
    if (rowIndex >= 0 && rowIndex < this.visibleTasks.length) {
      return this.visibleTasks[rowIndex];
    }
    return null;
  }

  /** Get start X position for a column */
  private getColumnStartX(columnId: string): number {
    let x = TABLE_LEFT_PADDING;
    for (const column of this.columns) {
      if (!column.visible) continue;
      if (column.id === columnId) {
        return x;
      }
      x += column.width;
    }
    return x;
  }

  /** Update selection based on marquee rectangle */
  private updateMarqueeSelection(): void {
    if (this.dragOperation.type !== 'marquee') return;

    const { startX, startY, currentX, currentY } = this.dragOperation;
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    const { headerHeight, rowHeight, taskBarHeight, taskBarPadding } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;
    const timelineX = this.tableWidth;

    // Find tasks whose bars intersect the marquee
    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const rowY = headerHeight + i * rowHeight - this.scrollY;
      const barY = rowY + taskBarPadding;

      // Calculate task bar position
      const barStartX = timelineX + this.daysBetween(this.startDate, task.startDate) * dayWidth - this.scrollX;
      const barEndX = timelineX + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;

      // Check if bar intersects marquee
      const intersectsX = barStartX <= maxX && barEndX >= minX;
      const intersectsY = barY <= maxY && barY + taskBarHeight >= minY;

      if (intersectsX && intersectsY) {
        this.selectedTaskIds.add(task.id);
      }
    }

    this.updateSelectedGroupHeader();
    this.callbacks.onSelectionChange?.(new Set(this.selectedTaskIds));
  }

  /** Zoom to fit all tasks */
  zoomToFit(): void {
    if (this.tasks.length === 0) return;

    // Find date range
    let minDate = this.tasks[0].startDate;
    let maxDate = this.tasks[0].endDate;
    for (const task of this.tasks) {
      if (task.startDate < minDate) minDate = task.startDate;
      if (task.endDate > maxDate) maxDate = task.endDate;
    }

    // Calculate required zoom to fit
    const timelineWidth = this.width - this.tableWidth;
    const days = this.daysBetween(minDate, maxDate) + 14; // Add buffer
    const requiredDayWidth = timelineWidth / days;
    this.zoom = Math.max(0.1, Math.min(3, requiredDayWidth / this.config.dayWidth));

    // Reset scroll
    this.scrollX = 0;
    this.scrollY = 0;

    // Set start date to minDate with buffer
    this.startDate = new Date(minDate);
    this.startDate.setDate(this.startDate.getDate() - 7);

    this.emitViewportChange();
    this.markDirty();
  }

  /** Scroll to today */
  scrollToToday(): void {
    const today = getTodayInCompanyTimezone();
    const dayWidth = this.config.dayWidth * this.zoom;
    const days = this.daysBetween(this.startDate, today);
    const targetX = days * dayWidth - (this.width - this.tableWidth) / 3;
    this.scrollX = Math.max(0, targetX);
    this.emitViewportChange();
    this.markDirty();
  }

  /** Calculate maximum scroll X based on timeline width */
  private calculateMaxScrollX(): number {
    if (this.tasks.length === 0) return 0;

    // Find the furthest end date
    let maxEndDate = this.tasks[0].endDate;
    for (const task of this.tasks) {
      if (task.endDate > maxEndDate) maxEndDate = task.endDate;
    }

    const dayWidth = this.config.dayWidth * this.zoom;
    const totalDays = this.daysBetween(this.startDate, maxEndDate);
    const timelineContentWidth = totalDays * dayWidth;
    const visibleTimelineWidth = this.width - this.tableWidth;
    return Math.max(0, timelineContentWidth - visibleTimelineWidth + 100); // Add buffer
  }

  /** Resize canvas */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Handle device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Reset transform before scaling (scale is cumulative)
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.markDirty();
  }

  /** Export canvas as PNG data URL */
  exportToPNG(): string {
    // Ensure the canvas is fully rendered before export
    this.render();
    return this.canvas.toDataURL('image/png');
  }

  /** Export canvas as PNG blob */
  async exportToPNGBlob(): Promise<Blob | null> {
    this.render();
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  /** Download canvas as PNG file */
  downloadPNG(filename: string = 'gantt-chart.png'): void {
    const dataUrl = this.exportToPNG();
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /** Clean up */
  destroy(): void {
    this.stopRenderLoop();
    this.unbindEvents();
  }

  // =============================================================================
  // Private: Setup
  // =============================================================================

  private setupCanvas(): void {
    // Get initial size from parent
    const parent = this.canvas.parentElement;
    if (parent) {
      this.resize(parent.clientWidth, parent.clientHeight);
    }
  }

  private bindEvents(): void {
    this.canvas.addEventListener('wheel', this.handleWheel);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    // Global handlers for drag operations
    document.addEventListener('mousemove', this.handleGlobalMouseMove);
    document.addEventListener('mouseup', this.handleGlobalMouseUp);
    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('mousemove', this.handleGlobalMouseMove);
    document.removeEventListener('mouseup', this.handleGlobalMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  // =============================================================================
  // Private: Event Handlers
  // =============================================================================

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.1, Math.min(3, this.zoom * factor));
    } else {
      // Scroll
      this.scrollX = Math.max(0, this.scrollX + e.deltaX);
      this.scrollY = Math.max(0, this.scrollY + e.deltaY);
    }

    this.emitViewportChange();
    this.markDirty();
  };

  private handleMouseDown = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for minimap click (navigate to clicked position)
    if (this.minimapBounds && this.handleMinimapClick(x, y)) {
      e.preventDefault();
      return;
    }

    // Check for column resize handle (in header area)
    if (y < this.config.headerHeight) {
      const resizeHandle = this.getColumnResizeHandleAt(x, y);
      if (resizeHandle) {
        const column = this.columns.find((c) => c.id === resizeHandle.columnId);
        if (column) {
          this.dragOperation = {
            type: 'column-resize',
            columnId: resizeHandle.columnId,
            startX: x,
            startWidth: column.width,
          };
          this.canvas.style.cursor = 'col-resize';
          e.preventDefault();
          return;
        }
      }

      // Check for column header drag (column reorder)
      const columnAt = this.getColumnAt(x);
      if (columnAt && columnAt.id !== 'row_number') {
        this.dragOperation = {
          type: 'column-reorder',
          columnId: columnAt.id,
          startX: x,
          currentX: x,
        };
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }
    }

    // Check for header row collapse toggle - clicking anywhere in name column toggles collapse
    // Also highlights all children of that header to show the group
    const task = this.getTaskAtRow(y);
    if (task && this.isHeaderTask(task) && x < this.tableWidth) {
      const nameColumn = this.columns.find((c) => c.id === 'name');
      if (nameColumn && nameColumn.visible) {
        const nameColumnX = this.getColumnStartX('name');
        const nameColumnEnd = nameColumnX + nameColumn.width;
        if (x >= nameColumnX && x < nameColumnEnd) {
          this.toggleHeaderCollapse(task.id);
          // Highlight the header and all its children to show the group
          this.selectHeaderGroup(task.id);
          e.preventDefault();
          return;
        }
      }
    }

    // Check if clicking on a task bar in timeline area (start drag or resize)
    if (x > this.tableWidth && y > this.config.headerHeight) {
      // Check for dependency connector click (click on connector circle, or Alt+click anywhere on bar)
      const connectorTask = this.getDependencyConnectorAtPosition(x, y);
      if (connectorTask) {
        // Start dependency creation drag
        const dayWidth = this.config.dayWidth * this.zoom;
        const endX = this.tableWidth + this.daysBetween(this.startDate, connectorTask.endDate) * dayWidth + dayWidth - this.scrollX;
        const rowIndex = this.visibleTasks.findIndex(t => t.id === connectorTask.id);
        const barY = this.config.headerHeight + rowIndex * this.config.rowHeight - this.scrollY + this.config.taskBarPadding;
        const centerY = barY + this.config.taskBarHeight / 2;

        this.dragOperation = {
          type: 'dependency-create',
          fromTaskId: connectorTask.id,
          fromX: endX,
          fromY: centerY,
          currentX: x,
          currentY: y,
        };
        this.canvas.style.cursor = 'crosshair';
        e.preventDefault();
        return;
      }

      // Check for progress handle click (progress drag) - highest priority
      const progressInfo = this.getProgressHandleAtPosition(x, y);
      if (progressInfo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = progressInfo.task.rowData as any;
        const isLocked = rowData?.is_completed || rowData?.finance_approved;

        if (!isLocked) {
          this.dragOperation = {
            type: 'progress-drag',
            taskId: progressInfo.task.id,
            barStartX: progressInfo.barStartX,
            barWidth: progressInfo.barWidth,
            originalProgress: progressInfo.progress,
          };
          this.canvas.style.cursor = 'ew-resize';
          e.preventDefault();
          return;
        }
      }

      // Then check for edge click (resize) - takes priority over move
      const edgeInfo = this.getTaskBarEdgeAtPosition(x, y);
      if (edgeInfo) {
        // Check if task is locked
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = edgeInfo.task.rowData as any;
        const isLocked = rowData?.is_completed || rowData?.confirm ||
                         rowData?.supplier_confirm || rowData?.finance_approved;

        if (!isLocked) {
          this.dragOperation = {
            type: 'task-resize',
            taskId: edgeInfo.task.id,
            edge: edgeInfo.edge,
            startX: x,
            originalStart: new Date(edgeInfo.task.startDate),
            originalEnd: new Date(edgeInfo.task.endDate),
          };
          this.canvas.style.cursor = 'ew-resize';
          e.preventDefault();
          return;
        }
      }

      // Then check for task bar click (move)
      const task = this.getTaskBarAtPosition(x, y);
      if (task) {
        // Check if task is locked (completed tasks can't be dragged)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = task.rowData as any;
        const isLocked = rowData?.is_completed || rowData?.confirm ||
                         rowData?.supplier_confirm || rowData?.finance_approved;

        if (!isLocked) {
          this.dragOperation = {
            type: 'task-move',
            taskId: task.id,
            startX: x,
            startDate: new Date(task.startDate),
          };
          this.canvas.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }
      } else {
        // Start marquee selection if clicking on empty timeline area
        this.dragOperation = {
          type: 'marquee',
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        };
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          this.selectedTaskIds.clear();
        }
        e.preventDefault();
        return;
      }
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update cursor based on position
    if (this.dragOperation.type === 'none') {
      // Check for column resize handle
      if (y < this.config.headerHeight) {
        const resizeHandle = this.getColumnResizeHandleAt(x, y);
        if (resizeHandle) {
          this.canvas.style.cursor = 'col-resize';
          return;
        }
        this.canvas.style.cursor = 'default';
      } else if (x > this.tableWidth) {
        // Check for dependency connector (shows crosshair for drag-to-create)
        const connectorTask = this.getDependencyConnectorAtPosition(x, y);
        if (connectorTask) {
          this.canvas.style.cursor = 'crosshair';
          return;
        }

        // Check for progress handle (shows ew-resize cursor)
        const progressInfo = this.getProgressHandleAtPosition(x, y);
        if (progressInfo) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = progressInfo.task.rowData as any;
          const isLocked = rowData?.is_completed || rowData?.finance_approved;
          if (!isLocked) {
            this.canvas.style.cursor = 'ew-resize';
            return;
          }
        }

        // Check for task bar edge (resize handle)
        const edgeInfo = this.getTaskBarEdgeAtPosition(x, y);
        if (edgeInfo) {
          // Check if task is locked
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = edgeInfo.task.rowData as any;
          const isLocked = rowData?.is_completed || rowData?.confirm ||
                           rowData?.supplier_confirm || rowData?.finance_approved;
          if (!isLocked) {
            this.canvas.style.cursor = 'ew-resize';
            return;
          }
        }
        this.canvas.style.cursor = 'default';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }

    // Check if hovering over a task
    const task = this.getTaskAtPosition(x, y);
    const newHoveredId = task?.id ?? null;

    if (newHoveredId !== this.hoveredTaskId) {
      this.hoveredTaskId = newHoveredId;
      this.markDirty();
    }
  };

  private handleGlobalMouseMove = (e: MouseEvent): void => {
    if (this.dragOperation.type === 'none') return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.dragOperation.type === 'column-resize') {
      const deltaX = x - this.dragOperation.startX;
      const newWidth = this.dragOperation.startWidth + deltaX;
      this.resizeColumn(this.dragOperation.columnId, newWidth);
    } else if (this.dragOperation.type === 'column-reorder') {
      this.dragOperation.currentX = x;
      this.markDirty();
    } else if (this.dragOperation.type === 'marquee') {
      this.dragOperation.currentX = x;
      this.dragOperation.currentY = y;
      this.updateMarqueeSelection();
      this.markDirty();
    } else if (this.dragOperation.type === 'task-move') {
      // Store operation with proper type narrowing
      const op = this.dragOperation;
      // Calculate new date based on drag distance
      const dayWidth = this.config.dayWidth * this.zoom;
      const deltaX = x - op.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      // Update task temporarily for visual feedback
      const task = this.visibleTasks.find((t) => t.id === op.taskId);
      if (task) {
        const originalStart = op.startDate;
        const newStart = new Date(originalStart);
        newStart.setDate(newStart.getDate() + daysDelta);

        // Calculate duration to maintain end date offset
        const duration = this.daysBetween(task.startDate, task.endDate);

        // Update task dates temporarily
        task.startDate = newStart;
        task.endDate = new Date(newStart);
        task.endDate.setDate(task.endDate.getDate() + duration);
      }
      this.markDirty();
    } else if (this.dragOperation.type === 'task-resize') {
      // Store operation with proper type narrowing
      const op = this.dragOperation;
      // Calculate new date based on drag distance
      const dayWidth = this.config.dayWidth * this.zoom;
      const deltaX = x - op.startX;
      const daysDelta = Math.round(deltaX / dayWidth);

      // Update task temporarily for visual feedback
      const task = this.visibleTasks.find((t) => t.id === op.taskId);
      if (task) {
        const { edge, originalStart, originalEnd } = op;

        if (edge === 'left') {
          // Dragging left edge - change start date
          const newStart = new Date(originalStart);
          newStart.setDate(newStart.getDate() + daysDelta);
          // Don't let start go past end (minimum 1 day duration)
          if (newStart < originalEnd) {
            task.startDate = newStart;
          }
        } else {
          // Dragging right edge - change end date
          const newEnd = new Date(originalEnd);
          newEnd.setDate(newEnd.getDate() + daysDelta);
          // Don't let end go before start (minimum 1 day duration)
          if (newEnd > originalStart) {
            task.endDate = newEnd;
          }
        }

        // Update rowData.duration_days for Days column display
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = task.rowData as any;
        if (rowData) {
          const newDuration = Math.max(1, this.daysBetween(task.startDate, task.endDate) + 1);
          rowData.duration_days = newDuration;
        }
      }
      this.markDirty();
    } else if (this.dragOperation.type === 'dependency-create') {
      // Update current position for dependency line drawing
      this.dragOperation.currentX = x;
      this.dragOperation.currentY = y;
      this.markDirty();
    } else if (this.dragOperation.type === 'progress-drag') {
      // Calculate new progress based on mouse position
      const op = this.dragOperation;
      const relativeX = x - op.barStartX;
      let newProgress = Math.round((relativeX / op.barWidth) * 100);

      // Clamp to valid range
      newProgress = Math.max(0, Math.min(100, newProgress));

      // Update task progress for visual feedback
      const task = this.visibleTasks.find((t) => t.id === op.taskId);
      if (task) {
        task.progress = newProgress;
        // Also update rowData for consistency
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = task.rowData as any;
        if (rowData) {
          rowData.progress_percentage = newProgress;
        }
      }
      this.markDirty();
    }
  };

  private handleMouseUp = (_e: MouseEvent): void => {
    // Handled by global handler
  };

  private handleGlobalMouseUp = (e: MouseEvent): void => {
    const op = this.dragOperation;
    if (op.type === 'none') return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (op.type === 'column-reorder') {
      // Find drop position
      const targetColumn = this.getColumnAt(x);
      if (targetColumn && targetColumn.id !== op.columnId) {
        const fromIndex = this.columns.findIndex((c) => c.id === op.columnId);
        const toIndex = this.columns.findIndex((c) => c.id === targetColumn.id);
        if (fromIndex !== -1 && toIndex !== -1) {
          this.reorderColumns(fromIndex, toIndex);
        }
      }
    } else if (op.type === 'task-move') {
      // Emit task drag callback with final position
      const task = this.visibleTasks.find((t) => t.id === op.taskId);
      if (task) {
        // Calculate final date
        const dayWidth = this.config.dayWidth * this.zoom;
        const deltaX = x - op.startX;
        const daysDelta = Math.round(deltaX / dayWidth);

        if (daysDelta !== 0) {
          const newStart = new Date(op.startDate);
          newStart.setDate(newStart.getDate() + daysDelta);

          // Emit callback for parent to handle API update
          this.callbacks.onTaskDrag?.(task, newStart);
        } else {
          // No change - reset task dates to original
          const duration = this.daysBetween(op.startDate, task.endDate);
          task.startDate = new Date(op.startDate);
          task.endDate = new Date(op.startDate);
          task.endDate.setDate(task.endDate.getDate() + duration);
        }
      }
    } else if (op.type === 'task-resize') {
      // Emit task resize callback with final dates
      const task = this.visibleTasks.find((t) => t.id === op.taskId);
      if (task) {
        // Calculate final dates
        const dayWidth = this.config.dayWidth * this.zoom;
        const deltaX = x - op.startX;
        const daysDelta = Math.round(deltaX / dayWidth);

        if (daysDelta !== 0) {
          const { edge, originalStart, originalEnd } = op;
          let newStart = new Date(originalStart);
          let newEnd = new Date(originalEnd);

          if (edge === 'left') {
            // Changed start date
            newStart = new Date(originalStart);
            newStart.setDate(newStart.getDate() + daysDelta);
            // Ensure minimum 1 day duration
            if (newStart >= originalEnd) {
              newStart = new Date(originalEnd);
              newStart.setDate(newStart.getDate() - 1);
            }
            task.startDate = newStart;
          } else {
            // Changed end date
            newEnd = new Date(originalEnd);
            newEnd.setDate(newEnd.getDate() + daysDelta);
            // Ensure minimum 1 day duration
            if (newEnd <= originalStart) {
              newEnd = new Date(originalStart);
              newEnd.setDate(newEnd.getDate() + 1);
            }
            task.endDate = newEnd;
          }

          // Update rowData.duration_days for Days column display
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = task.rowData as any;
          if (rowData) {
            const newDuration = Math.max(1, this.daysBetween(task.startDate, task.endDate) + 1);
            rowData.duration_days = newDuration;
          }

          // Emit callback for parent to handle API update
          this.callbacks.onTaskResize?.(task, task.startDate, task.endDate);
        } else {
          // No change - reset task dates to original
          task.startDate = new Date(op.originalStart);
          task.endDate = new Date(op.originalEnd);

          // Reset rowData.duration_days too
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = task.rowData as any;
          if (rowData) {
            const originalDuration = Math.max(1, this.daysBetween(op.originalStart, op.originalEnd) + 1);
            rowData.duration_days = originalDuration;
          }
        }
      }
    } else if (op.type === 'dependency-create') {
      // Check if we're over a target task
      const y = e.clientY - rect.top;
      const targetTask = this.getTaskBarAtPosition(op.currentX, y);

      if (targetTask && targetTask.id !== op.fromTaskId) {
        // Show popup for dependency type selection (if callback provided)
        if (this.callbacks.onDependencyPopupShow) {
          console.log('[UnifiedGanttCanvas] Showing dependency popup:', op.fromTaskId, '->', targetTask.id);
          this.pendingDependency = { fromTaskId: op.fromTaskId, toTaskId: targetTask.id };
          this.callbacks.onDependencyPopupShow(op.fromTaskId, targetTask.id, e.clientX, e.clientY);
        } else {
          // No popup callback - create directly with default FS type
          console.log('[UnifiedGanttCanvas] Creating dependency:', op.fromTaskId, '->', targetTask.id);
          this.callbacks.onDependencyCreate?.(op.fromTaskId, targetTask.id, 'FS');
        }
      }
    } else if (op.type === 'progress-drag') {
      // Emit progress change callback
      const task = this.visibleTasks.find((t) => t.id === op.taskId);
      if (task) {
        // Calculate final progress
        const relativeX = x - op.barStartX;
        let newProgress = Math.round((relativeX / op.barWidth) * 100);
        newProgress = Math.max(0, Math.min(100, newProgress));

        if (newProgress !== op.originalProgress) {
          // Emit callback for parent to handle API update
          console.log('[UnifiedGanttCanvas] Progress changed:', task.id, 'from', op.originalProgress, 'to', newProgress);
          this.callbacks.onProgressChange?.(task, newProgress);
        } else {
          // No change - reset to original
          task.progress = op.originalProgress;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rowData = task.rowData as any;
          if (rowData) {
            rowData.progress_percentage = op.originalProgress;
          }
        }
      }
    }

    this.dragOperation = { type: 'none' };
    this.canvas.style.cursor = 'default';
    this.markDirty();
  };

  private handleMouseLeave = (_e: MouseEvent): void => {
    if (this.hoveredTaskId !== null) {
      this.hoveredTaskId = null;
      this.markDirty();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Only handle keys when canvas is focused or has recent interaction
    // Skip if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const { key, shiftKey, ctrlKey, metaKey } = e;
    const modKey = ctrlKey || metaKey; // Handle both Ctrl and Cmd

    switch (key) {
      case 'ArrowDown': {
        e.preventDefault();
        this.moveSelection(1, shiftKey);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        this.moveSelection(-1, shiftKey);
        break;
      }
      case 'ArrowLeft': {
        // Scroll timeline left
        e.preventDefault();
        const scrollAmount = shiftKey ? 200 : 50;
        this.scrollX = Math.max(0, this.scrollX - scrollAmount);
        this.emitViewportChange();
        this.markDirty();
        break;
      }
      case 'ArrowRight': {
        // Scroll timeline right
        e.preventDefault();
        const scrollAmount = shiftKey ? 200 : 50;
        const maxScrollX = this.calculateMaxScrollX();
        this.scrollX = Math.min(maxScrollX, this.scrollX + scrollAmount);
        this.emitViewportChange();
        this.markDirty();
        break;
      }
      case 'Escape': {
        // Clear selection or cancel drag
        if (this.dragOperation.type !== 'none') {
          this.dragOperation = { type: 'none' };
          this.markDirty();
        } else {
          this.selectedTaskIds.clear();
          this.lastSelectedTaskId = null;
          this.callbacks.onSelectionChange?.(this.selectedTaskIds);
          this.markDirty();
        }
        break;
      }
      case 'Enter': {
        // Double-click on selected task
        if (this.lastSelectedTaskId) {
          const task = this.visibleTasks.find((t) => t.id === this.lastSelectedTaskId);
          if (task) {
            this.callbacks.onTaskDoubleClick?.(task, e as unknown as MouseEvent);
          }
        }
        break;
      }
      case 'Home': {
        // Go to first task
        if (this.visibleTasks.length > 0) {
          const task = this.visibleTasks[0];
          this.selectedTaskIds.clear();
          this.selectedTaskIds.add(task.id);
          this.lastSelectedTaskId = task.id;
          this.scrollY = 0;
          this.callbacks.onSelectionChange?.(this.selectedTaskIds);
          this.emitViewportChange();
          this.markDirty();
        }
        break;
      }
      case 'End': {
        // Go to last task
        if (this.visibleTasks.length > 0) {
          const task = this.visibleTasks[this.visibleTasks.length - 1];
          this.selectedTaskIds.clear();
          this.selectedTaskIds.add(task.id);
          this.lastSelectedTaskId = task.id;
          // Scroll to show last task
          const maxScroll = Math.max(0, this.visibleTasks.length * this.config.rowHeight - (this.height - this.config.headerHeight));
          this.scrollY = maxScroll;
          this.callbacks.onSelectionChange?.(this.selectedTaskIds);
          this.emitViewportChange();
          this.markDirty();
        }
        break;
      }
      case 'a':
      case 'A': {
        // Ctrl/Cmd + A: Select all tasks
        if (modKey) {
          e.preventDefault();
          this.selectedTaskIds.clear();
          for (const task of this.visibleTasks) {
            this.selectedTaskIds.add(task.id);
          }
          if (this.visibleTasks.length > 0) {
            this.lastSelectedTaskId = this.visibleTasks[this.visibleTasks.length - 1].id;
          }
          this.callbacks.onSelectionChange?.(this.selectedTaskIds);
          this.markDirty();
        }
        break;
      }
      case '+':
      case '=': {
        // Zoom in
        e.preventDefault();
        this.zoomIn();
        break;
      }
      case '-':
      case '_': {
        // Zoom out
        e.preventDefault();
        this.zoomOut();
        break;
      }
      case '0': {
        // Zoom to fit
        if (modKey) {
          e.preventDefault();
          this.zoomToFit();
        }
        break;
      }
      case 't':
      case 'T': {
        // Go to today
        if (!modKey) {
          e.preventDefault();
          this.scrollToToday();
        }
        break;
      }
      case 'f':
      case 'F': {
        // Ctrl/Cmd + F: Focus search (handled by toolbar)
        // Don't prevent default - let the toolbar handle it
        break;
      }
      case 'c':
      case 'C': {
        // C: Toggle critical path highlighting
        if (!modKey) {
          e.preventDefault();
          this.toggleCriticalPath();
        }
        break;
      }
      case 'b':
      case 'B': {
        // B: Toggle baseline comparison
        if (!modKey) {
          e.preventDefault();
          this.toggleBaseline();
        }
        break;
      }
      case 'm':
      case 'M': {
        // M: Toggle minimap
        if (!modKey) {
          e.preventDefault();
          this.toggleMinimap();
        }
        break;
      }
      case 'v':
      case 'V': {
        // V: Cycle zoom level (Day → Week → Month)
        if (!modKey) {
          e.preventDefault();
          this.cycleZoomLevel();
        }
        break;
      }
      case '1': {
        // 1: Day view
        if (!modKey) {
          e.preventDefault();
          this.zoomToDay();
        }
        break;
      }
      case '2': {
        // 2: Week view
        if (!modKey) {
          e.preventDefault();
          this.zoomToWeek();
        }
        break;
      }
      case '3': {
        // 3: Month view
        if (!modKey) {
          e.preventDefault();
          this.zoomToMonth();
        }
        break;
      }
    }
  };

  private moveSelection(direction: number, extendSelection: boolean): void {
    if (this.visibleTasks.length === 0) return;

    // Find current index
    let currentIndex = -1;
    if (this.lastSelectedTaskId) {
      currentIndex = this.visibleTasks.findIndex((t) => t.id === this.lastSelectedTaskId);
    }

    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= this.visibleTasks.length) newIndex = this.visibleTasks.length - 1;

    const newTask = this.visibleTasks[newIndex];

    if (extendSelection) {
      // Extend selection (shift+arrow)
      this.selectedTaskIds.add(newTask.id);
    } else {
      // Replace selection
      this.selectedTaskIds.clear();
      this.selectedTaskIds.add(newTask.id);
    }

    this.lastSelectedTaskId = newTask.id;

    // Scroll to keep selected task visible
    const { rowHeight, headerHeight } = this.config;
    const taskY = newIndex * rowHeight;
    const visibleHeight = this.height - headerHeight;

    if (taskY < this.scrollY) {
      this.scrollY = taskY;
      this.emitViewportChange();
    } else if (taskY + rowHeight > this.scrollY + visibleHeight) {
      this.scrollY = taskY + rowHeight - visibleHeight;
      this.emitViewportChange();
    }

    this.callbacks.onSelectionChange?.(this.selectedTaskIds);
    this.markDirty();
  }

  private handleClick = (e: MouseEvent): void => {
    // Don't handle click if we just finished a drag
    if (this.dragOperation.type !== 'none') return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Skip header area
    if (y < this.config.headerHeight) return;

    // Check for header row click - clicking anywhere in name column toggles collapse
    // Also highlights all children of that header to show the group
    const nameColumn = this.columns.find((c) => c.id === 'name');
    if (nameColumn && nameColumn.visible) {
      const task = this.getTaskAtRow(y);
      if (task && this.isHeaderTask(task)) {
        // For header rows, clicking ANYWHERE in the name column toggles collapse
        // This is much more user-friendly than requiring a click on the tiny chevron
        const nameColumnX = this.getColumnStartX('name');
        const nameColumnEnd = nameColumnX + nameColumn.width;

        if (x >= nameColumnX && x < nameColumnEnd) {
          this.toggleHeaderCollapse(task.id);
          // Highlight the header and all its children to show the group
          this.selectHeaderGroup(task.id);
          return;
        }
      }
    }

    // Check for dependency column click
    const column = this.getColumnAt(x);
    if (column?.id === 'dependencies' && y > this.config.headerHeight) {
      const task = this.getTaskAtRow(y);
      if (task) {
        this.callbacks.onDependencyClick?.(task, e);
        return;
      }
    }

    const task = this.getTaskAtPosition(x, y);
    if (task) {
      // Use the selectTask method for proper range/multi selection
      this.selectTask(task.id, {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
      });
      this.callbacks.onTaskClick?.(task, e);
      this.markDirty();
    }
  };

  private handleDoubleClick = (e: MouseEvent): void => {
    const x = e.offsetX;
    const y = e.offsetY;

    // Check if double-click is in the table area (for inline editing)
    if (x < this.tableWidth && y > this.config.headerHeight) {
      const column = this.getColumnAt(x);
      const task = this.getTaskAtRow(y);

      // Handle editable columns (duration/Days)
      if (column && task && column.type === 'number' && column.field) {
        // Calculate cell rectangle for positioning the edit input
        const columnX = this.getColumnStartX(column.id);
        const rowIndex = this.visibleTasks.indexOf(task);
        const cellY = this.config.headerHeight + rowIndex * this.config.rowHeight - this.scrollY;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = task.rowData as any;
        const currentValue = rowData?.[column.field];

        console.log('[UnifiedGanttCanvas] Double-click on editable cell:', column.id, task.id, currentValue);
        this.callbacks.onCellEdit?.(task, column.id, column.field, currentValue, {
          x: columnX,
          y: cellY,
          width: column.width,
          height: this.config.rowHeight,
        });
        return;
      }
    }

    // Otherwise, handle task bar double-click
    const task = this.getTaskAtPosition(x, y);
    if (task) {
      console.log('[UnifiedGanttCanvas] Double-click on task:', task.id, task.name);
      this.callbacks.onTaskDoubleClick?.(task, e);
    } else {
      console.log('[UnifiedGanttCanvas] Double-click on empty area at', x, y);
    }
  };

  private handleContextMenu = (e: MouseEvent): void => {
    // Prevent default browser context menu
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const task = this.getTaskAtPosition(x, y);

    // If right-clicking on a task, select it if not already selected
    if (task && !this.selectedTaskIds.has(task.id)) {
      this.selectedTaskIds.clear();
      this.selectedTaskIds.add(task.id);
      this.lastSelectedTaskId = task.id;
      this.callbacks.onSelectionChange?.(new Set(this.selectedTaskIds));
      this.markDirty();
    }

    // Emit context menu event with screen coordinates for menu positioning
    this.callbacks.onContextMenu?.(task, e.clientX, e.clientY, e);
  };

  // =============================================================================
  // Private: Hit Testing
  // =============================================================================

  private getTaskAtPosition(x: number, y: number): GanttTask | null {
    // Check if in table area or timeline area
    if (x < this.tableWidth) {
      // Table area - find row
      return this.getTaskAtRowY(y);
    } else {
      // Timeline area - find task bar
      return this.getTaskBarAtPosition(x, y);
    }
  }

  private getTaskAtRowY(y: number): GanttTask | null {
    if (y < this.config.headerHeight) return null;

    const rowIndex = Math.floor((y - this.config.headerHeight + this.scrollY) / this.config.rowHeight);
    if (rowIndex >= 0 && rowIndex < this.visibleTasks.length) {
      return this.visibleTasks[rowIndex];
    }
    return null;
  }

  private getTaskBarAtPosition(x: number, y: number): GanttTask | null {
    if (y < this.config.headerHeight) return null;

    const dayWidth = this.config.dayWidth * this.zoom;
    const { rowHeight, taskBarHeight, taskBarPadding, headerHeight } = this.config;

    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const rowY = headerHeight + i * rowHeight - this.scrollY;

      // Check if row is visible
      if (rowY + rowHeight < headerHeight || rowY > this.height) continue;

      // Calculate task bar position
      const startX = this.tableWidth + this.daysBetween(this.startDate, task.startDate) * dayWidth - this.scrollX;
      const endX = this.tableWidth + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;
      const barY = rowY + taskBarPadding;

      // Check if click is within task bar
      if (x >= startX && x <= endX && y >= barY && y <= barY + taskBarHeight) {
        return task;
      }
    }

    return null;
  }

  /**
   * Get task bar edge at position (for resize detection)
   * Returns the task and which edge ('left' or 'right') is near the position
   */
  private getTaskBarEdgeAtPosition(x: number, y: number): { task: GanttTask; edge: 'left' | 'right' } | null {
    if (y < this.config.headerHeight) return null;

    const dayWidth = this.config.dayWidth * this.zoom;
    const { rowHeight, taskBarHeight, taskBarPadding, headerHeight } = this.config;
    const edgeThreshold = 15; // Pixels near edge to trigger resize (increased for easier grabbing)

    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const rowY = headerHeight + i * rowHeight - this.scrollY;

      // Check if row is visible
      if (rowY + rowHeight < headerHeight || rowY > this.height) continue;

      // Calculate task bar position
      const startX = this.tableWidth + this.daysBetween(this.startDate, task.startDate) * dayWidth - this.scrollX;
      const endX = this.tableWidth + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;
      const barY = rowY + taskBarPadding;

      // Check if within Y bounds
      if (y < barY || y > barY + taskBarHeight) continue;

      // Check left edge
      if (Math.abs(x - startX) <= edgeThreshold) {
        return { task, edge: 'left' };
      }

      // Check right edge
      if (Math.abs(x - endX) <= edgeThreshold) {
        return { task, edge: 'right' };
      }
    }

    return null;
  }

  /**
   * Check if mouse is near the progress handle (right edge of progress bar within task)
   * Returns task info if near progress handle, null otherwise
   */
  private getProgressHandleAtPosition(x: number, y: number): { task: GanttTask; barStartX: number; barWidth: number; progress: number } | null {
    if (y < this.config.headerHeight) return null;

    const dayWidth = this.config.dayWidth * this.zoom;
    const { rowHeight, taskBarHeight, taskBarPadding, headerHeight } = this.config;
    const handleThreshold = 6; // Pixels near handle to trigger drag

    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const rowY = headerHeight + i * rowHeight - this.scrollY;

      // Check if row is visible
      if (rowY + rowHeight < headerHeight || rowY > this.height) continue;

      // Calculate task bar position
      const startX = this.tableWidth + this.daysBetween(this.startDate, task.startDate) * dayWidth - this.scrollX;
      const endX = this.tableWidth + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;
      const barWidth = endX - startX;
      const barY = rowY + taskBarPadding;

      // Check if within Y bounds
      if (y < barY || y > barY + taskBarHeight) continue;

      // Get current progress
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowData = task.rowData as any;
      const progress = task.progress ?? rowData?.progress_percentage ?? 0;

      // Only allow progress drag on tasks with progress < 100
      if (progress >= 100) continue;

      // Calculate progress handle position
      const progressWidth = barWidth * (progress / 100);
      const handleX = startX + progressWidth;

      // Check if near progress handle
      if (x >= startX && x <= endX && Math.abs(x - handleX) <= handleThreshold) {
        return { task, barStartX: startX, barWidth, progress };
      }
    }

    return null;
  }

  /**
   * Check if mouse is over a dependency connector (circle on right edge of task bar)
   * Returns the task if on a connector, null otherwise
   */
  private getDependencyConnectorAtPosition(x: number, y: number): GanttTask | null {
    if (y < this.config.headerHeight) return null;

    const dayWidth = this.config.dayWidth * this.zoom;
    const { rowHeight, taskBarHeight, taskBarPadding, headerHeight } = this.config;
    const connectorRadius = 5;

    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const rowY = headerHeight + i * rowHeight - this.scrollY;

      // Check if row is visible
      if (rowY + rowHeight < headerHeight || rowY > this.height) continue;

      // Calculate connector position (center of right edge)
      const endX = this.tableWidth + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;
      const barY = rowY + taskBarPadding;
      const connectorY = barY + taskBarHeight / 2;

      // Check if within connector circle
      const dx = x - endX;
      const dy = y - connectorY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= connectorRadius + 3) {
        return task;
      }
    }

    return null;
  }

  // =============================================================================
  // Private: Rendering
  // =============================================================================

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
    const { width, height } = this;
    if (width === 0 || height === 0) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Draw layers in order
    this.drawBackground();
    this.drawWeekendShading();
    this.drawTableSection();
    this.drawHeaderRowTimelineBackgrounds();
    this.drawTimelineSection();
    if (this.showDependencies) {
      this.drawDependencies();
    }
    this.drawTodayMarker();
    this.drawHeaders();

    // Draw drag overlays (marquee, column reorder)
    this.drawDragOverlays();

    // Draw tooltip (on top of everything)
    this.drawTooltip();

    // Draw scroll position indicator / minimap
    this.drawScrollIndicator();

    // Update overlay positions
    this.updateOverlayPositions();
  }

  private drawDragOverlays(): void {
    // Draw marquee selection rectangle
    if (this.dragOperation.type === 'marquee') {
      const { startX, startY, currentX, currentY } = this.dragOperation;
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      // Fill with semi-transparent blue
      this.ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      this.ctx.fillRect(x, y, w, h);

      // Stroke with solid blue
      this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([4, 4]);
      this.ctx.strokeRect(x, y, w, h);
      this.ctx.setLineDash([]);
    }

    // Draw column reorder feedback
    if (this.dragOperation.type === 'column-reorder') {
      const { columnId, currentX } = this.dragOperation;
      const column = this.columns.find((c) => c.id === columnId);
      if (column) {
        const columnStartX = this.getColumnStartX(columnId);
        const dragOffset = currentX - this.dragOperation.startX;
        const newX = columnStartX + dragOffset;

        // Draw dragged column ghost
        this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        this.ctx.fillRect(newX, 0, column.width, this.config.headerHeight);

        // Draw column header text
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(column.label, newX + column.width / 2, this.config.headerHeight / 2);

        // Draw drop indicator
        const targetColumn = this.getColumnAt(currentX);
        if (targetColumn && targetColumn.id !== columnId) {
          const targetX = this.getColumnStartX(targetColumn.id);
          // Draw vertical line at drop position
          this.ctx.strokeStyle = '#3b82f6';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(targetX, 0);
          this.ctx.lineTo(targetX, this.height);
          this.ctx.stroke();
        }
      }
    }

    // Draw dependency creation line
    if (this.dragOperation.type === 'dependency-create') {
      const { fromX, fromY, currentX, currentY } = this.dragOperation;

      // Draw connector line from source to cursor
      this.ctx.save();

      // Draw line
      this.ctx.strokeStyle = '#3b82f6';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Draw arrow at cursor
      const angle = Math.atan2(currentY - fromY, currentX - fromX);
      const arrowLength = 10;
      this.ctx.beginPath();
      this.ctx.moveTo(currentX, currentY);
      this.ctx.lineTo(
        currentX - arrowLength * Math.cos(angle - Math.PI / 6),
        currentY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      this.ctx.moveTo(currentX, currentY);
      this.ctx.lineTo(
        currentX - arrowLength * Math.cos(angle + Math.PI / 6),
        currentY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      this.ctx.stroke();

      // Draw source connector circle
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.beginPath();
      this.ctx.arc(fromX, fromY, 5, 0, Math.PI * 2);
      this.ctx.fill();

      // Highlight target task if hovering
      const targetTask = this.getTaskBarAtPosition(currentX, currentY);
      if (targetTask && targetTask.id !== this.dragOperation.fromTaskId) {
        // Draw highlight around target task bar
        const dayWidth = this.config.dayWidth * this.zoom;
        const { rowHeight, taskBarHeight, taskBarPadding, headerHeight } = this.config;
        const rowIndex = this.visibleTasks.findIndex(t => t.id === targetTask.id);
        const rowY = headerHeight + rowIndex * rowHeight - this.scrollY;
        const startX = this.tableWidth + this.daysBetween(this.startDate, targetTask.startDate) * dayWidth - this.scrollX;
        const endX = this.tableWidth + this.daysBetween(this.startDate, targetTask.endDate) * dayWidth + dayWidth - this.scrollX;
        const barY = rowY + taskBarPadding;

        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(startX - 2, barY - 2, endX - startX + 4, taskBarHeight + 4);
      }

      this.ctx.restore();
    }
  }

  private drawTooltip(): void {
    // Only show tooltip when hovering over a task (and not dragging)
    if (!this.hoveredTaskId || this.dragOperation.type !== 'none') return;

    const task = this.visibleTasks.find((t) => t.id === this.hoveredTaskId);
    if (!task) return;

    // Get task position
    const taskIndex = this.visibleTasks.indexOf(task);
    const { headerHeight, rowHeight, taskBarHeight, taskBarPadding } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;

    const taskY = headerHeight + taskIndex * rowHeight - this.scrollY;
    const startX = this.tableWidth + this.daysBetween(this.startDate, task.startDate) * dayWidth - this.scrollX;
    const endX = this.tableWidth + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;
    const barWidth = endX - startX;

    // Build tooltip content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowData = task.rowData as any;
    const lines: string[] = [];
    lines.push(task.name);

    // Format dates
    const startStr = task.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const endStr = task.endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const duration = this.daysBetween(task.startDate, task.endDate) + 1;
    lines.push(`${startStr} → ${endStr} (${duration}d)`);

    // Add supplier if present
    if (rowData?.supplier_name) {
      lines.push(`Supplier: ${rowData.supplier_name}`);
    }

    // Add status
    const statuses: string[] = [];
    if (rowData?.is_completed) statuses.push('Complete');
    else if (rowData?.supplier_confirm) statuses.push('Supplier Confirmed');
    else if (rowData?.confirm) statuses.push('Confirmed');
    else if (rowData?.hold) statuses.push('On Hold');
    else if (rowData?.started) statuses.push('Started');
    if (statuses.length > 0) {
      lines.push(`Status: ${statuses.join(', ')}`);
    }

    // Calculate tooltip dimensions
    this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const lineHeight = 16;
    const padding = 8;
    let maxWidth = 0;
    for (const line of lines) {
      const width = this.ctx.measureText(line).width;
      if (width > maxWidth) maxWidth = width;
    }

    const tooltipWidth = Math.min(maxWidth + padding * 2, 300);
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Position tooltip above the task bar
    let tooltipX = startX + barWidth / 2 - tooltipWidth / 2;
    let tooltipY = taskY + taskBarPadding - tooltipHeight - 8;

    // Keep tooltip on screen
    if (tooltipX < this.tableWidth + 4) tooltipX = this.tableWidth + 4;
    if (tooltipX + tooltipWidth > this.width - 4) tooltipX = this.width - tooltipWidth - 4;
    if (tooltipY < headerHeight + 4) {
      // Show below task instead
      tooltipY = taskY + taskBarPadding + taskBarHeight + 8;
    }

    // Draw tooltip background (inverted colors for visibility)
    this.ctx.fillStyle = this.config.darkMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.9)';
    this.ctx.beginPath();
    this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
    this.ctx.fill();

    // Draw tooltip text
    this.ctx.fillStyle = this.config.darkMode ? '#1f2937' : '#ffffff';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      const y = tooltipY + padding + i * lineHeight;
      // First line (task name) in bold
      if (i === 0) {
        this.ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      } else {
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      }
      this.ctx.fillText(lines[i], tooltipX + padding, y);
    }
  }

  private drawScrollIndicator(): void {
    // Draw minimap/scroll indicator in bottom-right corner
    const minimapWidth = 150;
    const minimapHeight = 80;
    const padding = 10;
    const x = this.width - minimapWidth - padding;
    const y = this.height - minimapHeight - padding;

    // Store bounds for click detection
    this.minimapBounds = { x, y, width: minimapWidth, height: minimapHeight };

    // Calculate content dimensions
    const { rowHeight, headerHeight } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;
    const totalContentHeight = this.visibleTasks.length * rowHeight;

    // Calculate timeline extent
    let minDate = this.startDate;
    let maxDate = this.startDate;
    for (const task of this.visibleTasks) {
      if (task.startDate < minDate) minDate = task.startDate;
      if (task.endDate > maxDate) maxDate = task.endDate;
    }
    const totalDays = Math.max(this.daysBetween(minDate, maxDate) + 7, 30);
    const totalTimelineWidth = totalDays * dayWidth;

    // Only show if there's content to scroll
    const viewableHeight = this.height - headerHeight;
    const viewableTimelineWidth = this.width - this.tableWidth;
    if (totalContentHeight <= viewableHeight && totalTimelineWidth <= viewableTimelineWidth) {
      this.minimapBounds = null;
      return;
    }

    // Draw minimap background
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, minimapWidth, minimapHeight, 6);
    this.ctx.fill();
    this.ctx.restore();

    // Draw border
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, minimapWidth, minimapHeight, 6);
    this.ctx.stroke();

    // Draw task bars as colored lines
    const scaleX = (minimapWidth - 8) / totalTimelineWidth;
    const scaleY = (minimapHeight - 8) / Math.max(totalContentHeight, viewableHeight);

    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const taskStartDays = this.daysBetween(this.startDate, task.startDate);
      const taskEndDays = this.daysBetween(this.startDate, task.endDate);
      const taskX = x + 4 + (taskStartDays * dayWidth) * scaleX;
      const taskW = Math.max(2, ((taskEndDays - taskStartDays + 1) * dayWidth) * scaleX);
      const taskY = y + 4 + (i * rowHeight) * scaleY;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowData = task.rowData as any;
      const color = this.getTaskBarColor(rowData);

      this.ctx.fillStyle = color;
      this.ctx.fillRect(taskX, taskY, taskW, Math.max(1, rowHeight * scaleY - 1));
    }

    // Draw viewport rectangle
    const vpX = x + 4 + (this.scrollX * scaleX);
    const vpY = y + 4 + (this.scrollY * scaleY);
    const vpW = viewableTimelineWidth * scaleX;
    const vpH = viewableHeight * scaleY;

    this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(vpX, vpY, vpW, vpH);

    // Fill viewport with semi-transparent blue
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    this.ctx.fillRect(vpX, vpY, vpW, vpH);
  }

  private drawBackground(): void {
    this.ctx.fillStyle = this.config.colors.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawWeekendShading(): void {
    const dayWidth = this.config.dayWidth * this.zoom;
    const { headerHeight } = this.config;

    // Calculate visible day range
    const startDayOffset = Math.floor(this.scrollX / dayWidth);
    const endDayOffset = Math.ceil((this.scrollX + this.width - this.tableWidth) / dayWidth);

    // Draw weekend and holiday shading (body only - timeline area)
    for (let i = startDayOffset; i <= endDayOffset; i++) {
      const x = this.tableWidth + i * dayWidth - this.scrollX;

      // Skip if not visible
      if (x + dayWidth < this.tableWidth || x > this.width) continue;

      const currentDate = new Date(this.startDate);
      currentDate.setDate(currentDate.getDate() + i);

      // Check holiday first (takes priority over weekend)
      if (this.isHoliday(currentDate)) {
        // Holiday shading - light pink/red tint
        this.ctx.fillStyle = this.config.darkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(254, 226, 226, 0.8)'; // red-100
        this.ctx.fillRect(x, headerHeight, dayWidth, this.height - headerHeight);
      } else if (this.isWeekend(currentDate)) {
        // Weekend shading - light gray
        this.ctx.fillStyle = this.config.colors.weekendBackground;
        this.ctx.fillRect(x, headerHeight, dayWidth, this.height - headerHeight);
      }
    }
  }

  /**
   * Draw header/group row backgrounds on the timeline side
   * These rows get amber tint, with darker amber on weekends/holidays
   */
  private drawHeaderRowTimelineBackgrounds(): void {
    const { headerHeight, rowHeight } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;

    // Calculate visible day range for weekend/holiday detection
    const startDayOffset = Math.floor(this.scrollX / dayWidth);
    const endDayOffset = Math.ceil((this.scrollX + this.width - this.tableWidth) / dayWidth);

    // Process each visible row
    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const y = headerHeight + i * rowHeight - this.scrollY;

      // Skip if not visible
      if (y + rowHeight < headerHeight || y > this.height) continue;

      // Check if this is a header/group row (SSoT: isHeaderRow)
      const isHeader = isHeaderRow(task.rowData);

      // Also check if it's a child row in selected group (amber tint)
      const isInSelectedGroup = this.isTaskInSelectedGroup(task) && !this.selectedTaskIds.has(task.id);

      if (!isHeader && !isInSelectedGroup) continue;

      // Draw base amber background across the timeline area
      const baseAmberColor = isHeader
        ? this.config.colors.headerRowBackground
        : this.config.colors.childRowBackground;

      this.ctx.fillStyle = baseAmberColor;
      this.ctx.fillRect(this.tableWidth, y, this.width - this.tableWidth, rowHeight);

      // Now draw darker overlays on weekend/holiday columns
      for (let d = startDayOffset; d <= endDayOffset; d++) {
        const x = this.tableWidth + d * dayWidth - this.scrollX;

        // Skip if not visible
        if (x + dayWidth < this.tableWidth || x > this.width) continue;

        const currentDate = new Date(this.startDate);
        currentDate.setDate(currentDate.getDate() + d);

        const isWeekend = this.isWeekend(currentDate);
        const isHoliday = this.isHoliday(currentDate);

        if (isHoliday) {
          // Holiday on group row - darkest amber with red tint
          this.ctx.fillStyle = this.config.darkMode
            ? 'rgba(217, 119, 6, 0.35)' // amber-600 with more opacity
            : 'rgba(251, 146, 60, 0.4)'; // orange-400 with opacity
          this.ctx.fillRect(x, y, dayWidth, rowHeight);
        } else if (isWeekend) {
          // Weekend on group row - darker amber
          this.ctx.fillStyle = this.config.darkMode
            ? 'rgba(251, 191, 36, 0.25)' // amber-400 with more opacity
            : 'rgba(251, 191, 36, 0.3)'; // amber-400 with more opacity
          this.ctx.fillRect(x, y, dayWidth, rowHeight);
        }
      }
    }
  }

  private drawTableSection(): void {
    const { headerHeight, rowHeight } = this.config;
    const { width: tableWidth } = { width: this.tableWidth };

    // Draw row backgrounds
    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const y = headerHeight + i * rowHeight - this.scrollY;

      // Skip if not visible
      if (y + rowHeight < headerHeight || y > this.height) continue;

      // Determine background color
      // Alternating row colors - use slightly different shade for odd rows
      const oddRowColor = this.config.darkMode ? '#263040' : '#fafafa';
      let bgColor = i % 2 === 0 ? this.config.colors.background : oddRowColor;

      // Check if header row (SSoT: isHeaderRow)
      const isHeader = isHeaderRow(task.rowData);
      if (isHeader) {
        bgColor = this.config.colors.headerRowBackground;
      }

      // Check if in selected group (amber highlight)
      if (this.isTaskInSelectedGroup(task) && !this.selectedTaskIds.has(task.id)) {
        bgColor = this.config.colors.childRowBackground;
      }

      // Check if selected
      if (this.selectedTaskIds.has(task.id)) {
        bgColor = this.config.colors.selectedRow;
      }

      // Check if hovered
      if (this.hoveredTaskId === task.id) {
        bgColor = this.config.colors.hoverRow;
      }

      // Draw row background
      this.ctx.fillStyle = bgColor;
      this.ctx.fillRect(0, y, tableWidth, rowHeight);

      // Draw row content (text)
      this.drawTableRow(task, i, y);
    }

    // Draw vertical grid lines for columns
    let columnX = TABLE_LEFT_PADDING;
    for (const column of this.columns) {
      if (!column.visible) continue;
      columnX += column.width;
      this.ctx.strokeStyle = this.config.colors.gridLines;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(columnX, headerHeight);
      this.ctx.lineTo(columnX, this.height);
      this.ctx.stroke();
    }

    // Draw horizontal grid lines (across full width)
    for (let i = 0; i <= this.visibleTasks.length; i++) {
      const y = headerHeight + i * rowHeight - this.scrollY;
      if (y < headerHeight || y > this.height) continue;

      this.ctx.strokeStyle = this.config.colors.gridLines;
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // Draw table/timeline separator
    this.ctx.strokeStyle = this.config.colors.borderColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(tableWidth, 0);
    this.ctx.lineTo(tableWidth, this.height);
    this.ctx.stroke();
  }

  private drawTableRow(task: GanttTask, rowIndex: number, y: number): void {
    const { rowHeight } = this.config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowData = task.rowData as any;
    const isHeader = this.isHeaderTask(task);
    const isCollapsed = this.collapsedHeaderIds.has(task.id);

    let columnX = TABLE_LEFT_PADDING;
    for (const column of this.columns) {
      if (!column.visible) continue;

      const cellX = columnX;
      const cellWidth = column.width;
      columnX += cellWidth;

      // Draw cell content based on column type
      if (column.type === 'text') {
        let text = '';
        if (column.id === 'row_number') {
          text = String(rowIndex + 1);
        } else if (column.field) {
          const rawValue = rowData?.[column.field] ?? task[column.field as keyof GanttTask];
          // Handle object values with display property (e.g., { id: 1, display: "Name" })
          if (rawValue && typeof rawValue === 'object' && 'display' in rawValue) {
            text = String(rawValue.display ?? '');
          } else {
            text = String(rawValue ?? '');
          }
        }
        // Draw chevron for name column on header rows
        let textOffsetX = 0;

        // Calculate nesting indentation (2-level nesting support)
        // Level 0: top-level headers (no indent)
        // Level 1: sub-headers or children of L1 headers (16px indent)
        // Level 2: children of L2 headers (32px indent)
        const nestingLevel = rowData?.nesting_level ?? 0;
        const nestingIndent = column.id === 'name' ? nestingLevel * 16 : 0;
        textOffsetX = nestingIndent;

        if (column.id === 'name' && isHeader) {
          // Draw collapse/expand chevron
          const chevronX = cellX + 8 + nestingIndent;
          const chevronY = y + rowHeight / 2;
          const chevronSize = 6;

          this.ctx.fillStyle = this.config.colors.textColor;
          this.ctx.beginPath();
          if (isCollapsed) {
            // Right-pointing chevron (collapsed)
            this.ctx.moveTo(chevronX, chevronY - chevronSize);
            this.ctx.lineTo(chevronX + chevronSize, chevronY);
            this.ctx.lineTo(chevronX, chevronY + chevronSize);
          } else {
            // Down-pointing chevron (expanded)
            this.ctx.moveTo(chevronX - chevronSize / 2, chevronY - chevronSize / 2);
            this.ctx.lineTo(chevronX + chevronSize / 2, chevronY - chevronSize / 2);
            this.ctx.lineTo(chevronX, chevronY + chevronSize / 2);
          }
          this.ctx.closePath();
          this.ctx.fill();
          textOffsetX = nestingIndent + 16; // Nesting indent + space after chevron
        }

        // Draw text
        this.ctx.fillStyle = isHeader ? '#374151' : this.config.colors.textColor;
        this.ctx.font = isHeader
          ? 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          : '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = column.id === 'row_number' ? 'center' : 'left';

        const textX = column.id === 'row_number' ? cellX + cellWidth / 2 : cellX + 8 + textOffsetX;
        const textY = y + rowHeight / 2;

        // Truncate text if too long
        const maxWidth = cellWidth - 16 - textOffsetX;
        let displayText = text;
        if (this.ctx.measureText(text).width > maxWidth) {
          while (this.ctx.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
            displayText = displayText.slice(0, -1);
          }
          displayText += '...';
        }

        // Check for search highlighting (name column only)
        if (column.id === 'name' && this.searchQuery && displayText.toLowerCase().includes(this.searchQuery)) {
          // Draw with highlighting
          const lowerText = displayText.toLowerCase();
          const matchIndex = lowerText.indexOf(this.searchQuery);
          const beforeMatch = displayText.substring(0, matchIndex);
          const match = displayText.substring(matchIndex, matchIndex + this.searchQuery.length);
          const afterMatch = displayText.substring(matchIndex + this.searchQuery.length);

          let currentX = textX;

          // Draw before match
          if (beforeMatch) {
            this.ctx.fillText(beforeMatch, currentX, textY);
            currentX += this.ctx.measureText(beforeMatch).width;
          }

          // Draw match with highlight
          const matchWidth = this.ctx.measureText(match).width;
          this.ctx.fillStyle = 'rgba(251, 191, 36, 0.4)'; // Yellow highlight
          this.ctx.fillRect(currentX - 1, textY - 8, matchWidth + 2, 16);
          this.ctx.fillStyle = isHeader ? '#374151' : this.config.colors.textColor;
          this.ctx.fillText(match, currentX, textY);
          currentX += matchWidth;

          // Draw after match
          if (afterMatch) {
            this.ctx.fillText(afterMatch, currentX, textY);
          }
        } else {
          this.ctx.fillText(displayText, textX, textY);
        }
      } else if (column.type === 'checkbox') {
        // Checkboxes are rendered by React overlay (GanttOverlay.tsx)
        // Canvas skips drawing to avoid double-render
      } else if (column.type === 'number') {
        const value = column.field ? rowData?.[column.field] : '';
        this.ctx.fillStyle = this.config.colors.textColor;
        this.ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(String(value ?? ''), cellX + cellWidth / 2, y + rowHeight / 2);
      } else if (column.type === 'date') {
        // Format date as DD/MM
        let dateStr = '';
        if (column.field) {
          const dateValue = column.field === 'start_date' ? task.startDate : task.endDate;
          if (dateValue) {
            const d = new Date(dateValue);
            dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
          }
        }
        this.ctx.fillStyle = this.config.colors.textColor;
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(dateStr, cellX + 4, y + rowHeight / 2);
      } else if (column.type === 'action') {
        // Draw action column (e.g., dependencies) - convert task IDs to row numbers
        let displayText = '';

        // Special handling for dependencies column - show row numbers not task IDs
        if (column.id === 'dependencies' && rowData?.predecessor_ids) {
          const predIds = rowData.predecessor_ids as Array<{ id: number; type?: string; lag?: number }>;
          if (predIds && predIds.length > 0) {
            // Build task_number -> visual row index map (use visibleTasks for correct row numbers)
            const taskNumToRowIdx = new Map<number, number>();
            this.visibleTasks.forEach((t, idx) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r = t.rowData as any;
              if (r?.task_number != null) {
                taskNumToRowIdx.set(Number(r.task_number), idx + 1); // 1-based visual row number
              }
            });

            // Convert each predecessor to "rowNum TYPE" format
            displayText = predIds.map(pred => {
              // Convert pred.id to number for consistent Map lookup
              const predTaskNum = Number(pred.id);
              const rowNum = taskNumToRowIdx.get(predTaskNum) || pred.id;
              const type = pred.type || 'FS';
              const lag = pred.lag || 0;
              let result = `${rowNum} ${type}`;
              if (lag !== 0) {
                result += lag > 0 ? `+${lag}` : `${lag}`;
              }
              return result;
            }).join(', ');
          }
        } else {
          const value = column.field ? rowData?.[column.field] : '';
          displayText = value ? String(value) : '';
        }

        if (displayText) {
          this.ctx.fillStyle = '#3b82f6'; // Blue text for clickable
          this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          this.ctx.textBaseline = 'middle';
          this.ctx.textAlign = 'left';

          // Truncate if needed
          const maxWidth = cellWidth - 8;
          if (this.ctx.measureText(displayText).width > maxWidth) {
            while (this.ctx.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
              displayText = displayText.slice(0, -1);
            }
            displayText += '...';
          }
          this.ctx.fillText(displayText, cellX + 4, y + rowHeight / 2);
        }
      }
    }
  }

  private drawTimelineSection(): void {
    const { headerHeight, rowHeight, taskBarHeight, taskBarPadding } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;
    const timelineX = this.tableWidth;

    // Draw vertical grid lines (weekend shading is in drawWeekendShading)
    const visibleDays = Math.ceil(this.width / dayWidth) + 2;
    const startDayOffset = Math.floor(this.scrollX / dayWidth);

    for (let i = 0; i < visibleDays; i++) {
      const dayOffset = startDayOffset + i;
      const x = timelineX + dayOffset * dayWidth - this.scrollX;

      // Draw vertical grid line
      this.ctx.strokeStyle = this.config.colors.gridLines;
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x, headerHeight);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // Draw task bars
    for (let i = 0; i < this.visibleTasks.length; i++) {
      const task = this.visibleTasks[i];
      const y = headerHeight + i * rowHeight - this.scrollY;

      // Skip if not visible
      if (y + rowHeight < headerHeight || y > this.height) continue;

      // Calculate bar position
      const startX = timelineX + this.daysBetween(this.startDate, task.startDate) * dayWidth - this.scrollX;
      const endX = timelineX + this.daysBetween(this.startDate, task.endDate) * dayWidth + dayWidth - this.scrollX;
      const barWidth = Math.max(endX - startX, dayWidth);
      const barY = y + taskBarPadding;

      // Skip if not visible horizontally
      if (endX < timelineX || startX > this.width) continue;

      // Determine bar color based on status
      // SSoT: Priority order matches old Gantt (Renderer.ts:1524-1566)
      // Complete > Supplier Confirm > Confirm > Hold > Started > Default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowData = task.rowData as any;
      const barColor = this.getTaskBarColor(rowData);

      // Check if this is a header/summary row (SSoT: isHeaderRow from lib/gantt/types)
      const isHeader = isHeaderRow(task.rowData);

      if (isHeader) {
        // MS Project style summary bar: thin black bar with downward triangles at ends
        const summaryBarHeight = 6;
        const summaryY = barY + (taskBarHeight - summaryBarHeight) / 2;
        const triangleSize = 8;

        // Draw the thin bar (gray-800 in light mode, gray-200 in dark mode)
        this.ctx.fillStyle = this.config.darkMode ? '#e5e7eb' : '#1f2937';
        this.ctx.fillRect(startX, summaryY, barWidth, summaryBarHeight);

        // Draw downward triangle at start
        this.ctx.beginPath();
        this.ctx.moveTo(startX, summaryY);
        this.ctx.lineTo(startX + triangleSize, summaryY);
        this.ctx.lineTo(startX, summaryY + triangleSize + summaryBarHeight);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw downward triangle at end
        this.ctx.beginPath();
        this.ctx.moveTo(startX + barWidth - triangleSize, summaryY);
        this.ctx.lineTo(startX + barWidth, summaryY);
        this.ctx.lineTo(startX + barWidth, summaryY + triangleSize + summaryBarHeight);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw header name to the right of the bar
        this.ctx.fillStyle = this.config.darkMode ? '#e5e7eb' : '#1f2937';
        this.ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(task.name, startX + barWidth + 8, barY + taskBarHeight / 2);

        continue; // Skip normal task bar rendering for headers
      }

      // Check task shape (Order, Call, Photo get special icons)
      const taskShape = task.shape || 'task';

      if (taskShape === 'order' || taskShape === 'call' || taskShape === 'photo') {
        // Draw icon for spawned tasks
        this.drawTaskIcon(startX, barY, taskBarHeight, taskShape, barColor);
      } else {
        // Draw regular bar
        this.ctx.fillStyle = barColor;
        this.ctx.fillRect(startX, barY, barWidth, taskBarHeight);

        // Draw CHECKERED pattern when dependency is broken/removed
        // This indicates the task is not following its predecessors as designed
        if (rowData?.dependency_broken) {
          this.ctx.save();
          // Clip to task bar shape
          this.ctx.beginPath();
          this.ctx.rect(startX, barY, barWidth, taskBarHeight);
          this.ctx.clip();

          // Draw checkered pattern (alternating squares)
          const squareSize = 6;
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          for (let x = 0; x < barWidth; x += squareSize * 2) {
            for (let yy = 0; yy < taskBarHeight; yy += squareSize * 2) {
              // Draw two squares in alternating positions
              this.ctx.fillRect(startX + x, barY + yy, squareSize, squareSize);
              this.ctx.fillRect(startX + x + squareSize, barY + yy + squareSize, squareSize, squareSize);
            }
          }
          this.ctx.restore();
        }

        // Draw progress bar (if task has progress)
        const progress = task.progress ?? rowData?.progress_percentage ?? 0;
        if (progress > 0 && progress < 100) {
          const progressWidth = barWidth * (progress / 100);
          // Slightly darker shade for progress
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          this.ctx.fillRect(startX, barY, progressWidth, taskBarHeight);

          // Draw progress handle when hovered
          if (this.hoveredTaskId === task.id) {
            const handleX = startX + progressWidth;
            // Draw vertical line handle
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(handleX, barY);
            this.ctx.lineTo(handleX, barY + taskBarHeight);
            this.ctx.stroke();

            // Draw small triangle/grip
            this.ctx.fillStyle = '#3b82f6';
            this.ctx.beginPath();
            this.ctx.moveTo(handleX, barY + taskBarHeight / 2 - 4);
            this.ctx.lineTo(handleX + 4, barY + taskBarHeight / 2);
            this.ctx.lineTo(handleX, barY + taskBarHeight / 2 + 4);
            this.ctx.closePath();
            this.ctx.fill();
          }
        }

        // Draw border
        this.ctx.strokeStyle = this.config.colors.taskBarBorder;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX, barY, barWidth, taskBarHeight);

        // Draw lock icon for locked tasks (completed, confirmed, or supplier confirmed)
        const isLocked = rowData?.is_completed || rowData?.confirm || rowData?.supplier_confirm;
        if (isLocked && barWidth >= 20) {
          // Draw lock icon on left edge of bar (Unicode lock: 🔒)
          this.ctx.font = '10px sans-serif';
          this.ctx.fillStyle = this.config.darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('🔒', startX + 2, barY + taskBarHeight / 2);
        }

        // Draw visual resize handles on hover (grip lines on edges)
        if (this.hoveredTaskId === task.id && !isLocked && barWidth >= 30) {
          const gripColor = this.config.darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.5)';
          const gripWidth = 3;
          const gripGap = 4;
          const gripHeight = 10;
          const centerY = barY + taskBarHeight / 2;

          // Left edge grip lines (3 lines)
          this.ctx.fillStyle = gripColor;
          this.ctx.fillRect(startX + 3, centerY - gripHeight / 2, gripWidth, gripHeight);
          this.ctx.fillRect(startX + 3 + gripGap, centerY - gripHeight / 2, gripWidth, gripHeight);
          this.ctx.fillRect(startX + 3 + gripGap * 2, centerY - gripHeight / 2, gripWidth, gripHeight);

          // Right edge grip lines (3 lines)
          const rightX = startX + barWidth - 6 - gripWidth;
          this.ctx.fillRect(rightX - gripGap * 2, centerY - gripHeight / 2, gripWidth, gripHeight);
          this.ctx.fillRect(rightX - gripGap, centerY - gripHeight / 2, gripWidth, gripHeight);
          this.ctx.fillRect(rightX, centerY - gripHeight / 2, gripWidth, gripHeight);
        }

        // Draw hold date marker (pinned task indicator)
        if (rowData?.hold && rowData?.hold_date) {
          const holdDate = new Date(rowData.hold_date);
          const holdX = timelineX + this.daysBetween(this.startDate, holdDate) * dayWidth - this.scrollX;

          // Draw small triangle marker at hold date position
          this.ctx.fillStyle = '#f59e0b'; // Amber color for hold
          this.ctx.beginPath();
          this.ctx.moveTo(holdX, barY - 2);
          this.ctx.lineTo(holdX + 4, barY + 4);
          this.ctx.lineTo(holdX - 4, barY + 4);
          this.ctx.closePath();
          this.ctx.fill();

          // Draw vertical line from marker to bar
          this.ctx.strokeStyle = '#f59e0b';
          this.ctx.lineWidth = 1;
          this.ctx.setLineDash([2, 2]);
          this.ctx.beginPath();
          this.ctx.moveTo(holdX, barY + 4);
          this.ctx.lineTo(holdX, barY + taskBarHeight);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }
      }

      // Draw baseline bar (if baseline comparison is enabled)
      if (this.baselineEnabled && taskShape === 'task') {
        const baseline = this.baselines.get(task.id);
        if (baseline) {
          const baselineStartX = timelineX + this.daysBetween(this.startDate, baseline.startDate) * dayWidth - this.scrollX;
          const baselineEndX = timelineX + this.daysBetween(this.startDate, baseline.endDate) * dayWidth + dayWidth - this.scrollX;
          const baselineWidth = Math.max(baselineEndX - baselineStartX, dayWidth);
          const baselineHeight = 4;
          const baselineY = barY + taskBarHeight + 2; // Below the task bar

          // Calculate variance to determine color
          const currentEndDays = this.daysBetween(this.startDate, task.endDate);
          const baselineEndDays = this.daysBetween(this.startDate, baseline.endDate);
          const variance = currentEndDays - baselineEndDays;

          // Color based on variance: delayed (amber), ahead (green), on-time (gray)
          let baselineColor: string;
          if (variance > 0) {
            baselineColor = this.config.darkMode ? '#f59e0b' : '#d97706'; // Amber - delayed
          } else if (variance < 0) {
            baselineColor = this.config.darkMode ? '#10b981' : '#059669'; // Green - ahead
          } else {
            baselineColor = this.config.darkMode ? '#6b7280' : '#9ca3af'; // Gray - on time
          }

          // Draw baseline bar with transparency
          this.ctx.save();
          this.ctx.globalAlpha = 0.7;
          this.ctx.fillStyle = baselineColor;
          this.ctx.fillRect(baselineStartX, baselineY, baselineWidth, baselineHeight);
          this.ctx.globalAlpha = 1;

          // Draw border
          this.ctx.strokeStyle = baselineColor;
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(baselineStartX, baselineY, baselineWidth, baselineHeight);
          this.ctx.restore();

          // Draw variance text if significant
          if (Math.abs(variance) >= 1) {
            const varianceText = variance > 0 ? `+${variance}d` : `${variance}d`;
            const textX = Math.max(startX + barWidth, baselineStartX + baselineWidth) + 4;

            this.ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
            this.ctx.fillStyle = baselineColor;
            this.ctx.textBaseline = 'middle';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(varianceText, textX, baselineY + baselineHeight / 2);
          }
        }
      }

      // Draw critical path highlight (red glow effect)
      if (this.criticalPathEnabled && this.criticalTaskIds.has(task.id)) {
        this.ctx.save();
        this.ctx.shadowColor = '#ef4444'; // Red shadow
        this.ctx.shadowBlur = 6;
        this.ctx.strokeStyle = '#ef4444'; // Red border
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX - 1, barY - 1, barWidth + 2, taskBarHeight + 2);
        this.ctx.restore();
      }

      // Draw selection highlight
      if (this.selectedTaskIds.has(task.id)) {
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX - 1, barY - 1, barWidth + 2, taskBarHeight + 2);
      }

      // Draw dependency connector circles on hover (right edge)
      if (this.hoveredTaskId === task.id && taskShape === 'task') {
        const connectorX = startX + barWidth;
        const connectorY = barY + taskBarHeight / 2;
        const connectorRadius = 5;

        // Outer circle (white background)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(connectorX, connectorY, connectorRadius + 1, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner circle (blue)
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.beginPath();
        this.ctx.arc(connectorX, connectorY, connectorRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Small arrow pointing right
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.moveTo(connectorX + 2, connectorY);
        this.ctx.lineTo(connectorX - 1, connectorY - 2);
        this.ctx.lineTo(connectorX - 1, connectorY + 2);
        this.ctx.closePath();
        this.ctx.fill();
      }

      // Draw task name on bar (if wide enough and not icon)
      if (barWidth > 50 && taskShape === 'task') {
        this.ctx.fillStyle = this.config.colors.taskBarText;
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';

        const textX = startX + 4;
        const textY = barY + taskBarHeight / 2;
        const maxTextWidth = barWidth - 8;

        let displayName = task.name;
        if (this.ctx.measureText(displayName).width > maxTextWidth) {
          while (this.ctx.measureText(displayName + '...').width > maxTextWidth && displayName.length > 0) {
            displayName = displayName.slice(0, -1);
          }
          displayName += '...';
        }

        this.ctx.fillText(displayName, textX, textY);
      }
    }
  }

  /** Draw task icon for Order, Call, Photo tasks */
  private drawTaskIcon(x: number, y: number, height: number, shape: string, color: string): void {
    const size = height - 2;
    const centerX = x + size / 2 + 2;
    const centerY = y + height / 2;
    const halfSize = size / 2;

    if (shape === 'order') {
      // Order: Orange diamond with "O" (matches old Gantt)
      this.ctx.fillStyle = '#ea580c'; // orange-600
      this.ctx.strokeStyle = '#9a3412'; // orange-800
      this.ctx.lineWidth = 1;
      // Draw diamond shape
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - halfSize); // top
      this.ctx.lineTo(centerX + halfSize, centerY); // right
      this.ctx.lineTo(centerX, centerY + halfSize); // bottom
      this.ctx.lineTo(centerX - halfSize, centerY); // left
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      // Draw "O" letter
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `bold ${size * 0.5}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('O', centerX, centerY + 1);
    } else if (shape === 'call') {
      // Call: Blue diamond with "C" (matches old Gantt)
      this.ctx.fillStyle = '#2563eb'; // blue-600
      this.ctx.strokeStyle = '#1e40af'; // blue-800
      this.ctx.lineWidth = 1;
      // Draw diamond shape
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - halfSize); // top
      this.ctx.lineTo(centerX + halfSize, centerY); // right
      this.ctx.lineTo(centerX, centerY + halfSize); // bottom
      this.ctx.lineTo(centerX - halfSize, centerY); // left
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      // Draw "C" letter
      this.ctx.fillStyle = '#fff';
      this.ctx.font = `bold ${size * 0.5}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('C', centerX, centerY + 1);
    } else if (shape === 'photo') {
      // Photo: Purple camera icon (matches old Gantt)
      this.ctx.fillStyle = '#9333ea'; // purple-600
      this.ctx.strokeStyle = '#7c3aed'; // purple-500
      this.ctx.lineWidth = 0.5;
      // Camera body (rounded rectangle)
      const bodyWidth = size * 0.9;
      const bodyHeight = size * 0.6;
      const bodyX = centerX - bodyWidth / 2;
      const bodyY = centerY - bodyHeight / 2 + 1;
      this.ctx.beginPath();
      this.ctx.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, 2);
      this.ctx.fill();
      this.ctx.stroke();
      // Viewfinder bump
      const bumpWidth = size * 0.3;
      const bumpHeight = size * 0.15;
      this.ctx.fillRect(centerX - bumpWidth / 2, bodyY - bumpHeight, bumpWidth, bumpHeight);
      // Lens outer (white circle)
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY + 1, size * 0.22, 0, Math.PI * 2);
      this.ctx.fill();
      // Lens inner (purple dot)
      this.ctx.fillStyle = '#9333ea';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY + 1, size * 0.1, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawDependencies(): void {
    const { headerHeight, rowHeight, taskBarHeight, taskBarPadding } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;
    const timelineX = this.tableWidth;

    // Create task index map for quick lookup (using visibleTasks)
    const taskIndexMap = new Map<string, number>();
    this.visibleTasks.forEach((task, index) => {
      taskIndexMap.set(task.id, index);
    });

    // Get first selected task for dependency highlighting
    const selectedTaskId = this.selectedTaskIds.size > 0 ? Array.from(this.selectedTaskIds)[0] : null;

    for (const dep of this.dependencies) {
      const fromIndex = taskIndexMap.get(dep.fromId);
      const toIndex = taskIndexMap.get(dep.toId);

      // Skip if either task is not visible
      if (fromIndex === undefined || toIndex === undefined) continue;

      const fromTask = this.visibleTasks[fromIndex];
      const toTask = this.visibleTasks[toIndex];

      // Skip if tasks don't have valid dates
      if (!fromTask.startDate || !fromTask.endDate || !toTask.startDate || !toTask.endDate) {
        continue;
      }

      // Calculate connection points based on dependency type
      let fromX: number;
      let toX: number;

      if (dep.type === 'FS' || dep.type === 'FF') {
        fromX = timelineX + this.daysBetween(this.startDate, fromTask.endDate) * dayWidth + dayWidth - this.scrollX;
      } else {
        fromX = timelineX + this.daysBetween(this.startDate, fromTask.startDate) * dayWidth - this.scrollX;
      }

      if (dep.type === 'FS' || dep.type === 'SS') {
        toX = timelineX + this.daysBetween(this.startDate, toTask.startDate) * dayWidth - this.scrollX;
      } else {
        toX = timelineX + this.daysBetween(this.startDate, toTask.endDate) * dayWidth + dayWidth - this.scrollX;
      }

      // Skip if coordinates are invalid (NaN or way out of bounds)
      if (isNaN(fromX) || isNaN(toX) || fromX < -1000 || toX < -1000 || fromX > this.width + 1000 || toX > this.width + 1000) {
        continue;
      }

      // Skip if both points are in the table area (nothing to draw in timeline)
      if (fromX < timelineX && toX < timelineX) {
        continue;
      }

      const fromY = headerHeight + fromIndex * rowHeight - this.scrollY + taskBarPadding + taskBarHeight / 2;
      const toY = headerHeight + toIndex * rowHeight - this.scrollY + taskBarPadding + taskBarHeight / 2;

      // Check if this dependency is on the critical path
      const isCriticalDep = this.criticalPathEnabled &&
        this.criticalTaskIds.has(dep.fromId) &&
        this.criticalTaskIds.has(dep.toId);

      // Check if this dependency is connected to the selected task
      // Predecessor: selected task is the "to" task (depends on from task) - yellow/black
      // Successor: selected task is the "from" task (to task depends on selected) - black/white
      const isPredecessorDep = selectedTaskId && dep.toId === selectedTaskId;
      const isSuccessorDep = selectedTaskId && dep.fromId === selectedTaskId;

      // Check if this is a broken dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toRowData = toTask.rowData as any;
      const isBroken = toRowData?.dependency_broken ||
        (toRowData?.brokenPredecessorIds && toRowData.brokenPredecessorIds.includes(dep.fromId)) ||
        (toTask as { brokenPredecessorIds?: string[] }).brokenPredecessorIds?.includes(dep.fromId);

      // Determine colors based on highlighting priority
      let strokeColor: string;
      let fillColor: string;
      let lineWidth: number;
      let arrowSize: number;
      let useDashPattern = false;

      if (isBroken) {
        // Broken dependency: red dashed with X instead of arrow
        strokeColor = '#ef4444'; // red-500
        fillColor = '#ef4444';
        lineWidth = 2;
        arrowSize = 5; // X mark size
        useDashPattern = true;
      } else if (isPredecessorDep) {
        // Predecessor dependency: yellow/black dashed (matches old UI)
        strokeColor = '#fbbf24'; // amber-400
        fillColor = '#fbbf24';
        lineWidth = 3;
        arrowSize = 8;
        useDashPattern = true;
      } else if (isSuccessorDep) {
        // Successor dependency: blue/black dashed (matches old UI)
        strokeColor = '#60a5fa'; // blue-400
        fillColor = '#60a5fa';
        lineWidth = 3;
        arrowSize = 8;
        useDashPattern = true;
      } else if (isCriticalDep) {
        // Critical path: red
        strokeColor = '#ef4444';
        fillColor = '#ef4444';
        lineWidth = 2.5;
        arrowSize = 8;
      } else {
        // Default: gray
        strokeColor = '#6b7280';
        fillColor = '#6b7280';
        lineWidth = 1.5;
        arrowSize = 6;
      }

      // Draw bezier curve
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);

      const midX = (fromX + toX) / 2;
      this.ctx.bezierCurveTo(midX, fromY, midX, toY, toX, toY);

      // Use dash pattern for predecessor/successor highlighting
      if (useDashPattern) {
        // Draw black base line first
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();

        // Draw colored dashed line on top
        this.ctx.setLineDash([6, 6]);
        this.ctx.strokeStyle = strokeColor;
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset dash pattern
      } else {
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
      }

      // Draw arrow head or X mark for broken dependencies
      if (isBroken) {
        // Draw X mark instead of arrow to indicate broken
        const xSize = arrowSize;
        this.ctx.strokeStyle = fillColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(toX - xSize, toY - xSize);
        this.ctx.lineTo(toX + xSize, toY + xSize);
        this.ctx.moveTo(toX + xSize, toY - xSize);
        this.ctx.lineTo(toX - xSize, toY + xSize);
        this.ctx.stroke();
      } else {
        // Draw regular arrow head
        const angle = Math.atan2(toY - fromY, toX - midX);
        this.ctx.beginPath();
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(
          toX - arrowSize * Math.cos(angle - Math.PI / 6),
          toY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
          toX - arrowSize * Math.cos(angle + Math.PI / 6),
          toY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
      }
    }
  }

  private drawTodayMarker(): void {
    const today = getTodayInCompanyTimezone();
    const dayWidth = this.config.dayWidth * this.zoom;
    const x = this.tableWidth + this.daysBetween(this.startDate, today) * dayWidth - this.scrollX;

    // Skip if not visible
    if (x < this.tableWidth || x > this.width) return;

    this.ctx.strokeStyle = this.config.colors.todayMarker;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, this.config.headerHeight);
    this.ctx.lineTo(x, this.height);
    this.ctx.stroke();
  }

  private drawHeaders(): void {
    const { headerHeight } = this.config;
    const dayWidth = this.config.dayWidth * this.zoom;

    // Draw table header background
    this.ctx.fillStyle = this.config.colors.headerBackground;
    this.ctx.fillRect(0, 0, this.tableWidth, headerHeight);

    // Draw table column headers
    let columnX = TABLE_LEFT_PADDING;
    for (const column of this.columns) {
      if (!column.visible) continue;

      this.ctx.fillStyle = this.config.colors.headerText;
      this.ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      this.ctx.textBaseline = 'middle';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(column.label, columnX + column.width / 2, headerHeight / 2);

      columnX += column.width;
    }

    // Draw timeline header background
    this.ctx.fillStyle = this.config.colors.headerBackground;
    this.ctx.fillRect(this.tableWidth, 0, this.width - this.tableWidth, headerHeight);

    // Draw date headers
    const visibleDays = Math.ceil(this.width / dayWidth) + 2;
    const startDayOffset = Math.floor(this.scrollX / dayWidth);

    this.ctx.fillStyle = this.config.colors.headerText;
    this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'center';

    for (let i = 0; i < visibleDays; i++) {
      const dayOffset = startDayOffset + i;
      const date = new Date(this.startDate);
      date.setDate(date.getDate() + dayOffset);

      const x = this.tableWidth + dayOffset * dayWidth - this.scrollX + dayWidth / 2;

      // Draw day number
      this.ctx.fillText(String(date.getDate()), x, headerHeight - 12);

      // Draw month on first day of month or first visible day
      if (date.getDate() === 1 || i === 0) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.fillText(monthNames[date.getMonth()], x, headerHeight - 30);
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      }
    }

    // Draw header border
    this.ctx.strokeStyle = this.config.colors.borderColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, headerHeight);
    this.ctx.lineTo(this.width, headerHeight);
    this.ctx.stroke();
  }

  // =============================================================================
  // Private: Overlay Position Calculation
  // =============================================================================

  private updateOverlayPositions(): void {
    const { headerHeight, rowHeight } = this.config;
    const positions: OverlayPosition[] = [];

    // Calculate visible range (from visibleTasks)
    const startRow = Math.max(0, Math.floor(this.scrollY / rowHeight));
    const endRow = Math.min(
      this.visibleTasks.length - 1,
      Math.ceil((this.scrollY + this.height - headerHeight) / rowHeight)
    );

    // Emit visible range
    this.callbacks.onVisibleRangeChange?.({ start: startRow, end: endRow });

    // Calculate overlay positions for visible rows
    for (let i = startRow; i <= endRow; i++) {
      if (i >= this.visibleTasks.length) break;
      const task = this.visibleTasks[i];
      const y = headerHeight + i * rowHeight - this.scrollY;

      // Calculate checkbox positions
      const checkboxes: OverlayPosition['checkboxes'] = [];
      let columnX = TABLE_LEFT_PADDING;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowData = task.rowData as any;
      for (const column of this.columns) {
        if (!column.visible) continue;

        if (column.type === 'checkbox' && column.field) {
          const isChecked = !!rowData?.[column.field];
          checkboxes.push({
            x: columnX,           // Column left position
            width: column.width,  // Column width
            field: column.field,
            checked: isChecked,
          });
        }

        columnX += column.width;
      }

      positions.push({
        taskId: task.id,
        rowIndex: i,
        y,
        checkboxes,
      });
    }

    this.callbacks.onOverlayPositionsChange?.(positions);
  }

  // =============================================================================
  // Private: Utilities
  // =============================================================================

  private daysBetween(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(date2);
    d2.setHours(0, 0, 0, 0);

    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((d2.getTime() - d1.getTime()) / oneDay);
  }

  private calculateDateRange(): void {
    if (this.tasks.length === 0) return;

    let minDate = this.tasks[0].startDate;
    let maxDate = this.tasks[0].endDate;

    for (const task of this.tasks) {
      if (task.startDate < minDate) minDate = task.startDate;
      if (task.endDate > maxDate) maxDate = task.endDate;
    }

    // Set start date with buffer
    this.startDate = new Date(minDate);
    this.startDate.setDate(this.startDate.getDate() - 7);
  }

  private emitViewportChange(): void {
    this.callbacks.onViewportChange?.({
      scrollX: this.scrollX,
      scrollY: this.scrollY,
      zoom: this.zoom,
    });
  }

  // =============================================================================
  // Private: Task Bar Color (SSoT from old Gantt Renderer.ts)
  // =============================================================================

  /**
   * Get task bar color based on checkbox status
   * SSoT: Priority order matches old Gantt (Renderer.ts:1524-1566)
   * Complete > Supplier Confirm > Confirm > Hold > Started > Default
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getTaskBarColor(rowData: any): string {
    // 1. Dark gray for completed tasks (beats all)
    if (rowData?.is_completed) {
      return '#1f2937'; // gray-800
    }

    // 2. Purple for supplier confirmed tasks
    if (rowData?.supplier_confirm) {
      return '#a855f7'; // purple-500
    }

    // 3. Orange for confirmed tasks
    if (rowData?.confirm) {
      return '#f97316'; // orange-500
    }

    // 4. Tan for manually positioned (held) tasks
    if (rowData?.hold) {
      return '#D4A574'; // Tan - brand color
    }

    // 5. Green for started tasks
    if (rowData?.started) {
      return '#10b981'; // emerald-500
    }

    // 6. Default gray for not started
    return '#9ca3af'; // gray-400
  }
}

export default UnifiedGanttCanvas;
