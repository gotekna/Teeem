"use client";

import * as React from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { Calendar, RefreshCw, SkipForward, Link2, Plus, Check, AlertTriangle, Trash2, BarChart3, ArrowRight, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TeeemTableView from "@/components/table/TeeemTableView";
import { GanttCanvasView } from "@/components/gantt-canvas/GanttCanvasView";
import type { GanttTask } from "@/lib/gantt/types";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { parseISO } from "date-fns";

interface Job {
  id: number;
  name: string;
  title: string;
  status: string;
  stage: string;
}

// SmTask interface for Gantt
interface SmTask {
  id: number;
  task_number: number;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  status: "not_started" | "started" | "completed";
  progress_percentage: number;
  locked: boolean;
  dependencies?: string[];
}

interface SmTasksResponse {
  success: boolean;
  sm_tasks: SmTask[];
}

// Sync types
interface SyncResult {
  success: boolean;
  message: string;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    unchanged: number;
    errors: number;
  };
  skipped_tasks: Array<{
    task_id: number;
    task_name: string;
    reason: string;
  }>;
  errors: Array<{
    row_id: number;
    error: string;
  }>;
}

interface CompareResult {
  success: boolean;
  template_id: number;
  template_name: string;
  job_id: number;
  job_name: string;
  summary: {
    will_create: number;
    will_update: number;
    will_skip: number;
    unchanged: number;
    unlinked: number;
    total: number;
  };
  comparisons: Array<{
    template_row: {
      id: number;
      task_number: number;
      name: string;
      description: string | null;
      duration_days: number;
      trade: string | null;
      stage: string | null;
      require_photo: boolean;
      po_required: boolean;
      critical_po: boolean;
    };
    job_task: {
      id: number;
      task_number: number;
      name: string;
      description: string | null;
      duration_days: number;
      trade: string | null;
      stage: string | null;
      status: string;
      require_photo: boolean;
      po_required: boolean;
      critical_po: boolean;
      started_at: string | null;
      completed_at: string | null;
      confirm: boolean;
      supplier_confirm: boolean;
      hold: boolean;
      purchase_order_id: number | null;
    } | null;
    status: "will_create" | "will_update" | "will_skip" | "unchanged";
    skip_reason: string | null;
    differences: Record<string, { template: unknown; task: unknown }>;
  }>;
  unlinked_tasks: Array<{
    task_id: number;
    task_number: number;
    name: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
  }>;
}

interface JobTemplate {
  id: number;
  name: string;
}

interface MatchAnalysis {
  auto_link: Array<{
    template_row_id: number;
    task_id: number;
    name: string;
    task_name: string;
    similarity: number;
  }>;
  needs_confirmation: Array<{
    template_row_id: number;
    task_id: number;
    template_name: string;
    template_task_number: number;
    task_name: string;
    task_task_number: number;
    similarity: number;
  }>;
  will_create: Array<{
    template_row_id: number;
    task_number: number;
    name: string;
    closest_match?: {
      task_id: number;
      name: string;
      similarity: number;
    };
  }>;
  already_linked: number;
  unlinked_tasks: Array<{
    task_id: number;
    task_number: number;
    name: string;
  }>;
}

interface AnalyzeResult {
  success: boolean;
  template_id: number;
  template_name: string;
  job_id: number;
  job_name: string;
  analysis: MatchAnalysis;
  summary: {
    auto_link_count: number;
    needs_confirmation_count: number;
    will_create_count: number;
    already_linked_count: number;
    orphan_count: number;
  };
}

// Row-level comparison for edit drawer
interface RowComparison {
  task: {
    id: number;
    task_number: number;
    name: string;
    description: string | null;
    duration_days: number;
    trade: string | null;
    stage: string | null;
    status: string;
    require_photo: boolean;
    po_required: boolean;
    critical_po: boolean;
    order_time_days: number | null;
    call_time_days: number | null;
    checklist_id: number | null;
    sm_schedule_master_id: number | null;
  };
  template_row: {
    id: number;
    task_number: number;
    name: string;
    description: string | null;
    duration_days: number;
    trade: string | null;
    stage: string | null;
    require_photo: boolean;
    po_required: boolean;
    critical_po: boolean;
    order_time_days: number | null;
    call_time_days: number | null;
    checklist_id: number | null;
  } | null;
  differences: Record<string, { template: unknown; task: unknown }>;
  can_sync: boolean;
  skip_reason: string | null;
}

function mapTaskToGanttTask(task: SmTask): GanttTask {
  const statusMap: Record<string, GanttTask["status"]> = {
    not_started: "not-started",
    started: "in-progress",
    completed: "completed",
  };

  return {
    id: String(task.id),
    name: task.name,
    startDate: parseISO(task.start_date),
    endDate: parseISO(task.end_date),
    status: statusMap[task.status] || "not-started",
    progress: task.progress_percentage || 0,
    locked: task.locked ? "manuallyPositioned" : undefined,
    predecessorIds: task.dependencies || [],
  };
}

export default function SchedulePage() {
  const params = useParams();
  const jobId = params.id as string;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Check if Gantt should auto-open from URL param
  const shouldOpenGantt = searchParams.get('gantt') === 'true';

  // Parse view from path: /jobs/123/schedule/setup → "setup"
  const activeView = React.useMemo(() => {
    const parts = pathname.replace(`/jobs/${jobId}/schedule`, "").split("/").filter(Boolean);
    return parts[0] || "table";
  }, [pathname, jobId]);

  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Gantt state
  const [ganttOpen, setGanttOpen] = React.useState(false);
  const [ganttTasks, setGanttTasks] = React.useState<SmTask[]>([]);
  const [loadingGantt, setLoadingGantt] = React.useState(false);

  // Sync state
  const [showSyncDialog, setShowSyncDialog] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [analyzeResult, setAnalyzeResult] = React.useState<AnalyzeResult | null>(null);
  const [compareResult, setCompareResult] = React.useState<CompareResult | null>(null);
  const [syncResult, setSyncResult] = React.useState<SyncResult | null>(null);
  const [syncStep, setSyncStep] = React.useState<"analyze" | "compare" | "result">("analyze");
  const [jobTemplate, setJobTemplate] = React.useState<JobTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [confirmedMatches, setConfirmedMatches] = React.useState<Set<number>>(new Set());
  const [orphansToDelete, setOrphansToDelete] = React.useState<Set<number>>(new Set());
  const [compareFilter, setCompareFilter] = React.useState<"all" | "will_create" | "will_update" | "will_skip" | "unchanged" | "unlinked">("all");

  // Row edit drawer state
  const [editDrawerOpen, setEditDrawerOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<Record<string, unknown> | null>(null);
  const [rowComparison, setRowComparison] = React.useState<RowComparison | null>(null);
  const [loadingRowComparison, setLoadingRowComparison] = React.useState(false);
  const [syncingRow, setSyncingRow] = React.useState(false);

  React.useEffect(() => {
    const fetchJob = async () => {
      try {
        const jobData = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        setJob(jobData);
      } catch (error) {
        console.error("Failed to fetch job:", error);
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // Handle inline row update (for Bulk Update button)
  const handleRowUpdate = React.useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/sm-tasks/records/${rowId}`, {
        record: { [field]: value }
      });
      triggerRefresh();
    } catch (error) {
      console.error("Failed to update task:", error);
      throw error;
    }
  }, [triggerRefresh]);

  // Open Gantt - fetch tasks and show sheet
  const handleOpenGantt = React.useCallback(async () => {
    setGanttOpen(true);
    setLoadingGantt(true);
    try {
      const tasksData = await api.get<SmTasksResponse>(`/api/v1/jobs/${jobId}/sm_tasks`);
      setGanttTasks(tasksData.sm_tasks || []);
    } catch (error) {
      console.error("Failed to fetch tasks for Gantt:", error);
      toast({ title: "Error", description: "Failed to load Gantt data", variant: "destructive" });
    } finally {
      setLoadingGantt(false);
    }
  }, [jobId, toast]);

  // Auto-open Gantt when path is /schedule/gantt or ?gantt=true is in URL
  React.useEffect(() => {
    const shouldOpen = shouldOpenGantt || activeView === 'gantt';
    if (shouldOpen && !loading && job && !ganttOpen) {
      handleOpenGantt();
      // Clear the gantt path/param to show table view underneath
      router.replace(`/jobs/${jobId}/schedule`, { scroll: false });
    }
  }, [shouldOpenGantt, activeView, loading, job, ganttOpen, handleOpenGantt, router, jobId]);

  // Convert tasks to Canvas Gantt format
  const ganttTasksFormatted = React.useMemo(() => {
    return ganttTasks.map(mapTaskToGanttTask);
  }, [ganttTasks]);

  // Build dependencies
  const ganttDependencies = React.useMemo(() => {
    const deps: Array<{ fromId: string; toId: string; type?: string }> = [];
    ganttTasks.forEach((task) => {
      (task.dependencies || []).forEach((depId) => {
        deps.push({ fromId: depId, toId: String(task.id), type: "FS" });
      });
    });
    return deps;
  }, [ganttTasks]);

  // Handle task drag in Gantt
  const handleTaskDrag = async (task: GanttTask, newStartDate: Date) => {
    const taskId = parseInt(task.id);
    const duration = task.endDate.getTime() - task.startDate.getTime();
    const newEndDate = new Date(newStartDate.getTime() + duration);

    setGanttTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              start_date: newStartDate.toISOString().split("T")[0],
              end_date: newEndDate.toISOString().split("T")[0],
            }
          : t
      )
    );

    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: {
          start_date: newStartDate.toISOString().split("T")[0],
          end_date: newEndDate.toISOString().split("T")[0],
        },
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      const tasksData = await api.get<SmTasksResponse>(`/api/v1/jobs/${jobId}/sm_tasks`);
      setGanttTasks(tasksData.sm_tasks || []);
    }
  };

  // Load job's default template
  const loadJobTemplate = React.useCallback(async () => {
    setLoadingTemplate(true);
    try {
      const response = await api.get<{
        success: boolean;
        sm_schedule_master_templates: Array<{ id: number; name: string; is_default: boolean }>
      }>("/api/v1/sm_schedule_master_templates");

      const templates = response.sm_schedule_master_templates || [];
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];

      if (defaultTemplate) {
        setJobTemplate({ id: defaultTemplate.id, name: defaultTemplate.name });
      }
    } catch (err) {
      console.error("Failed to load template:", err);
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  // Open sync dialog
  const handleOpenSyncDialog = async () => {
    setSyncResult(null);
    setCompareResult(null);
    setAnalyzeResult(null);
    setConfirmedMatches(new Set());
    setOrphansToDelete(new Set());
    setCompareFilter("all");
    setSyncStep("analyze");
    setShowSyncDialog(true);

    if (!jobTemplate) {
      await loadJobTemplate();
    }

    handleAnalyzeMatches();
  };

  // Analyze matches
  const handleAnalyzeMatches = async () => {
    let templateId = jobTemplate?.id;
    if (!templateId) {
      setLoadingTemplate(true);
      try {
        const response = await api.get<{
          success: boolean;
          sm_schedule_master_templates: Array<{ id: number; name: string; is_default: boolean }>
        }>("/api/v1/sm_schedule_master_templates");

        const templates = response.sm_schedule_master_templates || [];
        const defaultTemplate = templates.find(t => t.is_default) || templates[0];

        if (defaultTemplate) {
          setJobTemplate({ id: defaultTemplate.id, name: defaultTemplate.name });
          templateId = defaultTemplate.id;
        }
      } catch (err) {
        console.error("Failed to load template:", err);
        toast({ title: "Error", description: "Failed to load schedule template", variant: "destructive" });
        return;
      } finally {
        setLoadingTemplate(false);
      }
    }

    if (!templateId) {
      toast({ title: "No Template Found", description: "No schedule master template is configured", variant: "destructive" });
      return;
    }

    setAnalyzing(true);
    try {
      const response = await api.get<AnalyzeResult>(
        `/api/v1/sm_schedule_master_templates/${templateId}/analyze_matches?job_id=${jobId}`
      );
      if (response) {
        setAnalyzeResult(response);
        const allConfirmed = new Set(response.analysis.needs_confirmation.map(m => m.task_id));
        setConfirmedMatches(allConfirmed);
        const allOrphans = new Set(response.analysis.unlinked_tasks.map(t => t.task_id));
        setOrphansToDelete(allOrphans);
      }
    } catch (err) {
      console.error("Failed to analyze:", err);
      toast({ title: "Analysis Failed", description: "Failed to analyze matches", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply links and compare
  const handleApplyLinksAndCompare = async () => {
    if (!jobTemplate?.id || !analyzeResult) return;

    setAnalyzing(true);

    const linksToApply = [
      ...analyzeResult.analysis.auto_link.map(m => ({ template_row_id: m.template_row_id, task_id: m.task_id })),
      ...analyzeResult.analysis.needs_confirmation
        .filter(m => confirmedMatches.has(m.task_id))
        .map(m => ({ template_row_id: m.template_row_id, task_id: m.task_id }))
    ];

    if (linksToApply.length > 0) {
      try {
        await api.post(`/api/v1/sm_schedule_master_templates/${jobTemplate.id}/apply_links`, {
          job_id: parseInt(String(jobId)), links: linksToApply
        });
        toast({ title: "Links Applied", description: `Linked ${linksToApply.length} tasks to template rows` });
      } catch (err) {
        console.error("Failed to apply links:", err);
        toast({ title: "Failed to Apply Links", description: "Some links may not have been applied", variant: "destructive" });
      }
    }

    const orphanIds = Array.from(orphansToDelete);
    if (orphanIds.length > 0) {
      try {
        const deleteResponse = await api.post<{ success: boolean; deleted: number; errors: string[]; message: string }>(
          `/api/v1/sm_schedule_master_templates/${jobTemplate.id}/delete_orphans`,
          { job_id: parseInt(String(jobId)), task_ids: orphanIds }
        );
        if (deleteResponse && deleteResponse.deleted > 0) {
          toast({ title: "Orphans Deleted", description: deleteResponse.message });
        }
        if (deleteResponse?.errors && deleteResponse.errors.length > 0) {
          toast({
            title: "Some Tasks Skipped",
            description: `${deleteResponse.deleted} deleted, ${deleteResponse.errors.length} skipped`,
            variant: deleteResponse.deleted === 0 ? "destructive" : "default",
          });
        }
      } catch (err) {
        console.error("Failed to delete orphans:", err);
        toast({ title: "Failed to Delete Orphans", description: "Some orphan tasks may not have been deleted", variant: "destructive" });
      }
    }

    setAnalyzing(false);
    setSyncStep("compare");
    handleCompare();
  };

  const handleSkipToCompare = () => {
    setSyncStep("compare");
    handleCompare();
  };

  // Compare
  const handleCompare = async () => {
    let templateId = jobTemplate?.id;
    if (!templateId) {
      setLoadingTemplate(true);
      try {
        const response = await api.get<{
          success: boolean;
          sm_schedule_master_templates: Array<{ id: number; name: string; is_default: boolean }>
        }>("/api/v1/sm_schedule_master_templates");

        const templates = response.sm_schedule_master_templates || [];
        const defaultTemplate = templates.find(t => t.is_default) || templates[0];

        if (defaultTemplate) {
          setJobTemplate({ id: defaultTemplate.id, name: defaultTemplate.name });
          templateId = defaultTemplate.id;
        }
      } catch (err) {
        console.error("Failed to load template:", err);
        toast({ title: "Error", description: "Failed to load schedule template", variant: "destructive" });
        return;
      } finally {
        setLoadingTemplate(false);
      }
    }

    if (!templateId) {
      toast({ title: "No Template Found", description: "No schedule master template is configured", variant: "destructive" });
      return;
    }

    setComparing(true);
    try {
      const response = await api.get<CompareResult>(
        `/api/v1/sm_schedule_master_templates/${templateId}/compare_to_job?job_id=${jobId}`
      );
      if (response) {
        setCompareResult(response);
      }
    } catch (err) {
      console.error("Failed to compare:", err);
      toast({ title: "Comparison Failed", description: "Failed to compare template with job tasks", variant: "destructive" });
    } finally {
      setComparing(false);
    }
  };

  // Sync to job
  const handleSyncToJob = async () => {
    if (!jobTemplate?.id) return;

    setSyncing(true);
    try {
      const response = await api.post<SyncResult>(
        `/api/v1/sm_schedule_master_templates/${jobTemplate.id}/sync_to_job`,
        { job_id: parseInt(String(jobId)) }
      );
      if (response) {
        setSyncResult(response);
        setSyncStep("result");
        toast({
          title: "Sync Complete",
          description: `Created: ${response.summary.created}, Updated: ${response.summary.updated}, Skipped: ${response.summary.skipped}`,
        });
        triggerRefresh();
      }
    } catch (err) {
      console.error("Failed to sync:", err);
      toast({ title: "Sync Failed", description: "Failed to sync template to job", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // Row edit drawer handlers
  const handleRowDoubleClick = async (row: Record<string, unknown>) => {
    setSelectedRow(row);
    setRowComparison(null);
    setEditDrawerOpen(true);

    // Fetch comparison if task is linked to a template
    const taskId = row.id as number;
    const smScheduleMasterId = row.sm_schedule_master_id as number | null;

    if (smScheduleMasterId) {
      setLoadingRowComparison(true);
      try {
        const response = await api.get<{ success: boolean; comparison: RowComparison }>(
          `/api/v1/sm_tasks/${taskId}/compare_to_template`
        );
        if (response?.comparison) {
          setRowComparison(response.comparison);
        }
      } catch (err) {
        console.error("Failed to fetch row comparison:", err);
      } finally {
        setLoadingRowComparison(false);
      }
    }
  };

  const handleSyncRow = async () => {
    if (!selectedRow || !rowComparison?.template_row) return;

    setSyncingRow(true);
    try {
      const response = await api.post<{ success: boolean; message: string; changes: Record<string, unknown> }>(
        `/api/v1/sm_tasks/${selectedRow.id}/sync_from_template`
      );
      if (response?.success) {
        toast({
          title: "Row Synced",
          description: response.message || "Task updated from template",
        });
        // Refresh comparison
        const compResponse = await api.get<{ success: boolean; comparison: RowComparison }>(
          `/api/v1/sm_tasks/${selectedRow.id}/compare_to_template`
        );
        if (compResponse?.comparison) {
          setRowComparison(compResponse.comparison);
        }
        triggerRefresh();
      }
    } catch (err) {
      console.error("Failed to sync row:", err);
      toast({ title: "Sync Failed", description: "Failed to sync task from template", variant: "destructive" });
    } finally {
      setSyncingRow(false);
    }
  };

  // SSoT: Show skeleton layout during loading to prevent flash/CLS
  // The skeleton matches the actual page structure so there's no jarring layout shift
  if (loading) {
    return (
      <div className="flex flex-col h-full -mt-4">
        {/* Skeleton header - matches actual layout */}
        <div className="flex items-center justify-between pb-1 shrink-0">
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/jobs" />
            <Skeleton className="h-5 w-40" />
            <div className="flex items-center gap-1 ml-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
        </div>
        {/* Table skeleton - TeeemTableView will show its own loading but we show structure */}
        <div className="flex-1 -mx-4">
          <div className="h-full flex flex-col">
            {/* Toolbar skeleton */}
            <div className="flex items-center justify-between p-2 border-b">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-8 w-28" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            {/* Table header skeleton */}
            <div className="flex items-center gap-4 p-2 border-b bg-muted/30">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Table rows skeleton */}
            <div className="flex-1 space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mt-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-1 shrink-0">
        <div className="flex items-center gap-2">
          <BackButton fallbackHref="/jobs" />
          <span className="text-sm font-medium">{job?.name || "Loading..."}</span>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/plans`, '_blank')}>
              Plans
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/purchase-orders`, '_blank')}>
              PO
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}/site`, '_blank')}>
              Site
            </Button>
          </div>
        </div>
      </div>

      {/* Table View - fills remaining space */}
      <div className="flex-1 -mx-4">
        <TeeemTableView
          key={refreshKey}
          foundationId="sm-tasks"
          autoFetchRecords={true}
          initialFilters={[
            { id: "job-filter", column: "job_id", operator: "=", value: String(jobId) }
          ]}
          inheritViewsFrom="sm_schedule_master"
          tableName="Schedule Tasks"
          leftActions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/system/schedule-master`)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Master
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenSyncDialog}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from Master
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenGantt}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Open Gantt
              </Button>
            </div>
          }
          enableExport={true}
          onRefresh={triggerRefresh}
          onRowUpdate={handleRowUpdate}
          onRowDoubleClick={handleRowDoubleClick}
        />
      </div>

      {/* Gantt Sheet */}
      <Sheet open={ganttOpen} onOpenChange={setGanttOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="px-4 py-2 border-b">
            <SheetTitle className="text-sm font-medium">Gantt View - {job?.name}</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-48px)]">
            {loadingGantt ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size={32} className="text-muted-foreground" />
              </div>
            ) : ganttTasks.length > 0 ? (
              <GanttCanvasView
                staticTasks={ganttTasksFormatted}
                staticDependencies={ganttDependencies}
                showToolbar={true}
                onTaskDrag={handleTaskDrag}
                className="h-full"
                jobId={Number(jobId)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No tasks to display</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sync Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className={
          (syncStep === "analyze" && analyzeResult && (analyzeResult.summary.needs_confirmation_count > 0 || analyzeResult.summary.auto_link_count > 0))
            ? "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            : syncStep === "compare" && compareResult
              ? "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              : "max-w-lg"
        }>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {syncStep === "analyze" && <Link2 className="h-5 w-5" />}
              {syncStep === "compare" && <RefreshCw className="h-5 w-5" />}
              {syncStep === "result" && <Check className="h-5 w-5" />}
              {syncStep === "analyze" && "Link Tasks to Template"}
              {syncStep === "compare" && "Sync Schedule Master to Job"}
              {syncStep === "result" && "Sync Complete"}
            </DialogTitle>
            <DialogDescription>
              {syncStep === "analyze" && !analyzeResult && "Analyzing task matches..."}
              {syncStep === "analyze" && analyzeResult && "Match existing job tasks to template rows before syncing."}
              {syncStep === "compare" && !compareResult && "Loading comparison..."}
              {syncStep === "compare" && compareResult && `Comparing ${compareResult.template_name} with job tasks. Tasks with job reality will be skipped.`}
              {syncStep === "result" && "Schedule Master has been synced to the job."}
            </DialogDescription>
          </DialogHeader>

          {/* Analyze Step */}
          {syncStep === "analyze" && (
            <>
              {(analyzing || loadingTemplate) && !analyzeResult && (
                <div className="py-8 flex flex-col items-center gap-2">
                  <Spinner size={32} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {loadingTemplate ? "Loading template..." : "Analyzing task matches..."}
                  </p>
                </div>
              )}

              {analyzeResult && (
                <>
                  <div className="grid grid-cols-5 gap-2 py-2 shrink-0">
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">{analyzeResult.summary.auto_link_count}</p>
                      <p className="text-xs text-green-700 dark:text-green-300">Auto-Link</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{analyzeResult.summary.needs_confirmation_count}</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Confirm</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{analyzeResult.summary.will_create_count}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Create New</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{analyzeResult.summary.already_linked_count}</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">Linked</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">{analyzeResult.summary.orphan_count}</p>
                      <p className="text-xs text-red-700 dark:text-red-300">Orphans</p>
                    </div>
                  </div>

                  {analyzeResult.summary.auto_link_count === 0 &&
                   analyzeResult.summary.needs_confirmation_count === 0 &&
                   analyzeResult.summary.will_create_count === 0 && (
                    <div className="py-4 text-center">
                      <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">All template rows are already linked to job tasks.</p>
                    </div>
                  )}

                  {(analyzeResult.summary.auto_link_count > 0 || analyzeResult.summary.needs_confirmation_count > 0) && (
                    <div className="flex-1 overflow-auto border rounded-lg min-h-0">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <UITableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Template Row</TableHead>
                            <TableHead>Job Task</TableHead>
                            <TableHead className="w-[90px]">Match</TableHead>
                            <TableHead className="w-[90px]">Action</TableHead>
                          </UITableRow>
                        </TableHeader>
                        <TableBody>
                          {analyzeResult.analysis.auto_link.map((match) => (
                            <UITableRow key={`auto-${match.template_row_id}`} className="bg-green-50/50 dark:bg-green-950/30">
                              <TableCell><Check className="h-4 w-4 text-green-600" /></TableCell>
                              <TableCell><div className="font-medium text-sm">{match.name}</div></TableCell>
                              <TableCell><div className="font-medium text-sm">{match.task_name}</div></TableCell>
                              <TableCell><Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{match.similarity}%</Badge></TableCell>
                              <TableCell><span className="text-xs text-green-600 dark:text-green-400">Auto-link</span></TableCell>
                            </UITableRow>
                          ))}
                          {analyzeResult.analysis.needs_confirmation.map((match) => (
                            <UITableRow key={`confirm-${match.template_row_id}`} className="bg-amber-50/50 dark:bg-amber-950/30">
                              <TableCell>
                                <Checkbox
                                  checked={confirmedMatches.has(match.task_id)}
                                  onCheckedChange={(checked) => {
                                    setConfirmedMatches(prev => {
                                      const next = new Set(prev);
                                      if (checked) next.add(match.task_id);
                                      else next.delete(match.task_id);
                                      return next;
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{match.template_name}</div>
                                <div className="text-xs text-muted-foreground">#{match.template_task_number}</div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{match.task_name}</div>
                                <div className="text-xs text-muted-foreground">#{match.task_task_number}</div>
                              </TableCell>
                              <TableCell><Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">{match.similarity}%</Badge></TableCell>
                              <TableCell><span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Confirm</span></TableCell>
                            </UITableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {analyzeResult.summary.will_create_count > 0 && (
                    <div className="text-sm text-muted-foreground py-2">
                      <Plus className="h-4 w-4 inline mr-1" />
                      {analyzeResult.summary.will_create_count} new tasks will be created
                    </div>
                  )}

                  {analyzeResult.analysis.unlinked_tasks.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
                          <Trash2 className="h-4 w-4" />
                          Orphan Tasks ({analyzeResult.analysis.unlinked_tasks.length})
                        </h4>
                        <span className="text-xs text-muted-foreground">Tasks in job with no matching template row</span>
                      </div>
                      <div className="max-h-[200px] overflow-auto border rounded-lg">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <UITableRow>
                              <TableHead className="w-[40px]">
                                <Checkbox
                                  checked={orphansToDelete.size === analyzeResult.analysis.unlinked_tasks.length}
                                  onCheckedChange={(checked) => {
                                    if (checked) setOrphansToDelete(new Set(analyzeResult.analysis.unlinked_tasks.map(t => t.task_id)));
                                    else setOrphansToDelete(new Set());
                                  }}
                                />
                              </TableHead>
                              <TableHead className="w-[60px]">#</TableHead>
                              <TableHead>Task Name</TableHead>
                              <TableHead className="w-[80px]">Action</TableHead>
                            </UITableRow>
                          </TableHeader>
                          <TableBody>
                            {analyzeResult.analysis.unlinked_tasks.map((task) => (
                              <UITableRow key={`orphan-${task.task_id}`} className={orphansToDelete.has(task.task_id) ? "bg-red-50/50 dark:bg-red-950/30" : ""}>
                                <TableCell>
                                  <Checkbox
                                    checked={orphansToDelete.has(task.task_id)}
                                    onCheckedChange={(checked) => {
                                      setOrphansToDelete(prev => {
                                        const next = new Set(prev);
                                        if (checked) next.add(task.task_id);
                                        else next.delete(task.task_id);
                                        return next;
                                      });
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-muted-foreground text-sm">{task.task_number}</TableCell>
                                <TableCell><div className="font-medium text-sm">{task.name}</div></TableCell>
                                <TableCell>
                                  <span className={`text-xs ${orphansToDelete.has(task.task_id) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                    {orphansToDelete.has(task.task_id) ? "Delete" : "Keep"}
                                  </span>
                                </TableCell>
                              </UITableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <DialogFooter className="shrink-0 pt-2">
                    <Button variant="outline" onClick={() => setShowSyncDialog(false)}>Cancel</Button>
                    <Button variant="outline" onClick={handleSkipToCompare}>Skip Linking</Button>
                    <Button onClick={handleApplyLinksAndCompare} disabled={analyzing}>
                      {analyzing ? (
                        <><Spinner size={16} className="mr-2" />Applying...</>
                      ) : (
                        <><Link2 className="h-4 w-4 mr-2" />Apply {analyzeResult.summary.auto_link_count + confirmedMatches.size} Links{orphansToDelete.size > 0 && `, Delete ${orphansToDelete.size}`} & Continue</>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* Compare Step */}
          {syncStep === "compare" && (
            <>
              {(comparing || loadingTemplate) && !compareResult && (
                <div className="py-8 flex flex-col items-center gap-2">
                  <Spinner size={32} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{loadingTemplate ? "Loading template..." : "Comparing template with job tasks..."}</p>
                </div>
              )}

              {compareResult && (
                <>
                  <div className="grid grid-cols-5 gap-2 py-2 shrink-0">
                    <div
                      className={`rounded-lg p-2 text-center cursor-pointer transition-all ${
                        compareFilter === "will_create"
                          ? "bg-green-200 dark:bg-green-900 ring-2 ring-green-500"
                          : "bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900"
                      }`}
                      onClick={() => setCompareFilter(compareFilter === "will_create" ? "all" : "will_create")}
                    >
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{compareResult.summary.will_create}</p>
                      <p className="text-xs text-green-700 dark:text-green-300">Will Create</p>
                    </div>
                    <div
                      className={`rounded-lg p-2 text-center cursor-pointer transition-all ${
                        compareFilter === "will_update"
                          ? "bg-blue-200 dark:bg-blue-900 ring-2 ring-blue-500"
                          : "bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900"
                      }`}
                      onClick={() => setCompareFilter(compareFilter === "will_update" ? "all" : "will_update")}
                    >
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{compareResult.summary.will_update}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Will Update</p>
                    </div>
                    <div
                      className={`rounded-lg p-2 text-center cursor-pointer transition-all ${
                        compareFilter === "will_skip"
                          ? "bg-amber-200 dark:bg-amber-900 ring-2 ring-amber-500"
                          : "bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900"
                      }`}
                      onClick={() => setCompareFilter(compareFilter === "will_skip" ? "all" : "will_skip")}
                    >
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{compareResult.summary.will_skip}</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Will Skip</p>
                    </div>
                    <div
                      className={`rounded-lg p-2 text-center cursor-pointer transition-all ${
                        compareFilter === "unchanged"
                          ? "bg-gray-200 dark:bg-gray-700 ring-2 ring-gray-500"
                          : "bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => setCompareFilter(compareFilter === "unchanged" ? "all" : "unchanged")}
                    >
                      <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{compareResult.summary.unchanged}</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">Unchanged</p>
                    </div>
                    <div
                      className={`rounded-lg p-2 text-center cursor-pointer transition-all ${
                        compareFilter === "unlinked"
                          ? "bg-red-200 dark:bg-red-900 ring-2 ring-red-500"
                          : "bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900"
                      }`}
                      onClick={() => setCompareFilter(compareFilter === "unlinked" ? "all" : "unlinked")}
                    >
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">{compareResult.summary.unlinked || 0}</p>
                      <p className="text-xs text-red-700 dark:text-red-300">Unlinked</p>
                    </div>
                  </div>

                  {compareFilter !== "all" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2">
                      <span>Filtering by: <strong>{compareFilter.replace("_", " ")}</strong></span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setCompareFilter("all")}>
                        Clear filter
                      </Button>
                    </div>
                  )}

                  {/* Show unlinked tasks table when filtered */}
                  {compareFilter === "unlinked" && compareResult.unlinked_tasks && compareResult.unlinked_tasks.length > 0 && (
                    <div className="flex-1 overflow-auto border rounded-lg min-h-0">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <UITableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Task Name</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead>Info</TableHead>
                          </UITableRow>
                        </TableHeader>
                        <TableBody>
                          {compareResult.unlinked_tasks.map((task) => (
                            <UITableRow key={task.task_id} className="bg-red-50/50 dark:bg-red-950/30">
                              <TableCell className="font-mono text-muted-foreground text-sm">{task.task_number}</TableCell>
                              <TableCell><div className="font-medium text-sm">{task.name}</div></TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                  Unlinked
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {task.status}
                                  {task.started_at && " • Started"}
                                  {task.completed_at && " • Done"}
                                </span>
                              </TableCell>
                            </UITableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {compareFilter === "unlinked" && (!compareResult.unlinked_tasks || compareResult.unlinked_tasks.length === 0) && (
                    <div className="py-8 text-center text-muted-foreground">
                      <p>No unlinked tasks</p>
                    </div>
                  )}

                  {/* Show comparisons table when not filtering unlinked */}
                  {compareFilter !== "unlinked" && (
                  <div className="flex-1 overflow-auto border rounded-lg min-h-0">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <UITableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Template Row</TableHead>
                          <TableHead>Job Task</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead>Differences</TableHead>
                        </UITableRow>
                      </TableHeader>
                      <TableBody>
                        {compareResult.comparisons
                          .filter((comp) => compareFilter === "all" || comp.status === compareFilter)
                          .map((comp) => (
                          <UITableRow
                            key={comp.template_row.id}
                            className={
                              comp.status === "will_skip" ? "bg-amber-50/50 dark:bg-amber-950/30" :
                              comp.status === "will_create" ? "bg-green-50/50 dark:bg-green-950/30" :
                              comp.status === "will_update" ? "bg-blue-50/50 dark:bg-blue-950/30" : ""
                            }
                          >
                            <TableCell className="font-mono text-muted-foreground text-sm">{comp.template_row.task_number}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{comp.template_row.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {comp.template_row.trade && <span className="mr-2">{comp.template_row.trade}</span>}
                                {comp.template_row.duration_days}d
                              </div>
                            </TableCell>
                            <TableCell>
                              {comp.job_task ? (
                                <>
                                  <div className="font-medium text-sm">{comp.job_task.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {comp.job_task.status}
                                    {comp.job_task.started_at && " • Started"}
                                    {comp.job_task.completed_at && " • Done"}
                                  </div>
                                </>
                              ) : (
                                <span className="text-muted-foreground italic text-sm">Not in job</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  comp.status === "will_create" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                  comp.status === "will_update" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                                  comp.status === "will_skip" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
                                  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                }
                              >
                                {comp.status === "will_create" && "Create"}
                                {comp.status === "will_update" && "Update"}
                                {comp.status === "will_skip" && "Skip"}
                                {comp.status === "unchanged" && "Match"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {comp.status === "will_skip" && comp.skip_reason && (
                                <span className="text-xs text-amber-600 dark:text-amber-400">{comp.skip_reason}</span>
                              )}
                              {comp.status === "will_update" && Object.keys(comp.differences).length > 0 && (
                                <div className="text-xs space-y-0.5">
                                  {Object.entries(comp.differences).slice(0, 3).map(([field, diff]) => (
                                    <div key={field} className="flex gap-1">
                                      <span className="font-medium">{field}:</span>
                                      <span className="text-red-500 line-through">{String(diff.task ?? "-")}</span>
                                      <span>→</span>
                                      <span className="text-green-600">{String(diff.template)}</span>
                                    </div>
                                  ))}
                                  {Object.keys(comp.differences).length > 3 && (
                                    <span className="text-muted-foreground">+{Object.keys(comp.differences).length - 3} more</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </UITableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  )}

                  <DialogFooter className="shrink-0 pt-2">
                    <Button variant="outline" onClick={() => setShowSyncDialog(false)}>Cancel</Button>
                    <Button onClick={handleSyncToJob} disabled={syncing || (compareResult.summary.will_create === 0 && compareResult.summary.will_update === 0)}>
                      {syncing ? (
                        <><Spinner size={16} className="mr-2" />Syncing...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" />Sync {compareResult.summary.will_create + compareResult.summary.will_update} Tasks</>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* Result Step */}
          {syncStep === "result" && syncResult && (
            <>
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{syncResult.summary.created}</p>
                    <p className="text-xs text-green-700 dark:text-green-300">Created</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{syncResult.summary.updated}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Updated</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{syncResult.summary.skipped}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Skipped</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{syncResult.summary.unchanged}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">Unchanged</p>
                  </div>
                </div>

                {syncResult.skipped_tasks && syncResult.skipped_tasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <SkipForward className="h-4 w-4 text-amber-500" />
                      Skipped Tasks ({syncResult.skipped_tasks.length})
                    </h4>
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <UITableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Reason</TableHead>
                          </UITableRow>
                        </TableHeader>
                        <TableBody>
                          {syncResult.skipped_tasks.map((task) => (
                            <UITableRow key={task.task_id}>
                              <TableCell className="font-medium text-sm">{task.task_name}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-xs">{task.reason}</Badge></TableCell>
                            </UITableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Errors ({syncResult.errors.length})</h4>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      {syncResult.errors.map((err, idx) => (
                        <li key={idx}>Row #{err.row_id}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setShowSyncDialog(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Row Edit Drawer */}
      <Sheet open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">#{selectedRow?.task_number as number}</span>
              {String(selectedRow?.name || "")}
            </SheetTitle>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Template link status */}
            {selectedRow && (
              <div className="flex items-center gap-2 text-sm">
                {selectedRow.sm_schedule_master_id ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    <Link2 className="h-3 w-3 mr-1" />
                    Linked to Template
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Not Linked to Template
                  </Badge>
                )}
              </div>
            )}

            {/* Loading comparison */}
            {loadingRowComparison && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Spinner size={16} />
                Loading template comparison...
              </div>
            )}

            {/* Comparison table */}
            {rowComparison?.template_row && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Template Comparison</h4>
                  {rowComparison.can_sync ? (
                    <Button
                      size="sm"
                      onClick={handleSyncRow}
                      disabled={syncingRow || Object.keys(rowComparison.differences).length === 0}
                    >
                      {syncingRow ? (
                        <><Spinner size={14} className="mr-2" />Syncing...</>
                      ) : Object.keys(rowComparison.differences).length === 0 ? (
                        <><Check className="h-4 w-4 mr-2" />In Sync</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" />Sync {Object.keys(rowComparison.differences).length} Changes</>
                      )}
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      {rowComparison.skip_reason || "Cannot sync"}
                    </Badge>
                  )}
                </div>

                {Object.keys(rowComparison.differences).length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <UITableRow>
                          <TableHead className="w-[120px]">Field</TableHead>
                          <TableHead>Current Task</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Template</TableHead>
                        </UITableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(rowComparison.differences).map(([field, diff]) => (
                          <UITableRow key={field}>
                            <TableCell className="font-medium text-sm">{field}</TableCell>
                            <TableCell className="text-sm text-red-600 dark:text-red-400">
                              {String(diff.task ?? "-")}
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                            <TableCell className="text-sm text-green-600 dark:text-green-400">
                              {String(diff.template ?? "-")}
                            </TableCell>
                          </UITableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground bg-green-50 dark:bg-green-950 rounded-lg">
                    <Check className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    Task is in sync with template
                  </div>
                )}
              </div>
            )}

            {/* No template link */}
            {selectedRow && !selectedRow.sm_schedule_master_id && !loadingRowComparison && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p>This task is not linked to a template row.</p>
                <p className="mt-1">Use "Sync from Master" to link tasks to templates.</p>
              </div>
            )}

            {/* Task details summary */}
            {selectedRow && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-medium">Task Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2 font-medium">{selectedRow.status as string}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trade:</span>
                    <span className="ml-2 font-medium">{(selectedRow.trade as string) || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stage:</span>
                    <span className="ml-2 font-medium">{(selectedRow.stage as string) || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2 font-medium">{selectedRow.duration_days as number} days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">PO Required:</span>
                    <span className="ml-2 font-medium">{selectedRow.po_required ? "Yes" : "No"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Photo Required:</span>
                    <span className="ml-2 font-medium">{selectedRow.require_photo ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
