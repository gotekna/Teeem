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
 * Task status values matching backend SmScheduleMaster states
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
 * Task shape types for visual differentiation
 * - task: Standard rectangular bar (default)
 * - milestone: Diamond shape for single-day events
 * - order: Diamond with order icon (spawned Order tasks)
 * - call: Diamond with phone icon (spawned Call tasks)
 */
export type TaskShape = 'task' | 'milestone' | 'order' | 'call';

/**
 * Dependency types between tasks
 * - FS: Finish-to-Start (default) - Task B starts when Task A finishes
 * - SS: Start-to-Start - Task B starts when Task A starts
 * - FF: Finish-to-Finish - Task B finishes when Task A finishes
 * - SF: Start-to-Finish - Task B finishes when Task A starts
 */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

// ============================================================================
// API Types (from sm_schedule_master endpoint)
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
 * Schedule Master record from API
 */
export interface SmScheduleMaster {
  id: number;
  task_number: number;
  name: string;
  description: string | null;
  sequence_order: number;
  duration_days: number;
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
  confirm: boolean;
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
  supplier_confirm: boolean;
  finance_approved: boolean;
  is_master: boolean;
  header: string | null;
  // Multi-template support
  sm_template_ids: number[];
  // Manual positioning (held dates)
  hold: boolean | null;
  hold_date: string | null;
  // Completion tracking
  is_completed: boolean | null;
  completed_at: string | null;
  predecessor_ids_backup: ApiPredecessor[] | null;
  // Broken dependency indicator (locked task that had its dependency removed)
  dependency_broken: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Schedule Master Template from API
 */
export interface SmScheduleMasterTemplate {
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
 * Simplified from SmScheduleMaster with computed dates
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
  // Shape determines visual rendering (default: 'task')
  shape?: TaskShape;
  // Original row reference for full data access
  rowData?: SmScheduleMaster;
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
 * Extended SmScheduleMaster with downstream successor info for cascade dialogs
 */
export interface SuccessorInfo extends SmScheduleMaster {
  downstreamCount: number;
  downstreamTasks: SmScheduleMaster[];
  lockedDownstreamCount: number;
  hasMoreDownstream: boolean;
}

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
 * Australian public holidays (Queensland)
 * Format: MM-DD for recurring, YYYY-MM-DD for specific dates
 */
function getAustralianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // Fixed holidays
  holidays.add(`${year}-01-01`); // New Year's Day
  holidays.add(`${year}-01-26`); // Australia Day
  holidays.add(`${year}-04-25`); // ANZAC Day
  holidays.add(`${year}-12-25`); // Christmas Day
  holidays.add(`${year}-12-26`); // Boxing Day

  // Easter dates (approximate - these shift each year)
  // 2024: March 29 (Good Friday), April 1 (Easter Monday)
  // 2025: April 18 (Good Friday), April 21 (Easter Monday)
  if (year === 2024) {
    holidays.add('2024-03-29'); // Good Friday
    holidays.add('2024-03-30'); // Easter Saturday
    holidays.add('2024-04-01'); // Easter Monday
  } else if (year === 2025) {
    holidays.add('2025-04-18'); // Good Friday
    holidays.add('2025-04-19'); // Easter Saturday
    holidays.add('2025-04-21'); // Easter Monday
  } else if (year === 2026) {
    holidays.add('2026-04-03'); // Good Friday
    holidays.add('2026-04-04'); // Easter Saturday
    holidays.add('2026-04-06'); // Easter Monday
  }

  // Queen's Birthday (QLD) - First Monday of October
  const oct1 = new Date(year, 9, 1);
  const firstMondayOct = new Date(oct1);
  firstMondayOct.setDate(1 + ((8 - oct1.getDay()) % 7));
  holidays.add(firstMondayOct.toISOString().split('T')[0]);

  return holidays;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a holiday
 * Uses local date components (not UTC) to match holiday strings
 */
function isHoliday(date: Date, holidays: Set<string>): boolean {
  // Use local date components, not UTC (toISOString returns UTC which breaks timezone handling)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return holidays.has(dateStr);
}

/**
 * Count working days between two dates (INCLUSIVE of both start and end)
 * A task from Monday to Wednesday = 3 working days
 */
export function countWorkingDays(startDate: Date, endDate: Date): number {
  const holidays = getAustralianHolidays(startDate.getFullYear());
  // Also get holidays for end date year if different
  if (endDate.getFullYear() !== startDate.getFullYear()) {
    const endYearHolidays = getAustralianHolidays(endDate.getFullYear());
    endYearHolidays.forEach(h => holidays.add(h));
  }

  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    if (!isWeekend(current) && !isHoliday(current, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Add working days to a date (skipping weekends and holidays)
 */
export function addWorkingDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  const holidays = getAustralianHolidays(result.getFullYear());

  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);

    // Check if we crossed into a new year
    if (result.getMonth() === 0 && result.getDate() === 1) {
      // Merge in holidays for the new year
      const newYearHolidays = getAustralianHolidays(result.getFullYear());
      newYearHolidays.forEach(h => holidays.add(h));
    }

    if (!isWeekend(result) && !isHoliday(result, holidays)) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Skip to next working day if current date is weekend/holiday
 */
export function skipToNextWorkingDay(date: Date): Date {
  const result = new Date(date);
  const holidays = getAustralianHolidays(result.getFullYear());

  while (isWeekend(result) || isHoliday(result, holidays)) {
    result.setDate(result.getDate() + 1);

    // Check if we crossed into a new year
    if (result.getMonth() === 0 && result.getDate() === 1) {
      const newYearHolidays = getAustralianHolidays(result.getFullYear());
      newYearHolidays.forEach(h => holidays.add(h));
    }
  }

  return result;
}

/**
 * Convert SmScheduleMaster to GanttTask
 * Calculates dates based on sequence order and duration
 * Skips weekends and Australian public holidays
 */
export function convertRowToTask(
  row: SmScheduleMaster,
  projectStartDate: Date,
  taskDateMap?: Map<number, { start: Date; end: Date }>
): GanttTask {
  // Calculate start date based on predecessors or fallback to sequence
  let startDate: Date;
  let endDate: Date;

  // Check if task is LOCKED - locked tasks NEVER recalculate from predecessors
  // Lock types: Confirmed, Supplier Confirmed, Finance Approved, Completed
  const isLocked = row.confirm || row.supplier_confirm ||
                   row.finance_approved || row.is_completed;

  // If manually positioned OR locked with hold_date, use the manual start date
  // Locked tasks should NEVER move based on predecessor changes
  if ((row.hold || isLocked) && row.hold_date) {
    startDate = skipToNextWorkingDay(new Date(row.hold_date));
  } else if (taskDateMap && row.predecessor_ids?.length > 0 && !isLocked) {
    // Find the latest required start date from all predecessors
    let latestRequiredStart = projectStartDate;
    for (const pred of row.predecessor_ids) {
      const predDates = taskDateMap.get(pred.id);
      if (predDates) {
        const predType = pred.type || 'FS';
        const lag = pred.lag || 0;
        let requiredStart: Date;

        switch (predType) {
          case 'FS': // Finish-to-Start: successor starts after predecessor ends
            // Start on next working day after predecessor ends
            requiredStart = addWorkingDays(predDates.end, 1 + lag);
            break;
          case 'SS': // Start-to-Start: successor starts when predecessor starts
            requiredStart = new Date(predDates.start);
            if (lag > 0) {
              requiredStart = addWorkingDays(predDates.start, lag);
            } else {
              requiredStart = skipToNextWorkingDay(requiredStart);
            }
            break;
          case 'FF': // Finish-to-Finish: handled by end date, start calculated backwards
          case 'SF': // Start-to-Finish: rare, start calculated backwards
          default:
            // For FF/SF, just use predecessor end as reference
            requiredStart = addWorkingDays(predDates.end, 1 + lag);
            break;
        }

        if (requiredStart > latestRequiredStart) {
          latestRequiredStart = requiredStart;
        }
      }
    }
    startDate = skipToNextWorkingDay(new Date(latestRequiredStart));
  } else {
    // No predecessors - start at project start date (today)
    startDate = skipToNextWorkingDay(new Date(projectStartDate));
  }

  // Calculate end date based on duration (in working days)
  const duration = row.duration_days || 1;
  if (duration <= 1) {
    // Same day task
    endDate = new Date(startDate);
  } else {
    // Add working days for duration
    endDate = addWorkingDays(startDate, duration - 1);
  }

  // Determine task shape based on name prefix (spawned tasks) or duration
  let shape: TaskShape = 'task';
  if (row.name.startsWith('Order ')) {
    shape = 'order';
  } else if (row.name.startsWith('Call ')) {
    shape = 'call';
  } else if (duration <= 1) {
    // Single-day tasks could be milestones (optional - keep as task for now)
    // shape = 'milestone';
  }

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
    shape,
    rowData: row,
  };
}

/**
 * Convert SmScheduleMaster records to GanttTasks with calculated dates
 */
export function convertRowsToTasks(
  rows: SmScheduleMaster[],
  projectStartDate: Date
): GanttTask[] {
  // First pass: create date map based on sequence order
  // Key by task_number (not row.id) because predecessor_ids reference task_number
  const taskDateMap = new Map<number, { start: Date; end: Date }>();

  // Sort by sequence order
  const sortedRows = [...rows].sort((a, b) => a.sequence_order - b.sequence_order);

  // Calculate dates for each row
  for (const row of sortedRows) {
    const task = convertRowToTask(row, projectStartDate, taskDateMap);
    taskDateMap.set(row.task_number, { start: task.startDate, end: task.endDate });
  }

  // Second pass: convert all rows with the complete date map
  const tasks = sortedRows.map((row) => convertRowToTask(row, projectStartDate, taskDateMap));

  // Third pass: update header tasks to span their children
  // Header rows have header === 'Header' and children have parent_row_id pointing to them
  // If a header has dependencies, shift its children accordingly
  const headerIds = new Set(
    sortedRows.filter(r => r.header === 'Header').map(r => r.id)
  );

  if (headerIds.size > 0) {
    // Build map of header ID -> child tasks
    const headerChildrenMap = new Map<number, GanttTask[]>();
    for (const task of tasks) {
      const row = sortedRows.find(r => String(r.id) === task.id);
      if (row?.parent_row_id && headerIds.has(row.parent_row_id)) {
        const children = headerChildrenMap.get(row.parent_row_id) || [];
        children.push(task);
        headerChildrenMap.set(row.parent_row_id, children);
      }
    }

    // Update header task dates to span their children
    // If header has dependencies, shift children first
    for (const task of tasks) {
      const row = sortedRows.find(r => String(r.id) === task.id);
      if (row?.header === 'Header') {
        const children = headerChildrenMap.get(row.id);
        if (children && children.length > 0) {
          // Find current min start from children
          let minStart = children[0].startDate;
          let maxEnd = children[0].endDate;
          for (const child of children) {
            if (child.startDate < minStart) minStart = child.startDate;
            if (child.endDate > maxEnd) maxEnd = child.endDate;
          }

          // Check if header has dependencies - if so, calculate required start
          if (row.predecessor_ids && row.predecessor_ids.length > 0) {
            let latestRequiredStart: Date | null = null;

            for (const pred of row.predecessor_ids) {
              const predDates = taskDateMap.get(pred.id);
              if (!predDates) continue;

              const predType = pred.type || 'FS';
              const lagDays = pred.lag || 0;
              let requiredStart: Date;

              if (predType === 'FS') {
                // Finish-to-Start: start after predecessor finishes + lag
                requiredStart = addWorkingDays(predDates.end, 1 + lagDays);
              } else if (predType === 'SS') {
                // Start-to-Start: start when predecessor starts + lag
                requiredStart = addWorkingDays(predDates.start, lagDays);
              } else {
                // Default to FS
                requiredStart = addWorkingDays(predDates.end, 1 + lagDays);
              }

              if (!latestRequiredStart || requiredStart > latestRequiredStart) {
                latestRequiredStart = requiredStart;
              }
            }

            // If header needs to start later due to dependencies, shift all children
            if (latestRequiredStart && latestRequiredStart > minStart) {
              const offsetMs = latestRequiredStart.getTime() - minStart.getTime();
              for (const child of children) {
                child.startDate = new Date(child.startDate.getTime() + offsetMs);
                child.endDate = new Date(child.endDate.getTime() + offsetMs);
              }
              // Recalculate min/max after shift
              minStart = new Date(latestRequiredStart);
              maxEnd = new Date(maxEnd.getTime() + offsetMs);
            }
          }

          task.startDate = new Date(minStart);
          task.endDate = new Date(maxEnd);
        }
      }
    }
  }

  return tasks;
}

/**
 * Convert predecessor data to GanttDependencies
 */
export function convertToDependencies(rows: SmScheduleMaster[]): GanttDependency[] {
  const dependencies: GanttDependency[] = [];

  // Build lookup: task_number -> row.id (for converting predecessor references)
  const taskNumToRowId = new Map<number, number>();
  for (const row of rows) {
    taskNumToRowId.set(row.task_number, row.id);
  }

  for (const row of rows) {
    if (!row.predecessor_ids) continue;

    for (const pred of row.predecessor_ids) {
      // pred.id is task_number, need to convert to row.id for matching task.id
      const fromRowId = taskNumToRowId.get(pred.id);
      if (!fromRowId) continue; // Skip if predecessor doesn't exist

      dependencies.push({
        id: `${fromRowId}-${row.id}`,
        fromId: String(fromRowId),
        toId: String(row.id),
        type: pred.type || 'FS',
        lag: pred.lag || 0,
      });
    }
  }

  return dependencies;
}
