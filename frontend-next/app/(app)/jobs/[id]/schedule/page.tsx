"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { GanttCanvasView } from "@/components/gantt-canvas/GanttCanvasView";
import type { GanttTask } from "@/lib/gantt/types";
import TaskDependencyEditor from "@/components/schedule-master/TaskDependencyEditor";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Upload, Zap } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
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

  // Add Task modal state
  const [addTaskModalOpen, setAddTaskModalOpen] = React.useState(false);
  const [newTaskName, setNewTaskName] = React.useState("");
  const [newTaskStartDate, setNewTaskStartDate] = React.useState("");
  const [addingTask, setAddingTask] = React.useState(false);

  // PO creation fields
  const [createPO, setCreatePO] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Array<{ id: number; name: string }>>([]);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<number | null>(null);
  const [poPrice, setPoPrice] = React.useState("");

  // Dependency linking
  const [openDepsAfterCreate, setOpenDepsAfterCreate] = React.useState(false);
  const [depEditorTask, setDepEditorTask] = React.useState<SmTask | null>(null);

  // Fetch suppliers when modal opens
  React.useEffect(() => {
    if (addTaskModalOpen && suppliers.length === 0) {
      api.get<{ contacts: Array<{ id: number; name: string }> }>("/api/v1/contacts?type=suppliers")
        .then((res) => setSuppliers(res.contacts || []))
        .catch((err) => console.error("Failed to load suppliers:", err));
    }
  }, [addTaskModalOpen, suppliers.length]);

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

  // Handle add task
  const handleAddTask = async () => {
    if (!newTaskName.trim()) {
      toast({ title: "Error", description: "Task name is required", variant: "destructive" });
      return;
    }

    if (createPO && !selectedSupplierId) {
      toast({ title: "Error", description: "Please select a supplier for the PO", variant: "destructive" });
      return;
    }

    setAddingTask(true);
    try {
      const startDate = newTaskStartDate || new Date().toISOString().split("T")[0];

      // Step 1: Create the task
      const taskResponse = await api.post<{ sm_task: SmTask }>(`/api/v1/jobs/${jobId}/sm_tasks`, {
        sm_task: {
          name: newTaskName.trim(),
          start_date: startDate,
          duration_days: 1,
          status: "not_started",
        },
      });

      const newTask = taskResponse?.sm_task;
      if (!newTask) {
        throw new Error("Failed to create task");
      }

      // Step 2: Create PO if requested
      if (createPO && selectedSupplierId) {
        await api.post("/api/v1/purchase_orders", {
          purchase_order: {
            job_id: jobId,
            supplier_id: selectedSupplierId,
            description: newTaskName.trim(),
            budget: poPrice ? parseFloat(poPrice) : undefined,
            required_date: startDate,
            schedule_task_id: newTask.id,
          },
        });
      }

      toast({ title: "Success", description: createPO ? "Task and PO created successfully" : "Task added successfully" });
      setAddTaskModalOpen(false);
      setNewTaskName("");
      setNewTaskStartDate("");
      setCreatePO(false);
      setSelectedSupplierId(null);
      setPoPrice("");

      // Refetch tasks first so the new task is in the list
      await refetchTasks();

      // Step 3: Open dependency editor if requested
      if (openDepsAfterCreate) {
        setDepEditorTask(newTask);
        setOpenDepsAfterCreate(false);
      }
    } catch (error) {
      console.error("Failed to add task:", error);
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    } finally {
      setAddingTask(false);
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

  // Handle saving dependencies from TaskDependencyEditor
  const handleSaveDependencies = async (taskId: number, predecessors: Array<{ id: number; type: string; lag: number }>) => {
    try {
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: {
          predecessor_ids: predecessors,
        },
      });
      toast({ title: "Success", description: "Dependencies saved" });
      setDepEditorTask(null);
      refetchTasks();
    } catch (error) {
      console.error("Failed to save dependencies:", error);
      toast({ title: "Error", description: "Failed to save dependencies", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
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
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddTaskModalOpen(true)}>Add Task</Button>
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
              jobId={Number(jobId)}
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
                  <Spinner size={16} className="mr-2" />
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

      {/* Add Task Modal */}
      <Dialog open={addTaskModalOpen} onOpenChange={setAddTaskModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create a new task for this job schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                placeholder="e.g., Pour Concrete Slab"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-start">Start Date</Label>
              <Input
                id="task-start"
                type="date"
                value={newTaskStartDate}
                onChange={(e) => setNewTaskStartDate(e.target.value)}
              />
            </div>

            {/* Create PO Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="create-po">Create Purchase Order</Label>
              <Switch
                id="create-po"
                checked={createPO}
                onCheckedChange={setCreatePO}
              />
            </div>

            {/* PO Fields - shown when createPO is true */}
            {createPO && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={selectedSupplierId?.toString() || ""}
                    onValueChange={(v) => setSelectedSupplierId(v ? parseInt(v) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.filter(s => s.id).map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="po-price">PO Price ($)</Label>
                  <Input
                    id="po-price"
                    type="number"
                    placeholder="0.00"
                    value={poPrice}
                    onChange={(e) => setPoPrice(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Add Dependencies Toggle */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Label htmlFor="add-deps" className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Add Dependencies
                <span className="text-xs text-muted-foreground font-normal">(opens editor after creation)</span>
              </Label>
              <Switch
                id="add-deps"
                checked={openDepsAfterCreate}
                onCheckedChange={setOpenDepsAfterCreate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={!newTaskName.trim() || addingTask || (createPO && !selectedSupplierId)}>
              {addingTask ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Adding...
                </>
              ) : (
                "Add Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dependency Editor Modal (SSoT - reuses existing component) */}
      {depEditorTask && (
        <TaskDependencyEditor
          task={depEditorTask}
          tasks={tasks}
          onSave={handleSaveDependencies}
          onClose={() => setDepEditorTask(null)}
        />
      )}
    </div>
  );
}
