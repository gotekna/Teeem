'use client';

/**
 * Gantt V2 Test Page
 *
 * This page allows side-by-side comparison of the new unified Gantt chart
 * with the old implementation. Both can be viewed in separate browser tabs.
 *
 * URLs:
 * - /jobs/{id}/schedule         → Old Gantt (current implementation)
 * - /jobs/{id}/schedule/gantt-v2 → New Gantt (unified canvas)
 *
 * @see TEEEM_DOCS/GANTT_FEATURE_INVENTORY.md - Feature checklist
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GanttUnified, GanttDependencyEditor } from '@/components/gantt-v2';
import { api } from '@/lib/api';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { GanttTask, GanttDependency, SmScheduleMaster } from '@/lib/gantt/types';
import { convertRowsToTasks } from '@/lib/gantt/types';
import { getTodayInCompanyTimezone } from '@/lib/stores/company-settings-store';

// =============================================================================
// Types
// =============================================================================

interface Job {
  id: number;
  name: string;
  title: string;
}

interface GanttDataResponse {
  rows: SmScheduleMaster[];
  dependencies: Array<{
    id: string;
    from_id: string;
    to_id: string;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    lag?: number;
  }>;
}

// =============================================================================
// Page Component
// =============================================================================

export default function GanttV2Page() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = Number(params.id);

  // State
  const [job, setJob] = React.useState<Job | null>(null);
  const [tasks, setTasks] = React.useState<GanttTask[]>([]);
  const [dependencies, setDependencies] = React.useState<GanttDependency[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dependency editor state
  const [dependencyEditorState, setDependencyEditorState] = React.useState<{
    isOpen: boolean;
    task: GanttTask | null;
    visibleTasks: GanttTask[];
  }>({
    isOpen: false,
    task: null,
    visibleTasks: [],
  });

  // Edit sheet state (same pattern as ScheduleMasterTab)
  const [editSheetOpen, setEditSheetOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<GanttTask | null>(null);
  const [editForm, setEditForm] = React.useState<{
    name: string;
    duration_days: number;
    description: string;
    po_required: boolean;
    critical_po: boolean;
  }>({
    name: '',
    duration_days: 1,
    description: '',
    po_required: false,
    critical_po: false,
  });
  const [saving, setSaving] = React.useState(false);

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  React.useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch job details
        const jobResponse = await api.get<Job>(`/api/v1/jobs/${jobId}`);
        if (jobResponse) {
          setJob(jobResponse);
        }

        // SSoT: Run rollover on page load (same as old Gantt)
        // Ensures no tasks are on past dates, weekends, or holidays
        try {
          console.log('[GanttV2] 🔄 Running rollover on page load...');
          const validateResult = await api.post<{ success: boolean; rolled_over: number; extended: number; cascaded: number }>(
            `/api/v1/jobs/${jobId}/sm_tasks/validate_dates`
          );
          if (validateResult) {
            const fixCount = (validateResult.rolled_over || 0) + (validateResult.extended || 0);
            if (fixCount > 0) {
              console.log('[GanttV2] ✅ Rollover updated tasks:', fixCount);
              toast({
                title: 'Schedule Updated',
                description: `${fixCount} task(s) with past dates moved forward`,
              });
            }
          }
        } catch (rolloverErr) {
          console.warn('[GanttV2] Rollover failed (continuing anyway):', rolloverErr);
        }

        // Fetch Gantt data (after rollover ensures dates are valid)
        const ganttResponse = await api.get<GanttDataResponse>(
          `/api/v1/jobs/${jobId}/sm_tasks/gantt_data`
        );

        if (ganttResponse) {
          // Debug: log response structure
          console.log('[GanttV2] API response:', ganttResponse);

          // API returns {success: true, gantt_data: {tasks: [...], dependencies: [...]}}
          // Note: Backend uses "tasks", not "rows"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (ganttResponse as any).gantt_data || ganttResponse;
          const rows = data.tasks || data.rows || [];
          const deps = data.dependencies || [];

          console.log('[GanttV2] Tasks:', rows.length, 'Dependencies:', deps.length);

          const today = getTodayInCompanyTimezone();
          const convertedTasks = convertRowsToTasks(rows as SmScheduleMaster[], today);
          setTasks(convertedTasks);

          // Convert dependencies
          const convertedDeps: GanttDependency[] = deps.map((dep: { id: string; from_id: string; to_id: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag?: number }) => ({
            id: dep.id,
            fromId: dep.from_id,
            toId: dep.to_id,
            type: dep.type,
            lag: dep.lag,
          }));
          setDependencies(convertedDeps);
        }
      } catch (err) {
        console.error('[GanttV2] Failed to load data:', err);
        setError('Failed to load Gantt data');
        toast({
          title: 'Error',
          description: 'Failed to load Gantt data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (jobId) {
      loadData();
    }
  }, [jobId, toast]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleTaskClick = (task: GanttTask) => {
    console.log('[GanttV2] Task clicked:', task);
    toast({
      title: 'Task Selected',
      description: task.name,
    });
  };

  const handleTaskDoubleClick = (task: GanttTask) => {
    console.log('[GanttV2] Task double-clicked:', task);
    const rowData = task.rowData as SmScheduleMaster | undefined;

    setEditingTask(task);
    setEditForm({
      name: task.name || '',
      duration_days: rowData?.duration_days || 1,
      description: rowData?.description || '',
      po_required: rowData?.po_required || false,
      critical_po: rowData?.critical_po || false,
    });
    setEditSheetOpen(true);
  };

  // Save task edits (same pattern as ScheduleMasterTab)
  const handleSaveTask = async () => {
    if (!editingTask) return;

    setSaving(true);
    try {
      await api.patch(`/api/v1/sm_tasks/${editingTask.id}`, {
        sm_task: {
          name: editForm.name,
          duration_days: editForm.duration_days,
          description: editForm.description,
          po_required: editForm.po_required,
          critical_po: editForm.critical_po,
        },
      });

      toast({
        title: 'Task Saved',
        description: 'Task has been updated successfully',
      });

      // Reload data
      const ganttResponse = await api.get<GanttDataResponse>(
        `/api/v1/jobs/${jobId}/sm_tasks/gantt_data`
      );
      if (ganttResponse) {
        const data = (ganttResponse as any).gantt_data || ganttResponse;
        const rows = data.tasks || data.rows || [];
        const deps = data.dependencies || [];
        const today = getTodayInCompanyTimezone();
        setTasks(convertRowsToTasks(rows as SmScheduleMaster[], today));
        setDependencies(
          deps.map((dep: any) => ({
            id: dep.id,
            fromId: dep.from_id,
            toId: dep.to_id,
            type: dep.type,
            lag: dep.lag,
          }))
        );
      }

      setEditSheetOpen(false);
    } catch (err) {
      console.error('[GanttV2] Failed to save task:', err);
      toast({
        title: 'Error',
        description: 'Failed to save task',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Open dependency editor (same as ScheduleMasterTab)
  const handleEditDependencies = (task: GanttTask, visibleTasks: GanttTask[]) => {
    setDependencyEditorState({ isOpen: true, task, visibleTasks });
  };

  // Save dependencies (same API pattern as ScheduleMasterTab, but for sm_tasks)
  const handleDependencyEditorSave = async (
    taskId: string,
    predecessors: Array<{ taskNumber: number; type: string; lag: number }>,
    successors: Array<{ taskNumber: number; type: string; lag: number }>
  ) => {
    try {
      // Convert to API format: [{id: taskNumber, type: "FS", lag: 0}]
      const predecessorIds = predecessors.map((p) => ({
        id: p.taskNumber,
        type: p.type,
        lag: p.lag,
      }));

      // Update this task's predecessors
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: { predecessor_ids: predecessorIds },
      });

      // Update each successor's predecessor_ids to include this task
      const currentTask = tasks.find((t) => t.id === taskId);
      const currentTaskNumber = currentTask?.rowData?.task_number;

      if (currentTaskNumber) {
        for (const succ of successors) {
          const successorTask = tasks.find(
            (t) => t.rowData?.task_number === succ.taskNumber
          );
          if (successorTask) {
            const existingPreds = (successorTask.rowData?.predecessor_ids || []) as Array<{
              id: number;
              type: string;
              lag: number;
            }>;
            // Add this task as a predecessor if not already there
            const hasThisPred = existingPreds.some((p) => p.id === currentTaskNumber);
            if (!hasThisPred) {
              const newPreds = [
                ...existingPreds,
                { id: currentTaskNumber, type: succ.type, lag: succ.lag },
              ];
              await api.patch(`/api/v1/sm_tasks/${successorTask.id}`, {
                sm_task: { predecessor_ids: newPreds },
              });
            }
          }
        }
      }

      toast({
        title: 'Dependencies Saved',
        description: 'Task dependencies have been updated',
      });

      // Reload data
      const ganttResponse = await api.get<GanttDataResponse>(
        `/api/v1/jobs/${jobId}/sm_tasks/gantt_data`
      );
      if (ganttResponse) {
        const data = (ganttResponse as any).gantt_data || ganttResponse;
        const rows = data.tasks || data.rows || [];
        const deps = data.dependencies || [];
        const today = getTodayInCompanyTimezone();
        setTasks(convertRowsToTasks(rows as SmScheduleMaster[], today));
        setDependencies(
          deps.map((dep: any) => ({
            id: dep.id,
            fromId: dep.from_id,
            toId: dep.to_id,
            type: dep.type,
            lag: dep.lag,
          }))
        );
      }

      setDependencyEditorState({ isOpen: false, task: null, visibleTasks: [] });
    } catch (err) {
      console.error('[GanttV2] Failed to save dependencies:', err);
      toast({
        title: 'Error',
        description: 'Failed to save dependencies',
        variant: 'destructive',
      });
    }
  };

  const handleCheckboxToggle = (taskId: string, field: string, checked: boolean) => {
    console.log('[GanttV2] Checkbox toggled:', { taskId, field, checked });

    // Update local state optimistically
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId && task.rowData) {
          return {
            ...task,
            rowData: {
              ...task.rowData,
              [field]: checked,
            },
          };
        }
        return task;
      })
    );

    toast({
      title: 'Status Updated',
      description: `${field} ${checked ? 'checked' : 'unchecked'}`,
    });
  };

  // SSoT: POST /api/v1/jobs/{jobId}/sm_tasks/validate_dates
  // Reuses SmRolloverJob (THE ONE rollover implementation)
  const handleRollover = async () => {
    try {
      const result = await api.post<{ success: boolean; rolled_over: number; extended: number; cascaded: number }>(
        `/api/v1/jobs/${jobId}/sm_tasks/validate_dates`
      );

      if (result) {
        const fixCount = (result.rolled_over || 0) + (result.extended || 0);
        if (fixCount > 0) {
          toast({
            title: 'Schedule Updated',
            description: `${fixCount} task(s) with past dates moved forward`,
          });
          // Reload data to reflect changes
          const ganttResponse = await api.get<GanttDataResponse>(
            `/api/v1/jobs/${jobId}/sm_tasks/gantt_data`
          );
          if (ganttResponse) {
            const data = (ganttResponse as any).gantt_data || ganttResponse;
            const rows = data.tasks || data.rows || [];
            const deps = data.dependencies || [];
            const today = getTodayInCompanyTimezone();
            setTasks(convertRowsToTasks(rows as SmScheduleMaster[], today));
            setDependencies(deps.map((dep: { id: string; from_id: string; to_id: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag?: number }) => ({
              id: dep.id,
              fromId: dep.from_id,
              toId: dep.to_id,
              type: dep.type,
              lag: dep.lag,
            })));
          }
        } else {
          toast({
            title: 'Schedule Up to Date',
            description: 'No tasks needed to be rolled over',
          });
        }
        return result;
      }
      return null;
    } catch (err) {
      console.error('[GanttV2] Rollover failed:', err);
      toast({
        title: 'Error',
        description: 'Failed to run rollover',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleOpenOldGantt = () => {
    window.open(`/jobs/${jobId}/schedule`, '_blank');
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header job={job} onOpenOldGantt={handleOpenOldGantt} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-muted-foreground">Loading Gantt V2...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header job={job} onOpenOldGantt={handleOpenOldGantt} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => router.refresh()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header job={job} onOpenOldGantt={handleOpenOldGantt} />

      {/* Gantt Chart */}
      <div className="flex-1 min-h-0">
        <GanttUnified
          tasks={tasks}
          dependencies={dependencies}
          jobId={jobId}
          showToolbar={true}
          onTaskClick={handleTaskClick}
          onTaskDoubleClick={handleTaskDoubleClick}
          onCheckboxToggle={handleCheckboxToggle}
          onRollover={handleRollover}
          onEditDependencies={handleEditDependencies}
        />

        {/* Dependency Editor - SSoT: same component as ScheduleMasterTab */}
        <GanttDependencyEditor
          isOpen={dependencyEditorState.isOpen}
          onClose={() => setDependencyEditorState({ isOpen: false, task: null, visibleTasks: [] })}
          task={dependencyEditorState.task}
          tasks={dependencyEditorState.visibleTasks.length > 0 ? dependencyEditorState.visibleTasks : tasks}
          onSave={handleDependencyEditorSave}
        />

        {/* Edit Sheet - SSoT: same pattern as ScheduleMasterTab */}
        <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
          <SheetContent side="right" className="w-[400px] sm:w-[500px]">
            <SheetHeader>
              <SheetTitle>Edit Task</SheetTitle>
              <SheetDescription>
                {editingTask?.name} (Task #{(editingTask?.rowData as SmScheduleMaster)?.task_number})
              </SheetDescription>
            </SheetHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={editForm.duration_days}
                  onChange={(e) => setEditForm({ ...editForm, duration_days: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="po_required"
                  checked={editForm.po_required}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, po_required: !!checked })}
                />
                <Label htmlFor="po_required">PO Required</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="critical_po"
                  checked={editForm.critical_po}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, critical_po: !!checked })}
                />
                <Label htmlFor="critical_po">Critical PO</Label>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setEditSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTask} disabled={saving}>
                {saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Save
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Debug Info */}
      <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span className="font-medium">Gantt V2 (Development)</span>
        {' | '}
        {tasks.length} tasks, {dependencies.length} dependencies
        {' | '}
        <a
          href={`/jobs/${jobId}/schedule`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
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
  onOpenOldGantt: () => void;
}

function Header({ job, onOpenOldGantt }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-lg font-semibold">
            Gantt V2 {job ? `- ${job.name || job.title}` : ''}
          </h1>
          <p className="text-xs text-muted-foreground">
            Unified Canvas Architecture (Development Preview)
          </p>
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
