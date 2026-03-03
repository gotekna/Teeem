'use client';

/**
 * Gantt Page - Job Schedule
 *
 * SSoT: Uses useGanttDataManager hook for all Gantt behavior.
 * Same handlers as Schedule Master (templates) - fix once, works everywhere.
 *
 * @see lib/gantt/hooks/useGanttDataManager.ts - THE ONE hook
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GanttUnified, GanttDependencyEditor } from '@/components/gantt';
import { GanttTaskQuickEdit } from '@/components/gantt/GanttTaskQuickEdit';
import { api } from '@/lib/api';
import {
  ExternalLink,
  Camera,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  Link2Off,
  PlayCircle,
  GitBranch,
} from 'lucide-react';
import type { GanttTask, SmScheduleMaster, JobTaskRowData } from '@/lib/gantt/types';
import { isHeaderRow } from '@/lib/gantt/types';
import type { PhotoItem } from '@/components/ui/photo-gallery';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { useGanttDataManager } from '@/lib/gantt/hooks';
import { EditRowDialog, type EditRowData, type EditRowFormData } from '@/components/schedule/EditRowDialog';
import { clearCachedRecords } from '@/lib/records-cache';
import { GanttSyncIndicator } from '@/components/ui/gantt-sync-indicator';
import { useAutoGanttCache, useGanttOfflineCache } from '@/lib/offline';
import { Job } from '@/lib/types';

// =============================================================================
// Types
// =============================================================================

// =============================================================================
// Page Component
// =============================================================================

export default function GanttPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = Number(params.id);

  // Job-specific state (must be declared before offline hooks that reference it)
  const [job, setJob] = React.useState<Job | null>(null);

  // SSoT: Use shared hook for all Gantt behavior
  const gantt = useGanttDataManager({ mode: 'job', jobId });

  // Offline cache - tracks sync status and auto-caches when online
  const offlineCache = useGanttOfflineCache({
    mode: 'job',
    id: jobId,
    name: job?.name || job?.title || `Job ${jobId}`,
  });

  // Auto-cache Gantt data when loaded online
  useAutoGanttCache({
    mode: 'job',
    id: jobId,
    name: job?.name || job?.title || `Job ${jobId}`,
    tasks: gantt.tasks,
    dependencies: gantt.dependencies,
    rows: gantt.rows,
    loading: gantt.loading,
  });

  // Photo panel state (job-specific feature)
  const [showPhotoPanel, setShowPhotoPanel] = React.useState(false);
  const [jobPhotos, setJobPhotos] = React.useState<PhotoItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // Edit Row Dialog state (SSoT: uses shared EditRowDialog component)
  const [selectedTaskForEdit, setSelectedTaskForEdit] = React.useState<EditRowData | null>(null);
  const [showTaskEditDialog, setShowTaskEditDialog] = React.useState(false);

  // Quick Edit popover state (single-click on task bar)
  const [quickEditTask, setQuickEditTask] = React.useState<GanttTask | null>(null);
  const [quickEditPosition, setQuickEditPosition] = React.useState({ x: 0, y: 0 });

  // Reference data for EditRowDialog
  const [availableTrades, setAvailableTrades] = React.useState<{ id: number; name: string }[]>([]);
  const [availableRoles, setAvailableRoles] = React.useState<{ id: number; name: string; display_name: string }[]>([]);
  const [availableStages, setAvailableStages] = React.useState<{ id: number; name: string }[]>([]);
  const [availableCostCentres, setAvailableCostCentres] = React.useState<{ id: number; name: string }[]>([]);
  const [availableChecklists, setAvailableChecklists] = React.useState<{ id: number; name: string }[]>([]);
  const [availableDocumentTypes, setAvailableDocumentTypes] = React.useState<{ id: number; name: string; display_name?: string; form_number_mapping?: Record<string, string> }[]>([]);
  const [availableTradingNames, setAvailableTradingNames] = React.useState<{ id: number; name: string }[]>([]);
  const [availableInvoiceTemplates, setAvailableInvoiceTemplates] = React.useState<{ id: number; name: string; description: string; primary_color: string; secondary_color: string; is_default?: boolean }[]>([]);
  const [availableHeaderRows, setAvailableHeaderRows] = React.useState<{ id: number; task_number: number; name: string }[]>([]);
  const [allTasksForEdit, setAllTasksForEdit] = React.useState<EditRowData[]>([]);

  // ==========================================================================
  // Load Job and Gantt Data
  // ==========================================================================

  React.useEffect(() => {
    async function loadJob() {
      try {
        const jobResponse = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        if (jobResponse) {
          setJob(jobResponse);
        }
      } catch (err) {
        console.error('[Gantt] Failed to load job:', err);
      }
    }

    if (jobId) {
      loadJob();
      gantt.loadData();
    }
  }, [jobId, gantt.loadData]);

  // ==========================================================================
  // Load Reference Data for EditRowDialog
  // ==========================================================================

  React.useEffect(() => {
    const loadReferenceData = async () => {
      // Load trades
      try {
        const tradesData = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_trades/records?per_page=1000");
        if (tradesData?.records) setAvailableTrades(tradesData.records);
      } catch (e) { console.error("Failed to load trades:", e); }

      // Load stages
      try {
        const stagesData = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_stages/records?per_page=100");
        if (stagesData?.records) setAvailableStages(stagesData.records);
      } catch (e) { console.error("Failed to load stages:", e); }

      // Load roles
      try {
        const rolesData = await api.get<{ success: boolean; records: { id: number; name: string; display_name: string }[] }>("/api/v1/foundations/roles/records?per_page=100");
        if (rolesData?.records) setAvailableRoles(rolesData.records.map(r => ({ id: r.id, name: r.name, display_name: r.display_name || r.name })));
      } catch (e) { console.error("Failed to load roles:", e); }

      // Load cost centres
      try {
        const costCentresData = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/cost_centres/records?per_page=1000");
        if (costCentresData?.records) setAvailableCostCentres(costCentresData.records);
      } catch (e) { console.error("Failed to load cost centres:", e); }

      // Load checklists
      try {
        const checklistsData = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/supervisor_checklist_templates/records?per_page=100");
        if (checklistsData?.records) setAvailableChecklists(checklistsData.records);
      } catch (e) { console.error("Failed to load checklists:", e); }

      // Load document types (lightweight ?for=select fast path - 1 query, ~20ms)
      // Full /api/v1/document_types serializes 808 types with heavy joins - too slow for dropdown
      try {
        const docTypesData = await api.get<{ success: boolean; data: { id: number; name: string; display_name?: string; abbreviation?: string; scope?: string; folder?: string }[] }>("/api/v1/document_types?for=select&scope=job");
        if (docTypesData?.data) {
          setAvailableDocumentTypes(docTypesData.data);
        }
      } catch (e) { console.error("Failed to load document types:", e); }

      // Load trading names
      try {
        const tradingNamesData = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/trading_names/records?per_page=100");
        if (tradingNamesData?.records) setAvailableTradingNames(tradingNamesData.records);
      } catch (e) { console.error("Failed to load trading names:", e); }

      // Load invoice templates
      try {
        const templatesData = await api.get<{ success: boolean; data: { id: number; name: string; description: string; primary_color: string; secondary_color: string; is_default?: boolean }[] }>("/api/v1/claim_invoice_templates");
        if (templatesData?.data) setAvailableInvoiceTemplates(templatesData.data);
      } catch (e) { console.error("Failed to load invoice templates:", e); }
    };

    loadReferenceData();
  }, []);

  // ==========================================================================
  // Update Header Rows and All Tasks for EditRowDialog
  // ==========================================================================

  React.useEffect(() => {
    if (!gantt.tasks.length) return;

    // Extract header rows from gantt tasks
    const headers = gantt.tasks
      .filter((t) => {
        const row = t.rowData as SmScheduleMaster | undefined;
        return row?.allow_header || row?.header_gantt === 'Header';
      })
      .map((t) => {
        const row = t.rowData as SmScheduleMaster;
        return { id: row.id, task_number: row.task_number, name: row.name };
      });
    setAvailableHeaderRows(headers);

    // Convert all gantt tasks to EditRowData format
    // Note: Job mode returns sm_tasks which have _id suffix fields
    const allRows: EditRowData[] = gantt.tasks.map((t) => {
      const row = t.rowData as SmScheduleMaster;
      const jobRow = row as JobTaskRowData;  // Job tasks extend SmScheduleMaster with _id suffix fields
      return {
        id: row.id,
        task_number: row.task_number,
        name: row.name,
        description: row.description || undefined,
        duration_days: row.duration_days || 1,
        sequence_order: row.sequence_order || 0,
        // Job tasks use _id suffix, templates use direct values
        trade: jobRow.trade_id ? String(jobRow.trade_id) : (row.trade ? String(row.trade) : undefined),
        stage: jobRow.stage_id ? String(jobRow.stage_id) : (row.stage ? String(row.stage) : undefined),
        assigned_role: jobRow.assigned_role_id ? String(jobRow.assigned_role_id) : (row.assigned_role || null),
        cost_centre: jobRow.cost_centre_id ? String(jobRow.cost_centre_id) : (row.cost_centre ? String(row.cost_centre) : undefined),
        header_gantt: row.header_gantt as string | null | undefined,
        allow_header: row.allow_header || false,
        is_active: row.is_active !== false,
        po_required: row.po_required || false,
        critical_po: row.critical_po || false,
        create_po_on_job_start: row.create_po_on_job_start || false,
        spawn_order_task: jobRow.spawn_order_task || false,
        spawn_call_task: jobRow.spawn_call_task || false,
        require_photo: row.require_photo || false,
        pass_fail_enabled: row.pass_fail_enabled || false,
        checklist_id: row.checklist_id as number | undefined,
        is_claim_task: jobRow.is_claim_task || false,
        is_variation: jobRow.is_variation || false,
        claim_percentage: jobRow.claim_percentage as number | null | undefined,
        claim_invoice_pattern: jobRow.claim_invoice_pattern as string | null | undefined,
        claim_invoice_template_id: jobRow.claim_invoice_template_id as number | null | undefined,
        claim_trading_name_id: jobRow.claim_trading_name_id as number | null | undefined,
      };
    });
    setAllTasksForEdit(allRows);
  }, [gantt.tasks]);

  // ==========================================================================
  // Schedule Master Navigation
  // ==========================================================================

  const handleOpenScheduleMasterTable = React.useCallback(() => {
    router.push('/settings/operations/schedule-master');
  }, [router]);

  const handleOpenMasterTask = React.useCallback(async (smScheduleMasterId: number) => {
    // Fetch the SmScheduleMaster template record via Foundation API (SSoT)
    const resp = await api.get<{ success: boolean; record: SmScheduleMaster }>(
      `/api/v1/foundations/sm-schedule-master/records/${smScheduleMasterId}`
    );
    const data = resp?.record;
    if (!data) return;
    const editRow: EditRowData = {
      id: data.id,
      task_number: data.task_number,
      name: data.name,
      description: data.description || undefined,
      duration_days: data.duration_days || 1,
      predecessor_ids: data.predecessor_ids ?? [],
      predecessor_display: data.predecessor_display || '',
      trade: data.trade || undefined,
      trade_id: undefined,
      stage: data.stage || undefined,
      stage_id: undefined,
      assigned_role: data.assigned_role || undefined,
      assigned_role_id: undefined,
      cost_centre: data.cost_centre || undefined,
      cost_centre_id: undefined,
      hold: data.hold || false,
      hold_date: data.hold_date || undefined,
      confirm: data.confirm || false,
      supplier_confirm: data.supplier_confirm || false,
      started: false,
      po_required: data.po_required || false,
      supplier_id: data.supplier_id || undefined,
      supplier_name: data.supplier_name || undefined,
    } as unknown as EditRowData;
    setSelectedTaskForEdit(editRow);
    setShowTaskEditDialog(true);
  }, []);

  // ==========================================================================
  // EditRowDialog Handlers
  // ==========================================================================

  // Handle task double-click to open EditRowDialog (close quick edit first)
  const handleTaskEditDoubleClick = React.useCallback((task: GanttTask) => {
    setQuickEditTask(null);
    const row = task.rowData as SmScheduleMaster | undefined;
    if (!row) return;

    // Job tasks extend SmScheduleMaster with _id suffix fields
    const jobRow = row as JobTaskRowData;

    // Convert to EditRowData format (SSoT: same as Schedule Master)
    const editRow: EditRowData = {
      id: row.id,
      task_number: row.task_number,
      name: row.name,
      description: row.description || undefined,
      duration_days: row.duration_days || 1,
      sequence_order: row.sequence_order || 0,
      // Job tasks use _id suffix, templates use direct values
      trade: jobRow.trade_id ? String(jobRow.trade_id) : (row.trade ? String(row.trade) : undefined),
      trade_name: jobRow.trade_name ? String(jobRow.trade_name) : undefined,
      stage: jobRow.stage_id ? String(jobRow.stage_id) : (row.stage ? String(row.stage) : undefined),
      stage_name: jobRow.stage_name ? String(jobRow.stage_name) : undefined,
      assigned_role: jobRow.assigned_role_id ? String(jobRow.assigned_role_id) : (row.assigned_role || null),
      cost_centre: jobRow.cost_centre_id ? String(jobRow.cost_centre_id) : (row.cost_centre ? String(row.cost_centre) : undefined),
      header_gantt: row.header_gantt as string | null | undefined,
      allow_header: row.allow_header || false,
      is_active: row.is_active !== false,
      po_required: row.po_required || false,
      critical_po: row.critical_po || false,
      create_po_on_job_start: row.create_po_on_job_start || false,
      spawn_order_task: jobRow.spawn_order_task || false,
      spawn_call_task: jobRow.spawn_call_task || false,
      require_photo: row.require_photo || false,
      pass_fail_enabled: row.pass_fail_enabled || false,
      checklist_id: row.checklist_id as number | undefined,
      is_claim_task: jobRow.is_claim_task || false,
      is_variation: jobRow.is_variation || false,
      claim_percentage: jobRow.claim_percentage as number | null | undefined,
      claim_invoice_pattern: jobRow.claim_invoice_pattern as string | null | undefined,
      claim_invoice_template_id: jobRow.claim_invoice_template_id as number | null | undefined,
      claim_trading_name_id: jobRow.claim_trading_name_id as number | null | undefined,
      // Workflow triggers
      start_workflow_enabled: jobRow.start_workflow_enabled || false,
      start_workflow_id: jobRow.start_workflow_id as number | null | undefined,
      start_workflow_name: jobRow.start_workflow_name as string | null | undefined,
      complete_workflow_enabled: jobRow.complete_workflow_enabled || false,
      complete_workflow_id: jobRow.complete_workflow_id as number | null | undefined,
      complete_workflow_name: jobRow.complete_workflow_name as string | null | undefined,
      // Completion document requirement
      requires_document_to_complete: jobRow.requires_document_to_complete === true,
      completion_document_type_id: jobRow.completion_document_type_id as number | null | undefined,
      completion_document_type_name: jobRow.completion_document_type_name as string | null | undefined,
      // Dependencies
      predecessor_ids: row.predecessor_ids || [],
      // Relationships
      related_po_task_ids: jobRow.related_po_task_ids || [],
      related_po_task_names: jobRow.related_po_task_names || [],
      linked_task_ids: jobRow.linked_task_ids || [],
      completion_linked_task_ids: jobRow.completion_linked_task_ids || [],
      // Plan and document reference types
      plan_type_ids: jobRow.plan_type_ids || [],
      plan_type_names: jobRow.plan_type_names || [],
      document_ref_type_ids: jobRow.document_ref_type_ids || [],
      document_ref_type_names: jobRow.document_ref_type_names || [],
    };
    setSelectedTaskForEdit(editRow);
    setShowTaskEditDialog(true);
  }, []);

  // Save task changes - callback for EditRowDialog
  const handleSaveTask = React.useCallback(async (rowId: number, data: EditRowFormData) => {
    await api.patch(`/api/v1/sm_tasks/${rowId}`, {
      sm_task: {
        name: data.name,
        description: data.description,
        duration_days: data.duration_days,
        sequence_order: data.sequence_order,
        // Basic settings - sm_tasks uses _id suffix
        trade_id: data.trade ? parseInt(data.trade) : null,
        assigned_role_id: data.assigned_role ? parseInt(data.assigned_role) : null,
        // Classification
        stage_id: data.stage ? parseInt(data.stage) : null,
        cost_centre_id: data.cost_centre ? parseInt(data.cost_centre) : null,
        // PO settings
        po_required: data.po_required,
        critical_po: data.critical_po,
        create_po_on_job_start: data.create_po_on_job_start,
        spawn_order_task: data.spawn_order_task,
        spawn_call_task: data.spawn_call_task,
        // Completion
        require_photo: data.require_photo,
        pass_fail_enabled: data.pass_fail_enabled,
        // Relationships
        header_gantt: data.header_gantt,
        allow_header: data.allow_header,
        checklist_id: data.checklist_id,
        // Claim settings
        is_claim_task: data.is_claim_task,
        is_variation: data.is_variation,
        claim_percentage: data.claim_percentage,
        claim_invoice_pattern: data.claim_invoice_pattern,
        claim_invoice_template_id: data.claim_invoice_template_id,
        claim_trading_name_id: data.claim_trading_name_id,
        // Active status
        is_active: data.is_active,
        // Workflow triggers
        start_workflow_enabled: data.start_workflow_enabled,
        start_workflow_id: data.start_workflow_id,
        complete_workflow_enabled: data.complete_workflow_enabled,
        complete_workflow_id: data.complete_workflow_id,
        // Completion document requirement
        requires_document_to_complete: data.requires_document_to_complete,
        completion_document_type_id: data.completion_document_type_id,
        // Dependencies
        predecessor_ids: data.predecessor_ids,
        // Relationships
        related_po_task_ids: data.related_po_task_ids,
        linked_task_ids: data.linked_task_ids,
        completion_linked_task_ids: data.completion_linked_task_ids,
        // Plan and document reference types
        plan_type_ids: data.plan_type_ids,
        document_ref_type_ids: data.document_ref_type_ids,
      }
    });
    // Clear cache and reload gantt data
    clearCachedRecords("sm_tasks");
    gantt.loadData({ silent: true });
  }, [gantt]);

  // Simple task update for dependency editor (e.g., unlocking a task)
  const handleUpdateTask = React.useCallback(async (taskId: string, updates: Record<string, unknown>) => {
    await api.patch(`/api/v1/sm_tasks/${taskId}`, {
      sm_task: updates,
    });
    // Clear cache and reload gantt data
    clearCachedRecords("sm_tasks");
    gantt.loadData({ silent: true });
  }, [gantt]);

  // ==========================================================================
  // Quick Edit Popover (single-click on task bar)
  // ==========================================================================

  const handleTaskClick = React.useCallback((task: GanttTask, event: MouseEvent) => {
    // Don't open quick edit for header tasks
    if (task.rowData && isHeaderRow(task.rowData)) return;
    setQuickEditTask(task);
    setQuickEditPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const handleQuickEditSave = React.useCallback(async (
    taskId: string,
    updates: { start_date: string; duration_days: number; hold: boolean; hold_date: string }
  ) => {
    await api.patch(`/api/v1/sm_tasks/${taskId}`, {
      sm_task: updates,
    });
    clearCachedRecords("sm_tasks");
    gantt.loadData({ silent: true });
  }, [gantt]);

  // ==========================================================================
  // Photo Panel (Job-specific)
  // ==========================================================================

  const loadJobPhotos = React.useCallback(async () => {
    if (!showPhotoPanel || !jobId) return;

    try {
      setLoadingPhotos(true);

      const response = await api.get<{
        success: boolean;
        items: Array<{
          id: string;
          name: string;
          download_url?: string;
          thumbnail_url?: string;
          web_url?: string;
          modified?: string;
        }>;
      }>(`/api/v1/documents/job_all_files?job_id=${jobId}`);

      if (response?.items) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
        const imageFiles = response.items.filter((item) => {
          const ext = item.name.toLowerCase().slice(item.name.lastIndexOf('.'));
          return imageExtensions.includes(ext);
        });

        const photos: PhotoItem[] = imageFiles.map((file) => ({
          id: file.id,
          name: file.name,
          url: file.thumbnail_url || file.download_url || '',
          thumbnailUrl: file.thumbnail_url || file.download_url || '',
          webUrl: file.web_url,
          modifiedAt: file.modified,
        }));

        photos.sort((a, b) => {
          const dateA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
          const dateB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
          return dateB - dateA;
        });

        setJobPhotos(photos);
      }
    } catch (err) {
      console.error('[Gantt] Failed to load photos:', err);
      toast({
        title: 'Error',
        description: 'Failed to load job photos',
        variant: 'destructive',
      });
    } finally {
      setLoadingPhotos(false);
    }
  }, [showPhotoPanel, jobId, toast]);

  React.useEffect(() => {
    if (showPhotoPanel && jobPhotos.length === 0) {
      loadJobPhotos();
    }
  }, [showPhotoPanel, jobPhotos.length, loadJobPhotos]);

  const handleOpenOldGantt = () => {
    window.open(`/jobs/${jobId}/schedule`, '_blank');
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (gantt.loading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          job={job}
          jobId={jobId}
          onOpenOldGantt={handleOpenOldGantt}
          lastSyncedAt={offlineCache.lastSyncedAt}
          lastSyncedDisplay={offlineCache.lastSyncedDisplay}
          isStale={offlineCache.isStale}
          isLoading={gantt.loading}
          isOfflineCached={offlineCache.isOfflineCached}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-muted-foreground">Loading Gantt...</p>
          </div>
        </div>
      </div>
    );
  }

  if (gantt.error) {
    return (
      <div className="flex flex-col h-full">
        <Header
          job={job}
          jobId={jobId}
          onOpenOldGantt={handleOpenOldGantt}
          lastSyncedAt={offlineCache.lastSyncedAt}
          lastSyncedDisplay={offlineCache.lastSyncedDisplay}
          isStale={offlineCache.isStale}
          isLoading={gantt.loading}
          isOfflineCached={offlineCache.isOfflineCached}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-destructive">{gantt.error}</p>
            <Button onClick={() => gantt.loadData()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
          job={job}
          jobId={jobId}
          onOpenOldGantt={handleOpenOldGantt}
          lastSyncedAt={offlineCache.lastSyncedAt}
          lastSyncedDisplay={offlineCache.lastSyncedDisplay}
          isStale={offlineCache.isStale}
          isLoading={gantt.loading}
          isOfflineCached={offlineCache.isOfflineCached}
        />

      {/* Gantt Chart + Photo Panel */}
      <div className="flex-1 min-h-0 flex">
        {/* Gantt Chart */}
        <div className="flex-1 min-h-0">
          <GanttUnified
            tasks={gantt.tasks}
            dependencies={gantt.dependencies}
            jobId={jobId}
            showToolbar={true}
            onTaskClick={handleTaskClick}
            onTaskDoubleClick={handleTaskEditDoubleClick}
            onCheckboxToggle={gantt.handleCheckboxToggle}
            onRollover={gantt.handleRollover}
            onEditDependencies={gantt.openDependencyEditor}
            onTaskDrag={gantt.handleTaskDrag}
            onTaskResize={gantt.handleTaskResize}
            showPhotoPanel={showPhotoPanel}
            onTogglePhotoPanel={() => setShowPhotoPanel(!showPhotoPanel)}
            onOpenScheduleMasterTable={handleOpenScheduleMasterTable}
            onOpenMasterTask={handleOpenMasterTask}
          />
        </div>

        {/* Photo Panel - Right Side (Job-specific) */}
        {showPhotoPanel && (
          <div className="w-64 border-l bg-background flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Job Photos</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowPhotoPanel(false)}
                title="Close Panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-3 py-2 border-b text-xs text-muted-foreground">
              {loadingPhotos ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-3 w-3" />
                  Loading photos...
                </span>
              ) : (
                <span>{jobPhotos.length} photos</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loadingPhotos ? (
                <div className="flex items-center justify-center h-32">
                  <Spinner className="h-6 w-6 text-muted-foreground" />
                </div>
              ) : jobPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Camera className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No photos found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {jobPhotos.map((photo, index) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        setLightboxIndex(index);
                        setLightboxOpen(true);
                      }}
                      className="aspect-square rounded-md overflow-hidden bg-muted/50 hover:ring-2 hover:ring-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary relative group"
                    >
                      {photo.thumbnailUrl ? (
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Replace broken image with placeholder
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling;
                            if (placeholder) placeholder.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-muted/80 ${photo.thumbnailUrl ? 'hidden' : ''}`}>
                        <Camera className="h-6 w-6 text-muted-foreground/50 mb-1" />
                        <span className="text-[9px] text-muted-foreground text-center px-1 truncate w-full">
                          {photo.name.length > 20 ? photo.name.slice(0, 17) + '...' : photo.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={loadJobPhotos}
                disabled={loadingPhotos}
              >
                {loadingPhotos ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      <ImageLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photos={jobPhotos}
        initialIndex={lightboxIndex}
      />

      {/* Quick Edit Popover - single-click on task bar */}
      {quickEditTask && (
        <GanttTaskQuickEdit
          task={quickEditTask}
          position={quickEditPosition}
          isOpen={!!quickEditTask}
          onClose={() => setQuickEditTask(null)}
          onSave={handleQuickEditSave}
        />
      )}

      {/* Dependency Editor - SSoT: shared component */}
      {/* SSoT: Always pass ALL tasks (gantt.tasks), not just visible tasks
          The editor needs to look up inherited predecessors which might be in collapsed headers */}
      <GanttDependencyEditor
        isOpen={gantt.dependencyEditorState.isOpen}
        onClose={() => gantt.setDependencyEditorState({ isOpen: false, task: null, visibleTasks: [] })}
        task={gantt.dependencyEditorState.task}
        tasks={gantt.tasks}
        onSave={gantt.handleDependencyEditorSave}
        onUpdateTask={handleUpdateTask}
      />

      {/* Edit Dialog - SSoT: uses shared EditRowDialog component */}
      <EditRowDialog
        open={showTaskEditDialog}
        onOpenChange={setShowTaskEditDialog}
        row={selectedTaskForEdit}
        onSave={handleSaveTask}
        onRefresh={() => gantt.loadData({ silent: true })}
        trades={availableTrades}
        roles={availableRoles}
        stages={availableStages}
        costCentres={availableCostCentres}
        checklists={availableChecklists}
        documentTypes={availableDocumentTypes}
        tradingNames={availableTradingNames}
        invoiceTemplates={availableInvoiceTemplates}
        headerRows={availableHeaderRows}
        allRows={allTasksForEdit}
        showTemplateSection={false}
        jobId={jobId}
      />

      {/* Confirm Dialog - SSoT: for supplier_confirm/confirm toggles */}
      <Dialog
        open={gantt.confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            gantt.setConfirmDialog({ ...gantt.confirmDialog, isOpen: false });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {gantt.confirmDialog.type === 'supplierConfirm'
                ? 'Confirm Supplier Lock'
                : 'Confirm Task Lock'}
            </DialogTitle>
            <DialogDescription>
              {gantt.confirmDialog.isChecking ? (
                <>
                  Locking this task will fix its position. Successors will no longer push it forward.
                  {gantt.confirmDialog.affectedSuccessors.length > 0 && (
                    <span className="block mt-2">
                      <strong>{gantt.confirmDialog.affectedSuccessors.length} successor(s)</strong>{' '}
                      depend on this task.
                    </span>
                  )}
                </>
              ) : (
                'Unlocking this task will allow it to be pushed by predecessors again.'
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => gantt.setConfirmDialog({ ...gantt.confirmDialog, isOpen: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (gantt.confirmDialog.task) {
                  await gantt.executeCheckboxToggle(
                    gantt.confirmDialog.task.id,
                    gantt.confirmDialog.type === 'supplierConfirm' ? 'supplier_confirm' : 'confirm',
                    gantt.confirmDialog.isChecking
                  );
                }
                gantt.setConfirmDialog({ ...gantt.confirmDialog, isOpen: false });
              }}
            >
              {gantt.confirmDialog.isChecking ? 'Lock Task' : 'Unlock Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Task Dialog - SSoT: for starting tasks with break options */}
      <Dialog
        open={gantt.startTaskDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Start Task
            </DialogTitle>
            <DialogDescription>
              <strong>{gantt.startTaskDialog.task?.name}</strong>
              {gantt.startTaskDialog.headerName && (
                <span className="block mt-1">
                  Under header: <strong>{gantt.startTaskDialog.headerName}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {!gantt.startTaskDialog.isTodayWorkingDay && gantt.startTaskDialog.lastWorkingDay && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Today is not a working day. Choose a start date:
                </p>
              </div>
            )}

            {gantt.startTaskDialog.headerName && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => {
                  if (gantt.startTaskDialog.task) {
                    gantt.executeStartTask(
                      gantt.startTaskDialog.task,
                      'break-header',
                      gantt.startTaskDialog.isTodayWorkingDay
                        ? new Date()
                        : gantt.startTaskDialog.lastWorkingDay || new Date()
                    );
                  }
                  gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
                }}
              >
                <Link2Off className="h-5 w-5 text-amber-600" />
                <div className="text-left">
                  <div className="font-medium">Break out of header</div>
                  <div className="text-xs text-muted-foreground">
                    Task becomes standalone, starts{' '}
                    {gantt.startTaskDialog.isTodayWorkingDay
                      ? 'today'
                      : gantt.startTaskDialog.lastWorkingDay?.toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                  </div>
                </div>
              </Button>
            )}

            {gantt.startTaskDialog.hasPredecessors && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => {
                  if (gantt.startTaskDialog.task) {
                    gantt.executeStartTask(
                      gantt.startTaskDialog.task,
                      'break-dependency',
                      gantt.startTaskDialog.isTodayWorkingDay
                        ? new Date()
                        : gantt.startTaskDialog.lastWorkingDay || new Date()
                    );
                  }
                  gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
                }}
              >
                <GitBranch className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <div className="text-left">
                  <div className="font-medium">Break dependencies</div>
                  <div className="text-xs text-muted-foreground">
                    Clear predecessors, stay under header
                  </div>
                </div>
              </Button>
            )}

            <Button
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => {
                if (gantt.startTaskDialog.task) {
                  gantt.executeStartTask(
                    gantt.startTaskDialog.task,
                    'start-only',
                    gantt.startTaskDialog.isTodayWorkingDay
                      ? new Date()
                      : gantt.startTaskDialog.lastWorkingDay || new Date()
                  );
                }
                gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false });
              }}
            >
              <PlayCircle className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Start only</div>
                <div className="text-xs text-muted-foreground">
                  Keep relationships, mark as started
                </div>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => gantt.setStartTaskDialog({ ...gantt.startTaskDialog, isOpen: false })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cascade Dialog - SSoT: for task moves with successors */}
      <Dialog
        open={gantt.cascadeDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            gantt.setCascadeDialog({
              isOpen: false,
              task: null,
              newStartDate: null,
              successors: [],
              lockedSuccessors: [],
              unlockedSuccessors: [],
            });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Move Task - Successor Impact</DialogTitle>
            <DialogDescription>
              <strong>{gantt.cascadeDialog.task?.name}</strong> has successors that depend on it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {gantt.cascadeDialog.unlockedSuccessors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-green-600 dark:text-green-400">
                  Will Move ({gantt.cascadeDialog.unlockedSuccessors.length})
                </h4>
                <div className="text-sm text-muted-foreground">
                  {gantt.cascadeDialog.unlockedSuccessors.map((s) => s.name).join(', ')}
                </div>
              </div>
            )}

            {gantt.cascadeDialog.lockedSuccessors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-amber-600">
                  Locked ({gantt.cascadeDialog.lockedSuccessors.length})
                </h4>
                <div className="text-sm text-muted-foreground">
                  These tasks are confirmed and cannot be moved automatically.
                </div>
                <div className="space-y-1">
                  {gantt.cascadeDialog.lockedSuccessors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span>{s.name}</span>
                      <Badge variant="outline" className="text-xs">
                        Locked
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                gantt.setCascadeDialog({
                  isOpen: false,
                  task: null,
                  newStartDate: null,
                  successors: [],
                  lockedSuccessors: [],
                  unlockedSuccessors: [],
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (gantt.cascadeDialog.task && gantt.cascadeDialog.newStartDate) {
                  gantt.executeDragMove(gantt.cascadeDialog.task, gantt.cascadeDialog.newStartDate);
                }
                gantt.setCascadeDialog({
                  isOpen: false,
                  task: null,
                  newStartDate: null,
                  successors: [],
                  lockedSuccessors: [],
                  unlockedSuccessors: [],
                });
              }}
            >
              Move Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug Info */}
      <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span className="font-medium">Gantt (SSoT Hook)</span>
        {' | '}
        {gantt.tasks.length} tasks, {gantt.dependencies.length} dependencies
        {' | '}
        <a
          href={`/jobs/${jobId}/schedule`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 dark:text-blue-400 hover:underline"
        >
          Compare with old Gantt
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// Header Component
// =============================================================================

interface HeaderProps {
  job: Job | null;
  jobId: number;
  onOpenOldGantt: () => void;
  // Offline sync status
  lastSyncedAt: Date | null;
  lastSyncedDisplay: string;
  isStale: boolean;
  isLoading: boolean;
  isOfflineCached: boolean;
}

function Header({
  job,
  jobId,
  onOpenOldGantt,
  lastSyncedAt,
  lastSyncedDisplay,
  isStale,
  isLoading,
  isOfflineCached,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-lg font-semibold">
            Gantt {job ? `- ${job.name || job.title || job.job_code || `Job #${jobId}`}` : ''}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">SSoT Hook Architecture</p>
            <span className="text-muted-foreground">•</span>
            <GanttSyncIndicator
              lastSyncedAt={lastSyncedAt}
              lastSyncedDisplay={lastSyncedDisplay}
              isStale={isStale}
              isLoading={isLoading}
              isOfflineCached={isOfflineCached}
            />
          </div>
        </div>
        {/* Quick Links - Plans, PO, Claims, Site (SSoT: same as old Gantt page) */}
        <div className="flex items-center gap-1 ml-2">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/plans`, '_blank')}>
            Plans
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/purchase-orders`, '_blank')}>
            PO
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/claims`, '_blank')}>
            Claims
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/site`, '_blank')}>
            Site
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenOldGantt}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Compare with Old Gantt
        </Button>
      </div>
    </div>
  );
}
