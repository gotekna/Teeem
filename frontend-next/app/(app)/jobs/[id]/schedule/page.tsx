"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { GanttCanvasView } from "@/components/gantt-canvas/GanttCanvasView";
import type { GanttTask } from "@/lib/gantt/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Upload, Loader2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { parseISO } from "date-fns";

// SmTask interface matching backend response
interface SmTask {
  id: number;
  task_number: number;
  name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  status: "not_started" | "started" | "completed";
  progress_percentage: number;
  trade?: string;
  description?: string;
  locked: boolean;
  lock_type?: "position" | "dates" | "full";
  confirm: boolean;
  supplier_confirm: boolean;
  hold: boolean;
  is_hold_task: boolean;
  hold_reason?: string;
  purchase_order_id?: number;
  supplier_id?: number;
  po_required?: boolean;
  sequence_order: number;
  // Frontend-only: Local state for dependency management (backend uses SmDependency model)
  dependencies?: string[];
}

interface SmTasksResponse {
  success: boolean;
  sm_tasks: SmTask[];
  meta: {
    total_count: number;
    active_count: number;
    hold_count: number;
    completed_count: number;
  };
}

interface Job {
  id: number;
  name: string;  // Address (e.g., "123 Main St, Brisbane")
  title: string;
  status: string;
  stage: string;
}

function mapTaskToGanttTask(task: SmTask): GanttTask {
  // Map SmTask status to Canvas Gantt status (uses hyphens)
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

export default function ScheduleMasterPage() {
  const params = useParams();
  const jobId = params.id as string;
  const router = useRouter();

  const { toast } = useToast();
  const [job, setJob] = React.useState<Job | null>(null);
  const [tasks, setTasks] = React.useState<SmTask[]>([]);
  const [tasksMeta, setTasksMeta] = React.useState<SmTasksResponse["meta"] | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [clearExisting, setClearExisting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobData, tasksData] = await Promise.all([
          api.get<Job>(`/api/v1/jobs/${jobId}`),
          api.get<SmTasksResponse>(`/api/v1/jobs/${jobId}/sm_tasks`),
        ]);
        setJob(jobData);
        setTasks(tasksData.sm_tasks || []);
        setTasksMeta(tasksData.meta || null);
      } catch (error) {
        console.error("Failed to fetch schedule data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchData();
    }
  }, [jobId]);

  // Refetch tasks after import
  const refetchTasks = async () => {
    try {
      const tasksData = await api.get<SmTasksResponse>(`/api/v1/jobs/${jobId}/sm_tasks`);
      setTasks(tasksData.sm_tasks || []);
      setTasksMeta(tasksData.meta || null);
    } catch (error) {
      console.error("Failed to refetch tasks:", error);
    }
  };

  // Handle file import
  const handleImport = async () => {
    if (!importFile) {
      toast({ title: "Error", description: "Please select a file to import", variant: "destructive" });
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (clearExisting) {
        formData.append("clear_existing", "true");
      }

      const response = await fetch(`/api/v1/jobs/${jobId}/sm_tasks/import`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Import Successful",
          description: `Imported ${result.imported_count} tasks${result.dependencies_count ? ` and ${result.dependencies_count} dependencies` : ""}`,
        });
        setImportModalOpen(false);
        setImportFile(null);
        setClearExisting(false);
        refetchTasks();
      } else {
        toast({
          title: "Import Failed",
          description: result.error || result.errors?.join(", ") || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Convert tasks to Canvas Gantt format
  const ganttTasks = React.useMemo(() => {
    return tasks.map(mapTaskToGanttTask);
  }, [tasks]);

  // Build dependencies from task relationships
  const ganttDependencies = React.useMemo(() => {
    const deps: Array<{ fromId: string; toId: string; type?: string }> = [];
    tasks.forEach((task) => {
      (task.dependencies || []).forEach((depId) => {
        deps.push({ fromId: depId, toId: String(task.id), type: "FS" });
      });
    });
    return deps;
  }, [tasks]);

  // Handle task drag event from Canvas Gantt
  const handleTaskDrag = async (task: GanttTask, newStartDate: Date) => {
    const taskId = parseInt(task.id);
    const duration = task.endDate.getTime() - task.startDate.getTime();
    const newEndDate = new Date(newStartDate.getTime() + duration);

    // Update local state optimistically
    setTasks((prev) =>
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

    // Save to SmTask API
    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: {
          start_date: newStartDate.toISOString().split("T")[0],
          end_date: newEndDate.toISOString().split("T")[0],
        },
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      // Refetch to revert on error
      refetchTasks();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}?tab=plans`, '_blank')}>
              Plans
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}?tab=jobs&subtab=purchase-orders`, '_blank')}>
              PO
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => window.open(`/jobs/${jobId}?tab=site`, '_blank')}>
              Site
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>
          <Button size="sm">Add Task</Button>
        </div>
      </div>

      {/* Gantt Chart - fills remaining space */}
      <Card className="p-0 overflow-hidden flex-1">
        <div className="h-full">
          {tasks.length > 0 ? (
            <GanttCanvasView
              staticTasks={ganttTasks}
              staticDependencies={ganttDependencies}
              showToolbar={true}
              onTaskDrag={handleTaskDrag}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No schedule tasks yet</p>
              <p className="text-sm">Import a schedule or add tasks to get started.</p>
              <Button className="mt-4" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Schedule
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Schedule</DialogTitle>
            <DialogDescription>
              Import tasks from an Excel (.xlsx, .xls) or CSV file. The file should have columns for
              task name, dates, duration, and optionally predecessors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Select File</Label>
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {importFile && (
                <p className="text-sm text-muted-foreground">{importFile.name}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="clear-existing"
                checked={clearExisting}
                onCheckedChange={setClearExisting}
              />
              <Label htmlFor="clear-existing" className="text-sm">
                Clear existing tasks before import
              </Label>
            </div>
            {clearExisting && (
              <p className="text-sm text-orange-500">
                Warning: This will delete all existing tasks for this job before importing.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
