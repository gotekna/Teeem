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
  ArrowLeft,
  Calendar,
  ListChecks,
  Upload,
  BarChart3,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { addDays, parseISO } from "date-fns";

interface ScheduleTask {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
  dependencies?: string[];
  group_id?: string;
  lock?: LockType;
  po_matched?: boolean;
}

interface TaskGroup {
  id: string;
  name: string;
  sort_order: number;
}

interface Job {
  id: number;
  title: string;
  status: string;
  stage: string;
}

function mapTaskToFeature(task: ScheduleTask): GanttFeature {
  const statusMap: Record<string, typeof defaultStatuses[number]> = {
    not_started: defaultStatuses[0],
    in_progress: defaultStatuses[1],
    completed: defaultStatuses[2],
  };

  return {
    id: task.id,
    name: task.name,
    startAt: parseISO(task.start_date),
    endAt: parseISO(task.end_date),
    status: statusMap[task.status] || defaultStatuses[0],
    progress: task.progress || 0,
    dependencies: task.dependencies,
    lock: task.lock,
  };
}

export default function ScheduleMasterPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<Job | null>(null);
  const [tasks, setTasks] = React.useState<ScheduleTask[]>([]);
  const [taskGroups, setTaskGroups] = React.useState<TaskGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeView, setActiveView] = React.useState<"gantt" | "list">("gantt");
  const [holdState] = React.useState<HoldState>({ isOnHold: false });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobData, tasksData] = await Promise.all([
          api.get<Job>(`/api/v1/jobs/${jobId}`),
          api.get<{ tasks: ScheduleTask[]; groups: TaskGroup[] }>(
            `/api/v1/jobs/${jobId}/schedule_tasks`
          ),
        ]);
        setJob(jobData);
        setTasks(tasksData.tasks || []);
        setTaskGroups(tasksData.groups || []);
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

  // Convert tasks to Gantt format
  const { features, groups, markers } = React.useMemo(() => {
    const ungroupedTasks = tasks.filter((t) => !t.group_id);
    const features: GanttFeature[] = ungroupedTasks.map(mapTaskToFeature);

    const groups: GanttGroup[] = taskGroups.map((group) => ({
      id: group.id,
      name: group.name,
      features: tasks.filter((t) => t.group_id === group.id).map(mapTaskToFeature),
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
  }, [tasks, taskGroups]);

  // Stats
  const stats = React.useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const notStarted = tasks.filter((t) => t.status === "not_started").length;
    const matched = tasks.filter((t) => t.po_matched).length;
    const unmatched = total - matched;

    return { total, completed, inProgress, notStarted, matched, unmatched };
  }, [tasks]);

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
    // Update local state
    setTasks((prev) =>
      prev.map((task) =>
        task.id === updatedFeature.id
          ? {
              ...task,
              start_date: updatedFeature.startAt.toISOString(),
              end_date: updatedFeature.endAt.toISOString(),
            }
          : task
      )
    );

    // TODO: Save to API
    // await api.patch(`/api/v1/schedule_tasks/${updatedFeature.id}`, {
    //   start_date: updatedFeature.startAt.toISOString(),
    //   end_date: updatedFeature.endAt.toISOString(),
    // });
  };

  const handleCreateDependency = async (fromId: string, toId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === toId) {
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
      if (res.action === "move") {
        tasksToMove.add(res.featureId);
      } else if (res.action === "unlock-move") {
        tasksToMove.add(res.featureId);
        tasksToUnlock.add(res.featureId);
      }
    });

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === sourceFeature.id) {
          return {
            ...task,
            start_date: sourceFeature.startAt.toISOString(),
            end_date: sourceFeature.endAt.toISOString(),
          };
        }

        let updated = { ...task };

        const resolution = resolutions.find((r) => r.featureId === task.id);
        if (resolution?.action === "unlink") {
          updated.dependencies = (updated.dependencies || []).filter(
            (depId) => depId !== sourceFeature.id
          );
        }

        if (tasksToMove.has(task.id) && timeShift !== 0) {
          updated = {
            ...updated,
            start_date: new Date(parseISO(task.start_date).getTime() + timeShift).toISOString(),
            end_date: new Date(parseISO(task.end_date).getTime() + timeShift).toISOString(),
          };
        }

        if (tasksToUnlock.has(task.id)) {
          updated.lock = undefined;
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
          <Button variant="outline">
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
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Not Started</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.notStarted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">PO Matched</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.matched}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Unmatched</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.unmatched}</p>
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
                              : task.status === "in_progress"
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
                        {task.po_matched && <Badge variant="secondary">PO Matched</Badge>}
                        <Badge
                          variant={
                            task.status === "completed"
                              ? "default"
                              : task.status === "in_progress"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {task.status.replace("_", " ")}
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
    </div>
  );
}
