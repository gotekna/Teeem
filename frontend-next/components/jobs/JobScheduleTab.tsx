"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { Calendar, RefreshCw, Loader2, SkipForward } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow, TableColumn } from "@/components/table/types";

interface SmTask {
  id: number;
  task_number: number;
  name: string;
  trade?: string;
  stage?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  supplier?: { id: number; display_name: string };
  supplier_name?: string;
  sm_schedule_master_id?: number;
  purchase_order_id?: number;
  purchase_order_number?: string;
}

interface JobScheduleTabProps {
  jobId: string | number;
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
}

interface JobTemplate {
  id: number;
  name: string;
}

// Define columns for SmTasks table
const SM_TASK_COLUMNS: TableColumn[] = [
  { key: "task_number", label: "Task #", column_type: "number", width: 70 },
  { key: "name", label: "Name", column_type: "text", width: 250 },
  { key: "trade", label: "Trade", column_type: "text", width: 120 },
  { key: "stage", label: "Stage", column_type: "text", width: 100 },
  { key: "status", label: "Status", column_type: "badge", width: 100 },
  { key: "start_date", label: "Start", column_type: "date", width: 100 },
  { key: "end_date", label: "End", column_type: "date", width: 100 },
  { key: "duration_days", label: "Days", column_type: "number", width: 60 },
  { key: "supplier_name", label: "Supplier", column_type: "text", width: 150 },
];

export function JobScheduleTab({ jobId }: JobScheduleTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<SmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncStep, setSyncStep] = useState<"compare" | "result">("compare");
  const [jobTemplate, setJobTemplate] = useState<JobTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ sm_tasks: SmTask[] }>(`/api/v1/jobs/${jobId}/sm_tasks`);
      // Add supplier_name for display
      const tasksWithSupplierName = (response?.sm_tasks || []).map(task => ({
        ...task,
        supplier_name: task.supplier?.display_name || "",
      }));
      setTasks(tasksWithSupplierName);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Failed to load schedule tasks");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleRowClick = (row: TableRow) => {
    // Navigate to Schedule Master (SSoT) with task filter
    router.push(`/admin/system?tab=schedule-master`);
  };

  // Load job's default template
  const loadJobTemplate = useCallback(async () => {
    setLoadingTemplate(true);
    try {
      // Get the default template for this job
      const response = await api.get<{
        success: boolean;
        sm_schedule_master_templates: Array<{ id: number; name: string; is_default: boolean }>
      }>("/api/v1/sm_schedule_master_templates");

      // Find the default template or use the first one
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

  // Open sync dialog - starts comparison immediately
  const handleOpenSyncDialog = async () => {
    setSyncResult(null);
    setCompareResult(null);
    setSyncStep("compare");
    setShowSyncDialog(true);

    // Load template if not loaded
    if (!jobTemplate) {
      await loadJobTemplate();
    }

    // Start comparison
    handleCompare();
  };

  // Compare template with job
  const handleCompare = async () => {
    // Load template first if needed
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
        toast({
          title: "Error",
          description: "Failed to load schedule template",
          variant: "destructive",
        });
        return;
      } finally {
        setLoadingTemplate(false);
      }
    }

    if (!templateId) {
      toast({
        title: "No Template Found",
        description: "No schedule master template is configured",
        variant: "destructive",
      });
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
      toast({
        title: "Comparison Failed",
        description: "Failed to compare template with job tasks",
        variant: "destructive",
      });
    } finally {
      setComparing(false);
    }
  };

  // Sync template to job
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
        // Refresh the task list
        loadTasks();
      }
    } catch (err) {
      console.error("Failed to sync:", err);
      toast({
        title: "Sync Failed",
        description: "Failed to sync template to job",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={tasks as unknown as TableRow[]}
        columns={SM_TASK_COLUMNS}
        tableName="Schedule Tasks"
        onRefresh={loadTasks}
        onRowClick={handleRowClick}
        leftActions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/system?tab=schedule-master`)}
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
          </div>
        }
        enableExport={true}
      />

      {/* Sync Dialog - Compare & Sync Flow */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className={syncStep === "compare" && compareResult ? "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {syncStep === "compare" && "Sync Schedule Master to Job"}
              {syncStep === "result" && "Sync Complete"}
            </DialogTitle>
            <DialogDescription>
              {syncStep === "compare" && !compareResult && "Loading comparison..."}
              {syncStep === "compare" && compareResult && `Comparing ${compareResult.template_name} with job tasks. Tasks with job reality will be skipped.`}
              {syncStep === "result" && "Schedule Master has been synced to the job."}
            </DialogDescription>
          </DialogHeader>

          {/* Compare Step */}
          {syncStep === "compare" && (
            <>
              {(comparing || loadingTemplate) && !compareResult && (
                <div className="py-8 flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {loadingTemplate ? "Loading template..." : "Comparing template with job tasks..."}
                  </p>
                </div>
              )}

              {compareResult && (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-3 py-2 shrink-0">
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {compareResult.summary.will_create}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">Will Create</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {compareResult.summary.will_update}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Will Update</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2 text-center">
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                        {compareResult.summary.will_skip}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Will Skip</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                      <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                        {compareResult.summary.unchanged}
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">Unchanged</p>
                    </div>
                  </div>

                  {/* Comparison Table */}
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
                        {compareResult.comparisons.map((comp) => (
                          <UITableRow
                            key={comp.template_row.id}
                            className={
                              comp.status === "will_skip" ? "bg-amber-50/50 dark:bg-amber-950/30" :
                              comp.status === "will_create" ? "bg-green-50/50 dark:bg-green-950/30" :
                              comp.status === "will_update" ? "bg-blue-50/50 dark:bg-blue-950/30" :
                              ""
                            }
                          >
                            <TableCell className="font-mono text-muted-foreground text-sm">
                              {comp.template_row.task_number}
                            </TableCell>
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
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                  {comp.skip_reason}
                                </span>
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
                                    <span className="text-muted-foreground">
                                      +{Object.keys(comp.differences).length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </UITableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <DialogFooter className="shrink-0 pt-2">
                    <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSyncToJob}
                      disabled={syncing || (compareResult.summary.will_create === 0 && compareResult.summary.will_update === 0)}
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync {compareResult.summary.will_create + compareResult.summary.will_update} Tasks
                        </>
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
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {syncResult.summary.created}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">Created</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {syncResult.summary.updated}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Updated</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {syncResult.summary.skipped}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Skipped</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                      {syncResult.summary.unchanged}
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">Unchanged</p>
                  </div>
                </div>

                {/* Skipped Tasks */}
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
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {task.reason}
                                </Badge>
                              </TableCell>
                            </UITableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Errors ({syncResult.errors.length})
                    </h4>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      {syncResult.errors.map((err, idx) => (
                        <li key={idx}>Row #{err.row_id}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setShowSyncDialog(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
