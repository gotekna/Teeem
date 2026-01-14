/**
 * useGanttDataManager - SSoT for Gantt Chart Data and Behavior
 *
 * This hook is THE ONLY place where Gantt behavior is defined.
 * Both Schedule Master (templates) and Job Gantt V2 (job tasks) use this hook.
 * Fix once → works everywhere.
 *
 * Usage:
 *   Template mode: useGanttDataManager({ mode: 'template', templateId: 123 })
 *   Job mode:      useGanttDataManager({ mode: 'job', jobId: 456 })
 */

import * as React from 'react';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { validateDependencies } from '@/lib/api/schemas/gantt';
import {
  convertRowsToTasks,
  isHeaderRow,
  isWorkingDay,
  skipToPreviousWorkingDay,
  type GanttTask,
  type GanttDependency,
  type SmScheduleMaster,
  type SuccessorInfo,
} from '@/lib/gantt/types';
import { getTodayInCompanyTimezone } from '@/lib/stores/company-settings-store';
import { type GanttMode, getGanttApiConfig, wrapPayload } from './ganttApi';

// =============================================================================
// Types
// =============================================================================

export interface GanttDataManagerConfig {
  mode: GanttMode;
  templateId?: number;
  jobId?: number;
  /** Show all PO required tasks including those without suppliers (template mode only) */
  showAllPOTasks?: boolean;
  /** Show claim tasks (hidden by default in template mode) */
  showClaims?: boolean;
}

export interface EditRowForm {
  name?: string;
  description?: string;
  duration_days?: number;
  sequence_order?: number;
  trade?: string;
  stage?: string;
  assigned_role?: string | null;
  cost_centre?: string;
  header_gantt?: string | { id: number; display: string } | null;
  po_required?: boolean;
  critical_po?: boolean;
  create_po_on_job_start?: boolean;
  require_photo?: boolean;
  pass_fail_enabled?: boolean;
  spawn_order_task?: boolean;
  spawn_call_task?: boolean;
  order_time_days?: number;
  call_time_days?: number;
  linked_task_ids?: number[];
  allow_header?: boolean;
  is_active?: boolean;
  tags?: string[];
}

export interface CascadeDialogState {
  isOpen: boolean;
  task: GanttTask | null;
  newStartDate: Date | null;
  successors: SmScheduleMaster[];
  lockedSuccessors: SuccessorInfo[];
  unlockedSuccessors: SuccessorInfo[];
}

export interface ConfirmDialogState {
  isOpen: boolean;
  type: 'confirm' | 'supplierConfirm';
  task: GanttTask | null;
  isChecking: boolean;
  affectedSuccessors: SmScheduleMaster[];
}

export interface DependencyEditorState {
  isOpen: boolean;
  task: GanttTask | null;
  visibleTasks: GanttTask[];
  /** Pending predecessor from drag-create (not yet saved) */
  pendingPredecessor?: { taskNumber: number; type: string; lag: number };
  /** Pending successor from drag-create (not yet saved) */
  pendingSuccessor?: { taskNumber: number; type: string; lag: number };
}

export interface StartTaskDialogState {
  isOpen: boolean;
  task: GanttTask | null;
  headerName: string | null;
  hasPredecessors: boolean;
  isTodayWorkingDay: boolean;
  lastWorkingDay: Date | null;
}

export interface SupplierConfirmDialogState {
  isOpen: boolean;
  task: GanttTask | null;
  /** true = confirming, false = viewing/un-confirming */
  isConfirming: boolean;
  method: 'phone' | 'text' | 'email' | null;
  contactName: string;
  supplierName: string | null;
  supplierEmail: string | null;
  /** Reason for job not ready (used with Email Supplier) */
  reason: string;
  /** Whether to send email to supplier */
  sendEmail: boolean;
  /** Previous confirmation values (when viewing existing confirmation) */
  previousMethod: 'phone' | 'text' | 'email' | null;
  previousContactName: string;
  /** Whether task has predecessors (affects UI options) */
  hasPredecessors: boolean;
  /** Option selected: 'current' = lock at current date, 'break' = break deps and confirm */
  confirmOption: 'current' | 'break' | null;
}

export interface UndoState {
  startDate: Date;
  endDate: Date;
  duration: number;
  hold: boolean;
  holdDate: string | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract ID from lookup values that might be objects or primitives.
 */
function extractLookupId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.id !== undefined) return String(obj.id);
    if (obj.value !== undefined) return String(obj.value);
    return undefined;
  }
  return String(value);
}

/**
 * Extract display value from lookup column
 */
function extractLookupDisplay(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.display === 'string') return obj.display;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
  }
  return undefined;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useGanttDataManager(config: GanttDataManagerConfig) {
  const { mode, templateId, jobId, showAllPOTasks, showClaims } = config;
  const { toast } = useToast();

  // Check if we have a valid ID for the mode
  const hasValidId = (mode === 'template' && templateId) || (mode === 'job' && jobId);

  // Get API config for this mode (only if we have a valid ID)
  const apiConfig = React.useMemo(
    () => hasValidId ? getGanttApiConfig(mode, { templateId, jobId, showAllPOTasks, showClaims }) : null,
    [mode, templateId, jobId, showAllPOTasks, showClaims, hasValidId]
  );

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Core data state
  const [tasks, setTasks] = React.useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = React.useState<GanttDependency[]>([]);
  const [rows, setRows] = React.useState<SmScheduleMaster[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Undo history
  const [undoHistory, setUndoHistory] = React.useState<Map<string, UndoState>>(new Map());

  // Cascade dialog (for task moves with successors)
  const [cascadeDialog, setCascadeDialog] = React.useState<CascadeDialogState>({
    isOpen: false,
    task: null,
    newStartDate: null,
    successors: [],
    lockedSuccessors: [],
    unlockedSuccessors: [],
  });
  const [lockedTaskDecisions, setLockedTaskDecisions] = React.useState<Record<number, 'break' | 'cascade'>>({});

  // Confirm dialog (for supplier_confirm/confirm toggles)
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmDialogState>({
    isOpen: false,
    type: 'confirm',
    task: null,
    isChecking: false,
    affectedSuccessors: [],
  });

  // Dependency editor
  const [dependencyEditorState, setDependencyEditorState] = React.useState<DependencyEditorState>({
    isOpen: false,
    task: null,
    visibleTasks: [],
  });

  // Start task dialog
  const [startTaskDialog, setStartTaskDialog] = React.useState<StartTaskDialogState>({
    isOpen: false,
    task: null,
    headerName: null,
    hasPredecessors: false,
    isTodayWorkingDay: true,
    lastWorkingDay: null,
  });

  // Supplier confirm dialog
  const [supplierConfirmDialog, setSupplierConfirmDialog] = React.useState<SupplierConfirmDialogState>({
    isOpen: false,
    task: null,
    isConfirming: true,
    method: null,
    contactName: '',
    supplierName: null,
    supplierEmail: null,
    reason: '',
    sendEmail: false,
    previousMethod: null,
    previousContactName: '',
    hasPredecessors: false,
    confirmOption: null,
  });

  // Edit sheet
  const [editSheetOpen, setEditSheetOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<GanttTask | null>(null);
  const [editingRow, setEditingRow] = React.useState<SmScheduleMaster | null>(null);
  const [editRowForm, setEditRowForm] = React.useState<EditRowForm>({});
  const [saving, setSaving] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-save refs
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialFormLoadRef = React.useRef(true);

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  const loadData = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    console.log('[GanttDataManager] loadData called', { mode, hasApiConfig: !!apiConfig, jobId, templateId, silent });

    if (!apiConfig) {
      console.log('[GanttDataManager] No apiConfig, returning early');
      setTasks([]);
      setDependencies([]);
      setRows([]);
      return;
    }

    // Silent mode: skip loading state to avoid white screen flash
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      // For templates: run validate_dates first (auto-rollover)
      let dateMap: Record<number, { start_date: string; end_date: string }> | null = null;
      if (mode === 'template' && apiConfig.validateDatesUrl) {
        try {
          console.log('[GanttDataManager] 🔄 Running template auto-rollover...');
          const validateResult = await api.post<{
            success: boolean;
            updated: number;
            date_map: Record<number, { start_date: string; end_date: string }>;
          }>(apiConfig.validateDatesUrl);

          if (validateResult?.updated && validateResult.updated > 0) {
            console.log(`[GanttDataManager] ✅ Template auto-rollover: ${validateResult.updated} task(s)`);
          }
          dateMap = validateResult?.date_map || null;
        } catch (err) {
          console.warn('[GanttDataManager] Template auto-rollover failed:', err);
        }
      }

      // For jobs: run validate_dates (auto-rollover on load)
      if (mode === 'job' && jobId) {
        try {
          console.log('[GanttDataManager] 🔄 Running job rollover...');
          const validateResult = await api.post<{
            success: boolean;
            rolled_over: number;
            extended: number;
            cascaded: number;
          }>(`/api/v1/jobs/${jobId}/sm_tasks/validate_dates`);

          if (validateResult) {
            const fixCount = (validateResult.rolled_over || 0) + (validateResult.extended || 0);
            if (fixCount > 0) {
              console.log(`[GanttDataManager] ✅ Job rollover: ${fixCount} task(s)`);
              toast({
                title: 'Schedule Updated',
                description: `${fixCount} task(s) rolled forward`,
              });
            }
          }
        } catch (err) {
          console.warn('[GanttDataManager] Job rollover failed:', err);
        }
      }

      // Fetch holidays for working day calculations
      let holidayDates: Set<string> | undefined;
      try {
        const currentYear = new Date().getFullYear();
        const holidayResponse = await api.get<{ dates: string[] }>(
          `/api/v1/public_holidays/dates?year_start=${currentYear - 1}&year_end=${currentYear + 2}&region=QLD`
        );
        if (holidayResponse?.dates) {
          holidayDates = new Set(holidayResponse.dates);
          console.log(`[GanttDataManager] 📅 Loaded ${holidayDates.size} holidays`);
        }
      } catch (err) {
        console.warn('[GanttDataManager] Failed to load holidays from API:', err);
        // SSoT: No fallback - working day calculations will proceed without holidays
      }

      // Fetch data
      const response = await api.get<{
        success?: boolean;
        rows?: SmScheduleMaster[];
        tasks?: SmScheduleMaster[];
        gantt_data?: {
          tasks?: SmScheduleMaster[];
          rows?: SmScheduleMaster[];
          dependencies?: Array<{
            id: string;
            fromId: string;
            toId: string;
            type: 'FS' | 'SS' | 'FF' | 'SF';
            lag?: number;
          }>;
        };
        dependencies?: Array<{
          id: string;
          fromId: string;
          toId: string;
          type: 'FS' | 'SS' | 'FF' | 'SF';
          lag?: number;
        }>;
      }>(apiConfig.fetchUrl);

      // Handle different response formats
      // Template gantt_data: { gantt_data: { tasks: [...], dependencies: [...] } } - pre-sorted by backend
      // Job gantt_data: { gantt_data: { tasks: [...], dependencies: [...] } } - pre-sorted by backend
      // Template rows (Data View): { rows: [...] } - needs frontend sort
      const isGanttData = !!response.gantt_data;
      const data = response.gantt_data || response;
      const rawRows = data.tasks || data.rows || [];
      const fetchedDeps = data.dependencies || [];
      console.log('[GanttDataManager] API response - rows:', rawRows.length, 'deps:', fetchedDeps.length, 'isGanttData:', isGanttData);
      if (fetchedDeps.length > 0) {
        console.log('[GanttDataManager] Sample dep from API:', fetchedDeps[0]);
      }

      // SSoT: Backend sorts gantt_data by (start_date, end_date, sequence_order) in GanttDataService
      // Only sort by sequence_order for Data View (rows endpoint), not Gantt view (gantt_data endpoint)
      const fetchedRows = isGanttData
        ? rawRows // Preserve backend's hierarchical date-based sorting
        : [...rawRows].sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));

      setRows(fetchedRows);

      // Convert to GanttTask format (with API holidays for weekend/holiday skipping)
      const projectStartDate = getTodayInCompanyTimezone();
      // SSoT: Pass preserveOrder=true for gantt_data to trust backend sort order
      // Backend GanttDataService.sort_hierarchically is the SSoT for Gantt sort order
      let convertedTasks = convertRowsToTasks(fetchedRows, projectStartDate, holidayDates, isGanttData);

      // For templates: apply backend-calculated dates (SSoT)
      // Backend handles inherited dependencies and header expansion - no frontend cascade needed
      if (mode === 'template' && dateMap) {
        console.log(`[GanttDataManager] 📅 Applying backend date_map (SSoT)`, {
          hasDateMap: !!dateMap,
          dateMapKeys: Object.keys(dateMap).length,
          sampleKeys: Object.keys(dateMap).slice(0, 5),  // Show key types
          task378: dateMap['378' as unknown as number],  // JSON keys are strings
        });
        convertedTasks = applyDateMap(convertedTasks, fetchedRows, dateMap);
        // DO NOT cascade here - backend is SSoT for template dates
        // Frontend cascade doesn't know about inherited dependencies from parent headers

        // Debug: check task 378 after applying
        const task378 = convertedTasks.find(t => {
          const row = fetchedRows.find(r => String(r.id) === t.id);
          return row?.task_number === 378;
        });
        console.log(`[GanttDataManager] 📅 Task 378 after applyDateMap:`, task378?.startDate, task378?.endDate);
      }

      setTasks(convertedTasks);

      // Convert dependencies - either from API or generate from predecessor_ids
      let convertedDeps: GanttDependency[];
      if (fetchedDeps.length > 0) {
        // Use dependencies from API (job mode)
        // SSoT: Validate with Zod schema to catch API contract mismatches at runtime
        // This prevents bugs like fromId/from_id key name mismatches
        const validatedDeps = validateDependencies(fetchedDeps);
        convertedDeps = validatedDeps.map((dep) => ({
          id: dep.id,
          fromId: dep.fromId,
          toId: dep.toId,
          type: dep.type,
          lag: dep.lag,
        }));
      } else {
        // Generate dependencies from predecessor_ids (template mode)
        convertedDeps = [];
        for (const row of fetchedRows) {
          if (row.predecessor_ids && row.predecessor_ids.length > 0) {
            for (const pred of row.predecessor_ids) {
              // Find the predecessor row to get its id
              const predRow = fetchedRows.find(r => r.task_number === pred.id);
              if (predRow) {
                convertedDeps.push({
                  id: `dep-${pred.id}-${row.id}`,
                  fromId: String(predRow.id),  // Predecessor's row id
                  toId: String(row.id),         // This row's id
                  type: (pred.type || 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
                  lag: pred.lag || 0,
                });
              }
            }
          }
        }
      }
      console.log('[GanttDataManager] Setting dependencies:', convertedDeps.length);
      setDependencies(convertedDeps);

    } catch (err) {
      console.error('[GanttDataManager] Failed to load:', err);
      setError('Failed to load Gantt data');
      toast({
        title: 'Error',
        description: 'Failed to load Gantt data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [mode, apiConfig, jobId, templateId, toast]);

  // ---------------------------------------------------------------------------
  // Helper: Apply date map from backend (templates only)
  // ---------------------------------------------------------------------------

  function applyDateMap(
    taskList: GanttTask[],
    rowList: SmScheduleMaster[],
    dateMap: Record<number, { start_date: string; end_date: string }>
  ): GanttTask[] {
    // Apply dates to non-headers
    let updatedTasks = taskList.map(task => {
      const row = rowList.find(r => String(r.id) === task.id);
      if (isHeaderRow(row)) return task;

      // SSoT: Use string key lookup - JSON serializes Ruby integer keys as strings
      const taskNumKey = row ? String(row.task_number) : '';
      if (row && dateMap[taskNumKey as unknown as number]) {
        const dates = dateMap[taskNumKey as unknown as number];
        return {
          ...task,
          startDate: new Date(dates.start_date + 'T00:00:00'),
          endDate: new Date(dates.end_date + 'T00:00:00'),
        };
      }
      return task;
    });

    // Recalculate header spans
    updatedTasks = recalculateHeaderSpans(updatedTasks, rowList);

    return updatedTasks;
  }

  function recalculateHeaderSpans(taskList: GanttTask[], rowList: SmScheduleMaster[]): GanttTask[] {
    const headerTaskNumbers = new Set<number>();
    const childrenByHeader = new Map<number, GanttTask[]>();

    // Find headers
    for (const row of rowList) {
      if (isHeaderRow(row)) {
        headerTaskNumbers.add(row.task_number);
        childrenByHeader.set(row.task_number, []);
      }
    }

    // Group children
    for (const task of taskList) {
      const row = rowList.find(r => String(r.id) === task.id);
      if (!row || row.header_gantt === 'Header') continue;

      let parentTaskNumber: number | null = null;
      if (typeof row.header_gantt === 'number') {
        parentTaskNumber = row.header_gantt;
      } else if (typeof row.header_gantt === 'object' && row.header_gantt?.id) {
        parentTaskNumber = row.header_gantt.id;
      } else if (typeof row.header_gantt === 'string' && row.header_gantt !== 'Header') {
        const parsed = parseInt(row.header_gantt, 10);
        if (!isNaN(parsed)) parentTaskNumber = parsed;
      }

      if (parentTaskNumber && headerTaskNumbers.has(parentTaskNumber)) {
        childrenByHeader.get(parentTaskNumber)!.push(task);
      }
    }

    // Update header dates
    for (const task of taskList) {
      const row = rowList.find(r => String(r.id) === task.id);
      if (!row || !isHeaderRow(row)) continue;

      const children = childrenByHeader.get(row.task_number);
      if (!children || children.length === 0) continue;

      let minStart = children[0].startDate;
      let maxEnd = children[0].endDate;
      for (const child of children) {
        if (child.startDate < minStart) minStart = child.startDate;
        if (child.endDate > maxEnd) maxEnd = child.endDate;
      }

      // If header has explicit dependencies, keep START date from cascade but update END date to span children
      const hasExplicitDependencies = row.predecessor_ids && row.predecessor_ids.length > 0;
      if (hasExplicitDependencies) {
        // Only update end date to span children, keep cascaded start date
        task.endDate = new Date(maxEnd);
      } else {
        // No explicit dependencies - span from earliest child to latest child
        task.startDate = new Date(minStart);
        task.endDate = new Date(maxEnd);
      }
    }

    // Filter headers with no children
    return taskList.filter(task => {
      const row = rowList.find(r => String(r.id) === task.id);
      if (!row || !isHeaderRow(row)) return true;
      const children = childrenByHeader.get(row.task_number);
      return children && children.length > 0;
    });
  }

  // ---------------------------------------------------------------------------
  // Undo Support
  // ---------------------------------------------------------------------------

  const storeUndoState = React.useCallback((task: GanttTask) => {
    const rowData = task.rowData as SmScheduleMaster | undefined;
    setUndoHistory(prev => {
      const next = new Map(prev);
      next.set(task.id, {
        startDate: task.startDate,
        endDate: task.endDate,
        duration: rowData?.duration_days || 1,
        hold: rowData?.hold || false,
        holdDate: rowData?.hold_date || null,
      });
      return next;
    });
  }, []);

  const handleUndo = React.useCallback(async (selectedTaskId: string | null) => {
    if (!selectedTaskId || !apiConfig) return;

    const previousState = undoHistory.get(selectedTaskId);
    if (!previousState) {
      toast({ title: 'Nothing to Undo', description: 'No previous state found' });
      return;
    }

    try {
      // Format date in local timezone (not UTC) to avoid day shift
      const dateForHold = previousState.startDate;
      const fallbackHoldDate = `${dateForHold.getFullYear()}-${String(dateForHold.getMonth() + 1).padStart(2, '0')}-${String(dateForHold.getDate()).padStart(2, '0')}`;
      const holdDateStr = previousState.holdDate || fallbackHoldDate;

      await api.patch(
        apiConfig.updateUrl(selectedTaskId),
        wrapPayload(apiConfig, {
          hold: previousState.hold,
          hold_date: holdDateStr,
          duration_days: previousState.duration,
        })
      );

      setUndoHistory(prev => {
        const next = new Map(prev);
        next.delete(selectedTaskId);
        return next;
      });

      loadData({ silent: true });
      toast({ title: 'Undo', description: 'Change undone' });
    } catch (err) {
      console.error('[GanttDataManager] Undo failed:', err);
      toast({ title: 'Error', description: 'Failed to undo', variant: 'destructive' });
    }
  }, [undoHistory, apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Checkbox Toggle
  // ---------------------------------------------------------------------------

  const handleCheckboxToggle = React.useCallback(async (
    taskId: string,
    field: string,
    checked: boolean
  ) => {
    if (!apiConfig) return;
    console.log('[GanttDataManager] Checkbox toggle:', taskId, field, checked);

    const task = tasks.find(t => t.id === taskId);
    const row = task?.rowData as SmScheduleMaster | undefined;

    // For "started" field, check if under header or has predecessors
    if (field === 'started' && checked) {
      if (!task || !row) {
        await executeCheckboxToggle(taskId, field, checked);
        return;
      }

      const headerGanttValue = row.header_gantt;
      const isUnderHeader = headerGanttValue !== null &&
        headerGanttValue !== undefined &&
        headerGanttValue !== 'Header';
      const hasPredecessors = (row.predecessor_ids?.length ?? 0) > 0;

      if (isUnderHeader || hasPredecessors) {
        // Find header name
        let headerName: string | null = null;
        if (isUnderHeader) {
          const headerTaskNumber = extractLookupId(headerGanttValue);
          if (headerTaskNumber) {
            const headerRow = rows.find(r => String(r.task_number) === headerTaskNumber);
            headerName = headerRow?.name || extractLookupDisplay(headerGanttValue) || `Task #${headerTaskNumber}`;
          }
        }

        // Fetch holidays for working day check
        const today = new Date();
        let holidayDates: Set<string> | undefined;
        try {
          const year = today.getFullYear();
          const response = await api.get<{ dates: string[] }>(
            `/api/v1/public_holidays/dates?year_start=${year - 1}&year_end=${year + 1}&region=QLD`
          );
          if (response?.dates) {
            holidayDates = new Set(response.dates);
          }
        } catch { /* SSoT: No fallback - proceed without holidays */ }

        const isTodayWorking = isWorkingDay(today, holidayDates);
        const lastWorking = isTodayWorking ? null : skipToPreviousWorkingDay(today, holidayDates);

        setStartTaskDialog({
          isOpen: true,
          task,
          headerName,
          hasPredecessors,
          isTodayWorkingDay: isTodayWorking,
          lastWorkingDay: lastWorking,
        });
        return;
      }
    }

    // For supplier_confirm, show the supplier confirmation details dialog (both confirming and un-confirming)
    if (field === 'supplier_confirm') {
      if (!task || !row) {
        await executeCheckboxToggle(taskId, field, checked);
        return;
      }

      // Get supplier name, email, and previous confirmation details from rowData
      const supplierName = (row as any).supplier_name || (row as any).po_supplier?.name || null;
      const supplierEmail = (row as any).supplier_email || (row as any).po_supplier?.email || null;
      const previousMethod = (row as any).supplier_confirmation_method || null;
      const previousContactName = (row as any).supplier_confirmed_contact_name || '';
      const hasPredecessors = (row.predecessor_ids?.length ?? 0) > 0;

      setSupplierConfirmDialog({
        isOpen: true,
        task,
        isConfirming: checked,
        method: checked ? null : previousMethod,
        contactName: checked ? '' : previousContactName,
        supplierName,
        supplierEmail,
        reason: '',
        sendEmail: false,
        previousMethod,
        previousContactName,
        hasPredecessors,
        confirmOption: hasPredecessors && checked ? null : 'current', // Need to choose if has deps
      });
      return;
    }

    // For confirm field (not supplier_confirm), show confirmation dialog
    if (field === 'confirm') {
      if (!task || !row) {
        await executeCheckboxToggle(taskId, field, checked);
        return;
      }

      // Find successors
      const successorRows = tasks
        .filter(t => {
          const r = t.rowData as SmScheduleMaster | undefined;
          return r?.predecessor_ids?.some(p => p.id === row.task_number);
        })
        .map(t => t.rowData as SmScheduleMaster);

      setConfirmDialog({
        isOpen: true,
        type: 'confirm',
        task,
        isChecking: checked,
        affectedSuccessors: successorRows,
      });
      return;
    }

    // For other fields, save directly
    await executeCheckboxToggle(taskId, field, checked);
  }, [tasks, rows]);

  const executeCheckboxToggle = React.useCallback(async (
    taskId: string,
    field: string,
    checked: boolean
  ) => {
    if (!apiConfig) return;
    try {
      const fieldMap: Record<string, string> = {
        'started': 'started',
        'hold': 'hold',
        'confirm': 'confirm',
        'supplier_confirm': 'supplier_confirm',
        'is_completed': 'is_completed',
      };
      const apiField = fieldMap[field] || field;

      const task = tasks.find(t => t.id === taskId);
      const updateData: Record<string, unknown> = { [apiField]: checked };

      // When starting a task, move to today and clear hold
      // The backend will use hold_date as anchor when started=true (even without hold)
      if (field === 'started' && checked) {
        const today = new Date();
        updateData.hold = false;  // Clear hold checkbox
        updateData.hold_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      // For other confirms (confirm, supplier_confirm), lock at current position
      else if (checked && task?.startDate) {
        const d = task.startDate;
        updateData.hold = true;
        updateData.hold_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      await api.patch(
        apiConfig.updateUrl(taskId),
        wrapPayload(apiConfig, updateData)
      );

      toast({ title: 'Updated', description: `${field} ${checked ? 'enabled' : 'disabled'}` });
      loadData({ silent: true });
    } catch (err) {
      console.error('[GanttDataManager] Checkbox toggle failed:', err);
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  }, [tasks, apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Start Task (with break options)
  // ---------------------------------------------------------------------------

  const executeStartTask = React.useCallback(async (
    task: GanttTask,
    option: 'break-header' | 'break-dependency' | 'start-only',
    startDate?: Date
  ) => {
    if (!apiConfig) return;
    const row = task.rowData as SmScheduleMaster | undefined;
    if (!row) return;

    const dateToUse = startDate || new Date();
    // Format date in local timezone (not UTC) to avoid day shift
    const dateStr = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}-${String(dateToUse.getDate()).padStart(2, '0')}`;

    try {
      const updateData: Record<string, unknown> = {
        started: true,
        hold: true,
        hold_date: dateStr,
      };

      if (option === 'break-header') {
        updateData.header_gantt = null;
        updateData.dependency_broken = true;
      } else if (option === 'break-dependency') {
        updateData.predecessor_ids = [];
        updateData.dependency_broken = true;
      }

      await api.patch(
        apiConfig.updateUrl(task.id),
        wrapPayload(apiConfig, updateData)
      );

      const dateLabel = dateToUse.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
      let actionText = `start date set to ${dateLabel}`;
      if (option === 'break-header') {
        actionText = `broken out of header, ${actionText}`;
      } else if (option === 'break-dependency') {
        actionText = `dependencies cleared, ${actionText}`;
      }

      toast({ title: 'Task Started', description: actionText });
      loadData({ silent: true });
    } catch (err) {
      console.error('[GanttDataManager] Start task failed:', err);
      toast({ title: 'Error', description: 'Failed to start task', variant: 'destructive' });
    }
  }, [apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Supplier Confirm (with method and contact details)
  // ---------------------------------------------------------------------------

  const executeSupplierConfirm = React.useCallback(async (
    task: GanttTask,
    method: 'phone' | 'text' | 'email',
    contactName: string,
    breakDependencies?: boolean
  ) => {
    if (!apiConfig) return;

    try {
      // Lock task at its CURRENT position (not today)
      const currentStart = task.startDate;
      const dateStr = `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}-${String(currentStart.getDate()).padStart(2, '0')}`;

      const updateData: Record<string, unknown> = {
        supplier_confirm: true,
        supplier_confirmation_method: method,
        supplier_confirmed_contact_name: contactName,
        hold: true,
        hold_date: dateStr,
      };

      // If breaking dependencies, clear predecessor_ids
      if (breakDependencies) {
        updateData.predecessor_ids = [];
        updateData.dependency_broken = true;
      }

      await api.patch(
        apiConfig.updateUrl(task.id),
        wrapPayload(apiConfig, updateData)
      );

      const methodLabel = method === 'phone' ? 'phone call' : method;
      toast({
        title: 'Supplier Confirmed',
        description: `Confirmed by ${contactName} via ${methodLabel}`
      });
      loadData({ silent: true });
    } catch (err) {
      console.error('[GanttDataManager] Supplier confirm failed:', err);
      toast({ title: 'Error', description: 'Failed to confirm supplier', variant: 'destructive' });
    }
  }, [apiConfig, loadData, toast]);

  // Clear supplier confirmation (un-confirm)
  const executeSupplierUnconfirm = React.useCallback(async (task: GanttTask) => {
    if (!apiConfig) return;

    try {
      const updateData: Record<string, unknown> = {
        supplier_confirm: false,
        supplier_confirmation_method: null,
        supplier_confirmed_contact_name: null,
      };

      await api.patch(
        apiConfig.updateUrl(task.id),
        wrapPayload(apiConfig, updateData)
      );

      toast({
        title: 'Confirmation Cleared',
        description: 'Supplier confirmation has been removed'
      });
      loadData({ silent: true });
    } catch (err) {
      console.error('[GanttDataManager] Supplier unconfirm failed:', err);
      toast({ title: 'Error', description: 'Failed to clear confirmation', variant: 'destructive' });
    }
  }, [apiConfig, loadData, toast]);

  // Email supplier (job not ready)
  const executeEmailSupplier = React.useCallback(async (
    task: GanttTask,
    reason: string,
    supplierEmail?: string
  ) => {
    // Email supplier only works in job mode (templates don't have real suppliers)
    if (mode !== 'job') {
      toast({
        title: 'Not Available',
        description: 'Email supplier is only available for job tasks'
      });
      return;
    }

    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/v1/sm_tasks/${task.id}/email_supplier`,
        {
          message: reason,
          supplier_email: supplierEmail,
        }
      );

      if (response?.success) {
        toast({
          title: 'Email Sent',
          description: response.message || 'Supplier notified'
        });
      } else {
        toast({
          title: 'Email Failed',
          description: response?.error || 'Could not send email',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('[GanttDataManager] Email supplier failed:', err);
      toast({ title: 'Error', description: 'Failed to send email', variant: 'destructive' });
    }
  }, [mode, toast]);

  // ---------------------------------------------------------------------------
  // Task Drag (with cascade dialog)
  // ---------------------------------------------------------------------------

  const handleTaskDrag = React.useCallback(async (task: GanttTask, newStartDate: Date) => {
    if (!apiConfig) return;
    storeUndoState(task);
    console.log('[GanttDataManager] Task dragged:', task.id, 'to', newStartDate);
    console.log('[GanttDataManager] task.rowData:', task.rowData);

    const row = task.rowData as SmScheduleMaster | undefined;
    if (!row) {
      console.log('[GanttDataManager] ⚠️ rowData is undefined, skipping cascade check');
      await executeDragMove(task, newStartDate);
      return;
    }
    console.log('[GanttDataManager] Row exists - task_number:', row.task_number, 'name:', row.name);

    // Find successors recursively
    const findAllSuccessors = (taskNumber: number, visited = new Set<number>()): SmScheduleMaster[] => {
      const direct = tasks
        .filter(t => {
          const r = t.rowData as SmScheduleMaster | undefined;
          // Use == for loose comparison (handles string/number mismatch)
          return r?.predecessor_ids?.some(p => p.id == taskNumber) && !visited.has(r.id);
        })
        .map(t => t.rowData as SmScheduleMaster);

      let all = [...direct];
      direct.forEach(s => visited.add(s.id));
      direct.forEach(s => {
        all = [...all, ...findAllSuccessors(s.task_number, visited)];
      });
      return all;
    };

    const directSuccessors = tasks
      .filter(t => {
        const r = t.rowData as SmScheduleMaster | undefined;
        // Use == for loose comparison (handles string/number mismatch)
        return r?.predecessor_ids?.some(p => p.id == row.task_number);
      })
      .map(t => t.rowData as SmScheduleMaster);

    console.log('[GanttDataManager] Found direct successors:', directSuccessors.length, 'for task_number:', row.task_number);

    if (directSuccessors.length === 0) {
      await executeDragMove(task, newStartDate);
      return;
    }

    // Find ALL successors recursively (not just direct)
    const allSuccessors = findAllSuccessors(row.task_number);

    console.log('[GanttDataManager] Found ALL successors (recursive):', allSuccessors.length, 'for task_number:', row.task_number);

    // Build successor info for ALL descendants
    const successorInfo: SuccessorInfo[] = allSuccessors.map(s => ({
      ...s,
      downstreamCount: 0,
      downstreamTasks: [],
      lockedDownstreamCount: 0,
      hasMoreDownstream: false,
    }));

    // Split into locked vs unlocked - checking ALL descendants, not just direct
    const lockedSuccessors = successorInfo.filter(s => s.confirm || s.supplier_confirm || s.is_completed);
    const unlockedSuccessors = successorInfo.filter(s => !s.confirm && !s.supplier_confirm && !s.is_completed);

    // Debug logging for cascade detection
    console.log('[GanttDataManager] Task drag - successor analysis:', {
      movedTaskNumber: row.task_number,
      directSuccessorsCount: directSuccessors.length,
      allSuccessorsCount: allSuccessors.length,
      allSuccessors: allSuccessors.map(s => ({
        id: s.id,
        task_number: s.task_number,
        name: s.name,
        confirm: s.confirm,
        supplier_confirm: s.supplier_confirm,
        is_completed: s.is_completed,
        hold: s.hold,
      })),
      lockedCount: lockedSuccessors.length,
      unlockedCount: unlockedSuccessors.length,
    });

    // If no locked successors, just execute move directly - unlocked tasks cascade automatically via SSoT
    if (lockedSuccessors.length === 0) {
      console.log('[GanttDataManager] No locked successors - executing move directly');
      await executeDragMove(task, newStartDate);
      return;
    }

    // Default decisions
    const defaultDecisions: Record<number, 'break' | 'cascade'> = {};
    lockedSuccessors.forEach(s => {
      defaultDecisions[s.id] = 'break';
      s.downstreamTasks?.forEach(dt => {
        defaultDecisions[dt.id] = 'break';
      });
    });
    setLockedTaskDecisions(defaultDecisions);

    setCascadeDialog({
      isOpen: true,
      task,
      newStartDate,
      successors: successorInfo,
      lockedSuccessors,
      unlockedSuccessors,
    });
  }, [tasks, storeUndoState]);

  const executeDragMove = React.useCallback(async (task: GanttTask, newStartDate: Date) => {
    if (!apiConfig) return;
    try {
      // Format date in local timezone (not UTC) to avoid day shift
      const year = newStartDate.getFullYear();
      const month = String(newStartDate.getMonth() + 1).padStart(2, '0');
      const day = String(newStartDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      if (mode === 'template' && templateId) {
        // Template mode: PATCH the template row with hold=true and hold_date
        // This sets the manual position that GanttDateCalculationService will respect
        await api.patch(`/api/v1/sm_schedule_master_templates/${templateId}/rows/${task.id}`, {
          row: { hold: true, hold_date: dateStr }
        });

        toast({ title: 'Task Moved', description: `Moved to ${newStartDate.toLocaleDateString('en-AU')}` });
        loadData({ silent: true });
      } else {
        // Job mode: Use /move endpoint which auto-cascades unlocked successors
        console.log('[GanttDataManager] Executing drag move via /move endpoint, new_start_date=', dateStr);

        const result = await api.post<{
          success: boolean;
          needs_confirmation?: boolean;
          message?: string;
          cascade_results?: {
            updated_count: number;
            updated_task_ids: number[];
          };
        }>(`/api/v1/sm_tasks/${task.id}/move`, {
          new_start_date: dateStr,
        });

        if (result?.needs_confirmation) {
          // Shouldn't happen since we pre-filter locked successors, but handle it
          console.warn('[GanttDataManager] Move returned needs_confirmation - showing cascade dialog');
          toast({ title: 'Cascade Required', description: 'Please resolve locked successor conflicts', variant: 'destructive' });
          return;
        }

        const cascadeCount = (result?.cascade_results?.updated_count || 1) - 1;
        console.log('[GanttDataManager] Drag move saved successfully, cascaded:', cascadeCount);

        const description = cascadeCount > 0
          ? `Moved to ${newStartDate.toLocaleDateString('en-AU')} (+ ${cascadeCount} successor${cascadeCount > 1 ? 's' : ''} cascaded)`
          : `Moved to ${newStartDate.toLocaleDateString('en-AU')}`;

        toast({ title: 'Task Moved', description });
        loadData({ silent: true });
      }
    } catch (err) {
      console.error('[GanttDataManager] Drag move failed:', err);
      toast({ title: 'Error', description: 'Failed to move task', variant: 'destructive' });
    }
  }, [mode, templateId, apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Rollover
  // ---------------------------------------------------------------------------

  const handleRollover = React.useCallback(async (): Promise<{ rolled_over: number; extended: number; cascaded: number } | null> => {
    if (!apiConfig) return null;
    try {
      const url = mode === 'template'
        ? apiConfig.validateDatesUrl!
        : `/api/v1/jobs/${jobId}/sm_tasks/validate_dates`;

      const result = await api.post<{
        success: boolean;
        rolled_over?: number;
        extended?: number;
        updated?: number;
        cascaded?: number;
      }>(url);

      if (result) {
        const rolled_over = result.rolled_over || 0;
        const extended = result.extended || 0;
        const updated = result.updated || 0;
        const cascaded = result.cascaded || 0;
        const fixCount = rolled_over + extended + updated;

        if (fixCount > 0) {
          toast({
            title: 'Schedule Updated',
            description: `${fixCount} task(s) moved forward`,
          });
          loadData({ silent: true });
        } else {
          toast({
            title: 'Schedule Up to Date',
            description: 'No tasks needed rollover',
          });
        }
        return { rolled_over, extended, cascaded };
      }
      return null;
    } catch (err) {
      console.error('[GanttDataManager] Rollover failed:', err);
      toast({ title: 'Error', description: 'Failed to run rollover', variant: 'destructive' });
      return null;
    }
  }, [mode, apiConfig, jobId, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Dependency Editor
  // ---------------------------------------------------------------------------

  const openDependencyEditor = React.useCallback((task: GanttTask, visibleTasks: GanttTask[]) => {
    setDependencyEditorState({ isOpen: true, task, visibleTasks });
  }, []);

  const handleDependencyEditorSave = React.useCallback(async (
    taskId: string,
    predecessors: Array<{ taskNumber: number; type: string; lag: number }>,
    successors: Array<{ taskNumber: number; type: string; lag: number }>
  ) => {
    if (!apiConfig) return;
    const task = tasks.find(t => t.id === taskId);
    const taskRow = task?.rowData as SmScheduleMaster | undefined;
    if (!taskRow) return;

    const currentTaskNumber = taskRow.task_number;

    try {
      // 1. Update current task's predecessors
      const newPredIds = predecessors.map(p => ({ id: p.taskNumber, type: p.type, lag: p.lag }));
      await api.patch(
        apiConfig.updateUrl(taskRow.id),
        wrapPayload(apiConfig, { predecessor_ids: newPredIds })
      );

      // 2. Update successors
      const currentSuccessors = tasks.filter(t => {
        const r = t.rowData as SmScheduleMaster | undefined;
        return r?.predecessor_ids?.some(p => p.id === currentTaskNumber);
      });
      const newSuccessorNums = new Set(successors.map(s => s.taskNumber));

      // Add this task as predecessor to new successors
      for (const succ of successors) {
        const succTask = tasks.find(t => (t.rowData as SmScheduleMaster | undefined)?.task_number === succ.taskNumber);
        const succRow = succTask?.rowData as SmScheduleMaster | undefined;
        if (!succRow) continue;

        const alreadyHas = succRow.predecessor_ids?.some(p => p.id === currentTaskNumber);
        if (!alreadyHas) {
          const updated = [...(succRow.predecessor_ids || []), { id: currentTaskNumber, type: succ.type, lag: succ.lag }];
          await api.patch(
            apiConfig.updateUrl(succRow.id),
            wrapPayload(apiConfig, { predecessor_ids: updated })
          );
        } else {
          // Update existing entry
          const updated = (succRow.predecessor_ids || []).map(p =>
            p.id === currentTaskNumber ? { id: currentTaskNumber, type: succ.type, lag: succ.lag } : p
          );
          await api.patch(
            apiConfig.updateUrl(succRow.id),
            wrapPayload(apiConfig, { predecessor_ids: updated })
          );
        }
      }

      // Remove this task from old successors
      for (const currSucc of currentSuccessors) {
        const r = currSucc.rowData as SmScheduleMaster | undefined;
        if (!r || newSuccessorNums.has(r.task_number)) continue;

        const updated = (r.predecessor_ids || []).filter(p => p.id !== currentTaskNumber);
        await api.patch(
          apiConfig.updateUrl(r.id),
          wrapPayload(apiConfig, { predecessor_ids: updated })
        );
      }

      loadData({ silent: true });
      toast({ title: 'Success', description: 'Dependencies updated' });
    } catch (err) {
      console.error('[GanttDataManager] Dependency save failed:', err);
      toast({ title: 'Error', description: 'Failed to save dependencies', variant: 'destructive' });
      throw err;
    }
  }, [tasks, apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Task Resize & Duration Change
  // ---------------------------------------------------------------------------

  const handleTaskResize = React.useCallback(async (task: GanttTask, _newStartDate: Date, newEndDate: Date) => {
    if (!apiConfig) return;
    // Store undo state before making changes
    storeUndoState(task);

    // Calculate new duration in days
    const startDate = task.startDate;
    const diffTime = newEndDate.getTime() - startDate.getTime();
    const newDuration = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    console.log('[GanttDataManager] Task resized:', task.id, 'new duration:', newDuration);

    const row = task.rowData as SmScheduleMaster | undefined;
    if (!row) {
      console.error('[GanttDataManager] No row data for task:', task.id);
      return;
    }

    try {
      await api.patch(
        apiConfig.updateUrl(row.id),
        wrapPayload(apiConfig, { duration_days: newDuration })
      );

      toast({ title: 'Duration updated', description: `${newDuration} days` });
      loadData({ silent: true });
    } catch (error) {
      console.error('[GanttDataManager] Failed to save duration:', error);
      toast({ title: 'Error', description: 'Failed to update duration', variant: 'destructive' });
    }
  }, [apiConfig, loadData, toast, storeUndoState]);

  const handleDurationChange = React.useCallback(async (taskId: string, newDuration: number) => {
    if (!apiConfig) return;
    console.log('[GanttDataManager] Duration changed via inline edit:', taskId, 'new duration:', newDuration);

    // Optimistic update - update local state immediately (no screen flash)
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id !== taskId) return task;

      // Calculate new end date based on new duration
      const newEndDate = new Date(task.startDate);
      newEndDate.setDate(newEndDate.getDate() + newDuration - 1);

      // Update rowData too for consistency
      const updatedRowData = task.rowData ? { ...task.rowData, duration_days: newDuration } : undefined;

      return {
        ...task,
        endDate: newEndDate,
        rowData: updatedRowData,
      };
    }));

    // Update rows state too (for consistency with rowData)
    setRows(prevRows => prevRows.map(row => {
      if (String(row.id) !== taskId) return row;
      return { ...row, duration_days: newDuration };
    }));

    try {
      await api.patch(
        apiConfig.updateUrl(taskId),
        wrapPayload(apiConfig, { duration_days: newDuration })
      );

      toast({ title: 'Duration updated', description: `${newDuration} days` });
      // No loadData() - already updated optimistically
    } catch (error) {
      console.error('[GanttDataManager] Failed to save duration:', error);
      toast({ title: 'Error', description: 'Failed to update duration', variant: 'destructive' });
      // On error, reload to restore correct state
      loadData();
    }
  }, [apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Dependency Create/Delete (direct canvas interactions)
  // ---------------------------------------------------------------------------

  const handleDependencyCreate = React.useCallback((fromId: string, toId: string, type: string) => {
    console.log('[GanttDataManager] Dependency create:', fromId, '->', toId, 'type:', type);

    // Canvas passes row.id (not task_number), so find tasks by id
    // Drag from A to B = B depends on A = A is predecessor of B
    const targetTask = tasks.find(t => t.id === toId);   // B - task getting new predecessor
    const fromTask = tasks.find(t => t.id === fromId);   // A - the predecessor

    if (!targetTask || !targetTask.rowData) {
      console.error('[GanttDataManager] Target task not found:', toId);
      toast({ title: 'Error', description: 'Target task not found', variant: 'destructive' });
      return;
    }
    if (!fromTask || !fromTask.rowData) {
      console.error('[GanttDataManager] Source task not found:', fromId);
      toast({ title: 'Error', description: 'Source task not found', variant: 'destructive' });
      return;
    }

    const fromRow = fromTask.rowData as SmScheduleMaster;

    // Create pending predecessor to pass to the editor
    const pendingPredecessor = {
      taskNumber: fromRow.task_number,
      type: type || 'FS',
      lag: 0
    };

    // Open the dependency editor with the TARGET task (task we dragged TO)
    // and show FROM task as a new predecessor
    setDependencyEditorState({
      isOpen: true,
      task: targetTask,
      visibleTasks: tasks,
      pendingPredecessor
    });
  }, [tasks, toast]);

  const handleDependencyDelete = React.useCallback(async (dependencyId: string) => {
    if (!apiConfig) return;
    console.log('[GanttDataManager] Dependency delete:', dependencyId);

    // Parse dependency ID: format is "dep-{predecessor_task_number}-{row_id}"
    const match = dependencyId.match(/^dep-(\d+)-(\d+)$/);
    if (!match) {
      console.error('[GanttDataManager] Invalid dependency ID format:', dependencyId);
      toast({ title: 'Error', description: 'Invalid dependency ID', variant: 'destructive' });
      return;
    }

    const predecessorTaskNumber = parseInt(match[1], 10);
    const rowId = parseInt(match[2], 10);

    // Find the target task by row id
    const targetTask = tasks.find(t => (t.rowData as SmScheduleMaster | undefined)?.id === rowId);
    if (!targetTask || !targetTask.rowData) {
      console.error('[GanttDataManager] Target task not found for row:', rowId);
      toast({ title: 'Error', description: 'Target task not found', variant: 'destructive' });
      return;
    }

    const targetRow = targetTask.rowData as SmScheduleMaster;

    // Remove the predecessor from predecessor_ids
    const currentPreds = targetRow.predecessor_ids || [];
    const updatedPreds = currentPreds.filter((p: { id: number }) => p.id !== predecessorTaskNumber);

    if (updatedPreds.length === currentPreds.length) {
      toast({ title: 'Info', description: 'Dependency not found' });
      return;
    }

    try {
      await api.patch(
        apiConfig.updateUrl(rowId),
        wrapPayload(apiConfig, { predecessor_ids: updatedPreds })
      );

      loadData({ silent: true });
      toast({ title: 'Success', description: 'Dependency deleted' });
    } catch (error) {
      console.error('[GanttDataManager] Failed to delete dependency:', error);
      toast({ title: 'Error', description: 'Failed to delete dependency', variant: 'destructive' });
    }
  }, [tasks, apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Reset Manual Position
  // ---------------------------------------------------------------------------

  const handleResetManualPosition = React.useCallback(async (task: GanttTask) => {
    if (!apiConfig) return;
    console.log('[GanttDataManager] Reset manual position:', task.id);

    const row = task.rowData as SmScheduleMaster | undefined;
    if (!row) {
      console.error('[GanttDataManager] No row data for task:', task.id);
      return;
    }

    try {
      // Clear hold and hold_date
      await api.patch(
        apiConfig.updateUrl(row.id),
        wrapPayload(apiConfig, { hold: false, hold_date: null })
      );

      loadData({ silent: true });
      toast({ title: 'Success', description: 'Manual position reset' });
    } catch (error) {
      console.error('[GanttDataManager] Failed to reset manual position:', error);
      toast({ title: 'Error', description: 'Failed to reset manual position', variant: 'destructive' });
    }
  }, [apiConfig, loadData, toast]);

  // ---------------------------------------------------------------------------
  // Edit Sheet
  // ---------------------------------------------------------------------------

  const openEditSheet = React.useCallback((task: GanttTask) => {
    initialFormLoadRef.current = true;
    setAutoSaveStatus('idle');

    const rowData = task.rowData as SmScheduleMaster | undefined;
    if (!rowData) {
      console.error('[GanttDataManager] No rowData on task:', task);
      return;
    }

    setEditingTask(task);
    setEditingRow(rowData);
    setEditRowForm({
      name: rowData.name,
      description: rowData.description || undefined,
      duration_days: rowData.duration_days,
      sequence_order: rowData.sequence_order,
      trade: rowData.trade || undefined,
      stage: rowData.stage || undefined,
      assigned_role: rowData.assigned_role || undefined,
      cost_centre: rowData.cost_centre || undefined,
      header_gantt: rowData.header_gantt || undefined,
      po_required: rowData.po_required || false,
      critical_po: rowData.critical_po || false,
      create_po_on_job_start: rowData.create_po_on_job_start || false,
      require_photo: rowData.require_photo || false,
      pass_fail_enabled: rowData.pass_fail_enabled || false,
      linked_task_ids: rowData.linked_task_ids,
      allow_header: rowData.allow_header || false,
      is_active: rowData.is_active ?? true,
      tags: rowData.tags || [],
    });
    setEditSheetOpen(true);
  }, []);

  const saveEditSheet = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!editingRow || !apiConfig) return;

    const silent = options?.silent ?? false;

    if (silent) {
      setAutoSaveStatus('saving');
    } else {
      setSaving(true);
    }

    try {
      await api.patch(
        apiConfig.updateUrl(editingRow.id),
        wrapPayload(apiConfig, editRowForm as unknown as Record<string, unknown>)
      );

      if (silent) {
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
        loadData({ silent: true });
      } else {
        toast({ title: 'Success', description: 'Task updated' });
        setEditSheetOpen(false);
        loadData({ silent: true });
      }
    } catch (err) {
      console.error('[GanttDataManager] Save failed:', err);
      if (silent) {
        setAutoSaveStatus('error');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } else {
        toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
      }
    } finally {
      if (!silent) {
        setSaving(false);
      }
    }
  }, [editingRow, editRowForm, apiConfig, loadData, toast]);

  // Auto-save effect
  React.useEffect(() => {
    if (initialFormLoadRef.current) {
      initialFormLoadRef.current = false;
      return;
    }
    if (!editSheetOpen || !editingRow) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveEditSheet({ silent: true });
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editRowForm, editSheetOpen, editingRow, saveEditSheet]);

  // ---------------------------------------------------------------------------
  // Task Double Click (opens edit sheet)
  // ---------------------------------------------------------------------------

  const handleTaskDoubleClick = React.useCallback((task: GanttTask) => {
    openEditSheet(task);
  }, [openEditSheet]);

  // ---------------------------------------------------------------------------
  // Return Value
  // ---------------------------------------------------------------------------

  return {
    // Core state
    tasks,
    dependencies,
    rows,
    loading,
    error,

    // Data loading
    loadData,

    // Edit sheet
    editSheetOpen,
    setEditSheetOpen,
    editingTask,
    editingRow,
    editRowForm,
    setEditRowForm,
    saving,
    autoSaveStatus,
    openEditSheet,
    saveEditSheet,

    // Dependency editor
    dependencyEditorState,
    setDependencyEditorState,
    openDependencyEditor,
    handleDependencyEditorSave,

    // Cascade dialog
    cascadeDialog,
    setCascadeDialog,
    lockedTaskDecisions,
    setLockedTaskDecisions,
    executeDragMove,

    // Confirm dialog
    confirmDialog,
    setConfirmDialog,
    executeCheckboxToggle,

    // Start task dialog
    startTaskDialog,
    setStartTaskDialog,
    executeStartTask,

    // Supplier confirm dialog
    supplierConfirmDialog,
    setSupplierConfirmDialog,
    executeSupplierConfirm,
    executeSupplierUnconfirm,
    executeEmailSupplier,

    // Undo
    undoHistory,
    handleUndo,
    storeUndoState,

    // Handlers
    handleTaskClick: (task: GanttTask) => {
      // Single-click just selects the task (highlighting handled by canvas)
      // Dependency editor is opened via onDependencyClick (deps column click or double-click on gantt)
      console.log('[GanttDataManager] Task clicked:', task.id, task.name);
    },
    handleTaskDoubleClick,
    handleCheckboxToggle,
    handleTaskDrag,
    handleTaskResize,
    handleDurationChange,
    handleDependencyCreate,
    handleDependencyDelete,
    handleResetManualPosition,
    handleRollover,

    // API config (for advanced use)
    apiConfig,
    mode,
  };
}
