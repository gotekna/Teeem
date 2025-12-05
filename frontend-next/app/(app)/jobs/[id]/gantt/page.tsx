"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChartBarIcon,
  TableCellsIcon,
  ArrowLeftIcon,
  PauseIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

// ============================================
// Types
// ============================================

interface SmTask {
  id: number;
  task_number: number;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  locked: boolean;
  lock_type?: string;
  is_hold_task: boolean;
  hold_reason?: string;
  trade?: string;
  predecessor_ids?: number[];
}

interface Dependency {
  id: number;
  from_task_id: number;
  to_task_id: number;
  dependency_type: string;
  lag_days: number;
}

interface Construction {
  id: number;
  title: string;
  name: string;
}

interface GanttDataResponse {
  gantt_data: {
    tasks: SmTask[];
    dependencies: Dependency[];
  };
}

interface ConstructionResponse {
  construction: Construction;
}

interface HistoryAction {
  type: "task_update";
  taskId: number;
  previousData: Partial<SmTask> | null;
  newData: Partial<SmTask>;
}

// ============================================
// Task List Component
// ============================================

interface SmTaskListProps {
  tasks: SmTask[];
  onTaskClick?: (task: SmTask) => void;
}

function SmTaskList({ tasks, onTaskClick }: SmTaskListProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "started":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getLockVariant = (lockType?: string) => {
    switch (lockType) {
      case "supplier_confirm":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "confirm":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "started":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <TableCellsIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No tasks found</p>
          <p className="mt-2 text-sm">Create tasks from a schedule template</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Lock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              className={`cursor-pointer hover:bg-muted/50 ${
                task.is_hold_task ? "bg-red-50 dark:bg-red-900/20" : ""
              }`}
            >
              <TableCell>{task.task_number}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {task.is_hold_task && <PauseIcon className="h-4 w-4 text-red-500" />}
                  <span className={task.is_hold_task ? "font-medium text-red-600" : ""}>
                    {task.name}
                  </span>
                </div>
                {task.hold_reason && (
                  <div className="mt-0.5 text-xs text-red-500">{task.hold_reason}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={getStatusVariant(task.status)}>
                  {task.status?.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{task.start_date}</TableCell>
              <TableCell className="text-muted-foreground">{task.end_date}</TableCell>
              <TableCell className="text-muted-foreground">{task.duration_days}d</TableCell>
              <TableCell>
                {task.locked && (
                  <Badge variant="secondary" className={getLockVariant(task.lock_type)}>
                    {task.lock_type?.replace("_", " ")}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function SmGanttPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [construction, setConstruction] = useState<Construction | null>(null);
  const [tasks, setTasks] = useState<SmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"gantt" | "table">("table");
  const [showResourcePanel, setShowResourcePanel] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50;

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load construction details
      const constructionResponse = await api.get<ConstructionResponse>(`/api/v1/jobs/${id}`);
      setConstruction(constructionResponse.construction);

      // Load SM tasks and dependencies using gantt_data endpoint
      const ganttResponse = await api.get<GanttDataResponse>(`/api/v1/jobs/${id}/sm_tasks/gantt_data`);
      setTasks(ganttResponse.gantt_data?.tasks || []);
    } catch (err) {
      console.error("Failed to load SM Gantt data:", err);
      setError("Failed to load schedule data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  // Push to history for undo/redo
  const pushToHistory = useCallback(
    (action: HistoryAction) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(action);
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
    },
    [historyIndex]
  );

  // Undo action
  const handleUndo = useCallback(async () => {
    if (historyIndex < 0) return;

    const action = history[historyIndex];
    if (action?.type === "task_update" && action.previousData) {
      try {
        await api.patch(`/api/v1/sm_tasks/${action.taskId}`, { sm_task: action.previousData });
        toast({ title: "Undone" });
        loadData();
        setHistoryIndex((prev) => prev - 1);
      } catch {
        toast({ title: "Failed to undo", variant: "destructive" });
      }
    }
  }, [history, historyIndex, loadData, toast]);

  // Redo action
  const handleRedo = useCallback(async () => {
    if (historyIndex >= history.length - 1) return;

    const action = history[historyIndex + 1];
    if (action?.type === "task_update" && action.newData) {
      try {
        await api.patch(`/api/v1/sm_tasks/${action.taskId}`, { sm_task: action.newData });
        toast({ title: "Redone" });
        loadData();
        setHistoryIndex((prev) => prev + 1);
      } catch {
        toast({ title: "Failed to redo", variant: "destructive" });
      }
    }
  }, [history, historyIndex, loadData, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Escape - close modals
      if (e.key === "Escape") {
        if (showResourcePanel) setShowResourcePanel(false);
        return;
      }

      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z - Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl/Cmd + Y - Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // G - Toggle Gantt/Table view
      if (e.key === "g") {
        e.preventDefault();
        setViewMode((prev) => (prev === "gantt" ? "table" : "gantt"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResourcePanel, handleUndo, handleRedo]);

  const handleTaskClick = (task: SmTask) => {
    // TODO: Open task detail modal
    toast({ title: `Selected task: ${task.name}` });
  };


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">{error}</p>
          <Button variant="link" onClick={() => router.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeftIcon className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                SM Gantt - {construction?.title || construction?.name || "Loading..."}
              </h1>
              <p className="text-sm text-muted-foreground">
                Schedule Master v2 - {tasks.length} tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* New Task Button */}
            <Button onClick={() => toast({ title: "New Task modal coming soon" })}>
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Task
            </Button>

            {/* Copy from Template Button */}
            <Button
              variant="outline"
              onClick={() => toast({ title: "Copy from Template modal coming soon" })}
            >
              <DocumentDuplicateIcon className="mr-1.5 h-4 w-4" />
              From Template
            </Button>

            {/* Resources Button */}
            <Button
              variant={showResourcePanel ? "default" : "outline"}
              onClick={() => setShowResourcePanel(!showResourcePanel)}
            >
              <UserGroupIcon className="mr-1.5 h-4 w-4" />
              Resources
            </Button>

            {/* View Toggle */}
            <div className="flex overflow-hidden rounded-lg border">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode("table")}
              >
                <TableCellsIcon className="mr-1.5 h-4 w-4" />
                Table
              </Button>
              <Button
                variant={viewMode === "gantt" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode("gantt")}
              >
                <ChartBarIcon className="mr-1.5 h-4 w-4" />
                Gantt
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Task View */}
        <div className={`flex-1 overflow-hidden ${showResourcePanel ? "w-2/3" : "w-full"}`}>
          {viewMode === "gantt" ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Gantt Chart View</CardTitle>
              </CardHeader>
              <CardContent className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ChartBarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>Gantt chart component coming soon</p>
                  <p className="mt-2 text-sm">Use Table view for now</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full overflow-hidden">
              <SmTaskList tasks={tasks} onTaskClick={handleTaskClick} />
            </Card>
          )}
        </div>

        {/* Resource Panel */}
        {showResourcePanel && (
          <Card className="w-80 flex-shrink-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Resources
                <Button variant="ghost" size="sm" onClick={() => setShowResourcePanel(false)}>
                  &times;
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Resource panel coming soon</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
