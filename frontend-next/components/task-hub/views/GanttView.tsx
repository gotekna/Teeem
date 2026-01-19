'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTaskHub, SmTask } from '@/contexts/TaskHubContext';
import { GanttUnified } from '@/components/gantt/GanttUnified';
import { GanttTask, GanttDependency } from '@/lib/gantt/types';
import { TASK_STATUS, type TaskStatus } from '@/lib/constants/task-status';

/**
 * GanttView for Task Hub
 *
 * Uses GanttUnified component for the task timeline view.
 * Converts SmTask to GanttTask format and supports dependencies.
 */
export function GanttView() {
  const router = useRouter();
  const { filteredTasks, expandTask, updateTask } = useTaskHub();

  // Convert SmTask to GanttTask format
  const ganttTasks: GanttTask[] = useMemo(() => {
    return filteredTasks.map(task => ({
      id: String(task.id),
      name: task.name,
      startDate: new Date(task.start_date),
      endDate: new Date(task.end_date),
      progress: task.progress_percentage || 0,
      // SmTask status matches TaskStatus (both use snake_case: not_started, started, completed)
      status: task.status as TaskStatus,
      // Include predecessor_ids for dependency rendering
      predecessorIds: task.predecessor_ids?.map((p: any) => String(p.id || p)) || [],
      // Map SmTask fields to GanttTask
      supplierId: task.supplier_id,
      supplierName: task.supplier_name,
      purchaseOrderId: task.purchase_order_id,
      purchaseOrderNumber: task.purchase_order_number,
      poRequired: task.po_required,
      // Store original task data for reference
      rowData: {
        id: task.id,
        task_number: task.task_number,
        name: task.name,
        start_date: task.start_date,
        end_date: task.end_date,
        duration_days: task.duration_days,
        status: task.status,
        assigned_user_id: task.assigned_user_id,
        assigned_user_name: task.assigned_user_name,
        assigned_role: task.assigned_role,
        construction_id: task.construction_id,
        job_name: task.job_name,
        predecessor_ids: task.predecessor_ids,
      } as any,
    }));
  }, [filteredTasks]);

  // Build dependencies from predecessor_ids
  // For non-job tasks, we use the task id directly instead of task_number
  const dependencies: GanttDependency[] = useMemo(() => {
    const deps: GanttDependency[] = [];

    filteredTasks.forEach(task => {
      if (task.predecessor_ids && Array.isArray(task.predecessor_ids)) {
        task.predecessor_ids.forEach((pred: any) => {
          // For non-job tasks, predecessor id refers to task id directly
          // For job tasks, it refers to task_number within the job
          const predId = pred.id || pred;
          const predType = pred.type || 'FS';
          const predLag = pred.lag || 0;

          // Find the predecessor task
          let predecessorTask: SmTask | undefined;

          if (task.construction_id > 0) {
            // Job task - find by task_number within same job
            predecessorTask = filteredTasks.find(t =>
              t.construction_id === task.construction_id && t.task_number === predId
            );
          } else {
            // Non-job task - find by task id directly
            predecessorTask = filteredTasks.find(t => t.id === predId);
          }

          if (predecessorTask) {
            deps.push({
              id: `${predecessorTask.id}_${task.id}`,
              fromId: String(predecessorTask.id),
              toId: String(task.id),
              type: predType as 'FS' | 'FF' | 'SS' | 'SF',
              lag: predLag,
            });
          }
        });
      }
    });

    return deps;
  }, [filteredTasks]);

  // Handle task click - expand the task inline
  const handleTaskClick = useCallback((task: GanttTask) => {
    const taskId = parseInt(task.id, 10);
    if (!isNaN(taskId)) {
      expandTask(taskId);
    }
  }, [expandTask]);

  // Handle task double-click - open in fullscreen
  const handleTaskDoubleClick = useCallback((task: GanttTask) => {
    const taskId = parseInt(task.id, 10);
    if (!isNaN(taskId)) {
      router.push(`/sm_tasks/${taskId}`);
    }
  }, [router]);

  // Handle dependency create
  const handleDependencyCreate = useCallback(async (fromId: string, toId: string, type: string) => {
    const successorTask = filteredTasks.find(t => t.id === parseInt(toId));
    const predecessorTask = filteredTasks.find(t => t.id === parseInt(fromId));

    if (!successorTask || !predecessorTask) return;

    // Add the new predecessor to the successor's predecessor_ids
    const currentPredecessors = successorTask.predecessor_ids || [];
    const newPredecessor = {
      id: predecessorTask.construction_id > 0 ? predecessorTask.task_number : predecessorTask.id,
      type: type || 'FS',
      lag: 0,
    };

    // Check if already exists
    const exists = currentPredecessors.some((p: any) =>
      (p.id || p) === newPredecessor.id
    );

    if (!exists) {
      await updateTask(successorTask.id, {
        predecessor_ids: [...currentPredecessors, newPredecessor],
      });
    }
  }, [filteredTasks, updateTask]);

  // Handle dependency delete
  const handleDependencyDelete = useCallback(async (dependencyId: string) => {
    // dependencyId format: "fromId_toId"
    const [fromIdStr, toIdStr] = dependencyId.split('_');
    const fromId = parseInt(fromIdStr);
    const toId = parseInt(toIdStr);

    const successorTask = filteredTasks.find(t => t.id === toId);
    const predecessorTask = filteredTasks.find(t => t.id === fromId);

    if (!successorTask || !predecessorTask) return;

    const currentPredecessors = successorTask.predecessor_ids || [];
    const predIdToRemove = predecessorTask.construction_id > 0
      ? predecessorTask.task_number
      : predecessorTask.id;

    const newPredecessors = currentPredecessors.filter((p: any) =>
      (p.id || p) !== predIdToRemove
    );

    await updateTask(successorTask.id, {
      predecessor_ids: newPredecessors,
    });
  }, [filteredTasks, updateTask]);

  if (filteredTasks.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center border rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground">No tasks to display in Gantt view</p>
      </div>
    );
  }

  return (
    <div className="h-[500px]">
      <GanttUnified
        tasks={ganttTasks}
        dependencies={dependencies}
        showToolbar={true}
        onTaskClick={handleTaskClick}
        onTaskDoubleClick={handleTaskDoubleClick}
        onDependencyCreate={handleDependencyCreate}
        onDependencyDelete={handleDependencyDelete}
        className="h-full"
      />
    </div>
  );
}

export default GanttView;
