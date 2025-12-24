/**
 * Gantt Chart Type Definitions
 *
 * Unified types for the Canvas-based Gantt chart engine.
 * These types are used across the engine, API integration, and React components.
 */

// ============================================================================
// Core Task Types
// ============================================================================

/**
 * Task status values matching backend sm_template_row states
 */
export type TaskStatus =
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'on-hold'
  | 'at-risk';

/**
 * Lock types that prevent task movement
 */
export type LockType =
  | 'supplierConfirmed'
  | 'started'
  | 'manuallyPositioned';

/**
 * Hold state reasons
 */
export type HoldReason =
  | 'whs_incident'
  | 'weather_delay'
  | 'permit_delay'
  | 'client_request'
  | 'material_delay'
  | 'subcontractor_issue'
  | 'other';

/**
 * Dependency types between tasks
 * - FS: Finish-to-Start (default) - Task B starts when Task A finishes
 * - SS: Start-to-Start - Task B starts when Task A starts
 * - FF: Finish-to-Finish - Task B finishes when Task A finishes
 * - SF: Start-to-Finish - Task B finishes when Task A starts
 */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

// ============================================================================
// API Types (from sm_template_rows endpoint)
// ============================================================================

/**
 * Predecessor definition in API format
 */
export interface ApiPredecessor {
  id: number;
  type: DependencyType;
  lag: number;
}

/**
 * Schedule Template Row from API
 */
export interface SmTemplateRow {
  id: number;
  task_number: number;
  name: string;
  description: string | null;
  sequence_order: number;
  duration_days: number;
  start_day_offset: number | null;
  predecessor_ids: ApiPredecessor[];
  predecessor_display: string;
  predecessor_display_names: string[];
  trade: string | null;
  stage: string | null;
  cost_centre: string | null;
  assigned_role: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  checklist_id: number | null;
  parent_row_id: number | null;
  require_photo: boolean;
  require_certificate: boolean;
  require_supervisor_check: boolean;
  po_required: boolean;
  critical_po: boolean;
  create_po_on_job_start: boolean;
  cert_lag_days: number | null;
  has_subtasks: boolean;
  subtask_count: number | null;
  subtask_names: string[] | null;
  spawn_photo_task: boolean;
  spawn_scan_task: boolean;
  pass_fail_enabled: boolean;
  order_time_days: number | null;
  call_time_days: number | null;
  documentation_category_ids: number[];
  show_in_docs_tab: boolean;
  linked_task_ids: number[];
  price_book_item_ids: number[];
  tags: string[];
  color: string | null;
  is_active: boolean;
  // New Schedule Master fields
  auto_include: boolean;
  allow_duplicates: boolean;
  ai_select: boolean;
  plan_type_ids: number[];
  start_entity_tab_ids: number[];
  complete_entity_tab_ids: number[];
  photo_entity_tab_id: number | null;
  linked_po_task_id: number | null;
  linked_po_task_name: string | null;
  require_supplier_confirm: boolean;
  is_master: boolean;
  // Multi-template support
  sm_template_ids: number[];
  created_at: string;
  updated_at: string;
}

/**
 * Schedule Template from API
 */
export interface SmTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
}

// ============================================================================
// Canvas Engine Types
// ============================================================================

/**
 * Task for canvas rendering
 * Simplified from SmTemplateRow with computed dates
 */
export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress?: number;
  status?: TaskStatus;
  locked?: LockType;
  predecessorIds?: string[];
  supplierId?: number;
  supplierName?: string;
  // Original row reference for full data access
  rowData?: SmTemplateRow;
}

/**
 * Dependency between tasks for canvas rendering
 */
export interface GanttDependency {
  id: string;
  fromId: string;
  toId: string;
  type: DependencyType;
  lag?: number;
}

/**
 * Color configuration for Gantt chart
 */
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

/**
 * Configuration for the Gantt canvas
 */
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

/**
 * Viewport state for pan/zoom
 */
export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  startDate: Date;
}

/**
 * Complete Gantt chart state
 */
export interface GanttState {
  tasks: GanttTask[];
  dependencies: GanttDependency[];
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  viewportState: ViewportState;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Task click event payload
 */
export interface TaskClickEvent {
  task: GanttTask;
  originalEvent: MouseEvent;
}

/**
 * Task drag event payload
 */
export interface TaskDragEvent {
  task: GanttTask;
  newStartDate: Date;
  originalStartDate: Date;
}

/**
 * Dependency click event payload
 */
export interface DependencyClickEvent {
  dependency: GanttDependency;
  originalEvent: MouseEvent;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for GanttCanvas React component
 */
export interface GanttCanvasProps {
  templateId: number;
  darkMode?: boolean;
  onTaskClick?: (event: TaskClickEvent) => void;
  onTaskDoubleClick?: (event: TaskClickEvent) => void;
  onTaskDrag?: (event: TaskDragEvent) => void;
  onDependencyClick?: (event: DependencyClickEvent) => void;
  className?: string;
}

// ============================================================================
// Cascade Types
// ============================================================================

/**
 * Result of cascade calculation
 */
export interface CascadeResult {
  willCascade: GanttTask[];
  willBreak: GanttTask[];
  locked: GanttTask[];
}

/**
 * Resolution option for cascade conflicts
 */
export interface CascadeResolution {
  taskId: string;
  action: 'cascade' | 'break' | 'keep';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert SmTemplateRow to GanttTask
 * Calculates dates based on sequence order and duration
 */
export function convertRowToTask(
  row: SmTemplateRow,
  projectStartDate: Date,
  taskDateMap?: Map<number, { start: Date; end: Date }>
): GanttTask {
  // Calculate start date based on predecessors or fallback to sequence
  let startDate: Date;
  let endDate: Date;

  if (taskDateMap && row.predecessor_ids?.length > 0) {
    // Find the latest end date from predecessors
    let latestEnd = projectStartDate;
    for (const pred of row.predecessor_ids) {
      const predDates = taskDateMap.get(pred.id);
      if (predDates) {
        const predEndWithLag = new Date(predDates.end);
        predEndWithLag.setDate(predEndWithLag.getDate() + (pred.lag || 0));
        if (predEndWithLag > latestEnd) {
          latestEnd = predEndWithLag;
        }
      }
    }
    startDate = new Date(latestEnd);
  } else {
    // Fallback: use start_day_offset or sequence order * 7 days
    const offsetDays = row.start_day_offset ?? ((row.sequence_order - 1) * 7);
    startDate = new Date(projectStartDate);
    startDate.setDate(startDate.getDate() + offsetDays);
  }

  // Calculate end date based on duration
  endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (row.duration_days || 1));

  return {
    id: String(row.id),
    name: row.name,
    startDate,
    endDate,
    progress: 0,
    status: 'not-started',
    locked: undefined,
    predecessorIds: row.predecessor_ids?.map((p) => String(p.id)) || [],
    supplierId: row.supplier_id ?? undefined,
    supplierName: row.supplier_name ?? undefined,
    rowData: row,
  };
}

/**
 * Convert SmTemplateRows to GanttTasks with calculated dates
 */
export function convertRowsToTasks(
  rows: SmTemplateRow[],
  projectStartDate: Date
): GanttTask[] {
  // First pass: create date map based on sequence order
  const taskDateMap = new Map<number, { start: Date; end: Date }>();

  // Sort by sequence order
  const sortedRows = [...rows].sort((a, b) => a.sequence_order - b.sequence_order);

  // Calculate dates for each row
  for (const row of sortedRows) {
    const task = convertRowToTask(row, projectStartDate, taskDateMap);
    taskDateMap.set(row.id, { start: task.startDate, end: task.endDate });
  }

  // Second pass: convert all rows with the complete date map
  return sortedRows.map((row) => convertRowToTask(row, projectStartDate, taskDateMap));
}

/**
 * Convert predecessor data to GanttDependencies
 */
export function convertToDependencies(rows: SmTemplateRow[]): GanttDependency[] {
  const dependencies: GanttDependency[] = [];

  for (const row of rows) {
    if (!row.predecessor_ids) continue;

    for (const pred of row.predecessor_ids) {
      dependencies.push({
        id: `${pred.id}-${row.id}`,
        fromId: String(pred.id),
        toId: String(row.id),
        type: pred.type || 'FS',
        lag: pred.lag || 0,
      });
    }
  }

  return dependencies;
}
