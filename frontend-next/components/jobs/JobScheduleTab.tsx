"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { Calendar, RefreshCw, SkipForward, Link2, Plus, Check, AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";

// SSoT: SmTask interface removed - data now fetched via Foundation API
// TeeemTableView handles data internally with autoFetchRecords

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

// Match analysis types (from analyze_matches endpoint)
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

// SSoT: Columns come from Foundation API (ID: 218, slug: sm-tasks)
// DO NOT hardcode columns here - TeeemTableView auto-fetches from Foundation
// Global views are inherited from Schedule Master (foundation 426) - allows "PO Tasks Only" etc. to appear here

export function JobScheduleTab({ jobId }: JobScheduleTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  // SSoT: Use autoFetchRecords instead of manual fetching
  // refreshKey triggers re-fetch when sync completes
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync state
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncStep, setSyncStep] = useState<"analyze" | "compare" | "result">("analyze");
  const [jobTemplate, setJobTemplate] = useState<JobTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  // Track which matches user has confirmed (for 65-95% matches)
  const [confirmedMatches, setConfirmedMatches] = useState<Set<number>>(new Set());
  // Track which orphans to delete (default: all selected for deletion)
  const [orphansToDelete, setOrphansToDelete] = useState<Set<number>>(new Set());

  // SSoT: Data fetching moved to TeeemTableView with autoFetchRecords
  // Trigger refresh by incrementing refreshKey after sync operations
  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

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

  // Open sync dialog - starts with analysis step
  const handleOpenSyncDialog = async () => {
    setSyncResult(null);
    setCompareResult(null);
    setAnalyzeResult(null);
    setConfirmedMatches(new Set());
    setOrphansToDelete(new Set());
    setSyncStep("analyze");
    setShowSyncDialog(true);

    // Load template if not loaded
    if (!jobTemplate) {
      await loadJobTemplate();
    }

    // Start analysis (intelligent matching)
    handleAnalyzeMatches();
  };

  // Analyze matches between template and unlinked job tasks
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

    setAnalyzing(true);
    try {
      const response = await api.get<AnalyzeResult>(
        `/api/v1/sm_schedule_master_templates/${templateId}/analyze_matches?job_id=${jobId}`
      );
      if (response) {
        setAnalyzeResult(response);
        // Pre-select all matches for confirmation (user can deselect)
        const allConfirmed = new Set(
          response.analysis.needs_confirmation.map(m => m.task_id)
        );
        setConfirmedMatches(allConfirmed);
        // Pre-select all orphans for deletion (user can deselect to keep)
        const allOrphans = new Set(
          response.analysis.unlinked_tasks.map(t => t.task_id)
        );
        setOrphansToDelete(allOrphans);
      }
    } catch (err) {
      console.error("Failed to analyze:", err);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze matches",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply links and proceed to compare
  const handleApplyLinksAndCompare = async () => {
    if (!jobTemplate?.id || !analyzeResult) return;

    setAnalyzing(true);

    // Build links to apply: auto_links + confirmed matches
    const linksToApply = [
      ...analyzeResult.analysis.auto_link.map(m => ({
        template_row_id: m.template_row_id,
        task_id: m.task_id
      })),
      ...analyzeResult.analysis.needs_confirmation
        .filter(m => confirmedMatches.has(m.task_id))
        .map(m => ({
          template_row_id: m.template_row_id,
          task_id: m.task_id
        }))
    ];

    // Apply links if any
    if (linksToApply.length > 0) {
      try {
        await api.post(
          `/api/v1/sm_schedule_master_templates/${jobTemplate.id}/apply_links`,
          { job_id: parseInt(String(jobId)), links: linksToApply }
        );
        toast({
          title: "Links Applied",
          description: `Linked ${linksToApply.length} tasks to template rows`,
        });
      } catch (err) {
        console.error("Failed to apply links:", err);
        toast({
          title: "Failed to Apply Links",
          description: "Some links may not have been applied",
          variant: "destructive",
        });
      }
    }

    // Delete selected orphans
    const orphanIds = Array.from(orphansToDelete);
    if (orphanIds.length > 0) {
      try {
        const deleteResponse = await api.post<{
          success: boolean;
          deleted: number;
          errors: string[];
          message: string;
        }>(
          `/api/v1/sm_schedule_master_templates/${jobTemplate.id}/delete_orphans`,
          { job_id: parseInt(String(jobId)), task_ids: orphanIds }
        );

        if (deleteResponse) {
          if (deleteResponse.deleted > 0) {
            toast({
              title: "Orphans Deleted",
              description: deleteResponse.message,
            });
          }

          // Show warnings if some tasks were skipped
          if (deleteResponse.errors && deleteResponse.errors.length > 0) {
            console.warn("Delete orphans warnings:", deleteResponse.errors);
            toast({
              title: "Some Tasks Skipped",
              description: `${deleteResponse.deleted} deleted, ${deleteResponse.errors.length} skipped (linked or has job reality)`,
              variant: deleteResponse.deleted === 0 ? "destructive" : "default",
            });
          }
        }
      } catch (err) {
        console.error("Failed to delete orphans:", err);
        toast({
          title: "Failed to Delete Orphans",
          description: "Some orphan tasks may not have been deleted",
          variant: "destructive",
        });
      }
    }

    setAnalyzing(false);

    // Proceed to compare step
    setSyncStep("compare");
    handleCompare();
  };

  // Skip directly to compare (if all tasks already linked or user wants to skip matching)
  const handleSkipToCompare = () => {
    setSyncStep("compare");
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
        // Refresh the task list (triggers autoFetch re-query)
        triggerRefresh();
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
        key={refreshKey}
        foundationId="sm-tasks"
        autoFetchRecords={true}
        initialFilters={[
          { id: "job-filter", column: "job_id", operator: "=", value: String(jobId) }
        ]}
        inheritViewsFrom="sm_schedule_master"
        tableName="Schedule Tasks"
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

      {/* Sync Dialog - Analyze, Compare & Sync Flow */}
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

          {/* Analyze Step - Intelligent Matching */}
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
                  {/* Summary Stats */}
                  <div className="grid grid-cols-5 gap-2 py-2 shrink-0">
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {analyzeResult.summary.auto_link_count}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">Auto-Link</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {analyzeResult.summary.needs_confirmation_count}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Confirm</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {analyzeResult.summary.will_create_count}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Create New</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-600 dark:text-gray-400">
                        {analyzeResult.summary.already_linked_count}
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">Linked</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {analyzeResult.summary.orphan_count}
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300">Orphans</p>
                    </div>
                  </div>

                  {/* All Tasks Already Linked - Skip to Compare */}
                  {analyzeResult.summary.auto_link_count === 0 &&
                   analyzeResult.summary.needs_confirmation_count === 0 &&
                   analyzeResult.summary.will_create_count === 0 && (
                    <div className="py-4 text-center">
                      <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        All template rows are already linked to job tasks.
                      </p>
                    </div>
                  )}

                  {/* Matches Table */}
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
                          {/* Auto-link matches (95%+) */}
                          {analyzeResult.analysis.auto_link.map((match) => (
                            <UITableRow
                              key={`auto-${match.template_row_id}`}
                              className="bg-green-50/50 dark:bg-green-950/30"
                            >
                              <TableCell>
                                <Check className="h-4 w-4 text-green-600" />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{match.name}</div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{match.task_name}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  {match.similarity}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-green-600 dark:text-green-400">Auto-link</span>
                              </TableCell>
                            </UITableRow>
                          ))}

                          {/* Needs confirmation (65-95%) */}
                          {analyzeResult.analysis.needs_confirmation.map((match) => (
                            <UITableRow
                              key={`confirm-${match.template_row_id}`}
                              className="bg-amber-50/50 dark:bg-amber-950/30"
                            >
                              <TableCell>
                                <Checkbox
                                  checked={confirmedMatches.has(match.task_id)}
                                  onCheckedChange={(checked) => {
                                    setConfirmedMatches(prev => {
                                      const next = new Set(prev);
                                      if (checked) {
                                        next.add(match.task_id);
                                      } else {
                                        next.delete(match.task_id);
                                      }
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
                              <TableCell>
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                  {match.similarity}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Confirm
                                </span>
                              </TableCell>
                            </UITableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Will Create section */}
                  {analyzeResult.summary.will_create_count > 0 && (
                    <div className="text-sm text-muted-foreground py-2">
                      <Plus className="h-4 w-4 inline mr-1" />
                      {analyzeResult.summary.will_create_count} new tasks will be created
                    </div>
                  )}

                  {/* Orphans section - tasks in job with no match in template */}
                  {analyzeResult.analysis.unlinked_tasks.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
                          <Trash2 className="h-4 w-4" />
                          Orphan Tasks ({analyzeResult.analysis.unlinked_tasks.length})
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          Tasks in job with no matching template row
                        </span>
                      </div>
                      <div className="max-h-[200px] overflow-auto border rounded-lg">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <UITableRow>
                              <TableHead className="w-[40px]">
                                <Checkbox
                                  checked={orphansToDelete.size === analyzeResult.analysis.unlinked_tasks.length}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setOrphansToDelete(new Set(analyzeResult.analysis.unlinked_tasks.map(t => t.task_id)));
                                    } else {
                                      setOrphansToDelete(new Set());
                                    }
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
                              <UITableRow
                                key={`orphan-${task.task_id}`}
                                className={orphansToDelete.has(task.task_id) ? "bg-red-50/50 dark:bg-red-950/30" : ""}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={orphansToDelete.has(task.task_id)}
                                    onCheckedChange={(checked) => {
                                      setOrphansToDelete(prev => {
                                        const next = new Set(prev);
                                        if (checked) {
                                          next.add(task.task_id);
                                        } else {
                                          next.delete(task.task_id);
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-muted-foreground text-sm">
                                  {task.task_number}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">{task.name}</div>
                                </TableCell>
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
                    <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                      Cancel
                    </Button>
                    <Button variant="outline" onClick={handleSkipToCompare}>
                      Skip Linking
                    </Button>
                    <Button
                      onClick={handleApplyLinksAndCompare}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <>
                          <Spinner size={16} className="mr-2" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4 mr-2" />
                          Apply {analyzeResult.summary.auto_link_count + confirmedMatches.size} Links
                          {orphansToDelete.size > 0 && `, Delete ${orphansToDelete.size}`}
                          {' '}& Continue
                        </>
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
                          <Spinner size={16} className="mr-2" />
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
