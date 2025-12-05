"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChartBarIcon,
  TableCellsIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// Types
interface Task {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  duration: number;
  progress: number;
  status: string;
  assigned_to?: string;
  supplier?: string;
  trade?: string;
  parent_id?: number;
}

interface Project {
  id: number;
  name: string;
  construction_id: number;
}

interface Construction {
  id: number;
  name: string;
}

interface ScheduleData {
  tasks: Task[];
  links?: { id: number; source: number; target: number; type: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  delayed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function MasterSchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const constructionId = searchParams.get("job");
  const { toast } = useToast();

  const [construction, setConstruction] = useState<Construction | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"gantt" | "table">("table");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (constructionId) {
      loadConstructionAndSchedule();
    } else {
      setError("No job ID provided");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, [constructionId]);

  const loadConstructionAndSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load construction/job details
      const constructionResponse = await api.get<{ construction: Construction }>(
        `/api/v1/jobs/${constructionId}`
      );
      if (constructionResponse?.construction) {
        setConstruction(constructionResponse.construction);
      }

      // Find the project for this construction
      const projectsResponse = await api.get<{ projects: Project[] }>("/api/v1/projects");
      const jobProject = projectsResponse?.projects?.find(
        (p) => p.construction_id === parseInt(constructionId!)
      );

      if (jobProject) {
        setProject(jobProject);

        // Load the Gantt schedule for this project
        const scheduleResponse = await api.get<ScheduleData>(
          `/api/v1/projects/${jobProject.id}/gantt`
        );
        setScheduleData(scheduleResponse);
      } else {
        setError("No schedule found for this job");
      }
    } catch (err) {
      console.error("Failed to load schedule:", err);
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = async (
    taskId: number,
    updates: Partial<Task>
  ) => {
    if (!project || saving) return;

    // Store original data for rollback
    const originalTasks = scheduleData?.tasks ? [...scheduleData.tasks] : [];

    // Optimistic update
    if (scheduleData?.tasks) {
      const updatedTasks = scheduleData.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      );
      setScheduleData({ ...scheduleData, tasks: updatedTasks });
    }

    try {
      setSaving(true);

      const response = await api.patch<{ success: boolean; errors?: string[] }>(
        `/api/v1/projects/${project.id}/tasks/${taskId}`,
        { project_task: updates }
      );

      if (response?.success) {
        toast({ title: "Task updated successfully" });
        // Reload to get fresh data
        const scheduleResponse = await api.get<ScheduleData>(
          `/api/v1/projects/${project.id}/gantt`
        );
        setScheduleData(scheduleResponse);
      } else {
        throw new Error(response?.errors?.join(", ") || "Update failed");
      }
    } catch (err) {
      console.error("Failed to update task:", err);
      // Rollback on error
      setScheduleData({ ...scheduleData!, tasks: originalTasks });
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Button className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="py-6">
        {/* Header */}
        <header className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              title="Back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Master Schedule</h1>
              {construction && (
                <p className="text-sm text-muted-foreground">{construction.name}</p>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8">
          {/* View Toggle */}
          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "gantt" ? "default" : "outline"}
                onClick={() => setViewMode("gantt")}
              >
                <ChartBarIcon className="mr-2 h-5 w-5" />
                Gantt Chart
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                onClick={() => setViewMode("table")}
              >
                <TableCellsIcon className="mr-2 h-5 w-5" />
                Table View
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {scheduleData?.tasks?.length || 0} tasks
            </p>
          </div>

          {/* Table View */}
          {viewMode === "table" && scheduleData?.tasks && (
            <Card className="mt-4">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleData.tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          {task.parent_id && (
                            <span className="mr-2 text-muted-foreground">└</span>
                          )}
                          {task.name}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={task.start_date?.split("T")[0] || ""}
                            onChange={(e) =>
                              handleTaskUpdate(task.id, { start_date: e.target.value })
                            }
                            className="w-auto"
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={task.end_date?.split("T")[0] || ""}
                            onChange={(e) =>
                              handleTaskUpdate(task.id, { end_date: e.target.value })
                            }
                            className="w-auto"
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell>{task.duration} days</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {task.progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.status}
                            onValueChange={(value) =>
                              handleTaskUpdate(task.id, { status: value })
                            }
                            disabled={saving}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="delayed">Delayed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{task.assigned_to || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Gantt View Placeholder */}
          {viewMode === "gantt" && (
            <Card className="mt-4">
              <CardContent className="flex min-h-[400px] items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ChartBarIcon className="mx-auto h-12 w-12" />
                  <p className="mt-4">Gantt chart view</p>
                  <p className="text-sm">Interactive Gantt chart coming soon</p>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
