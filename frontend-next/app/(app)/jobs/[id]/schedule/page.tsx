"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GanttChart,
  defaultStatuses,
  type GanttFeature,
  type GanttGroup,
  type GanttMarkerType,
  type CascadeResolution,
  type HoldState,
  type LockType,
} from "@/components/ui/gantt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ArrowLeft,
  Calendar,
  ListChecks,
  Upload,
  BarChart3,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
} from "lucide-react";
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
  lock_type?: LockType;
  confirm: boolean;
  supplier_confirm: boolean;
  manually_positioned: boolean;
  is_hold_task: boolean;
  hold_reason?: string;
  purchase_order_id?: number;
  supplier_id?: number;
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
  title: string;
  status: string;
  stage: string;
}

function mapTaskToFeature(task: SmTask): GanttFeature {
  // Map SmTask status to Gantt status
  const statusMap: Record<string, typeof defaultStatuses[number]> = {
    not_started: defaultStatuses[0],
    started: defaultStatuses[1],  // SmTask uses "started" not "in_progress"
    completed: defaultStatuses[2],
  };

  return {
    id: String(task.id),
    name: task.name,
    startAt: parseISO(task.start_date),
    endAt: parseISO(task.end_date),
    status: statusMap[task.status] || defaultStatuses[0],
    progress: task.progress_percentage || 0,
    lock: task.locked ? task.lock_type : undefined,
  };
}

export default function ScheduleMasterPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const { toast } = useToast();
  const [job, setJob] = React.useState<Job | null>(null);
  const [tasks, setTasks] = React.useState<SmTask[]>([]);
  const [tasksMeta, setTasksMeta] = React.useState<SmTasksResponse["meta"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeView, setActiveView] = React.useState<"gantt" | "list">("gantt");
  const [holdState] = React.useState<HoldState>({ isOnHold: false });

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

  // Convert tasks to Gantt format
  const { features, groups, markers } = React.useMemo(() => {
    // Group tasks by trade if available
    const tradeGroups = new Map<string, SmTask[]>();
    const ungroupedTasks: SmTask[] = [];

    tasks.forEach((task) => {
      if (task.trade) {
        const existing = tradeGroups.get(task.trade) || [];
        tradeGroups.set(task.trade, [...existing, task]);
      } else {
        ungroupedTasks.push(task);
      }
    });

    const features: GanttFeature[] = ungroupedTasks.map(mapTaskToFeature);

    const groups: GanttGroup[] = Array.from(tradeGroups.entries()).map(([trade, tradeTasks]) => ({
      id: trade,
      name: trade,
      features: tradeTasks.map(mapTaskToFeature),
    }));

    // Find key milestones for markers
    const markers: GanttMarkerType[] = [];
    const completionTask = tasks.find((t) => t.name.toLowerCase().includes("completion"));
    if (completionTask) {
      markers.push({
        id: "completion",
        date: parseISO(completionTask.end_date),
        label: "Practical Completion",
        color: "bg-green-500",
      });
    }

    return { features, groups, markers };
  }, [tasks]);

  // Stats - use meta from API or calculate from tasks
  const stats = React.useMemo(() => {
    if (tasksMeta) {
      return {
        total: tasksMeta.total_count,
        completed: tasksMeta.completed_count,
        inProgress: tasksMeta.active_count - tasksMeta.hold_count,
        notStarted: tasksMeta.total_count - tasksMeta.active_count - tasksMeta.completed_count,
        holdCount: tasksMeta.hold_count,
        poLinked: tasks.filter((t) => t.purchase_order_id).length,
      };
    }
    // Fallback to calculating from tasks array
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const started = tasks.filter((t) => t.status === "started").length;
    const notStarted = tasks.filter((t) => t.status === "not_started").length;
    const holdCount = tasks.filter((t) => t.is_hold_task && t.status === "not_started").length;
    const poLinked = tasks.filter((t) => t.purchase_order_id).length;

    return { total, completed, inProgress: started, notStarted, holdCount, poLinked };
  }, [tasks, tasksMeta]);

  const getAllFeatures = React.useCallback(() => {
    const all: GanttFeature[] = [...features];
    groups.forEach((g) => all.push(...g.features));
    return all;
  }, [features, groups]);

  const findDependentTasks = React.useCallback(
    (taskId: string, visited = new Set<string>()): string[] => {
      if (visited.has(taskId)) return [];
      visited.add(taskId);

      const allFeatures = getAllFeatures();
      const dependents: string[] = [];

      allFeatures.forEach((f) => {
        if (f.dependencies?.includes(taskId)) {
          dependents.push(f.id);
          dependents.push(...findDependentTasks(f.id, visited));
        }
      });

      return dependents;
    },
    [getAllFeatures]
  );

  const handleFeatureUpdate = async (updatedFeature: GanttFeature) => {
    const taskId = parseInt(updatedFeature.id);

    // Update local state optimistically
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              start_date: updatedFeature.startAt.toISOString().split("T")[0],
              end_date: updatedFeature.endAt.toISOString().split("T")[0],
            }
          : task
      )
    );

    // Save to SmTask API
    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: {
          start_date: updatedFeature.startAt.toISOString().split("T")[0],
          end_date: updatedFeature.endAt.toISOString().split("T")[0],
        },
      });
    } catch (error) {
      console.error("Failed to update task:", error);
      // TODO: Revert optimistic update on error
    }
  };

  const handleCreateDependency = async (fromId: string, toId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (String(task.id) === toId) {
          const deps = task.dependencies || [];
          if (!deps.includes(fromId)) {
            return { ...task, dependencies: [...deps, fromId] };
          }
        }
        return task;
      })
    );
  };

  const handleCascadeUpdate = (
    sourceFeature: GanttFeature,
    resolutions: CascadeResolution[]
  ) => {
    // Similar cascade logic as the demo page
    const allFeatures = getAllFeatures();
    const originalFeature = allFeatures.find((f) => f.id === sourceFeature.id);
    if (!originalFeature) return;

    const timeShift = sourceFeature.startAt.getTime() - originalFeature.startAt.getTime();

    const tasksToMove = new Set<string>();
    const tasksToUnlock = new Set<string>();

    resolutions.forEach((res) => {
      if (res?.action === "move") {
        tasksToMove.add(res.featureId);
      } else if (res?.action === "unlock-move") {
        tasksToMove.add(res.featureId);
        tasksToUnlock.add(res.featureId);
      }
    });

    setTasks((prev) =>
      prev.map((task) => {
        const taskIdStr = String(task.id);
        if (taskIdStr === sourceFeature.id) {
          return {
            ...task,
            start_date: sourceFeature.startAt.toISOString(),
            end_date: sourceFeature.endAt.toISOString(),
          };
        }

        let updated = { ...task };

        const resolution = resolutions.find((r) => r.featureId === taskIdStr);
        if (resolution?.action === "unlink") {
          updated.dependencies = (updated.dependencies || []).filter(
            (depId) => depId !== sourceFeature.id
          );
        }

        if (tasksToMove.has(taskIdStr) && timeShift !== 0) {
          updated = {
            ...updated,
            start_date: new Date(parseISO(task.start_date).getTime() + timeShift).toISOString(),
            end_date: new Date(parseISO(task.end_date).getTime() + timeShift).toISOString(),
          };
        }

        if (tasksToUnlock.has(taskIdStr)) {
          updated.locked = false;
          updated.lock_type = undefined;
        }

        return updated;
      })
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/jobs/${jobId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Master</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {job?.title || "Loading..."} • Task scheduling and Gantt view
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Schedule
          </Button>
          <Button>Add Task</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Tasks</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-muted-foreground">Not Started</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.notStarted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Pause className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">On Hold</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.holdCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
              <span className="text-sm text-muted-foreground">PO Linked</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.poLinked}</p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "gantt" | "list")}>
        <TabsList>
          <TabsTrigger value="gantt" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Gantt View
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <ListChecks className="h-4 w-4" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="h-[600px]">
              {tasks.length > 0 ? (
                <GanttChart
                  features={features}
                  groups={groups}
                  markers={markers}
                  defaultRange="daily"
                  holdState={holdState}
                  onFeatureUpdate={handleFeatureUpdate}
                  onCreateDependency={handleCreateDependency}
                  onCascadeUpdate={handleCascadeUpdate}
                  getDependentTasks={findDependentTasks}
                  className="h-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">No schedule tasks yet</p>
                  <p className="text-sm">Import a schedule or add tasks to get started.</p>
                  <Button className="mt-4">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Schedule
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Task List</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            task.status === "completed"
                              ? "bg-green-500"
                              : task.status === "started"
                              ? "bg-blue-500"
                              : "bg-gray-300"
                          }`}
                        />
                        <span className="font-medium">{task.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(task.start_date).toLocaleDateString("en-AU")} -{" "}
                          {new Date(task.end_date).toLocaleDateString("en-AU")}
                        </span>
                        {task.purchase_order_id && <Badge variant="secondary">PO Linked</Badge>}
                        {task.is_hold_task && <Badge variant="outline" className="text-orange-500 border-orange-500">On Hold</Badge>}
                        <Badge
                          variant={
                            task.status === "completed"
                              ? "default"
                              : task.status === "started"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {task.status === "not_started" ? "Not Started" : task.status === "started" ? "In Progress" : "Completed"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No tasks found. Import a schedule to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 p-4 border border-border bg-card">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Status:
        </span>
        {defaultStatuses.map((status) => (
          <div key={status.id} className="flex items-center gap-2">
            <div className={`w-3 h-3 ${status.color.split(" ")[0]}`} />
            <span className="text-[11px]">{status.name}</span>
          </div>
        ))}
      </div>

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
